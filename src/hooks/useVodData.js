import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
    SOURCES,
    TMDB_IMAGE_BASE_URL,
    TMDB_IMAGE_SIZES,
} from "../constants/vodConstants";
import { vodCache } from "../utils/vodCache";

const CONFIG = {
    APP_DOMAIN_SOURCE_K: import.meta.env.VITE_SOURCE_K_API,
    APP_DOMAIN_SOURCE_K_CDN_IMAGE: import.meta.env.VITE_SOURCE_K_CDN_IMAGE,
    APP_DOMAIN_SOURCE_C: import.meta.env.VITE_SOURCE_C_API,
    APP_DOMAIN_SOURCE_O: import.meta.env.VITE_SOURCE_O_API,
    TMDB_API_KEY: import.meta.env.VITE_TMDB_API_KEY,
    TMDB_BASE_URL: import.meta.env.VITE_TMDB_BASE_URL,
    APP_DOMAIN_SOURCE_R: import.meta.env.VITE_SOURCE_R_API,
};

// Sources moved to constants

// Normalize movie fields logic mirrored from Vods.jsx normalizeMovieForSource
const normalizeMovie = (item, source) => {
    if (!item) return null;
    const m = { ...item };
    m.source = source;

    if (!m.slug && m.movie_slug) m.slug = m.movie_slug;

    if (source === SOURCES.SOURCE_C) {
        // NguonC bị ngược: poster_url là ảnh ngang, thumb_url là ảnh dọc
        m.poster_url = item.thumb_url;
        m.thumb_url = item.poster_url;
        m.episode_current = m.current_episode || m.episode_current;
        m.lang = m.language || m.lang;
        m.quality = m.quality;
    } else if (source === SOURCES.SOURCE_O) {
        // Source O (Ophim): trong list chỉ có thumb_url (dọc), poster_url thường không có
        const portrait = item.thumb_url;
        const landscape = item.poster_url || ""; // Không fallback sang ảnh dọc

        m.poster_url = portrait;
        m.thumb_url = landscape;

        // Ensure paths have uploads/movies/ if they are relative
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
    } else if (source === SOURCES.SOURCE_R) {
        // Source R (Rophim): thumbnail (portrait/dọc), poster (landscape/ngang), image_name (logo)
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
    } else if (source === SOURCES.SOURCE_K) {
        // Source K (PhimAPI): poster_url (portrait), thumb_url (landscape)
        m.poster_url = item.poster_url;
        m.thumb_url = item.thumb_url;
        m.tmdbId = item.tmdb?.id || item.movie?.tmdb?.id;
    } else {
        // Fallback for others (Source C, etc.)
        m.poster_url = m.poster_url || m.poster || m.thumbnail || "";
        m.thumb_url = m.thumb_url || m.thumbnail || m.poster || "";
    }

    // Standardized fields cho UI (không fallback chéo giữa dọc/ngang)
    m.thumbnail = m.thumb_url || "";
    m.poster = m.poster_url || "";

    // Ensure basic metadata exists with more fallbacks
    m.quality = m.quality || m.episode_current;
    m.year = m.year || (m.time ? new Date(m.time).getFullYear() : null) || null;

    // Detect if it's only a trailer
    m.isTrailer =
        m.quality?.toLowerCase().includes("trailer") ||
        m.episode_current?.toLowerCase().includes("trailer");

    return m;
};

