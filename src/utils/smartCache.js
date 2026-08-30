/**
 * SmartCache - Hệ thống Cache Thông Minh Đa Tầng (Multi-tier Smart Caching)
 * 
 * Tính năng nổi bật:
 * 1. Đa tầng (Multi-tier):
 *    - L1 Cache: In-Memory RAM (Map) - Tốc độ 0ms, truy xuất siêu tốc.
 *    - L2 Cache: Persistent Storage (localStorage) - Bền bỉ qua các phiên F5/reload.
 * 2. Request Deduplication: Gom các request trùng lặp đang xử lý thành 1 Promise duy nhất.
 * 3. SWR (Stale-While-Revalidate): Trả về cache tức thì, âm thầm revalidate cập nhật nền.
 * 4. LRU Eviction & Quota Safety: Tự động dọn dẹp các cache cũ/hết hạn khi đầy bộ nhớ, chống crash app.
 */

import { LRUCache } from "lru-cache";
import { CACHE_TTL, CACHE_PREFIX, MAX_MEMORY_ITEMS } from "../constants";

export { CACHE_TTL };

class SmartCacheManager {
    constructor() {
        // L1: In-Memory LRU Cache sử dụng thư viện chuẩn lru-cache
        this.memoryCache = new LRUCache({
            max: MAX_MEMORY_ITEMS,
            ttl: CACHE_TTL.LISTING,
            allowStale: true,
            updateAgeOnGet: true,
        });
        // In-flight request deduplication map
        this.inflightRequests = new Map();
        // Thống kê hiệu năng cache
        this.stats = {
            hits: 0,
            misses: 0,
            swrUpdates: 0,
        };
    }

    /**
     * Tạo khóa lưu trữ chuẩn hóa
     */
    getStorageKey(key) {
        return CACHE_PREFIX + key;
    }

    /**
     * Lấy dữ liệu từ Cache (Ưu tiên L1 -> L2)
     * @param {string} key 
     * @param {boolean} allowStale - Có chấp nhận dữ liệu cũ nếu hết hạn không (dùng cho SWR)
     */
    get(key, allowStale = false) {
        // 1. Kiểm tra L1 LRU Memory Cache từ thư viện
        const memoryVal = this.memoryCache.get(key, { allowStale });
        if (memoryVal !== undefined) {
            this.stats.hits++;
            return memoryVal;
        }

        // 2. Kiểm tra L2 LocalStorage
        try {
            const raw = localStorage.getItem(this.getStorageKey(key));
            if (!raw) {
                this.stats.misses++;
                return null;
            }

            const entry = JSON.parse(raw);
            const now = Date.now();
            const isExpired = now - entry.timestamp > (entry.ttl || CACHE_TTL.LISTING);

            if (!isExpired || allowStale) {
                // Nạp ngược lại vào L1 Memory Cache để lần sau đọc nhanh hơn
                this.memoryCache.set(key, entry.data, { ttl: entry.ttl || CACHE_TTL.LISTING });
                this.stats.hits++;
                return entry.data;
            }

            // Xóa item hết hạn khỏi L2
            localStorage.removeItem(this.getStorageKey(key));
        } catch {
            // Lỗi parse JSON hoặc localStorage bị chặn
        }

        this.stats.misses++;
        return null;
    }

    /**
     * Lưu dữ liệu vào cả L1 và L2
     */
    set(key, data, ttl = CACHE_TTL.LISTING) {
        if (data === undefined || data === null) return;

        // 1. Lưu vào L1 LRU Cache qua thư viện
        this.memoryCache.set(key, data, { ttl });

        // 2. Lưu vào L2 an toàn với Quota Manager
        const now = Date.now();
        const entry = {
            data,
            timestamp: now,
            ttl,
            lastAccessed: now,
        };
        this.setStorage(key, entry);
    }

    /**
     * Quản lý lưu L2 với cơ chế giải phóng dung lượng thông minh
     */
    setStorage(key, entry) {
        const storageKey = this.getStorageKey(key);
        try {
            localStorage.setItem(storageKey, JSON.stringify(entry));
        } catch (e) {
            // Xử lý QuotaExceededError
            if (e.name === "QuotaExceededError" || e.code === 22) {
                this.evictStorage();
                try {
                    localStorage.setItem(storageKey, JSON.stringify(entry));
                } catch {
                    // Nếu vẫn không đủ chỗ, bỏ qua lưu persistent
                }
            }
        }
    }

