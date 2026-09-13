import {
    SOURCES,
    TMDB_IMAGE_BASE_URL,
    TMDB_IMAGE_SIZES,
    DEFAULT_REGION,
    DEFAULT_TMDB_LANG,
    MEDIA_TYPES,
    TIMEFRAMES,
    TMDB_ENDPOINTS,
    TMDB_THEATRICAL_RELEASE_TYPES,
} from "../../constants";
import { smartCache, CACHE_TTL } from "../../utils/smartCache";
import { slugify } from "../../utils/vodIdentifier";

const TMDB_API_KEYS = [
    import.meta.env.VITE_TMDB_API_KEY,
    import.meta.env.VITE_TMDB_API_KEY_2,
    import.meta.env.VITE_TMDB_API_KEY_3,
    import.meta.env.VITE_TMDB_API_KEY_FALLBACK,
]
    .flatMap((k) => (typeof k === "string" ? k.split(",") : []))
    .map((k) => k?.trim())
    .filter((k, idx, arr) => Boolean(k) && arr.indexOf(k) === idx);

const FINAL_TMDB_KEYS = TMDB_API_KEYS.length > 0 ? TMDB_API_KEYS : [
    "3356865d41894a2fa9bfa84b2b5f59bb",
    "1865f43a0549ca50d341dd9ab8b29f49",
    "304ca56b1b7b57ca7a47d9b59946be94",
];

const CONFIG = {
    TMDB_API_KEYS: FINAL_TMDB_KEYS,
    TMDB_BASE_URL: import.meta.env.VITE_TMDB_BASE_URL || "https://api.themoviedb.org/3",
};

// Quản lý trạng thái cooldown của từng key nhằm tránh lỗi 429 rate limit
const keyCooldownMap = new Map();
let keyIndex = 0;

const RATE_LIMIT_COOLDOWN_MS = 60 * 1000; // 1 phút khi bị 429
const UNAUTHORIZED_COOLDOWN_MS = 5 * 60 * 1000; // 5 phút khi bị 401

/**
 * Lấy API key khả dụng theo cơ chế Round-Robin để chia đều tải và ngừa 429
 */
export const getNextTmdbApiKey = () => {
    const now = Date.now();
    const total = FINAL_TMDB_KEYS.length;

    for (let i = 0; i < total; i++) {
        const candidate = FINAL_TMDB_KEYS[(keyIndex + i) % total];
        const cooldownUntil = keyCooldownMap.get(candidate) || 0;
        if (now >= cooldownUntil) {
            keyIndex = (keyIndex + i + 1) % total;
            return candidate;
        }
    }

    let earliestKey = FINAL_TMDB_KEYS[0];
    let earliestTime = keyCooldownMap.get(earliestKey) || 0;
    for (const k of FINAL_TMDB_KEYS) {
        const time = keyCooldownMap.get(k) || 0;
        if (time < earliestTime) {
            earliestTime = time;
            earliestKey = k;
        }
    }
    return earliestKey;
};

const markKeyLimited = (key, statusCode = 429) => {
    const duration = statusCode === 401 ? UNAUTHORIZED_COOLDOWN_MS : RATE_LIMIT_COOLDOWN_MS;
    keyCooldownMap.set(key, Date.now() + duration);
    console.warn(`[TMDB] Key ...${key.slice(-6)} bị mã ${statusCode}. Tạm chuyển sang fallback key trong ${duration / 1000}s`);
};

const buildTmdbUrl = (urlOrBuilder, apiKey) => {
    if (typeof urlOrBuilder === "function") {
        return urlOrBuilder(apiKey);
    }
    if (typeof urlOrBuilder === "string") {
        if (urlOrBuilder.includes("api_key=")) {
            return urlOrBuilder.replace(/api_key=[^&]+/, `api_key=${apiKey}`);
        }
        const sep = urlOrBuilder.includes("?") ? "&" : "?";
        return `${urlOrBuilder}${sep}api_key=${apiKey}`;
    }
    return "";
};

