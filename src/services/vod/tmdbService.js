import {
    SOURCES,
    TMDB_IMAGE_BASE_URL,
    TMDB_IMAGE_SIZES,
} from "../../constants/vodConstants";

const CONFIG = {
    TMDB_API_KEY: import.meta.env.VITE_TMDB_API_KEY,
    TMDB_BASE_URL: import.meta.env.VITE_TMDB_BASE_URL || "https://api.themoviedb.org/3",
};

/**
 * Chuẩn hóa một item phim trả về từ TMDB API thành format chung của hệ sinh thái VOD
 * @param {object} item - Dữ liệu thô từ TMDB
 * @param {string} source - Nguồn dữ liệu (mặc định source_tmdb)
 */
export const normalizeTMDBMovie = (item, source = SOURCES.SOURCE_TMDB) => {
    if (!item) return null;

    const posterUrl = item.poster_path
        ? `${TMDB_IMAGE_BASE_URL}/${TMDB_IMAGE_SIZES.POSTER}${item.poster_path}`
        : "";
    const thumbUrl = item.backdrop_path
        ? `${TMDB_IMAGE_BASE_URL}/${TMDB_IMAGE_SIZES.BACKDROP}${item.backdrop_path}`
        : posterUrl;

    const releaseDate = item.release_date || item.first_air_date;
    const year = releaseDate ? new Date(releaseDate).getFullYear() : null;
    const rating = typeof item.vote_average === "number" ? item.vote_average : null;

    return {
        ...item,
        id: item.id,
        tmdbId: item.id,
        slug: item.id ? `tmdb-${item.id}` : "",
        name: item.title || item.name || item.original_title || item.original_name || "",
        origin_name: item.original_title || item.original_name || item.title || item.name || "",
        poster_url: posterUrl,
        thumb_url: thumbUrl,
        poster: posterUrl,
        thumbnail: thumbUrl,
        year: year,
        quality: rating && rating > 0 ? `${rating.toFixed(1)}` : "HD",
        rating: rating,
        vote_count: item.vote_count || 0,
        lang: item.original_language || "en",
        content: item.overview || "",
        source: source || SOURCES.SOURCE_TMDB,
        media_type: item.media_type || (item.title ? "movie" : "tv"),
    };
};

/**
 * Lấy danh sách phim trending / thịnh hành / xem nhiều từ TMDB theo Region VN
 * @param {object} params - Tham số truy vấn { mediaType, timeWindow, page, language, region }
 */