    collectStorageEntries(now) {
        const entries = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k || !k.startsWith(CACHE_PREFIX)) continue;

            try {
                const raw = localStorage.getItem(k);
                if (!raw) continue;
                const parsed = JSON.parse(raw);
                if (now - parsed.timestamp > (parsed.ttl || 0)) {
                    localStorage.removeItem(k);
                } else {
                    entries.push({ key: k, lastAccessed: parsed.lastAccessed || parsed.timestamp });
                }
            } catch {
                localStorage.removeItem(k);
            }
        }
        return entries;
    }

    /**
     * Dọn dẹp bộ nhớ Storage khi chạm ngưỡng Quota
     */
    evictStorage() {
        const entries = this.collectStorageEntries(Date.now());
        if (entries.length <= 50) return;

        entries.sort((a, b) => a.lastAccessed - b.lastAccessed);
        const toRemove = Math.ceil(entries.length * 0.25);
        for (let i = 0; i < toRemove; i++) {
            localStorage.removeItem(entries[i].key);
        }
    }

    /**
     * Xóa một key cụ thể
     */
    remove(key) {
        this.memoryCache.delete(key);
        try {
            localStorage.removeItem(this.getStorageKey(key));
        } catch {}
    }

    /**
     * Xóa toàn bộ cache thuộc SmartCache
     */
    clear() {
        this.memoryCache.clear();
        this.inflightRequests.clear();
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(CACHE_PREFIX)) {
                    keysToRemove.push(k);
                }
            }
            keysToRemove.forEach((k) => localStorage.removeItem(k));
        } catch {}
    }

    /**
     * Fetch with Smart Cache & Request Deduplication & SWR
     * @param {object} options
     * @param {string} options.key - Unique cache key
     * @param {Function} options.fetcher - Async function fetch data
     * @param {number} options.ttl - Cache duration
     * @param {boolean} options.swr - Kích hoạt Stale-While-Revalidate
     */
    async fetchWithCache({ key, fetcher, ttl = CACHE_TTL.LISTING, swr = true }) {
        if (!key || typeof fetcher !== "function") return null;

        // 1. Kiểm tra cache có sẵn
        const cachedData = this.get(key, swr);

        // Nếu có cache và bật SWR: trả ngay cache, chạy fetcher ngầm để cập nhật
        if (cachedData !== null) {
            if (swr) {
                this.revalidateInBackground(key, fetcher, ttl);
            }
            return cachedData;
        }

        // 2. Request Deduplication: Nếu cùng 1 key đang có request đang bay, tái sử dụng Promise đó
        if (this.inflightRequests.has(key)) {
            return this.inflightRequests.get(key);
        }

        // 3. Thực thi gọi API mới
        const requestPromise = (async () => {
            try {
                const data = await fetcher();
                if (data !== undefined && data !== null && !data.isError) {
                    this.set(key, data, ttl);
                }
                return data;
            } finally {
                this.inflightRequests.delete(key);
            }
        })();

        this.inflightRequests.set(key, requestPromise);
        return requestPromise;
    }

    /**
     * Chạy revalidate ngầm không chặn luồng UI
     */
    async revalidateInBackground(key, fetcher, ttl) {
        if (this.inflightRequests.has(key)) return;

        const bgPromise = (async () => {
            try {
                const freshData = await fetcher();
                if (freshData !== undefined && freshData !== null && !freshData.isError) {
                    this.set(key, freshData, ttl);
                    this.stats.swrUpdates++;
                }
            } catch {
                // Nuốt lỗi nền, giữ nguyên data cache cũ an toàn cho UI
            } finally {
                this.inflightRequests.delete(key);
            }
        })();

        this.inflightRequests.set(key, bgPromise);
    }

    /**
     * Lấy báo cáo thống kê hiệu suất cache
     */
    getStats() {
        return {
            ...this.stats,
            memoryEntries: this.memoryCache.size,
            inflightRequests: this.inflightRequests.size,
            hitRate: this.stats.hits + this.stats.misses > 0
                ? ((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(1) + "%"
                : "0%",
        };
    }
}

export const smartCache = new SmartCacheManager();