// parseApiJson logic mirrored from Vods.jsx
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
    } else if (json.data && Array.isArray(json.data.items)) {
        items = json.data.items;
        const pag = json.data.params?.pagination;
        if (pag) {
            totalItems = pag.totalItems || items.length;
            totalPages =
                pag.totalPages ||
                Math.ceil(totalItems / (pag.totalItemsPerPage || limit));
        } else {
            totalItems = items.length;
        }
    } else if (
        json.data &&
        json.data.items &&
        json.data.params &&
        json.data.params.pagination
    ) {
        items = json.data.items;
        totalItems = json.data.params.pagination.totalItems;
        totalPages =
            json.data.params.pagination.totalPages ||
            Math.ceil(
                totalItems /
                    (json.data.params.pagination.totalItemsPerPage || limit),
            );
    } else if (Array.isArray(json)) {
        items = json;
        totalItems = items.length;
    } else if (json.result) {
        items = Array.isArray(json.result)
            ? json.result
            : json.result.items || [];
        totalItems =
            json.result.total_item ||
            json.result.totalItems ||
            json.result.total_items ||
            items.length;
        totalPages =
            json.result.total_page ||
            json.result.totalPages ||
            Math.ceil(totalItems / limit);
    } else if (Array.isArray(json.items)) {
        items = json.items;
        totalItems = items.length;
        // Bổ sung: Kiểm tra pagination ở root (theo snippet của USER)
        const pag = json.pagination || json.data?.pagination;
        if (pag) {
            totalItems = pag.totalItems || totalItems;
            totalPages =
                pag.totalPages ||
                Math.ceil(totalItems / (pag.totalItemsPerPage || limit));
        }
    } else if (Array.isArray(json.data)) {
        items = json.data;
        totalItems = items.length;
    }

    return { items, totalPages, totalItems, cat };
};

// Memory cache remains for TMDB as it's very frequent
const tmdbCache = new Map();

// VOD Data Cache now uses persistent storage via vodCache
// Logic mirrored from vodCache.js

const getVodCacheKey = (cat) => {
    return JSON.stringify({
        id: cat.id,
        type: cat.type,
        useV1: cat.useV1,
        source: cat.source,
        page: cat.page || 1,
        params: cat.params || {},
        limit: cat.limit,
    });
};

// Helper to fetch TMDB branding & images (Poster, Backdrop, Logo)
const fetchTmdbMetadata = async (
    tmdbId,
    type = "movie",
    language = "vi-VN",
) => {
    const cacheKey = `${type}_${tmdbId}_${language}`;
    if (tmdbCache.has(cacheKey)) return tmdbCache.get(cacheKey);

    try {
        const apiKey = CONFIG.TMDB_API_KEY;
        const endpoint = type === "tv" ? "tv" : "movie";
        const url = `${CONFIG.TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${apiKey}&language=${language}`;

        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();

        let brandLogoPath = null;

        if (type === "tv" && data.networks?.length > 0) {
            const net =
                data.networks.find((n) => n.logo_path) || data.networks[0];
            brandLogoPath = net.logo_path;
        } else if (data.production_companies?.length > 0) {
            const comp =
                data.production_companies.find((c) => c.logo_path) ||
                data.production_companies[0];
            brandLogoPath = comp.logo_path;
        }

        // Fetch extra images for title logo
        const imgUrl = `${CONFIG.TMDB_BASE_URL}/${endpoint}/${tmdbId}/images?api_key=${apiKey}`;
        const imgRes = await fetch(imgUrl);
        let titleLogoPath = null;
        if (imgRes.ok) {
            const imgData = await imgRes.json();
            if (imgData.logos?.length > 0) {
                const viLogo = imgData.logos.find((l) => l.iso_639_1 === "vi");
                const enLogo = imgData.logos.find((l) => l.iso_639_1 === "en");
                const logo = viLogo || enLogo || null;
                if (logo) titleLogoPath = logo.file_path;
            }
        }

        const metadata = {
            brandLogo: brandLogoPath
                ? `${TMDB_IMAGE_BASE_URL}/${TMDB_IMAGE_SIZES.LOGO}${brandLogoPath}`
                : null,
            titleLogo: titleLogoPath
                ? `${TMDB_IMAGE_BASE_URL}/${TMDB_IMAGE_SIZES.POSTER}${titleLogoPath}`
                : null,
            poster: data.poster_path
                ? `${TMDB_IMAGE_BASE_URL}/${TMDB_IMAGE_SIZES.POSTER}${data.poster_path}`
                : null,
            backdrop: data.backdrop_path
                ? `${TMDB_IMAGE_BASE_URL}/${TMDB_IMAGE_SIZES.BACKDROP}${data.backdrop_path}`
                : null,
            nameVi: data.title || data.name || null,
        };

        tmdbCache.set(cacheKey, metadata);
        return metadata;
    } catch (e) {
        console.warn("fetchTmdbMetadata error:", e);
        return null;
    }
};

