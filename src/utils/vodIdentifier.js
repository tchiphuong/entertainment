/**
 * VOD Identifier - Module định danh phim chuẩn hóa toàn hệ thống
 * 
 * ĐẶC TÍNH:
 * - 100% Pure JavaScript, KHÔNG phụ thuộc React, DOM hay Web APIs (window, document, localStorage).
 * - Dùng chung 100% cho cả Web App và TV App (React Native / Android TV).
 * - Phân biệt rạch ròi giữa Phim điện ảnh (movie) và Phim truyền hình (tv) trên TMDB namespace.
 * - Hỗ trợ Season cho CẢ phim bộ và phim lẻ nhiều phần (franchise/sequels) mà không bị nhầm loại phim.
 */

const ROMAN_SEASON_MAP = {
    i: 1,
    ii: 2,
    iii: 3,
    iv: 4,
    v: 5,
    vi: 6,
    vii: 7,
    viii: 8,
    ix: 9,
    x: 10,
};

const TV_TYPES = new Set(["tv", "series", "phim-bo", "tvshows"]);
const MOVIE_TYPES = new Set(["movie", "single", "phim-le"]);

const matchKeywordSeason = (text) => {
    const kwMatch = /(?:ph[aâầ]n|season|m[uù]a|ss|part)\.?\s*(\d{1,2})/i.exec(text);
    if (kwMatch?.[1]) {
        const num = Number.parseInt(kwMatch[1], 10);
        if (num > 0 && num <= 50) return num;
    }
    return null;
};

const matchRomanSeason = (text) => {
    const romanMatch = /(?:ph[aâầ]n|season|m[uù]a)\.?\s*(i{1,3}|iv|v|vi{0,3}|ix|x)\b/i.exec(text);
    if (romanMatch?.[1]) {
        const roman = romanMatch[1].toLowerCase();
        if (ROMAN_SEASON_MAP[roman]) return ROMAN_SEASON_MAP[roman];
    }
    return null;
};

const matchPrefixSSeason = (text) => {
    const sMatch = /(?:^|\b|\s|-)s(\d{1,2})(?:$|\b|\s|-|\.)/i.exec(text);
    if (sMatch?.[1]) {
        const num = Number.parseInt(sMatch[1], 10);
        if (num > 0 && num <= 50) return num;
    }
    return null;
};

const matchSlugTrailingSeason = (slug) => {
    if (!slug || typeof slug !== "string") return null;
    const slugNumMatch = /(?:^|-)(\d{1,2})$/.exec(slug.trim());
    if (slugNumMatch?.[1]) {
        const num = Number.parseInt(slugNumMatch[1], 10);
        if (num > 1 && num <= 50) return num;
    }
    return null;
};

/**
 * Trích xuất số season/phần từ metadata hoặc tên phim.
 * Áp dụng cho CẢ phim truyền hình và phim điện ảnh (sequels/franchise).
 * @param {object} movie
 * @returns {number|null}
 */
export function extractSeasonNumber(movie) {
    if (!movie) return null;
    if (movie.tmdb?.season && Number(movie.tmdb.season) > 0) {
        return Number(movie.tmdb.season);
    }
    if (movie.season && Number(movie.season) > 0) {
        return Number(movie.season);
    }

    const text = [
        movie.slug,
        movie.name,
        movie.origin_name,
        movie.episode_current,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    return (
        matchKeywordSeason(text) ||
        matchRomanSeason(text) ||
        matchPrefixSSeason(text) ||
        matchSlugTrailingSeason(movie.slug)
    );
}

const getRawTmdbIdCandidate = (movie) => {
    if (!movie) return "";
    if (movie.tmdb?.id) return movie.tmdb.id;
    if (movie.tmdb_id) return movie.tmdb_id;
    if (movie.tmdbId) return movie.tmdbId;
    return movie.id || "";
};

/**
 * Chuyển đổi tên phim thành slug thân thiện URL (hỗ trợ tiếng Việt không dấu)
 * @param {string} text
 * @returns {string}
 */
export function slugify(text) {
    if (!text || typeof text !== "string") return "";
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[đĐ]/g, "d")
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
}

/**
 * Trích xuất TMDB ID chuỗi số từ object phim
 * @param {object} movie
 * @param {string} slugFallback
 * @returns {string}
 */
export function extractTmdbId(movie, slugFallback = "") {
    const rawId = String(getRawTmdbIdCandidate(movie)).trim();
    if (rawId && /^\d+$/.test(rawId)) {
        return rawId;
    }

    const fallback = String(slugFallback || movie?.slug || "").trim();
    if (/^\d+$/.test(fallback)) {
        return fallback;
    }
    if (fallback.startsWith("tmdb-")) {
        const parsed = fallback.slice(5).replace(/^(movie|tv)-/, "").replace(/-s\d+$/, "");
        if (/^\d+$/.test(parsed)) return parsed;
    }

    return "";
}

