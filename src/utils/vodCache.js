import { smartCache, CACHE_TTL } from "./smartCache";

export const getFromCache = (key, allowStale = false) => {
    return smartCache.get(key, allowStale);
};

export const saveToCache = (key, data, ttl = CACHE_TTL.LISTING) => {
    smartCache.set(key, data, ttl);
};

export const clearVodCache = () => {
    smartCache.clear();
    console.log("VOD Smart Cache cleared");
};

export const vodCache = {
    get: getFromCache,
    set: saveToCache,
    clear: clearVodCache,
    fetchWithCache: (options) => smartCache.fetchWithCache(options),
    getStats: () => smartCache.getStats(),
    TTL: {
        DETAIL: CACHE_TTL.DETAIL,
        LISTING: CACHE_TTL.LISTING,
        METADATA: CACHE_TTL.STATIC_METADATA,
        SHORT: CACHE_TTL.SHORT,
    },
};