/**
 * Thực hiện gọi TMDB API với cơ chế tự động thử lại qua danh sách fallback keys khi gặp lỗi 429 hoặc 401
 */
export const fetchTMDBApi = async (urlOrBuilder, fetchOptions = {}) => {
    const maxAttempts = FINAL_TMDB_KEYS.length;
    let lastError = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const apiKey = getNextTmdbApiKey();
        const url = buildTmdbUrl(urlOrBuilder, apiKey);
        if (!url) break;

        try {
            const res = await fetch(url, fetchOptions);

            if (res.status === 429 || res.status === 401) {
                markKeyLimited(apiKey, res.status);
                continue;
            }

            return res;
        } catch (err) {
            lastError = err;
            console.warn(`[TMDB] Fetch lỗi với key ...${apiKey.slice(-6)}:`, err);
        }
    }

    if (lastError) throw lastError;
    return null;
};

/**
 * Fetch dữ liệu JSON từ TMDB API an toàn với fallback keys
 */
export const fetchTMDBJson = async (urlOrBuilder, fetchOptions = {}) => {
    try {
        const res = await fetchTMDBApi(urlOrBuilder, fetchOptions);
        if (!res || !res.ok) return null;
        return await res.json();
    } catch (e) {
        console.warn("[TMDB] Lỗi fetchTMDBJson:", e);
        return null;
    }
};

const getTmdbTitle = (item) =>
    item.title || item.name || item.original_title || item.original_name || "";

const getTmdbOriginTitle = (item) =>
    item.original_title || item.original_name || item.title || item.name || "";

const getTmdbDuration = (item) => {
    if (item.runtime) return `${item.runtime} phút`;
    if (item.episode_run_time?.[0]) return `${item.episode_run_time[0]} phút/tập`;
    return "";
};

const getTmdbQuality = (rating) => (rating && rating > 0 ? `${rating.toFixed(1)}` : "HD");

const getTmdbPosterUrl = (posterPath) =>
    posterPath ? `${TMDB_IMAGE_BASE_URL}/${TMDB_IMAGE_SIZES.POSTER}${posterPath}` : "";

const getTmdbBackdropUrl = (backdropPath, fallback) =>
    backdropPath ? `${TMDB_IMAGE_BASE_URL}/${TMDB_IMAGE_SIZES.BACKDROP}${backdropPath}` : fallback;

const getTmdbReleaseYear = (item) => {
    const releaseDate = item.release_date || item.first_air_date;
    return releaseDate ? new Date(releaseDate).getFullYear() : null;
};

const getTmdbDirector = (item) =>
    (item.credits?.crew || []).find((c) => c.job === "Director")?.name || "";

const getTmdbMediaType = (item, isMovie) =>
    item.media_type || (isMovie ? MEDIA_TYPES.MOVIE : MEDIA_TYPES.TV);

const resolveTmdbSlug = (item, movieTitle) => {
    if (movieTitle) return slugify(movieTitle);
    return item?.id ? String(item.id) : "";
};

const resolveTmdbCategories = (genres) => {
    return Array.isArray(genres)
        ? genres.map((g) => ({ id: g.id, name: g.name, slug: String(g.id) }))
        : [];
};

const resolveTmdbActors = (credits) => {
    return Array.isArray(credits?.cast)
        ? credits.cast.map((c) => c.name)
        : [];
};

/**
 * Chuẩn hóa một item phim trả về từ TMDB API thành format chung của hệ sinh thái VOD
 * @param {object} item - Dữ liệu thô từ TMDB
 * @param {string} source - Nguồn dữ liệu (mặc định source_tmdb)
 */
