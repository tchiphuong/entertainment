import { SOURCES } from "../../constants/vodConstants";
import { vodCache } from "../../utils/vodCache";

const CONFIG = {
    APP_DOMAIN_SOURCE_K: import.meta.env.VITE_SOURCE_K_API,
    APP_DOMAIN_SOURCE_C: import.meta.env.VITE_SOURCE_C_API,
    APP_DOMAIN_SOURCE_O: import.meta.env.VITE_SOURCE_O_API,
    API_ENDPOINT: import.meta.env.VITE_API_ENDPOINT,
};

// Logic cache đã được chuyển sang src/utils/vodCache.js
const { get: getFromCache, set: saveToCache, clear: clearVodCache } = vodCache;

// Normalize movie fields (shared logic)
const normalizeMovieForSource = (item, source) => {
    if (!item) return null;
    const m = { ...item };
    m.source = source;

    if (source === SOURCES.SOURCE_O) {
        m.name = m.name || m.origin_name;
        m.poster_url = item.thumb_url;
        m.thumb_url = item.poster_url || "";
        [m.poster_url, m.thumb_url].forEach((path, idx) => {
            if (
                path &&
                typeof path === "string" &&
                !path.startsWith("http") &&
                !path.startsWith("uploads/movies/")
            ) {
                if (idx === 0) m.poster_url = `uploads/movies/${path}`;
                else m.thumb_url = `uploads/movies/${path}`;
            }
        });
    } else if (source === SOURCES.SOURCE_C) {
        // NguonC bị ngược: poster_url là ảnh ngang, thumb_url là ảnh dọc
        m.poster_url = item.thumb_url;
        m.thumb_url = item.poster_url;
    } else if (source === SOURCES.SOURCE_K) {
        m.poster_url = item.poster_url;
        m.thumb_url = item.thumb_url;
    }

    m.thumbnail = m.thumb_url || "";
    m.poster = m.poster_url || "";
    m.year = m.year || (m.time ? new Date(m.time).getFullYear() : null);

    return m;
};

export const fetchSourceData = async (slug, source) => {
    const cacheKey = `${source}_${slug}`;
    const cachedData = getFromCache(cacheKey);
    if (cachedData) return cachedData;

    let url = "";
    if (source === SOURCES.SOURCE_O) {
        url = `${CONFIG.APP_DOMAIN_SOURCE_O}/v1/api/phim/${slug}`;
    } else if (source === SOURCES.SOURCE_K) {
        url = `${CONFIG.APP_DOMAIN_SOURCE_K}/phim/${slug}`;
    } else if (source === SOURCES.SOURCE_C) {
        url = `${CONFIG.APP_DOMAIN_SOURCE_C}/api/film/${slug}`;
    } else {
        url = `${CONFIG.API_ENDPOINT}/${slug}`;
    }

    try {
        const res = await fetch(url);
        if (!res.ok) {
            const emptyResult = { movie: null, episodes: [] };
            // Cache 404 để tránh gọi lại API liên tục
            saveToCache(cacheKey, emptyResult);
            return emptyResult;
        }
        const json = await res.json();

        let movieData = null;
        let episodesData = [];

        if (source === SOURCES.SOURCE_O) {
            if (json.data?.item) {
                movieData = normalizeMovieForSource(json.data.item, source);
                episodesData = json.data.item.episodes || [];
            }
        } else if (json.movie) {
            movieData = normalizeMovieForSource(json.movie, source);
            episodesData = json.episodes || [];
        }

        const result = { movie: movieData, episodes: episodesData };
        // Negative caching: Lưu cả khi không có movieData để tránh gọi lại API liên tục cho các slug không tồn tại
        saveToCache(cacheKey, result);
        return result;
    } catch (e) {
        console.error(`Error fetching ${source} data:`, e);
        // Cache lại lỗi để tránh retry liên tục trong phiên làm việc
        const errorResult = { movie: null, episodes: [] };
        saveToCache(cacheKey, errorResult);
        return errorResult;
    }
};

export const fetchTMDbData = async (
    tmdbId,
    type = "movie",
    language = "vi-VN",
) => {
    const apiKey = import.meta.env.VITE_TMDB_API_KEY;
    const baseUrl = import.meta.env.VITE_TMDB_BASE_URL;
    const cacheKey = `tmdb_${type}_${tmdbId}_${language}`;

    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    try {
        const [detailsRes] = await Promise.all([
            fetch(
                `${baseUrl}/${type}/${tmdbId}?api_key=${apiKey}&language=${language}&append_to_response=external_ids,credits,images,videos&include_image_language=vi,null,en`,
            ),
        ]);

        const [details] = await Promise.all([
            detailsRes.ok ? detailsRes.json() : null,
        ]);

        const result = { details };
        if (details) saveToCache(cacheKey, result);
        return result;
    } catch (e) {
        console.error("Error fetching TMDB data:", e);
        return null;
    }
};

export const fetchTMDBSeason = async (
    tmdbId,
    seasonNumber,
    language = "vi-VN",
) => {
    const apiKey = import.meta.env.VITE_TMDB_API_KEY;
    const baseUrl = import.meta.env.VITE_TMDB_BASE_URL;
    const cacheKey = `tmdb_season_${tmdbId}_${seasonNumber}_${language}`;

    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    try {
        const res = await fetch(
            `${baseUrl}/tv/${tmdbId}/season/${seasonNumber}?api_key=${apiKey}&language=${language}`,
        );
        if (!res.ok) return null;
        const data = await res.json();
        saveToCache(cacheKey, data);
        return data;
    } catch (e) {
        console.error("Error fetching TMDB season data:", e);
        return null;
    }
};

export const fetchFanartLogo = async (imdbId) => {
    const apiKey = "cfa9dc054d221b8d107f8411cd20b13f"; // Fanart API Key
    const cacheKey = `fanart_logo_${imdbId}`;

    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    try {
        const res = await fetch(
            `https://webservice.fanart.tv/v3/movies/${imdbId}?api_key=${apiKey}`,
        );
        if (!res.ok) return null;
        const data = await res.json();
        saveToCache(cacheKey, data);
        return data;
    } catch (e) {
        console.error("Error fetching Fanart logo:", e);
        return null;
    }
};

export const vodService = {
    fetchSourceData,
    fetchTMDbData,
    fetchTMDBSeason,
    fetchFanartLogo,
    normalizeMovieForSource,
    getFromCache,
    saveToCache,
    clearVodCache,
};
