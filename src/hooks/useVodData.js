import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
    SOURCES,
    TMDB_IMAGE_BASE_URL,
    TMDB_IMAGE_SIZES,
    TMDB_ENDPOINTS,
    HERO_PRIORITY_SET,
    PAGINATION,
} from "../constants";
import { vodCache } from "../utils/vodCache";
import { tmdbService } from "../services/vod/tmdbService";
import { extractSeasonNumber } from "../utils/vodHelpers";

const CONFIG = {
    APP_DOMAIN_SOURCE_K: import.meta.env.VITE_SOURCE_K_API,
    APP_DOMAIN_SOURCE_K_CDN_IMAGE: import.meta.env.VITE_SOURCE_K_CDN_IMAGE,
    APP_DOMAIN_SOURCE_C: import.meta.env.VITE_SOURCE_C_API,
    APP_DOMAIN_SOURCE_O: import.meta.env.VITE_SOURCE_O_API,
    TMDB_API_KEY: import.meta.env.VITE_TMDB_API_KEY,
    TMDB_BASE_URL: import.meta.env.VITE_TMDB_BASE_URL,
    APP_DOMAIN_SOURCE_R: import.meta.env.VITE_SOURCE_R_API,
};

const normalizeSourceO = (m, item) => {
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
    m.name = m.name || m.origin_name;
};

const normalizeSourceR = (m, item) => {
    m.poster_url = item.thumbnail || item.poster;
    m.thumb_url = item.poster || item.thumbnail || item.banner;
    m.titleLogo = item.image_name;
    m.name = m.name || item.name;
    m.origin_name = m.origin_name || item.origin_name;
    m.quality = item.quality;
    m.year = item.publish_year;
    m.rating = item.imdb_rating || item.rating;
    m.tmdbId = item.tmdb_id;
    m.episode_current = item.episode_current;
    m.content = item.description;
};