export const normalizeTMDBMovie = (item, source = SOURCES.SOURCE_TMDB) => {
    if (!item) return null;

    const posterUrl = getTmdbPosterUrl(item.poster_path);
    const thumbUrl = getTmdbBackdropUrl(item.backdrop_path, posterUrl);
    const year = getTmdbReleaseYear(item);
    const rating = typeof item.vote_average === "number" ? item.vote_average : null;
    const isMovie = Boolean(item.title || item.runtime || item.release_date);
    const mediaType = getTmdbMediaType(item, isMovie);
    const movieTitle = getTmdbTitle(item);
    const movieSlug = resolveTmdbSlug(item, movieTitle);

    return {
        ...item,
        id: item.id,
        tmdbId: item.id,
        tmdb_id: item.id,
        tmdb: item,
        slug: movieSlug,
        name: movieTitle,
        origin_name: getTmdbOriginTitle(item),
        poster_url: posterUrl,
        thumb_url: thumbUrl,
        poster: posterUrl,
        thumbnail: thumbUrl,
        year: year,
        quality: getTmdbQuality(rating),
        rating: rating,
        vote_count: item.vote_count ?? 0,
        lang: item.original_language ?? "en",
        content: item.overview ?? "",
        source: source || SOURCES.SOURCE_TMDB,
        media_type: mediaType,
        type: mediaType === MEDIA_TYPES.MOVIE ? "single" : "series",
        time: getTmdbDuration(item),
        category: resolveTmdbCategories(item.genres),
        actor: resolveTmdbActors(item.credits),
        director: getTmdbDirector(item),
    };
};

/**
 * Lấy danh sách phim trending / thịnh hành / xem nhiều từ TMDB theo Region VN
 * @param {object} params - Tham số truy vấn { mediaType, timeWindow, page, language, region }
 */
export const fetchTMDBTrending = async ({
    mediaType = MEDIA_TYPES.ALL,
    timeWindow = TIMEFRAMES.WEEK,
    page = 1,
    language = DEFAULT_TMDB_LANG,
    region = DEFAULT_REGION,
} = {}) => {
    const baseUrl = CONFIG.TMDB_BASE_URL;
    const regionParam = region ? `&region=${region}` : "";
    const data = await fetchTMDBJson(
        (apiKey) => `${baseUrl}/trending/${mediaType}/${timeWindow}?api_key=${apiKey}&language=${language}&page=${page}${regionParam}`,
    );

    if (!data) return { items: [], totalPages: 1, totalItems: 0 };
    const results = Array.isArray(data.results) ? data.results : [];
    const items = results.map((item) => normalizeTMDBMovie(item));

    return {
        items,
        totalPages: data.total_pages || 1,
        totalItems: data.total_results || items.length,
        page: data.page || page,
    };
};

/**
 * Lấy danh sách phim phổ biến (Popular) từ TMDB theo Region VN
 * @param {object} params - Tham số truy vấn { mediaType, page, language, region }
 */
export const fetchTMDBPopular = async ({
    mediaType = MEDIA_TYPES.MOVIE,
    page = 1,
    language = DEFAULT_TMDB_LANG,
    region = DEFAULT_REGION,
} = {}) => {
    const baseUrl = CONFIG.TMDB_BASE_URL;
    const regionParam = region ? `&region=${region}` : "";
    const data = await fetchTMDBJson(
        (apiKey) => `${baseUrl}/${mediaType}/popular?api_key=${apiKey}&language=${language}&page=${page}${regionParam}`,
    );

    if (!data) return { items: [], totalPages: 1, totalItems: 0 };
    const results = Array.isArray(data.results) ? data.results : [];
    const items = results.map((item) => normalizeTMDBMovie(item));

    return {
        items,
        totalPages: data.total_pages || 1,
        totalItems: data.total_results || items.length,
        page: data.page || page,
    };
};

/**
 * Lấy danh sách phim đang chiếu rạp (Now Playing) từ TMDB theo Region VN
 * @param {object} params - Tham số truy vấn { page, language, region }
 */
export const fetchTMDBNowPlaying = async ({
    page = 1,
    language = DEFAULT_TMDB_LANG,
    region = DEFAULT_REGION,
    withReleaseType = TMDB_THEATRICAL_RELEASE_TYPES,
} = {}) => {
    const baseUrl = CONFIG.TMDB_BASE_URL;
    const regionParam = region ? `&region=${region}` : "";
    const releaseTypeParam = withReleaseType ? `&with_release_type=${withReleaseType}` : "";
    const data = await fetchTMDBJson(
        (apiKey) => `${baseUrl}/${TMDB_ENDPOINTS.NOW_PLAYING}?api_key=${apiKey}&language=${language}&page=${page}${regionParam}${releaseTypeParam}`,
    );

    if (!data) return { items: [], totalPages: 1, totalItems: 0 };
    const results = Array.isArray(data.results) ? data.results : [];
    const items = results.map((item) => normalizeTMDBMovie(item));

    return {
        items,
        totalPages: data.total_pages || 1,
        totalItems: data.total_results || items.length,
        page: data.page || page,
    };
};