export const useVodData = (passedCategories) => {
    const { i18n } = useTranslation();
    const tmdbLang = i18n.language === "vi" ? "vi-VN" : "en-US";
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
            const fetchPromises = CATEGORIES.map(async (cat) => {
                const cacheKey = getVodCacheKey(cat);
                const cached = vodCache.get(cacheKey);

                if (cached) {
                    // Nếu là cache lỗi (Negative Cache), trả về rỗng ngay lập tức
                    if (cached.isError) {
                        return {
                            id: cat.id,
                            items: [],
                            totalPages: 1,
                            totalItems: 0,
                        };
                    }
                    return cached;
                }

                let url = "";
                let items = [];
                let totalPages = 1;
                let totalItems = 0;
                let apiMetadata = null;

                const page = cat.page || 1;
                const limit = cat.limit || (cat.isView === false ? 24 : 12);

                // Build query params
                const paramsData = { page: page };
                
                // Chỉ gửi limit nếu là API V1 (KKPhim/OPhim) hoặc nguồn Rophim có hỗ trợ
                if (cat.useV1 || cat.source === SOURCES.SOURCE_R) {
                    paramsData.limit = limit;
                }

                const params = new URLSearchParams({
                    ...paramsData,
                    ...(cat.params || {}),
                });

                if (cat.params?.keyword || cat.params?.q) {
                    params.set("keyword", cat.params.keyword || cat.params.q);
                }

                if (cat.source === SOURCES.SOURCE_R) {
                    url = `${CONFIG.APP_DOMAIN_SOURCE_R}/${cat.type}${cat.type.includes("?") ? "&" : "?"}${params.toString()}`;
                } else if (cat.source === SOURCES.SOURCE_K) {
                    const prefix = cat.useV1 ? "/v1/api" : "";
                    const endpoint = cat.type
                        ? cat.type.startsWith("/")
                            ? cat.type
                            : `/${cat.type}`
                        : "";
                    const fullBase = `${CONFIG.APP_DOMAIN_SOURCE_K}${prefix}${endpoint}`;
                    url = `${fullBase}${fullBase.includes("?") ? "&" : "?"}${params.toString()}`;
                } else if (cat.source === SOURCES.SOURCE_C) {
                    const endpoint = cat.type
                        ? cat.type.startsWith("/")
                            ? cat.type
                            : `/${cat.type}`
                        : "";
                    url = `${CONFIG.APP_DOMAIN_SOURCE_C}/api/films${endpoint}${endpoint.includes("?") ? "&" : "?"}${params.toString()}`;
                } else if (cat.source === SOURCES.SOURCE_O) {
                    const prefix = cat.useV1 ? "/v1/api" : "";
                    const endpoint = cat.type
                        ? cat.type.startsWith("/")
                            ? cat.type
                            : `/${cat.type}`
                        : "";
                    const fullBase = `${CONFIG.APP_DOMAIN_SOURCE_O}${prefix}${endpoint}`;
                    url = `${fullBase}${fullBase.includes("?") ? "&" : "?"}${params.toString()}`;
                }

                if (!url) return { id: cat.id, items: [], totalPages: 1 };

                try {
                    const res = await fetch(url);
                    if (!res.ok) {
                        // Negative Caching: Lưu lại lỗi để không gọi lại dánh sách này nữa
                        const errorData = { id: cat.id, items: [], totalPages: 1, totalItems: 0, isError: true };
                        vodCache.set(cacheKey, errorData);
                        return errorData;
                    }
                    const json = await res.json();

                    // Special handling for Rophim collections
                    if (
                        cat.source === SOURCES.SOURCE_R &&
                        cat.type.includes("homepageLists")
                    ) {
                        const collections = json.result?.collections || [];
                        const collection = collections.find(
                            (c) =>
                                c.slug === cat.id || c.name.includes(cat.title),
                        );
                        items = collection ? collection.movies || [] : [];
                    } else {
                        // Default parsing for most sources
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
                            return normalized;
                        }),
                    );

                    const result = {
                        id: cat.id,
                        items: enrichedItems,
                        source: cat.source,
                        totalPages: totalPages,
                        totalItems: totalItems,
                        cat: apiMetadata,
                    };

                    // Save to cache with Listing TTL (10 minutes)
                    vodCache.set(cacheKey, result, vodCache.TTL.LISTING);

                    return result;
                } catch (e) {
                    console.error(`Fetch error for ${cat.id}:`, e);
                    return { id: cat.id, items: [], totalPages: 1 };
                }
            });

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

            // Fetch high-quality details for Hero Slider
            const HERO_PRIORITY = ["hot-rophim", "new-ophim", "new"];
            let rawHeroPool = [];

            // Chỉ thực hiện logic Hero Slider nếu danh sách categories yêu cầu có chứa ID ưu tiên
            const hasHeroSource = CATEGORIES.some((cat) =>
                HERO_PRIORITY.includes(cat.id),
            );

            if (hasHeroSource) {
                HERO_PRIORITY.forEach((catId) => {
                    const srcRes = results.find((r) => r.id === catId);
                    if (srcRes && srcRes.items && srcRes.items.length > 0) {
                        rawHeroPool = [
                            ...rawHeroPool,
                            ...srcRes.items.slice(0, 10),
                        ];
                    }
                });

                // Nếu không có phim nào từ 3 nguồn ưu tiên, lấy từ bất kỳ nguồn nào có dữ liệu
                if (rawHeroPool.length === 0) {
                    const anySource = results.find(
                        (r) => r.items && r.items.length > 0,
                    );
                    if (anySource) rawHeroPool = anySource.items.slice(0, 10);
                }
            }

            if (hasHeroSource && rawHeroPool.length > 0) {
                // Giới hạn tổng số phim trên Slider (ví dụ 15-20 phim)
                const finalPool = rawHeroPool.slice(0, 20);

                // Cơ chế cache cho Hero Slider (tránh gọi TMDB liên tục)
                const heroCacheKey = `hero_slider_detailed_${finalPool.map((m) => m.slug).join("_")}`;
                const cachedHero = vodCache.get(heroCacheKey);

                if (cachedHero) {
                    setHeroMovies(cachedHero);
                } else {
                    const detailedHeroMovies = await Promise.all(
                        finalPool.map(async (m) => {
                            try {
                                let rawItem = m._rawItem || m; // Dữ liệu gốc trước normalize
                                const source = m.source;

                                // Normalize từ dữ liệu thô (chỉ 1 lần duy nhất)
                                const normalized = normalizeMovie(
                                    rawItem,
                                    source,
                                );
                                // Gắn lại titleLogo nếu có
                                if (rawItem._titleLogo)
                                    normalized.titleLogo = rawItem._titleLogo;

                                const tmdbId =
                                    normalized.tmdbId || rawItem.tmdb?.id;
                                const tmdbType =
                                    rawItem.tmdb?.type ||
                                    (normalized.episode_current
                                        ? "tv"
                                        : "movie");

                                if (tmdbId || normalized.titleLogo) {
                                    const metadata = tmdbId
                                        ? await fetchTmdbMetadata(
                                              tmdbId,
                                              tmdbType,
                                              tmdbLang,
                                          )
                                        : null;

                                    const branding = metadata || {};
                                    if (normalized.titleLogo) {
                                        branding.titleLogo =
                                            normalized.titleLogo;
                                    }

                                    normalized.tmdbBranding = branding;
                                    // Priority: TMDB images > Source images
                                    normalized.poster_url =
                                        branding.poster ||
                                        normalized.poster_url;
                                    normalized.thumb_url =
                                        branding.backdrop ||
                                        normalized.thumb_url;
                                    normalized.poster = normalized.poster_url;
                                    normalized.thumbnail = normalized.thumb_url;
                                }

                                return normalized;
                            } catch (e) {
                                console.error("Error detailing hero movie:", e);
                                return m;
                            }
                        }),
                    );
                    setHeroMovies(detailedHeroMovies);
                    // Lưu vào cache với TTL tương đương Listing (10 phút)
                    vodCache.set(
                        heroCacheKey,
                        detailedHeroMovies,
                        vodCache.TTL.LISTING,
                    );
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