const isTvByEpisodes = (movie) => {
    if (typeof movie.total_episodes === "number" && movie.total_episodes > 1) {
        return true;
    }
    if (Array.isArray(movie.episodes) && movie.episodes.length > 1) {
        return true;
    }
    const epTotalNum = Number.parseInt(movie.episode_total, 10);
    return !Number.isNaN(epTotalNum) && epTotalNum > 1;
};

const getMediaTypeFromEpisodeCurrent = (epCurrent) => {
    const text = String(epCurrent || "").toLowerCase();
    if (!text) return null;
    if (["full", "hd", "cam", "trailer"].some((kw) => text.includes(kw))) {
        return "movie";
    }
    if (/(?:t[aâậ]p|ep)\.?\s*\d+/i.test(text)) {
        return "tv";
    }
    return null;
};

/**
 * Xác định chính xác loại hình: "movie" (điện ảnh) hay "tv" (truyền hình/nhiều tập).
 * LƯU Ý: Tuyệt đối KHÔNG dùng sự xuất hiện của season để gán là "tv",
 * vì phim điện ảnh nhiều phần (như John Wick 2, Lật Mặt 7) vẫn là "movie".
 * @param {object} movie
 * @returns {"movie"|"tv"}
 */
export function getMediaType(movie) {
    if (!movie) return "movie";

    // 1. Kiểm tra TMDB type rõ ràng
    const tmdbType = (movie.tmdb?.type || movie.media_type || "").toLowerCase();
    if (tmdbType === "tv" || tmdbType === "movie") return tmdbType;

    // 2. Kiểm tra type từ API nguồn
    const rawType = (movie.type || "").toLowerCase();
    if (TV_TYPES.has(rawType)) return "tv";
    if (MOVIE_TYPES.has(rawType)) return "movie";

    // 3. Kiểm tra số lượng tập phim
    if (isTvByEpisodes(movie)) return "tv";

    // 4. Kiểm tra nhãn chiếu rạp
    if (movie.chieurap === true) return "movie";

    // 5. Kiểm tra episode_current
    const typeFromEp = getMediaTypeFromEpisodeCurrent(movie.episode_current);
    if (typeFromEp) return typeFromEp;

    return "movie";
}

/**
 * Sinh TMDB Unique Key chuẩn hóa phân biệt rạch ròi giữa movie và tv.
 * Định dạng: tmdb_{mediaType}_{tmdbId}{_s{season}}
 * Ví dụ:
 * - tmdb_movie_157336 (Interstellar)
 * - tmdb_movie_324552_s2 (John Wick 2)
 * - tmdb_tv_1399_s1 (Game of Thrones S1)
 * @param {object} movie
 * @param {string|number} tmdbId
 * @returns {string}
 */
export function getTmdbUniqueKey(movie, tmdbId) {
    if (!tmdbId) return "";
    const mediaType = getMediaType(movie);
    const season = extractSeasonNumber(movie);
    const seasonSuffix = season ? `_s${season}` : "";
    return `tmdb_${mediaType}_${tmdbId}${seasonSuffix}`;
}

/**
 * Lấy khóa duy nhất (Unique Key) cho một phim để gộp các bản ghi trùng nhau giữa các nguồn
 * @param {object} movie
 * @returns {string}
 */
export function getMovieUniqueKey(movie) {
    if (!movie) return "";
    const tmdbId = extractTmdbId(movie);
    if (tmdbId) return getTmdbUniqueKey(movie, tmdbId);
    return movie.slug ? `slug_${movie.slug}` : `id_${movie._id || movie.id || ""}`;
}

/**
 * Lấy khóa định danh duy nhất cho một item trong history (Firebase Firestore / LocalStorage)
 * Hỗ trợ phân biệt movie/tv và bảo toàn mùa phim.
 * @param {object} item
 * @returns {string}
 */
export function getHistoryItemKey(item) {
    if (!item) return "";
    const tmdbId = extractTmdbId(item, item.slug);
    if (tmdbId) {
        const mediaType = getMediaType(item);
        const season = extractSeasonNumber(item);
        let seasonSuffix = "";
        if (season && season > 1) {
            seasonSuffix = `_s${season}`;
        } else if (mediaType === "tv" && season === 1) {
            seasonSuffix = "_s1";
        }
        return `tmdb_${mediaType}_${tmdbId}${seasonSuffix}`;
    }

    if (item.slug && !item.slug.startsWith("tmdb-")) {
        return `slug_${item.slug.trim()}`;
    }

    const name = (item.name || "").trim().toLowerCase();
    return name ? `name_${name}` : `id_${item._id || item.id || item.slug || ""}`;
}

const hasMatchingTypeAndSeason = (itemA, itemB) => {
    if (getMediaType(itemA) !== getMediaType(itemB)) return false;
    const sa = extractSeasonNumber(itemA);
    const sb = extractSeasonNumber(itemB);
    return !(sa && sb && sa !== sb);
};

