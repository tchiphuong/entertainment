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
    K_API: import.meta.env.VITE_SOURCE_K_API,
    K_CDN: import.meta.env.VITE_SOURCE_K_CDN_IMAGE,
    C_API: import.meta.env.VITE_SOURCE_C_API,
    O_API: import.meta.env.VITE_SOURCE_O_API,
    T_KEY: import.meta.env.VITE_TMDB_API_KEY,
    T_URL: import.meta.env.VITE_TMDB_BASE_URL,
    R_API: import.meta.env.VITE_SOURCE_R_API,
};

// Sources moved to constants

// Normalize movie fields logic mirrored from Vods.jsx normalizeMovieForSource
const normalizeMediaItem = (item, encodedSource) => {
    if (!item) return null;
    const source = atob(encodedSource);
    const m = { ...item };
    m.source = encodedSource;

    if (!m.slug && m.movie_slug) m.slug = m.movie_slug;

    if (source === "source_c") {
        // NguonC bị ngược: poster_url là ảnh ngang, thumb_url là ảnh dọc
        m.poster_url = item.thumb_url;
        m.thumb_url = item.poster_url;
        m.episode_current = m.current_episode || m.episode_current;
        m.lang = m.language || m.lang;
        m.quality = m.quality;
    } else if (source === "source_o") {
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
    } else if (source === "source_r") {
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
    } else if (source === "source_k") {
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

export const useLibraryData = (passedCategories) => {
    const { i18n } = useTranslation();
    const tmdbLang =
        i18n?.language && i18n.language.startsWith("en")
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
                if (cat.useV1 || atob(cat.source) === "source_r") {
                    paramsData.limit = limit;
                }

                const params = new URLSearchParams({
                    ...paramsData,
                    ...(cat.params || {}),
                });

                if (cat.params?.keyword || cat.params?.q) {
                    params.set("keyword", cat.params.keyword || cat.params.q);
                }

                const decodedSource = atob(cat.source);
                if (decodedSource === "source_r") {
                    url = `${CONFIG.R_API}/${cat.type}${cat.type.includes("?") ? "&" : "?"}${params.toString()}`;
                } else if (decodedSource === "source_k") {
                    const prefix = cat.useV1 ? "/v1/api" : "";
                    const endpoint = cat.type
                        ? cat.type.startsWith("/")
                            ? cat.type
                            : `/${cat.type}`
                        : "";
                    const fullBase = `${CONFIG.K_API}${prefix}${endpoint}`;
                    url = `${fullBase}${fullBase.includes("?") ? "&" : "?"}${params.toString()}`;
                } else if (decodedSource === "source_c") {
                    const endpoint = cat.type
                        ? cat.type.startsWith("/")
                            ? cat.type
                            : `/${cat.type}`
                        : "";
                    url = `${CONFIG.C_API}/api/films${endpoint}${endpoint.includes("?") ? "&" : "?"}${params.toString()}`;
                } else if (decodedSource === "source_o") {
                    const prefix = cat.useV1 ? "/v1/api" : "";
                    const endpoint = cat.type
                        ? cat.type.startsWith("/")
                            ? cat.type
                            : `/${cat.type}`
                        : "";
                    const fullBase = `${CONFIG.O_API}${prefix}${endpoint}`;
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
                        atob(cat.source) === "source_r" &&
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
                            const normalized = normalizeMediaItem(item, cat.source);
                            normalized._rawItem = item;

                            // Tự động enrich hình ảnh chất lượng cao và poster tiếng Việt từ TMDB
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

                            if (tmdbId && cat.source !== SOURCES.SOURCE_TMDB) {
                                try {
                                    const metadata = await tmdbService.fetchTMDBMetadata({
                                        tmdbId,
                                        type: tmdbType,
                                        language: tmdbLang,
                                        seasonNumber,
                                    });
                                    if (metadata) {
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
                                    }
                                } catch (errEnrich) {
                                    // Fallback an toàn về ảnh gốc của nguồn phim
                                }
                            }

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

                const usedBackdrops = new Set();
                const usedPosters = new Set();
                const detailedHeroMovies = [];

                for (const m of finalPool) {
                    try {
                        let rawItem = m._rawItem || m; // Dữ liệu gốc trước normalize
                        const source = m.source;

                        // Normalize từ dữ liệu thô (chỉ 1 lần duy nhất)
                        const normalized = normalizeMediaItem(rawItem, source);
                        // Gắn lại titleLogo nếu có
                        if (rawItem._titleLogo)
                            normalized.titleLogo = rawItem._titleLogo;

                        const tmdbId =
                            normalized.tmdbId || rawItem.tmdb?.id;
                        const tmdbType =
                            rawItem.tmdb?.type ||
                            (normalized.episode_current ? "tv" : "movie");
                        const seasonNumber =
                            extractSeasonNumber(rawItem) ||
                            extractSeasonNumber(normalized);

                        // Lưu hình ảnh gốc do API nguồn trả về
                        const apiPoster =
                            normalized.poster_url ||
                            rawItem.poster_url ||
                            "";
                        const apiThumb =
                            normalized.thumb_url ||
                            rawItem.thumb_url ||
                            "";

                        if (tmdbId || normalized.titleLogo) {
                            const metadata = tmdbId
                                ? await tmdbService.fetchTMDBMetadata({
                                      tmdbId,
                                      type: tmdbType,
                                      language: tmdbLang,
                                      seasonNumber,
                                  })
                                : null;

                            const branding = metadata || {};
                            if (normalized.titleLogo) {
                                branding.titleLogo = normalized.titleLogo;
                            }

                            normalized.tmdbBranding = branding;

                            // Xử lý Backdrop: Nếu TMDB bị trùng lặp giữa các season -> lấy hình của API nguồn trả về
                            let selectedBackdrop = branding.backdrop;
                            if (selectedBackdrop && usedBackdrops.has(selectedBackdrop)) {
                                selectedBackdrop = apiThumb || apiPoster;
                            } else if (selectedBackdrop) {
                                usedBackdrops.add(selectedBackdrop);
                            } else {
                                selectedBackdrop = apiThumb || apiPoster;
                            }

                            // Xử lý Poster: Nếu TMDB bị trùng lặp giữa các season -> lấy hình của API nguồn trả về
                            let selectedPoster = branding.poster;
                            if (selectedPoster && usedPosters.has(selectedPoster)) {
                                selectedPoster = apiPoster || apiThumb;
                            } else if (selectedPoster) {
                                usedPosters.add(selectedPoster);
                            } else {
                                selectedPoster = apiPoster || apiThumb;
                            }

                            normalized.poster_url = selectedPoster;
                            normalized.thumb_url = selectedBackdrop;
                            normalized.poster = selectedPoster;
                            normalized.thumbnail = selectedBackdrop;
                        }

                        detailedHeroMovies.push(normalized);
                    } catch (e) {
                        console.error("Error detailing hero movie:", e);
                        detailedHeroMovies.push(m);
                    }
                }
                setHeroMovies(detailedHeroMovies);
            } else {
                setHeroMovies([]);
            }
        } catch (err) {
            console.error("useLibraryData error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInitialData();
    }, [JSON.stringify(CATEGORIES)]);

    return { sections, heroMovies, loading, refresh: fetchInitialData };
};
