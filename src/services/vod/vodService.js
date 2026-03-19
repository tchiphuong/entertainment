import { SOURCES } from "../../constants/vodConstants";

const CONFIG = {
    APP_DOMAIN_SOURCE_K: import.meta.env.VITE_SOURCE_K_API,
    APP_DOMAIN_SOURCE_C: import.meta.env.VITE_SOURCE_C_API,
    APP_DOMAIN_SOURCE_O: import.meta.env.VITE_SOURCE_O_API,
    API_ENDPOINT: import.meta.env.VITE_API_ENDPOINT,
};

const CACHE_PREFIX = "vod_data_";
const CACHE_TTL = 3600000; // 1 hour

const getFromCache = (key) => {
    try {
        const cached = localStorage.getItem(CACHE_PREFIX + key);
        if (!cached) return null;
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp > CACHE_TTL) {
            localStorage.removeItem(CACHE_PREFIX + key);
            return null;
        }
        return data;
    } catch (e) {
        return null;
    }
};

const saveToCache = (key, data) => {
    try {
        localStorage.setItem(
            CACHE_PREFIX + key,
            JSON.stringify({ data, timestamp: Date.now() }),
        );
    } catch (e) {}
};

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
    } else if (source === SOURCES.SOURCE_K || source === SOURCES.SOURCE_C) {
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
        if (!res.ok) return null;
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
        if (movieData) saveToCache(cacheKey, result);
        return result;
    } catch (e) {
        console.error(`Error fetching ${source} data:`, e);
        return null;
    }
};

export const fetchTMDbData = async (tmdbId, type = "movie", language = "vi-VN") => {
    const apiKey = import.meta.env.VITE_TMDB_API_KEY;
    const baseUrl = import.meta.env.VITE_TMDB_BASE_URL;
    const cacheKey = `tmdb_${type}_${tmdbId}_${language}`;
    
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    try {
        const [detailsRes, creditsRes, imagesRes, videosRes] = await Promise.all([
            fetch(`${baseUrl}/${type}/${tmdbId}?api_key=${apiKey}&language=${language}`),
            fetch(`${baseUrl}/${type}/${tmdbId}/credits?api_key=${apiKey}&language=${language}`),
            fetch(`${baseUrl}/${type}/${tmdbId}/images?api_key=${apiKey}`),
            fetch(`${baseUrl}/${type}/${tmdbId}/videos?api_key=${apiKey}&language=${language}`)
        ]);

        const [details, credits, images, videos] = await Promise.all([
            detailsRes.ok ? detailsRes.json() : null,
            creditsRes.ok ? creditsRes.json() : null,
            imagesRes.ok ? imagesRes.json() : null,
            videosRes.ok ? videosRes.json() : null
        ]);

        const result = { details, credits, images, videos };
        if (details) saveToCache(cacheKey, result);
        return result;
    } catch (e) {
        console.error("Error fetching TMDB data:", e);
        return null;
    }
};

export const vodService = {
    fetchSourceData,
    fetchTMDbData,
    normalizeMovieForSource,
};