/**
 * Lấy danh sách phim được đánh giá cao nhất (Top Rated) từ TMDB theo Region VN
 * @param {object} params - Tham số truy vấn { mediaType, page, language, region }
 */
export const fetchTMDBTopRated = async ({
    mediaType = MEDIA_TYPES.MOVIE,
    page = 1,
    language = DEFAULT_TMDB_LANG,
    region = DEFAULT_REGION,
} = {}) => {
    const baseUrl = CONFIG.TMDB_BASE_URL;
    const regionParam = region ? `&region=${region}` : "";
    const data = await fetchTMDBJson(
        (apiKey) => `${baseUrl}/${mediaType}/top_rated?api_key=${apiKey}&language=${language}&page=${page}${regionParam}`,
    );

    if (!data) return { items: [], totalPages: 1, totalItems: 0 };
    const results = Array.isArray(data.results) ? data.results : [];
    const items = results.map((item) => normalizeTMDBMovie(item));

    return {
        items,
        totalPages: data.total_pages || 1,
        totalItems: data.total_results || items.length,
        page: data.page || page,
    };
};

/**
 * Lấy danh sách Top View theo khung thời gian: day (Hôm nay), week (Tuần này), month (Tháng này / Phổ biến) chuẩn Region VN
 * @param {object} params - { timeframe: 'day' | 'week' | 'month', page, language, region }
 */
export const fetchTMDBTopViewByTimeframe = async ({
    timeframe = TIMEFRAMES.WEEK,
    page = 1,
    language = DEFAULT_TMDB_LANG,
    region = DEFAULT_REGION,
} = {}) => {
    if (timeframe === TIMEFRAMES.DAY) {
        return fetchTMDBTrending({ mediaType: MEDIA_TYPES.ALL, timeWindow: TIMEFRAMES.DAY, page, language, region });
    }
    if (timeframe === TIMEFRAMES.MONTH) {
        return fetchTMDBPopular({ mediaType: MEDIA_TYPES.MOVIE, page, language, region });
    }
    // Mặc định là week
    return fetchTMDBTrending({ mediaType: MEDIA_TYPES.ALL, timeWindow: TIMEFRAMES.WEEK, page, language, region });
};

const extractBrandLogo = (type, mainData) => {
    if (type === "tv" && mainData.networks?.length > 0) {
        const net = mainData.networks.find((n) => n.logo_path) || mainData.networks[0];
        return net?.logo_path || null;
    }
    if (mainData.production_companies?.length > 0) {
        const comp = mainData.production_companies.find((c) => c.logo_path) || mainData.production_companies[0];
        return comp?.logo_path || null;
    }
    return null;
};

const fetchTMDBImagesMetadata = async (baseUrl, endpoint, tmdbId) => {
    try {
        const imgData = await fetchTMDBJson(
            (apiKey) => `${baseUrl}/${endpoint}/${tmdbId}/images?api_key=${apiKey}&include_image_language=vi,null,en`,
        );
        if (!imgData) return {};

        const titleLogo = imgData.logos?.find((l) => l.iso_639_1 === "vi") || imgData.logos?.find((l) => l.iso_639_1 === "en");
        const viPoster = imgData.posters?.find((p) => p.iso_639_1 === "vi");
        const viBackdrop = imgData.backdrops?.find((b) => b.iso_639_1 === "vi");

        return {
            titleLogoPath: titleLogo?.file_path || null,
            posterPath: viPoster?.file_path || null,
            backdropPath: viBackdrop?.file_path || null,
        };
    } catch {
        return {};
    }
};

