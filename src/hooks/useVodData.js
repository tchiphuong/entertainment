import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
    SOURCES,
    TMDB_IMAGE_BASE_URL,
    TMDB_IMAGE_SIZES,
} from "../constants/vodConstants";
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

const normalizeSourceTmdb = (m, item) => {
    m.tmdbId = item.id || item.tmdbId;
    m.name = item.title || item.name || item.original_title || item.original_name || "";
    m.origin_name = item.original_title || item.original_name || "";
    const posterPath = item.poster_path;
    const backdropPath = item.backdrop_path;

    if (posterPath) {
        m.poster_url = posterPath.startsWith("http") ? posterPath : `${TMDB_IMAGE_BASE_URL}/${TMDB_IMAGE_SIZES.POSTER}${posterPath}`;
    } else {
        m.poster_url = item.poster_url || "";
    }

    if (backdropPath) {
        m.thumb_url = backdropPath.startsWith("http") ? backdropPath : `${TMDB_IMAGE_BASE_URL}/${TMDB_IMAGE_SIZES.BACKDROP}${backdropPath}`;
    } else {
        m.thumb_url = item.thumb_url || m.poster_url;
    }

    m.slug = item.slug || (item.id ? `tmdb-${item.id}` : "");
    const releaseDate = item.release_date || item.first_air_date;
    m.year = releaseDate ? new Date(releaseDate).getFullYear() : (item.year || null);
    const vote = typeof item.vote_average === "number" ? item.vote_average : item.rating;
    m.quality = vote && vote > 0 ? `${Number(vote).toFixed(1)}` : (item.quality || "HD");
    m.rating = vote;
    m.lang = item.original_language || item.lang || "en";
    m.content = item.overview || item.content || "";
};

// Normalize movie fields logic
const normalizeMovie = (item, source) => {
    if (!item) return null;
    const m = { ...item };
    m.source = source;

    if (!m.slug && m.movie_slug) m.slug = m.movie_slug;

    if (source === SOURCES.SOURCE_C) {
        m.poster_url = item.thumb_url;
        m.thumb_url = item.poster_url;
        m.episode_current = m.current_episode || m.episode_current;
        m.lang = m.language || m.lang;
    } else if (source === SOURCES.SOURCE_O) {
        normalizeSourceO(m, item);
    } else if (source === SOURCES.SOURCE_R) {
        normalizeSourceR(m, item);
    } else if (source === SOURCES.SOURCE_TMDB) {
        normalizeSourceTmdb(m, item);
    } else if (source === SOURCES.SOURCE_K) {
        m.poster_url = item.poster_url;
        m.thumb_url = item.thumb_url;
        m.tmdbId = item.tmdb?.id || item.movie?.tmdb?.id;
    } else {
        m.poster_url = m.poster_url || m.poster || m.thumbnail || "";
        m.thumb_url = m.thumb_url || m.thumbnail || m.poster || "";
    }

    m.thumbnail = m.thumb_url || "";
    m.poster = m.poster_url || "";
    m.quality = m.quality || m.episode_current;
    m.year = m.year || (m.time ? new Date(m.time).getFullYear() : null);
    m.isTrailer =
        m.quality?.toLowerCase().includes("trailer") ||
        m.episode_current?.toLowerCase().includes("trailer");

    return m;
};

