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

const CONFIG = {
    TMDB_API_KEY: import.meta.env.VITE_TMDB_API_KEY,
    TMDB_BASE_URL: import.meta.env.VITE_TMDB_BASE_URL,
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

    return {
        ...item,
        id: item.id,
        tmdbId: item.id,
        tmdb_id: item.id,
        tmdb: item,
        slug: item.id ? String(item.id) : "",
        name: getTmdbTitle(item),
        origin_name: getTmdbOriginTitle(item),
        poster_url: posterUrl,
        thumb_url: thumbUrl,
        poster: posterUrl,
        thumbnail: thumbUrl,
        year: year,
        quality: getTmdbQuality(rating),
        rating: rating,
        vote_count: item.vote_count || 0,
        lang: item.original_language || "en",
        content: item.overview || "",
        source: source || SOURCES.SOURCE_TMDB,
        media_type: mediaType,
        type: mediaType === MEDIA_TYPES.MOVIE ? "single" : "series",
        time: getTmdbDuration(item),
        category: (item.genres || []).map((g) => ({ id: g.id, name: g.name, slug: String(g.id) })),
        actor: (item.credits?.cast || []).map((c) => c.name),
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
    const apiKey = CONFIG.TMDB_API_KEY;
    const baseUrl = CONFIG.TMDB_BASE_URL;
    const regionParam = region ? `&region=${region}` : "";
    const url = `${baseUrl}/trending/${mediaType}/${timeWindow}?api_key=${apiKey}&language=${language}&page=${page}${regionParam}`;

    try {
        const res = await fetch(url);
        if (!res.ok) return { items: [], totalPages: 1, totalItems: 0 };
        const data = await res.json();
        const results = Array.isArray(data.results) ? data.results : [];
        const items = results.map((item) => normalizeTMDBMovie(item));

        return {
            items,
            totalPages: data.total_pages || 1,
            totalItems: data.total_results || items.length,
            page: data.page || page,
        };
    } catch (e) {
        console.error("fetchTMDBTrending error:", e);
        return { items: [], totalPages: 1, totalItems: 0 };
    }
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
    const apiKey = CONFIG.TMDB_API_KEY;
    const baseUrl = CONFIG.TMDB_BASE_URL;
    const regionParam = region ? `&region=${region}` : "";
    const url = `${baseUrl}/${mediaType}/popular?api_key=${apiKey}&language=${language}&page=${page}${regionParam}`;

    try {
        const res = await fetch(url);
        if (!res.ok) return { items: [], totalPages: 1, totalItems: 0 };
        const data = await res.json();
        const results = Array.isArray(data.results) ? data.results : [];
        const items = results.map((item) => normalizeTMDBMovie(item));

        return {
            items,
            totalPages: data.total_pages || 1,
            totalItems: data.total_results || items.length,
            page: data.page || page,
        };
    } catch (e) {
        console.error("fetchTMDBPopular error:", e);
        return { items: [], totalPages: 1, totalItems: 0 };
    }
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
    const apiKey = CONFIG.TMDB_API_KEY;
    const baseUrl = CONFIG.TMDB_BASE_URL;
    const regionParam = region ? `&region=${region}` : "";
    const releaseTypeParam = withReleaseType ? `&with_release_type=${withReleaseType}` : "";
    const url = `${baseUrl}/${TMDB_ENDPOINTS.NOW_PLAYING}?api_key=${apiKey}&language=${language}&page=${page}${regionParam}${releaseTypeParam}`;

    try {
        const res = await fetch(url);
        if (!res.ok) return { items: [], totalPages: 1, totalItems: 0 };
        const data = await res.json();
        const results = Array.isArray(data.results) ? data.results : [];
        const items = results.map((item) => normalizeTMDBMovie(item));

        return {
            items,
            totalPages: data.total_pages || 1,
            totalItems: data.total_results || items.length,
            page: data.page || page,
        };
    } catch (e) {
        console.error("fetchTMDBNowPlaying error:", e);
        return { items: [], totalPages: 1, totalItems: 0 };
    }
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
    const apiKey = CONFIG.TMDB_API_KEY;
    const baseUrl = CONFIG.TMDB_BASE_URL;
    const regionParam = region ? `&region=${region}` : "";
    const url = `${baseUrl}/${mediaType}/top_rated?api_key=${apiKey}&language=${language}&page=${page}${regionParam}`;

    try {
        const res = await fetch(url);
        if (!res.ok) return { items: [], totalPages: 1, totalItems: 0 };
        const data = await res.json();
        const results = Array.isArray(data.results) ? data.results : [];
        const items = results.map((item) => normalizeTMDBMovie(item));

        return {
            items,
            totalPages: data.total_pages || 1,
            totalItems: data.total_results || items.length,
            page: data.page || page,
        };
    } catch (e) {
        console.error("fetchTMDBTopRated error:", e);
        return { items: [], totalPages: 1, totalItems: 0 };
    }
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

const fetchTMDBImagesMetadata = async (baseUrl, endpoint, tmdbId, apiKey) => {
    const imgUrl = `${baseUrl}/${endpoint}/${tmdbId}/images?api_key=${apiKey}&include_image_language=vi,null,en`;
    try {
        const imgRes = await fetch(imgUrl);
        if (!imgRes.ok) return {};
        const imgData = await imgRes.json();

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

const fetchTMDBSeasonMetadata = async (baseUrl, tmdbId, parsedSeason, apiKey, language, mainData) => {
    try {
        const seasonUrl = `${baseUrl}/tv/${tmdbId}/season/${parsedSeason}?api_key=${apiKey}&language=${language}&append_to_response=images&include_image_language=vi,null,en`;
        const seasonRes = await fetch(seasonUrl);
        if (!seasonRes.ok) return {};
        const seasonData = await seasonRes.json();

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
        console.warn(`Error fetching season ${parsedSeason} for TV ${tmdbId}:`, error_);
        return {};
    }
};

const resolveTmdbMetadataPaths = async ({
    baseUrl,
    endpoint,
    tmdbId,
    apiKey,
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

    const imgMeta = await fetchTMDBImagesMetadata(baseUrl, endpoint, tmdbId, apiKey);
    if (imgMeta.titleLogoPath) titleLogoPath = imgMeta.titleLogoPath;
    if (imgMeta.posterPath) posterPath = imgMeta.posterPath;
    if (imgMeta.backdropPath) backdropPath = imgMeta.backdropPath;

    if (type === "tv" && parsedSeason) {
        const seasonMeta = await fetchTMDBSeasonMetadata(
            baseUrl,
            tmdbId,
            parsedSeason,
            apiKey,
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
            const apiKey = CONFIG.TMDB_API_KEY;
            const baseUrl = CONFIG.TMDB_BASE_URL;
            const endpoint = type === "tv" ? "tv" : "movie";
            const mainUrl = `${baseUrl}/${endpoint}/${tmdbId}?api_key=${apiKey}&language=${language}`;

            const mainRes = await fetch(mainUrl);
            if (!mainRes.ok) return null;
            const mainData = await mainRes.json();

            return resolveTmdbMetadataPaths({
                baseUrl,
                endpoint,
                tmdbId,
                apiKey,
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
            const apiKey = CONFIG.TMDB_API_KEY;
            const baseUrl = CONFIG.TMDB_BASE_URL;
            const url = `${baseUrl}/person/${personId}?api_key=${apiKey}&language=${language}`;

            const res = await fetch(url);
            if (!res.ok) return null;
            return await res.json();
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
            const apiKey = CONFIG.TMDB_API_KEY;
            const baseUrl = CONFIG.TMDB_BASE_URL;
            const url = `${baseUrl}/person/${personId}/combined_credits?api_key=${apiKey}&language=${language}`;

            const res = await fetch(url);
            if (!res.ok) return { items: [], categories: [], totalPages: 1, totalItems: 0 };
            const data = await res.json();
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
            const apiKey = CONFIG.TMDB_API_KEY;
            const baseUrl = CONFIG.TMDB_BASE_URL;

            // Fetch cả recommendations và similar song song
            const recUrl = `${baseUrl}/${type}/${tmdbId}/recommendations?api_key=${apiKey}&language=${language}&page=1`;
            const simUrl = `${baseUrl}/${type}/${tmdbId}/similar?api_key=${apiKey}&language=${language}&page=1`;

            const [recRes, simRes] = await Promise.all([
                fetch(recUrl).then((r) => (r.ok ? r.json() : null)).catch(() => null),
                fetch(simUrl).then((r) => (r.ok ? r.json() : null)).catch(() => null),
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

            addToList(recRes?.results);
            addToList(simRes?.results);

            // Fallback nếu kết quả ít hơn 6 phim
            if (map.size < 6 && language !== "en-US") {
                try {
                    const fallbackUrl = `${baseUrl}/${type}/${tmdbId}/recommendations?api_key=${apiKey}&language=en-US&page=1`;
                    const fallbackRes = await fetch(fallbackUrl);
                    if (fallbackRes.ok) {
                        const fallbackData = await fallbackRes.json();
                        addToList(fallbackData?.results);
                    }
                } catch (e) {
                    console.warn("fetchTMDBRelated fallback error:", e);
                }
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

export const tmdbService = {
    fetchTMDBTrending,
    fetchTMDBPopular,
    fetchTMDBNowPlaying,
    fetchTMDBTopRated,
    fetchTMDBTopViewByTimeframe,
    fetchTMDBMetadata,
    fetchTMDBPersonDetail,
    fetchTMDBPersonCredits,
    fetchTMDBRelated,
    normalizeTMDBMovie,
};