const fetchTMDBSeasonMetadata = async (baseUrl, tmdbId, parsedSeason, language, mainData) => {
    try {
        const seasonData = await fetchTMDBJson(
            (apiKey) => `${baseUrl}/tv/${tmdbId}/season/${parsedSeason}?api_key=${apiKey}&language=${language}&append_to_response=images&include_image_language=vi,null,en`,
        );
        if (!seasonData) return {};

        const viSeasonPoster = seasonData.images?.posters?.find((p) => p.iso_639_1 === "vi");
        const seasonPoster = viSeasonPoster?.file_path || seasonData.poster_path || null;
        const seasonNameVi = seasonData.name ? `${mainData.name || ""} (${seasonData.name})` : null;
        const seasonBackdrop = seasonData.episodes?.[0]?.still_path || null;

        return {
            posterPath: seasonPoster,
            nameVi: seasonNameVi,
            backdropPath: seasonBackdrop,
        };
    } catch (error_) {
        console.warn(`Lỗi fetch season ${parsedSeason} của TV ${tmdbId}:`, error_);
        return {};
    }
};

const resolveTmdbMetadataPaths = async ({
    baseUrl,
    endpoint,
    tmdbId,
    language,
    mainData,
    type,
    parsedSeason,
}) => {
    const brandLogoPath = extractBrandLogo(type, mainData);
    let posterPath = mainData.poster_path;
    let backdropPath = mainData.backdrop_path;
    let titleLogoPath = null;
    let nameVi = mainData.title || mainData.name || null;

    const imgMeta = await fetchTMDBImagesMetadata(baseUrl, endpoint, tmdbId);
    if (imgMeta.titleLogoPath) titleLogoPath = imgMeta.titleLogoPath;
    if (imgMeta.posterPath) posterPath = imgMeta.posterPath;
    if (imgMeta.backdropPath) backdropPath = imgMeta.backdropPath;

    if (type === "tv" && parsedSeason) {
        const seasonMeta = await fetchTMDBSeasonMetadata(
            baseUrl,
            tmdbId,
            parsedSeason,
            language,
            mainData,
        );
        if (seasonMeta.posterPath) posterPath = seasonMeta.posterPath;
        if (seasonMeta.nameVi) nameVi = seasonMeta.nameVi;
        if (seasonMeta.backdropPath) backdropPath = seasonMeta.backdropPath;
    }

    return {
        brandLogo: brandLogoPath
            ? `${TMDB_IMAGE_BASE_URL}/${TMDB_IMAGE_SIZES.LOGO}${brandLogoPath}`
            : null,
        titleLogo: titleLogoPath
            ? `${TMDB_IMAGE_BASE_URL}/${TMDB_IMAGE_SIZES.POSTER}${titleLogoPath}`
            : null,
        poster: posterPath
            ? `${TMDB_IMAGE_BASE_URL}/${TMDB_IMAGE_SIZES.POSTER}${posterPath}`
            : null,
        backdrop: backdropPath
            ? `${TMDB_IMAGE_BASE_URL}/${TMDB_IMAGE_SIZES.BACKDROP}${backdropPath}`
            : null,
        nameVi,
        seasonNumber: parsedSeason,
    };
};

/**
 * Lấy toàn bộ metadata TMDB (Brand Logo, Poster, Backdrop, Title Logo PNG) phục vụ Branding
 * @param {object} params - { tmdbId, type: 'movie' | 'tv', language, seasonNumber }
 */
export const fetchTMDBMetadata = async ({
    tmdbId,
    type = "movie",
    language = "vi-VN",
    seasonNumber = null,
} = {}) => {
    if (!tmdbId) return null;

    const parsedSeason = seasonNumber && Number(seasonNumber) > 0 ? Number(seasonNumber) : null;
    const cacheKey = `tmdb_meta_${type}_${tmdbId}_s${parsedSeason || 0}_${language}`;

    return smartCache.fetchWithCache({
        key: cacheKey,
        ttl: CACHE_TTL.STATIC_METADATA,
        swr: true,
        fetcher: async () => {
            const baseUrl = CONFIG.TMDB_BASE_URL;
            const endpoint = type === "tv" ? "tv" : "movie";
            const mainData = await fetchTMDBJson(
                (apiKey) => `${baseUrl}/${endpoint}/${tmdbId}?api_key=${apiKey}&language=${language}`,
            );
            if (!mainData) return null;

            return resolveTmdbMetadataPaths({
                baseUrl,
                endpoint,
                tmdbId,
                language,
                mainData,
                type,
                parsedSeason,
            });
        },
    });
};

