import { SOURCES } from "../../constants";
import { vodCache } from "../../utils/vodCache";
import { fetchTMDBRelated, fetchTMDBJson } from "./tmdbService";

const CONFIG = {
    APP_DOMAIN_SOURCE_K: import.meta.env.VITE_SOURCE_K_API,
    APP_DOMAIN_SOURCE_C: import.meta.env.VITE_SOURCE_C_API,
    APP_DOMAIN_SOURCE_O: import.meta.env.VITE_SOURCE_O_API,
    API_ENDPOINT: import.meta.env.VITE_API_ENDPOINT,
};

// Logic cache đã được chuyển sang src/utils/vodCache.js
const { get: getFromCache, set: saveToCache, clear: clearVodCache } = vodCache;

// Fix đường dẫn ảnh cục bộ Source O
const fixSourceOImagePath = (path) => {
    if (
        path &&
        typeof path === "string" &&
        !path.startsWith("http") &&
        !path.startsWith("uploads/movies/")
    ) {
        return `uploads/movies/${path}`;
    }
    return path;
};

// Normalize movie fields (shared logic)
const normalizeMovieForSource = (item, source) => {
    if (!item) return null;
    const m = { ...item };
    m.source = source;

    if (source === SOURCES.SOURCE_O) {
        m.name = m.name || m.origin_name;
        m.poster_url = fixSourceOImagePath(item.thumb_url);
        m.thumb_url = fixSourceOImagePath(item.poster_url || "");
    } else if (source === SOURCES.SOURCE_C) {
        // Source C: poster_url là ảnh ngang, thumb_url là ảnh dọc
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

// Tạo URL gọi API theo nguồn & TMDB ID
const getSourceApiUrl = (slug, source, tmdbId, mediaType = "movie") => {
    if (tmdbId && (source === SOURCES.SOURCE_K || source === SOURCES.SOURCE_O)) {
        const domain = source === SOURCES.SOURCE_O ? CONFIG.APP_DOMAIN_SOURCE_O : CONFIG.APP_DOMAIN_SOURCE_K;
        const typeEndpoint = mediaType === "tv" ? "tv" : "movie";
        return `${domain}/tmdb/${typeEndpoint}/${tmdbId}`;
    }
    if (source === SOURCES.SOURCE_O) {
        return `${CONFIG.APP_DOMAIN_SOURCE_O}/v1/api/phim/${slug}`;
    }
    if (source === SOURCES.SOURCE_K) {
        return `${CONFIG.APP_DOMAIN_SOURCE_K}/phim/${slug}`;
    }
    if (source === SOURCES.SOURCE_C) {
        return `${CONFIG.APP_DOMAIN_SOURCE_C}/api/film/${slug}`;
    }
    return `${CONFIG.API_ENDPOINT}/${slug}`;
};

// Gọi fetch và fallback thông minh giữa movie và tv nếu bị 404
const fetchSourceResponse = async (slug, source, tmdbId, mediaType = null) => {
    const preferredType = mediaType || "movie";
    const alternateType = preferredType === "tv" ? "movie" : "tv";

    const url = getSourceApiUrl(slug, source, tmdbId, preferredType);
    let res = await fetch(url);

    if (!res.ok && tmdbId && (source === SOURCES.SOURCE_K || source === SOURCES.SOURCE_O)) {
        const domain = source === SOURCES.SOURCE_O ? CONFIG.APP_DOMAIN_SOURCE_O : CONFIG.APP_DOMAIN_SOURCE_K;
        const altRes = await fetch(`${domain}/tmdb/${alternateType}/${tmdbId}`);
        if (altRes.ok) {
            res = altRes;
        }
    }
    return res;
};

// Parse JSON trả về cấu trúc chuẩn { movie, episodes }
const parseSourceJson = (json, source) => {
    let movieData = null;
    let episodesData = [];

    if (source === SOURCES.SOURCE_O && json.data?.item) {
        movieData = normalizeMovieForSource(json.data.item, source);
        episodesData = json.data.item.episodes || [];
    } else if (json.movie) {
        movieData = normalizeMovieForSource(json.movie, source);
        episodesData = json.episodes || [];
    }

    return { movie: movieData, episodes: episodesData };
};

const resolveTmdbParams = (slug, explicitTmdbId, explicitMediaType) => {
    if (explicitTmdbId === "movie" || explicitTmdbId === "tv") {
        return { tmdbId: null, mediaType: explicitTmdbId };
    }

    let tmdbId = explicitTmdbId;
    const isTmdbSlug =
        (typeof slug === "string" && slug.startsWith("tmdb-")) ||
        /^\d+$/.test(String(slug).trim());
    if (!tmdbId && isTmdbSlug) {
        tmdbId = String(slug)
            .replace(/^tmdb-/, "")
            .replace(/^(movie|tv)-/, "")
            .trim();
    }
    return { tmdbId, mediaType: explicitMediaType };
};

const isInvalidSourceCRequest = (source, slug) => {
    return source === SOURCES.SOURCE_C && (/^\d+$/.test(String(slug).trim()) || !slug);
};

export const fetchSourceData = async (
    slug,
    source,
    explicitTmdbId = null,
    explicitMediaType = null,
) => {
    if (isInvalidSourceCRequest(source, slug)) {
        return { movie: null, episodes: [] };
    }

    const { tmdbId, mediaType } = resolveTmdbParams(slug, explicitTmdbId, explicitMediaType);
    const cacheKey = tmdbId
        ? `${source}_tmdb_${mediaType || "movie"}_${tmdbId}`
        : `${source}_slug_${slug}`;
    const cachedData = getFromCache(cacheKey);
    if (cachedData) return cachedData;

    try {
        const res = await fetchSourceResponse(slug, source, tmdbId, mediaType);
        if (!res.ok) {
            return { movie: null, episodes: [] };
        }

        const json = await res.json();
        const result = parseSourceJson(json, source);

        if (result?.movie) {
            saveToCache(cacheKey, result);
        }
        return result;
    } catch (e) {
        console.error(`Error fetching ${source} data:`, e);
        return { movie: null, episodes: [] };
    }
};

export const fetchTMDbData = async (
    tmdbId,
    type = "movie",
    language = "vi-VN",
) => {
    const baseUrl = import.meta.env.VITE_TMDB_BASE_URL || "https://api.themoviedb.org/3";
    const resolvedType = type || "movie";
    const cacheKey = `tmdb_${resolvedType}_${tmdbId}_${language}`;

    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    try {
        let details = await fetchTMDBJson(
            (apiKey) => `${baseUrl}/${resolvedType}/${tmdbId}?api_key=${apiKey}&language=${language}&append_to_response=external_ids,credits,images,videos&include_image_language=vi,null,en`,
        );

        if (!details && resolvedType === "movie") {
            details = await fetchTMDBJson(
                (apiKey) => `${baseUrl}/tv/${tmdbId}?api_key=${apiKey}&language=${language}&append_to_response=external_ids,credits,images,videos&include_image_language=vi,null,en`,
            );
        } else if (!details && resolvedType === "tv") {
            details = await fetchTMDBJson(
                (apiKey) => `${baseUrl}/movie/${tmdbId}?api_key=${apiKey}&language=${language}&append_to_response=external_ids,credits,images,videos&include_image_language=vi,null,en`,
            );
        }

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
    const baseUrl = import.meta.env.VITE_TMDB_BASE_URL || "https://api.themoviedb.org/3";
    const cacheKey = `tmdb_season_${tmdbId}_${seasonNumber}_${language}`;

    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    try {
        const data = await fetchTMDBJson(
            (apiKey) => `${baseUrl}/tv/${tmdbId}/season/${seasonNumber}?api_key=${apiKey}&language=${language}`,
        );
        if (!data) return null;
        saveToCache(cacheKey, data);
        return data;
    } catch (e) {
        console.error("Error fetching TMDB season data:", e);
        return null;
    }
};

export const vodService = {
    fetchSourceData,
    fetchTMDbData,
    fetchTMDBSeason,
    fetchTMDBRelated,
    normalizeMovieForSource,
    getFromCache,
    saveToCache,
    clearVodCache,
};
