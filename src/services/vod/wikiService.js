import { vodCache } from "../../utils/vodCache";

// Helper gọi 1 endpoint Wikipedia và trích xuất thumbnail URL
const queryImageFromEndpoint = async (endpoint) => {
    try {
        const res = await fetch(endpoint);
        if (!res.ok) return null;

        const data = await res.json();
        const pages = data.query?.pages || {};

        for (const pageId in pages) {
            const thumbnailSrc = pages[pageId]?.thumbnail?.source;
            if (thumbnailSrc) return thumbnailSrc;
        }
        return null;
    } catch {
        return null;
    }
};

// Helper tạo danh sách endpoint Wikipedia theo thứ tự ưu tiên
const buildWikiEndpoints = (name) => {
    const encoded = encodeURIComponent(name);
    return [
        `https://vi.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=pageimages&format=json&pithumbsize=600&origin=*`,
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=pageimages&format=json&pithumbsize=600&origin=*`,
    ];
};

/**
 * Service tra cứu hình ảnh avatar diễn viên từ Wikipedia / Wikimedia Commons API
 */
class WikiService {
    constructor() {
        this.memoryCache = new Map();
    }

    /**
     * Lấy URL hình ảnh chân dung chất lượng cao của diễn viên từ Wikipedia
     * @param {string} actorName Tên diễn viên
     * @returns {Promise<string|null>}
     */
    async fetchWikiActorImage(actorName) {
        if (!actorName || typeof actorName !== "string") return null;

        const cleanName = actorName.trim();
        if (!cleanName) return null;

        const cacheKey = `wiki_actor_avatar_${cleanName.toLowerCase()}`;

        if (this.memoryCache.has(cacheKey)) {
            return this.memoryCache.get(cacheKey);
        }

        const cached = vodCache.get(cacheKey);
        if (cached !== null && cached !== undefined) {
            this.memoryCache.set(cacheKey, cached.url || null);
            return cached.url || null;
        }

        const endpoints = buildWikiEndpoints(cleanName);
        let imageUrl = null;

        for (const endpoint of endpoints) {
            imageUrl = await queryImageFromEndpoint(endpoint);
            if (imageUrl) break;
        }

        this.memoryCache.set(cacheKey, imageUrl);
        vodCache.set(cacheKey, { url: imageUrl }, 7 * 24 * 60 * 60 * 1000);

        return imageUrl;
    }
}

export const wikiService = new WikiService();