/**
 * So khớp an toàn giữa 2 đối tượng phim hoặc lịch sử xem.
 * Kiểm tra đầy đủ: Slug, Name, Cặp TMDB ID + MediaType + Season.
 * @param {object} itemA
 * @param {object} itemB
 * @returns {boolean}
 */
export function isMovieMatch(itemA, itemB) {
    if (!itemA || !itemB) return false;

    // 1. Khớp slug trực tiếp
    if (itemA.slug && itemB.slug && itemA.slug === itemB.slug) {
        return true;
    }

    // 2. Khớp theo TMDB ID
    const tmdbA = extractTmdbId(itemA, itemA.slug);
    const tmdbB = extractTmdbId(itemB, itemB.slug);
    if (tmdbA && tmdbB && tmdbA === tmdbB) {
        return hasMatchingTypeAndSeason(itemA, itemB);
    }

    // 3. Khớp theo tên khi không có TMDB
    const nameA = (itemA.name || "").trim().toLowerCase();
    const nameB = (itemB.name || "").trim().toLowerCase();
    if (nameA && nameB && nameA === nameB) {
        return hasMatchingTypeAndSeason(itemA, itemB);
    }

    return false;
}

const resolveFallbackMovieKey = (item) => {
    if (item.slug) return `slug_${item.slug}`;
    const rawId = item.id || item._id;
    return rawId ? `id_${rawId}` : null;
};

/**
 * Lọc danh sách phim loại bỏ các phần tử trùng lặp theo ID, Slug hoặc TMDB ID.
 * @template T
 * @param {T[]} movies - Danh sách phim cần lọc
 * @returns {T[]}
 */
export function distinctMovies(movies) {
    if (!Array.isArray(movies) || movies.length === 0) return [];
    const seen = new Set();
    const result = [];

    for (const element of movies) {
        const item = element;
        if (!item) continue;
        const key = getMovieUniqueKey(item) || resolveFallbackMovieKey(item);
        if (key) {
            if (!seen.has(key)) {
                seen.add(key);
                result.push(item);
            }
        } else {
            result.push(item);
        }
    }

    return result;
}

const getValidOriginalSlug = (movie) => {
    const rawSlug = typeof movie?.slug === "string" ? movie.slug.trim() : "";
    if (rawSlug && !/^\d+$/.test(rawSlug) && !rawSlug.startsWith("tmdb-")) {
        return rawSlug;
    }
    return "";
};

const getGeneratedTitleSlug = (movie) => {
    const movieTitle = movie?.name || movie?.title || movie?.origin_name || movie?.original_title || "";
    return movieTitle ? slugify(movieTitle) : "";
};

/**
 * Lấy định danh slug phát phim chuẩn hóa cho URL (/vod/play/:slug):
 * - Ưu tiên tuyệt đối slug gốc của nguồn nếu hợp lệ (không phải số, không bắt đầu bằng tmdb-)
 * - Nếu là phim TMDB: sinh slug chữ thân thiện từ tên phim (slugify)
 * @param {object} movie
 * @returns {string}
 */
export function getMoviePlaySlug(movie) {
    if (!movie) return "";

    const originalSlug = getValidOriginalSlug(movie);
    if (originalSlug) {
        return originalSlug;
    }

    const generatedSlug = getGeneratedTitleSlug(movie);
    if (generatedSlug) {
        return generatedSlug;
    }

    const fallbackId = extractTmdbId(movie, movie.slug) || movie.id || movie._id || "";
    return fallbackId ? String(fallbackId).trim() : "";
}

/**
 * Lấy URL phát phim chuẩn hóa (/vod/play/{slug}?source=...&id=...&type=...&season=...):
 * - Đảm bảo không show chữ tmdb lên URL
 * - Kèm id, type (movie|tv), season để an toàn tuyệt đối và thuận tiện giữa các source
 * @param {object} movie
 * @param {string} fallbackSource
 * @returns {string}
 */
export function getMoviePlayUrl(movie, fallbackSource = "source_k") {
    if (!movie) return "#";
    const playSlug = getMoviePlaySlug(movie);
    if (!playSlug) return "#";

    const source = movie.source || fallbackSource;
    const episodeParam = movie.current_episode?.key
        ? `&episode=${movie.current_episode.key}`
        : "";
    const serverParam = movie.server ? `&server=${movie.server}` : "";

    const tmdbId = extractTmdbId(movie, movie.slug);
    const mediaType = getMediaType(movie) || "movie";
    const season = extractSeasonNumber(movie) || 1;

    let metaParams = `&type=${mediaType}&season=${season}`;
    if (tmdbId) {
        metaParams = `&id=${tmdbId}${metaParams}`;
    }

    return `/vod/play/${playSlug}?source=${source}${metaParams}${episodeParam}${serverParam}`;
}