const getTmdbImageUrl = (path, size, fallback = "") => {
    if (!path) return fallback;
    return path.startsWith("http") ? path : `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
};

const resolveTmdbName = (item) => item.title || item.name || item.original_title || item.original_name || "";

const resolveTmdbYear = (item) => {
    const releaseDate = item.release_date || item.first_air_date;
    return releaseDate ? new Date(releaseDate).getFullYear() : (item.year || null);
};

const resolveTmdbQuality = (vote, fallbackQuality) => {
    return vote && vote > 0 ? `${Number(vote).toFixed(1)}` : (fallbackQuality || "HD");
};

const normalizeSourceTmdb = (m, item) => {
    m.tmdbId = item.id || item.tmdbId;
    m.name = resolveTmdbName(item);
    m.origin_name = item.original_title || item.original_name || "";
    m.poster_url = getTmdbImageUrl(item.poster_path, TMDB_IMAGE_SIZES.POSTER, item.poster_url || "");
    m.thumb_url = getTmdbImageUrl(item.backdrop_path, TMDB_IMAGE_SIZES.BACKDROP, item.thumb_url || m.poster_url);
    m.slug = item.slug || (item.id ? String(item.id) : "");
    m.year = resolveTmdbYear(item);
    const vote = typeof item.vote_average === "number" ? item.vote_average : item.rating;
    m.quality = resolveTmdbQuality(vote, item.quality);
    m.rating = vote;
    m.lang = item.original_language || item.lang || "en";
    m.content = item.overview || item.content || "";
};

const normalizeSourceC = (m, item) => {
    m.poster_url = item.thumb_url;
    m.thumb_url = item.poster_url;
    m.episode_current = m.current_episode || m.episode_current;
    m.lang = m.language || m.lang;
};

const normalizeSourceK = (m, item) => {
    m.poster_url = item.poster_url;
    m.thumb_url = item.thumb_url;
    m.tmdbId = item.tmdb?.id || item.movie?.tmdb?.id;
};

const applySourceSpecificFields = (m, item, source) => {
    switch (source) {
        case SOURCES.SOURCE_C:
            normalizeSourceC(m, item);
            break;
        case SOURCES.SOURCE_O:
            normalizeSourceO(m, item);
            break;
        case SOURCES.SOURCE_R:
            normalizeSourceR(m, item);
            break;
        case SOURCES.SOURCE_TMDB:
            normalizeSourceTmdb(m, item);
            break;
        case SOURCES.SOURCE_K:
            normalizeSourceK(m, item);
            break;
        default:
            m.poster_url = m.poster_url || m.poster || m.thumbnail || "";
            m.thumb_url = m.thumb_url || m.thumbnail || m.poster || "";
            break;
    }
};

// Normalize movie fields logic
const normalizeMovie = (item, source) => {
    if (!item) return null;
    const m = { ...item, source };
    if (!m.slug && m.movie_slug) m.slug = m.movie_slug;

    applySourceSpecificFields(m, item, source);

    m.thumbnail = m.thumb_url || "";
    m.poster = m.poster_url || "";
    m.quality = m.quality || m.episode_current;
    m.year = m.year || (m.time ? new Date(m.time).getFullYear() : null);
    m.isTrailer =
        m.quality?.toLowerCase().includes("trailer") ||
        m.episode_current?.toLowerCase().includes("trailer");

    return m;
};

const parsePaginateResponse = (json) => ({
    items: json.items,
    totalPages: json.paginate.total_page || 1,
    totalItems: json.paginate.total_item || json.items.length,
    cat: json.cat || null,
});

const parseDataItemsResponse = (json, limit) => {
    const items = json.data.items;
    const pag = json.data.params?.pagination;
    const totalItems = pag?.totalItems || items.length;
    const totalPages = pag?.totalPages || Math.ceil(totalItems / (pag?.totalItemsPerPage || limit));
    return { items, totalPages, totalItems, cat: null };
};

const parseResultResponse = (json, limit) => {
    const items = Array.isArray(json.result) ? json.result : json.result.items || [];
    const totalItems = json.result.total_item || json.result.totalItems || json.result.total_items || items.length;
    const totalPages = json.result.total_page || json.result.totalPages || Math.ceil(totalItems / limit);
    return { items, totalPages, totalItems, cat: null };
};

const parseItemsWithPagination = (json, limit) => {
    const items = json.items;
    const pag = json.pagination || json.data?.pagination;
    const totalItems = pag?.totalItems || items.length;
    const totalPages = pag?.totalPages || Math.ceil(totalItems / (pag?.totalItemsPerPage || limit));
    return { items, totalPages, totalItems, cat: null };
};

// parseApiJson logic
const parseApiJson = (json, limit = 12) => {
    if (!json) return { items: [], totalPages: 1, totalItems: 0, cat: null };

    if (json.paginate && Array.isArray(json.items)) return parsePaginateResponse(json);
    if (json.data?.items && Array.isArray(json.data.items)) return parseDataItemsResponse(json, limit);
    if (json.result) return parseResultResponse(json, limit);
    if (Array.isArray(json.items)) return parseItemsWithPagination(json, limit);
    if (Array.isArray(json.results)) return { items: json.results, totalPages: json.total_pages || 1, totalItems: json.total_results || json.results.length, cat: null };
    if (Array.isArray(json.data)) return { items: json.data, totalPages: 1, totalItems: json.data.length, cat: null };
    if (Array.isArray(json)) return { items: json, totalPages: 1, totalItems: json.length, cat: null };

    return { items: [], totalPages: 1, totalItems: 0, cat: null };
};

const getVodCacheKey = (cat, lang = "vi-VN") => {
    return JSON.stringify({
        id: cat.id,
        type: cat.type,
        useV1: cat.useV1,
        source: cat.source,
        page: cat.page || 1,
        params: cat.params || {},
        limit: cat.limit,
        lang,
    });
};

const buildSourceSearchParams = (cat, page, limit) => {
    const params = new URLSearchParams();
    params.set("page", page);
    if (cat.useV1 || cat.source === SOURCES.SOURCE_R) {
        params.set("limit", limit);
    }
    if (cat.params) {
        for (const [k, v] of Object.entries(cat.params)) {
            params.set(k, v);
        }
    }
    if (cat.params?.keyword || cat.params?.q) {
        params.set("keyword", cat.params.keyword || cat.params.q);
    }
    return params;
};

const buildUrlWithParams = (domain, path, params) => {
    const full = `${domain}${path}`;
    const sep = full.includes("?") ? "&" : "?";
    return `${full}${sep}${params.toString()}`;
};

const buildTmdbCategoryUrl = (cat, tmdbLang, page) => {
    const ep = cat.type ? cat.type.replace(/^\//, "") : TMDB_ENDPOINTS.TRENDING_MOVIE_WEEK;
    const tmdbParams = new URLSearchParams();
    tmdbParams.set("api_key", CONFIG.TMDB_API_KEY);
    tmdbParams.set("language", tmdbLang);
    tmdbParams.set("page", page);
    if (cat.params) {
        for (const [k, v] of Object.entries(cat.params)) {
            if (v !== undefined && v !== null && v !== "") {
                tmdbParams.set(k, v);
            }
        }
    }
    return `${CONFIG.TMDB_BASE_URL}/${ep}?${tmdbParams.toString()}`;
};

const fetchTmdbCategorySection = async (cat, tmdbLang, page, limit) => {
    const tmdbPageSize = PAGINATION.TMDB_PAGE_SIZE;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const startTmdbPage = Math.floor(startIndex / tmdbPageSize) + 1;
    const endTmdbPage = Math.floor((endIndex - 1) / tmdbPageSize) + 1;

    const tmdbPageNumbers = [];
    for (let p = startTmdbPage; p <= endTmdbPage; p++) {
        tmdbPageNumbers.push(p);
    }

    const responses = await Promise.all(
        tmdbPageNumbers.map(async (p) => {
            const url = buildTmdbCategoryUrl(cat, tmdbLang, p);
            const res = await fetch(url);
            if (!res.ok) return { results: [], total_pages: 1, total_results: 0 };
            return res.json();
        })
    );

    let allResults = [];
    let totalResults = 0;
    let maxTmdbPages = PAGINATION.MAX_TMDB_PAGES;

    responses.forEach((json, idx) => {
        if (Array.isArray(json.results)) {
            allResults = allResults.concat(json.results);
        }
        if (idx === 0) {
            totalResults = json.total_results || 0;
            maxTmdbPages = json.total_pages || PAGINATION.MAX_TMDB_PAGES;
        }
    });

    const offsetInFetched = startIndex - (startTmdbPage - 1) * tmdbPageSize;
    const slicedItems = allResults.slice(offsetInFetched, offsetInFetched + limit);
    const effectiveTotalPages = Math.min(
        Math.ceil(totalResults / limit),
        Math.floor((maxTmdbPages * tmdbPageSize) / limit)
    ) || 1;

    return {
        items: slicedItems,
        totalPages: effectiveTotalPages,
        totalItems: totalResults,
        cat: null,
    };
};

// Helper tạo URL gọi danh mục theo từng nguồn
const buildCategoryUrl = (cat, tmdbLang, page, limit) => {
    if (cat.source === SOURCES.SOURCE_TMDB) {
        return buildTmdbCategoryUrl(cat, tmdbLang, page);
    }
    const params = buildSourceSearchParams(cat, page, limit);
    let endpoint = cat.type || "";
    if (endpoint && !endpoint.startsWith("/")) endpoint = `/${endpoint}`;

    if (cat.source === SOURCES.SOURCE_C) {
        return buildUrlWithParams(CONFIG.APP_DOMAIN_SOURCE_C, `/api/films${endpoint}`, params);
    }
    if (cat.source === SOURCES.SOURCE_R) {
        return buildUrlWithParams(CONFIG.APP_DOMAIN_SOURCE_R, `/${cat.type}`, params);
    }
    const domain = cat.source === SOURCES.SOURCE_O ? CONFIG.APP_DOMAIN_SOURCE_O : CONFIG.APP_DOMAIN_SOURCE_K;
    const prefix = cat.useV1 ? "/v1/api" : "";
    return buildUrlWithParams(domain, `${prefix}${endpoint}`, params);
};

const applyTmdbMetadata = (normalized, metadata) => {
    if (!metadata) return;
    normalized.tmdbBranding = metadata;
    if (metadata.poster) {
        normalized.poster_url = metadata.poster;
        normalized.poster = metadata.poster;
    }
    if (metadata.backdrop) {
        normalized.thumb_url = metadata.backdrop;
        normalized.thumbnail = metadata.backdrop;
    }
    if (metadata.titleLogo) {
        normalized.titleLogo = metadata.titleLogo;
    }
    if (metadata.nameVi && (!normalized.name || normalized.name === normalized.origin_name)) {
        normalized.name = metadata.nameVi;
    }
};

// Helper enrich item TMDB
const enrichItemWithTmdb = async (normalized, item, source, tmdbLang) => {
    const tmdbId =
        normalized.tmdbId ||
        item.tmdb?.id ||
        item.tmdb_id ||
        item.movie?.tmdb?.id;
    if (tmdbId) {
        normalized.tmdbId = tmdbId;
        normalized.tmdb_id = tmdbId;
    }
    const tmdbType =
        item.tmdb?.type ||
        (normalized.episode_current ? "tv" : "movie");
    const seasonNumber =
        extractSeasonNumber(item) ||
        extractSeasonNumber(normalized);

    if (tmdbId && source !== SOURCES.SOURCE_TMDB) {
        try {
            const metadata = await tmdbService.fetchTMDBMetadata({
                tmdbId,
                type: tmdbType,
                language: tmdbLang,
                seasonNumber,
            });
            applyTmdbMetadata(normalized, metadata);
        } catch {
            // Fallback an toàn về ảnh gốc của nguồn phim
        }
    }
    return normalized;
};

const extractRawHeroPool = (results, categories) => {
    const hasHeroSource = categories.some((cat) => HERO_PRIORITY_SET.has(cat.id));
    if (!hasHeroSource) return [];

    let rawHeroPool = [];
    HERO_PRIORITY_SET.forEach((catId) => {
        const srcRes = results.find((r) => r.id === catId);
        if (srcRes?.items?.length) {
            rawHeroPool = [...rawHeroPool, ...srcRes.items.slice(0, 10)];
        }
    });

    if (rawHeroPool.length === 0) {
        const anySource = results.find((r) => r.items?.length);
        if (anySource) rawHeroPool = anySource.items.slice(0, 10);
    }

    return rawHeroPool;
};

const selectUniqueHeroImage = (candidate, fallback, usedSet) => {
    if (candidate && !usedSet.has(candidate)) {
        usedSet.add(candidate);
        return candidate;
    }
    return fallback;
};

const applyHeroBrandingImages = (normalized, branding, apiThumb, apiPoster, usedBackdrops, usedPosters) => {
    const selectedBackdrop = selectUniqueHeroImage(branding.backdrop, apiThumb || apiPoster, usedBackdrops);
    const selectedPoster = selectUniqueHeroImage(branding.poster, apiPoster || apiThumb, usedPosters);

    normalized.poster_url = selectedPoster;
    normalized.thumb_url = selectedBackdrop;
    normalized.poster = selectedPoster;
    normalized.thumbnail = selectedBackdrop;
};

const fetchHeroMetadata = async (tmdbId, tmdbType, tmdbLang, seasonNumber) => {
    if (!tmdbId) return null;
    return tmdbService.fetchTMDBMetadata({
        tmdbId,
        type: tmdbType,
        language: tmdbLang,
        seasonNumber,
    });
};

const prepareHeroNormalized = (m) => {
    const rawItem = m._rawItem || m;
    const normalized = normalizeMovie(rawItem, m.source);
    if (rawItem._titleLogo) normalized.titleLogo = rawItem._titleLogo;
    return { rawItem, normalized };
};

const resolveHeroParams = (rawItem, normalized) => {
    const tmdbId = normalized.tmdbId || rawItem.tmdb?.id;
    const tmdbType = rawItem.tmdb?.type || (normalized.episode_current ? "tv" : "movie");
    const seasonNumber = extractSeasonNumber(rawItem) || extractSeasonNumber(normalized);
    return { tmdbId, tmdbType, seasonNumber };
};

const enrichSingleHeroMovie = async (m, tmdbLang, usedBackdrops, usedPosters) => {
    try {
        const { rawItem, normalized } = prepareHeroNormalized(m);
        const { tmdbId, tmdbType, seasonNumber } = resolveHeroParams(rawItem, normalized);

        if (!tmdbId && !normalized.titleLogo) {
            return normalized;
        }

        const metadata = await fetchHeroMetadata(tmdbId, tmdbType, tmdbLang, seasonNumber);
        const branding = metadata || {};
        if (normalized.titleLogo) branding.titleLogo = normalized.titleLogo;
        normalized.tmdbBranding = branding;

        const apiPoster = normalized.poster_url || rawItem.poster_url || "";
        const apiThumb = normalized.thumb_url || rawItem.thumb_url || "";
        applyHeroBrandingImages(normalized, branding, apiThumb, apiPoster, usedBackdrops, usedPosters);
        return normalized;
    } catch (e) {
        console.error("Error detailing hero movie:", e);
        return m;
    }
};

// Helper làm giàu dữ liệu chi tiết cho Hero Slider
const enrichHeroSlider = async (finalPool, tmdbLang) => {
    const usedBackdrops = new Set();
    const usedPosters = new Set();
    const detailedHeroMovies = [];

    for (const m of finalPool) {
        const enriched = await enrichSingleHeroMovie(m, tmdbLang, usedBackdrops, usedPosters);
        detailedHeroMovies.push(enriched);
    }

    return detailedHeroMovies;
};

const fetchTmdbCategory = async (cat, tmdbLang, page, limit, cacheKey) => {
    try {
        const parsed = await fetchTmdbCategorySection(cat, tmdbLang, page, limit);
        const enrichedItems = await Promise.all(
            parsed.items.map(async (item) => {
                const normalized = normalizeMovie(item, cat.source);
                normalized._rawItem = item;
                return enrichItemWithTmdb(normalized, item, cat.source, tmdbLang);
            })
        );

        const result = {
            id: cat.id,
            items: enrichedItems,
            source: cat.source,
            totalPages: parsed.totalPages,
            totalItems: parsed.totalItems,
            cat: null,
        };

        vodCache.set(cacheKey, result, vodCache.TTL.LISTING);
        return result;
    } catch (e) {
        console.error(`Fetch error for TMDB ${cat.id}:`, e);
        return { id: cat.id, items: [], totalPages: 1, totalItems: 0 };
    }
};

const extractCustomApiItems = (cat, json, limit) => {
    if (cat.source === SOURCES.SOURCE_R && cat.type.includes("homepageLists")) {
        const collections = json.result?.collections || [];
        const collection = collections.find(
            (c) => c.slug === cat.id || c.name.includes(cat.title),
        );
        return {
            items: collection ? collection.movies || [] : [],
            totalPages: 1,
            totalItems: 0,
            apiMetadata: null,
        };
    }
    const parsed = parseApiJson(json, limit);
    return {
        items: parsed.items,
        totalPages: parsed.totalPages,
        totalItems: parsed.totalItems,
        apiMetadata: parsed.cat,
    };
};

const fetchCustomApiCategory = async (cat, tmdbLang, page, limit, cacheKey) => {
    const url = buildCategoryUrl(cat, tmdbLang, page, limit);
    if (!url) return { id: cat.id, items: [], totalPages: 1 };

    try {
        const res = await fetch(url);
        if (!res.ok) {
            const errorData = { id: cat.id, items: [], totalPages: 1, totalItems: 0, isError: true };
            vodCache.set(cacheKey, errorData);
            return errorData;
        }
        const json = await res.json();
        const { items, totalPages, totalItems, apiMetadata } = extractCustomApiItems(cat, json, limit);

        const enrichedItems = await Promise.all(
            items.map(async (item) => {
                const normalized = normalizeMovie(item, cat.source);
                normalized._rawItem = item;
                return enrichItemWithTmdb(normalized, item, cat.source, tmdbLang);
            }),
        );

        const result = {
            id: cat.id,
            items: enrichedItems,
            source: cat.source,
            totalPages,
            totalItems,
            cat: apiMetadata,
        };

        vodCache.set(cacheKey, result, vodCache.TTL.LISTING);
        return result;
    } catch (e) {
        console.error(`Fetch error for ${cat.id}:`, e);
        return { id: cat.id, items: [], totalPages: 1 };
    }
};

// Helper thực thi fetch từng danh mục đơn lẻ
const fetchSingleCategory = async (cat, tmdbLang) => {
    const cacheKey = getVodCacheKey(cat, tmdbLang);
    const cached = vodCache.get(cacheKey);

    if (cached) {
        if (cached.isError) {
            return { id: cat.id, items: [], totalPages: 1, totalItems: 0 };
        }
        return cached;
    }

    const page = cat.page || PAGINATION.DEFAULT_PAGE;
    const limit = cat.limit || (cat.isView === false ? PAGINATION.DEFAULT_PAGE_SIZE : PAGINATION.ROW_PAGE_SIZE);

    if (cat.source === SOURCES.SOURCE_TMDB) {
        return fetchTmdbCategory(cat, tmdbLang, page, limit, cacheKey);
    }

    return fetchCustomApiCategory(cat, tmdbLang, page, limit, cacheKey);
};

export const useVodData = (passedCategories) => {
    const { i18n } = useTranslation();
    const tmdbLang =
        i18n?.language?.startsWith("en")
            ? "en-US"
            : "vi-VN";
    const CATEGORIES = Array.isArray(passedCategories) ? passedCategories : [];
    const [sections, setSections] = useState({});
    const [heroMovies, setHeroMovies] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchInitialData = async () => {
        if (CATEGORIES.length === 0) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const fetchPromises = CATEGORIES.map((cat) => fetchSingleCategory(cat, tmdbLang));
            const results = await Promise.all(fetchPromises);
            const sectionsData = {};
            results.forEach((res) => {
                sectionsData[res.id] = {
                    items: res.items,
                    source: res.source,
                    totalPages: res.totalPages,
                    totalItems: res.totalItems,
                };
            });

            setSections(sectionsData);

            const rawHeroPool = extractRawHeroPool(results, CATEGORIES);
            if (rawHeroPool.length > 0) {
                const finalPool = rawHeroPool.slice(0, 20);
                const heroCacheKey = `hero_slider_season_dedup_${finalPool.map((m) => m.slug).join("_")}`;
                const cachedHero = vodCache.get(heroCacheKey);

                if (cachedHero) {
                    setHeroMovies(cachedHero);
                } else {
                    const detailedHeroMovies = await enrichHeroSlider(finalPool, tmdbLang);
                    setHeroMovies(detailedHeroMovies);
                    vodCache.set(heroCacheKey, detailedHeroMovies, vodCache.TTL.LISTING);
                }
            } else {
                setHeroMovies([]);
            }
        } catch (err) {
            console.error("useVodData error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInitialData();
    }, [JSON.stringify(CATEGORIES)]);

    return { sections, heroMovies, loading, refresh: fetchInitialData };
};