/**
 * Lấy thông tin chi tiết của diễn viên theo TMDB Person ID
 * @param {string|number} personId 
 * @param {string} language 
 */
export const fetchTMDBPersonDetail = async (personId, language = "vi-VN") => {
    if (!personId) return null;
    const cacheKey = `tmdb_person_${personId}_${language}`;

    return smartCache.fetchWithCache({
        key: cacheKey,
        ttl: CACHE_TTL.DETAIL,
        swr: true,
        fetcher: async () => {
            const baseUrl = CONFIG.TMDB_BASE_URL;
            return await fetchTMDBJson(
                (apiKey) => `${baseUrl}/person/${personId}?api_key=${apiKey}&language=${language}`,
            );
        },
    });
};
const normalizePersonCreditItem = (item) => {
    return normalizeTMDBMovie(item);
};

const getPersonItemReleaseTime = (item) => {
    const dateStr = item.release_date || item.first_air_date;
    if (dateStr) {
        const time = new Date(dateStr).getTime();
        if (!Number.isNaN(time)) return time;
    }
    if (typeof item.year === "number" && !Number.isNaN(item.year)) {
        return new Date(item.year, 0, 1).getTime();
    }
    return 0;
};

const sortPersonCreditsByYearDesc = (a, b) => {
    const timeA = getPersonItemReleaseTime(a);
    const timeB = getPersonItemReleaseTime(b);

    if (timeA !== timeB) {
        return timeB - timeA; // Năm mới nhất xếp trước (9-0)
    }

    return (b.popularity || 0) - (a.popularity || 0);
};

/**
 * Lấy danh sách phim mà nghệ sĩ tham gia với vai trò diễn viên (Actor/Cast)
 * và sắp xếp theo thứ tự sự nghiệp từ năm mới nhất (9-0)
 * @param {string|number} personId 
 * @param {string} language 
 */
export const fetchTMDBPersonCredits = async (personId, language = "vi-VN") => {
    if (!personId) return { items: [], categories: [], totalPages: 1, totalItems: 0 };
    const cacheKey = `tmdb_person_actor_credits_${personId}_${language}`;

    return smartCache.fetchWithCache({
        key: cacheKey,
        ttl: CACHE_TTL.DETAIL,
        swr: true,
        fetcher: async () => {
            const baseUrl = CONFIG.TMDB_BASE_URL;
            const data = await fetchTMDBJson(
                (apiKey) => `${baseUrl}/person/${personId}/combined_credits?api_key=${apiKey}&language=${language}`,
            );
            if (!data) return { items: [], categories: [], totalPages: 1, totalItems: 0 };
            const castList = Array.isArray(data.cast) ? data.cast : [];

            const castMap = new Map();
            for (const item of castList) {
                if (!item?.id) continue;
                if (!castMap.has(item.id)) {
                    const normalized = normalizePersonCreditItem(item);
                    if (normalized) {
                        castMap.set(item.id, normalized);
                    }
                }
            }

            const castItems = Array.from(castMap.values()).sort(sortPersonCreditsByYearDesc);

            return {
                items: castItems,
                castItems,
                crewItems: [],
                categories: [],
                totalPages: 1,
                totalItems: castItems.length,
                page: 1,
            };
        },
    });
};

/**
 * Lấy danh sách phim liên quan / đề xuất tương tự từ TMDB (Recommendations + Similar)
 * @param {string|number} tmdbId - ID phim trên TMDB
 * @param {string} mediaType - Loại phim ("movie" hoặc "tv")
 * @param {string} language - Mã ngôn ngữ (mặc định "vi-VN")
 */
