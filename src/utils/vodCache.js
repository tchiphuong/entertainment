const CACHE_PREFIX = "vod_data_";
const CACHE_TTL = 3600000; // 1 giờ mặc định cho chi tiết phim
const LISTING_CACHE_TTL = 600000; // 10 phút mặc định cho danh sách phim

export const getFromCache = (key) => {
    try {
        const cached = localStorage.getItem(CACHE_PREFIX + key);
        if (!cached) return null;
        const { data, timestamp, ttl } = JSON.parse(cached);
        const currentTTL = ttl || CACHE_TTL;
        if (Date.now() - timestamp > currentTTL) {
            localStorage.removeItem(CACHE_PREFIX + key);
            return null;
        }
        return data;
    } catch (e) {
        return null;
    }
};

export const saveToCache = (key, data, ttl = CACHE_TTL) => {
    try {
        localStorage.setItem(
            CACHE_PREFIX + key,
            JSON.stringify({ data, timestamp: Date.now(), ttl }),
        );
    } catch (e) {}
};

export const clearVodCache = () => {
    try {
        Object.keys(localStorage).forEach((key) => {
            if (key.startsWith(CACHE_PREFIX)) {
                localStorage.removeItem(key);
            }
        });
        console.log("VOD Cache cleared");
    } catch (e) {}
};

export const vodCache = {
    get: getFromCache,
    set: saveToCache,
    clear: clearVodCache,
    TTL: {
        DETAIL: CACHE_TTL,
        LISTING: LISTING_CACHE_TTL
    }
};