// parseApiJson logic
const parseApiJson = (json, limit = 12) => {
    let items = [];
    let totalPages = 1;
    let totalItems = 0;
    let cat = null;

    if (!json) return { items, totalPages, totalItems, cat };

    if (json.paginate && Array.isArray(json.items)) {
        items = json.items;
        totalPages = json.paginate.total_page || totalPages;
        totalItems = json.paginate.total_item || items.length;
        cat = json.cat || null;
    } else if (json.data?.items && Array.isArray(json.data.items)) {
        items = json.data.items;
        const pag = json.data.params?.pagination;
        totalItems = pag?.totalItems || items.length;
        totalPages = pag?.totalPages || Math.ceil(totalItems / (pag?.totalItemsPerPage || limit));
    } else if (Array.isArray(json)) {
        items = json;
        totalItems = items.length;
    } else if (json.result) {
        items = Array.isArray(json.result) ? json.result : json.result.items || [];
        totalItems = json.result.total_item || json.result.totalItems || json.result.total_items || items.length;
        totalPages = json.result.total_page || json.result.totalPages || Math.ceil(totalItems / limit);
    } else if (Array.isArray(json.items)) {
        items = json.items;
        totalItems = items.length;
        const pag = json.pagination || json.data?.pagination;
        if (pag) {
            totalItems = pag.totalItems || totalItems;
            totalPages = pag.totalPages || Math.ceil(totalItems / (pag.totalItemsPerPage || limit));
        }
    } else if (Array.isArray(json.results)) {
        items = json.results;
        totalPages = json.total_pages || 1;
        totalItems = json.total_results || items.length;
    } else if (Array.isArray(json.data)) {
        items = json.data;
        totalItems = items.length;
    }

    return { items, totalPages, totalItems, cat };
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

// Helper tạo URL gọi danh mục theo từng nguồn
const buildCategoryUrl = (cat, tmdbLang, page, limit) => {
    const params = buildSourceSearchParams(cat, page, limit);

    let endpoint = cat.type || "";
    if (endpoint && !endpoint.startsWith("/")) endpoint = `/${endpoint}`;

    if (cat.source === SOURCES.SOURCE_R) {
        const joiner = cat.type.includes("?") ? "&" : "?";
        return `${CONFIG.APP_DOMAIN_SOURCE_R}/${cat.type}${joiner}${params.toString()}`;
    }
    if (cat.source === SOURCES.SOURCE_K) {
        const prefix = cat.useV1 ? "/v1/api" : "";
        const fullBase = `${CONFIG.APP_DOMAIN_SOURCE_K}${prefix}${endpoint}`;
        return `${fullBase}${fullBase.includes("?") ? "&" : "?"}${params.toString()}`;
    }
    if (cat.source === SOURCES.SOURCE_C) {
        return `${CONFIG.APP_DOMAIN_SOURCE_C}/api/films${endpoint}${endpoint.includes("?") ? "&" : "?"}${params.toString()}`;
    }
    if (cat.source === SOURCES.SOURCE_TMDB) {
        const ep = cat.type ? cat.type.replace(/^\//, "") : "trending/movie/week";
        const tmdbBaseUrl = CONFIG.TMDB_BASE_URL;
        return `${tmdbBaseUrl}/${ep}?api_key=${CONFIG.TMDB_API_KEY}&language=${tmdbLang}&page=${page}`;
    }
    if (cat.source === SOURCES.SOURCE_O) {
        const prefix = cat.useV1 ? "/v1/api" : "";
        const fullBase = `${CONFIG.APP_DOMAIN_SOURCE_O}${prefix}${endpoint}`;
        return `${fullBase}${fullBase.includes("?") ? "&" : "?"}${params.toString()}`;
    }
    return null;
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

const HERO_PRIORITY_SET = new Set(["hot-rophim", "new-ophim", "new"]);

// Helper tổng hợp raw hero pool từ kết quả categories
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

const enrichSingleHeroMovie = async (m, tmdbLang, usedBackdrops, usedPosters) => {
    try {
        const rawItem = m._rawItem || m;
        const source = m.source;
        const normalized = normalizeMovie(rawItem, source);
        if (rawItem._titleLogo) normalized.titleLogo = rawItem._titleLogo;

        const tmdbId = normalized.tmdbId || rawItem.tmdb?.id;
        const tmdbType = rawItem.tmdb?.type || (normalized.episode_current ? "tv" : "movie");
        const seasonNumber = extractSeasonNumber(rawItem) || extractSeasonNumber(normalized);

        const apiPoster = normalized.poster_url || rawItem.poster_url || "";
        const apiThumb = normalized.thumb_url || rawItem.thumb_url || "";

        if (!tmdbId && !normalized.titleLogo) {
            return normalized;
        }

        const metadata = tmdbId
            ? await tmdbService.fetchTMDBMetadata({
                  tmdbId,
                  type: tmdbType,
                  language: tmdbLang,
                  seasonNumber,
              })
            : null;

        const branding = metadata || {};
        if (normalized.titleLogo) branding.titleLogo = normalized.titleLogo;
        normalized.tmdbBranding = branding;

        const selectedBackdrop = selectUniqueHeroImage(branding.backdrop, apiThumb || apiPoster, usedBackdrops);
        const selectedPoster = selectUniqueHeroImage(branding.poster, apiPoster || apiThumb, usedPosters);

        normalized.poster_url = selectedPoster;
        normalized.thumb_url = selectedBackdrop;
        normalized.poster = selectedPoster;
        normalized.thumbnail = selectedBackdrop;

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

    const page = cat.page || 1;
    const limit = cat.limit || (cat.isView === false ? 24 : 12);
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

        let items;
        let totalPages = 1;
        let totalItems = 0;
        let apiMetadata = null;

        if (cat.source === SOURCES.SOURCE_R && cat.type.includes("homepageLists")) {
            const collections = json.result?.collections || [];
            const collection = collections.find(
                (c) => c.slug === cat.id || c.name.includes(cat.title),
            );
            items = collection ? collection.movies || [] : [];
        } else {
            const parsed = parseApiJson(json, limit);
            items = parsed.items;
            totalPages = parsed.totalPages;
            totalItems = parsed.totalItems;
            apiMetadata = parsed.cat;
        }

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