export const fetchTMDBRelated = async (tmdbId, mediaType = "movie", language = DEFAULT_TMDB_LANG) => {
    if (!tmdbId) return { items: [], totalItems: 0 };
    const type = mediaType === "tv" || mediaType === "series" ? "tv" : "movie";
    const cacheKey = `tmdb_related_${type}_${tmdbId}_${language}`;

    return smartCache.fetchWithCache({
        key: cacheKey,
        ttl: CACHE_TTL.DETAIL,
        swr: true,
        fetcher: async () => {
            const baseUrl = CONFIG.TMDB_BASE_URL;

            // Fetch cả recommendations và similar song song qua resilient pool
            const [recData, simData] = await Promise.all([
                fetchTMDBJson((apiKey) => `${baseUrl}/${type}/${tmdbId}/recommendations?api_key=${apiKey}&language=${language}&page=1`),
                fetchTMDBJson((apiKey) => `${baseUrl}/${type}/${tmdbId}/similar?api_key=${apiKey}&language=${language}&page=1`),
            ]);

            const map = new Map();
            const addToList = (results) => {
                if (Array.isArray(results)) {
                    results.forEach((item) => {
                        if (item?.id && !map.has(item.id)) {
                            map.set(item.id, item);
                        }
                    });
                }
            };

            addToList(recData?.results);
            addToList(simData?.results);

            // Fallback nếu kết quả ít hơn 6 phim
            if (map.size < 6 && language !== "en-US") {
                const fallbackData = await fetchTMDBJson(
                    (apiKey) => `${baseUrl}/${type}/${tmdbId}/recommendations?api_key=${apiKey}&language=en-US&page=1`,
                );
                addToList(fallbackData?.results);
            }

            const items = Array.from(map.values())
                .filter((item) => item && (item.poster_path || item.backdrop_path))
                .map((item) => normalizeTMDBMovie(item))
                .filter(Boolean);

            return {
                items,
                totalItems: items.length,
            };
        },
    });
};

/**
 * Tìm kiếm TMDB kết quả khớp đầu tiên theo tên phim (dành cho các phim nguồn chưa có sẵn TMDB ID)
 * @param {string} query - Tên phim cần tìm
 * @param {string} mediaType - "movie" hoặc "tv"
 * @returns {Promise<{ id: string, media_type: string }|null>}
 */
export const searchTMDBFirstMatch = async (query, mediaType = null) => {
    if (!query || typeof query !== "string") return null;
    const cleanQuery = query.replace(/\(.*?\)/g, "").trim();
    if (!cleanQuery) return null;

    const baseUrl = CONFIG.TMDB_BASE_URL;
    if (!baseUrl) return null;

    const endpoint = mediaType === "tv" || mediaType === "movie" ? mediaType : "multi";
    const cacheKey = `tmdb_search_${endpoint}_${cleanQuery.toLowerCase()}`;

    return smartCache.fetchWithCache({
        key: cacheKey,
        ttl: CACHE_TTL.LISTING,
        fetcher: async () => {
            const data = await fetchTMDBJson(
                (apiKey) => `${baseUrl}/search/${endpoint}?api_key=${apiKey}&query=${encodeURIComponent(cleanQuery)}&page=1`,
            );
            const first = data?.results?.[0];
            if (!first?.id) return null;
            return {
                id: String(first.id),
                media_type: first.media_type || mediaType || (first.title ? "movie" : "tv"),
            };
        },
    });
};

export const tmdbService = {
    getNextTmdbApiKey,
    fetchTMDBApi,
    fetchTMDBJson,
    fetchTMDBTrending,
    fetchTMDBPopular,
    fetchTMDBNowPlaying,
    fetchTMDBTopRated,
    fetchTMDBTopViewByTimeframe,
    fetchTMDBMetadata,
    fetchTMDBPersonDetail,
    fetchTMDBPersonCredits,
    fetchTMDBRelated,
    searchTMDBFirstMatch,
    normalizeTMDBMovie,
};