export const fetchTMDBTrending = async ({
    mediaType = "all",
    timeWindow = "week",
    page = 1,
    language = "vi-VN",
    region = "VN",
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
    mediaType = "movie",
    page = 1,
    language = "vi-VN",
    region = "VN",
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
 * Lấy danh sách Top View theo khung thời gian: day (Hôm nay), week (Tuần này), month (Tháng này / Phổ biến) chuẩn Region VN
 * @param {object} params - { timeframe: 'day' | 'week' | 'month', page, language, region }
 */
export const fetchTMDBTopViewByTimeframe = async ({
    timeframe = "week",
    page = 1,
    language = "vi-VN",
    region = "VN",
} = {}) => {
    if (timeframe === "day") {
        return fetchTMDBTrending({ mediaType: "all", timeWindow: "day", page, language, region });
    }
    if (timeframe === "month") {
        return fetchTMDBPopular({ mediaType: "movie", page, language, region });
    }
    // Mặc định là week
    return fetchTMDBTrending({ mediaType: "all", timeWindow: "week", page, language, region });
};

// Cache lưu trữ metadata TMDB trong phiên làm việc
const tmdbMetadataCache = new Map();

/**
 * Lấy chi tiết Branding, Logo và Poster/Backdrop (ưu tiên hình ảnh Tiếng Việt) từ TMDB chính chủ
 * @param {object} params - { tmdbId, type: 'movie' | 'tv', language, seasonNumber }
 */
export const fetchTMDBMetadata = async ({
    tmdbId,
    type = "movie",
    language = "vi-VN",
    seasonNumber = null,
} = {}) => {
    if (!tmdbId) return null;

    const apiKey = CONFIG.TMDB_API_KEY;
    const baseUrl = CONFIG.TMDB_BASE_URL;
    const parsedSeason = seasonNumber && Number(seasonNumber) > 0 ? Number(seasonNumber) : null;
    const cacheKey = `${type}_${tmdbId}_s${parsedSeason || 0}_${language}`;

    if (tmdbMetadataCache.has(cacheKey)) {
        return tmdbMetadataCache.get(cacheKey);
    }

    try {
        const endpoint = type === "tv" ? "tv" : "movie";
        const mainUrl = `${baseUrl}/${endpoint}/${tmdbId}?api_key=${apiKey}&language=${language}`;

        const mainRes = await fetch(mainUrl);
        if (!mainRes.ok) return null;
        const mainData = await mainRes.json();

        let brandLogoPath = null;
        if (type === "tv" && mainData.networks?.length > 0) {
            const net = mainData.networks.find((n) => n.logo_path) || mainData.networks[0];
            brandLogoPath = net.logo_path;
        } else if (mainData.production_companies?.length > 0) {
            const comp = mainData.production_companies.find((c) => c.logo_path) || mainData.production_companies[0];
            brandLogoPath = comp.logo_path;
        }

        let posterPath = mainData.poster_path;
        let backdropPath = mainData.backdrop_path;
        let titleLogoPath = null;
        let nameVi = mainData.title || mainData.name || null;

        // Lấy hình ảnh từ endpoint images (ưu tiên poster, backdrop và logo Tiếng Việt)
        const imgUrl = `${baseUrl}/${endpoint}/${tmdbId}/images?api_key=${apiKey}&include_image_language=vi,null,en`;
        const imgRes = await fetch(imgUrl);
        if (imgRes.ok) {
            const imgData = await imgRes.json();
            
            // Ưu tiên Logo tiếng Việt
            if (imgData.logos?.length > 0) {
                const viLogo = imgData.logos.find((l) => l.iso_639_1 === "vi");
                const enLogo = imgData.logos.find((l) => l.iso_639_1 === "en");
                const logo = viLogo || enLogo || null;
                if (logo) titleLogoPath = logo.file_path;
            }

            // Ưu tiên Poster tiếng Việt
            if (imgData.posters?.length > 0) {
                const viPoster = imgData.posters.find((p) => p.iso_639_1 === "vi");
                if (viPoster) {
                    posterPath = viPoster.file_path;
                }
            }

            // Ưu tiên Backdrop tiếng Việt
            if (imgData.backdrops?.length > 0) {
                const viBackdrop = imgData.backdrops.find((b) => b.iso_639_1 === "vi");
                if (viBackdrop) {
                    backdropPath = viBackdrop.file_path;
                }
            }
        }

        // Nếu là TV Show và có chỉ định Season, ưu tiên lấy poster và still_path riêng của Season
        if (type === "tv" && parsedSeason) {
            try {
                const seasonUrl = `${baseUrl}/tv/${tmdbId}/season/${parsedSeason}?api_key=${apiKey}&language=${language}&append_to_response=images&include_image_language=vi,null,en`;
                const seasonRes = await fetch(seasonUrl);
                if (seasonRes.ok) {
                    const seasonData = await seasonRes.json();
                    
                    // Ưu tiên poster tiếng Việt của Season nếu có
                    if (seasonData.images?.posters?.length > 0) {
                        const viSeasonPoster = seasonData.images.posters.find((p) => p.iso_639_1 === "vi");
                        if (viSeasonPoster) {
                            posterPath = viSeasonPoster.file_path;
                        } else if (seasonData.poster_path) {
                            posterPath = seasonData.poster_path;
                        }
                    } else if (seasonData.poster_path) {
                        posterPath = seasonData.poster_path;
                    }

                    if (seasonData.name) {
                        nameVi = `${mainData.name || ""} (${seasonData.name})`;
                    }
                    // Nếu tập đầu tiên của mùa có ảnh still HD sắc nét, dùng làm backdrop riêng của mùa
                    if (seasonData.episodes?.[0]?.still_path) {
                        backdropPath = seasonData.episodes[0].still_path;
                    }
                }
            } catch (errSeason) {
                console.warn(`Error fetching season ${parsedSeason} for TV ${tmdbId}:`, errSeason);
            }
        }

        const metadata = {
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
            nameVi: nameVi,
            seasonNumber: parsedSeason,
        };

        tmdbMetadataCache.set(cacheKey, metadata);
        return metadata;
    } catch (e) {
        console.warn("fetchTMDBMetadata error:", e);
        return null;
    }
};

export const tmdbService = {
    fetchTMDBTrending,
    fetchTMDBPopular,
    fetchTMDBTopViewByTimeframe,
    fetchTMDBMetadata,
    normalizeTMDBMovie,
};
