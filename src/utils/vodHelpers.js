import { useState, useEffect } from "react";

/**
 * Hook để lấy query parameters từ URL
 */
export function useQuery() {
    return new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
}

/**
 * Hook để quản lý state đồng bộ với LocalStorage
 */
export function useLocalStorage(key, initial) {
    const [state, setState] = useState(() => {
        try {
            const v = localStorage.getItem(key);
            return v ? JSON.parse(v) : initial;
        } catch {
            return initial;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(state));
        } catch {
            // Bỏ qua lỗi quota exceeded
        }
    }, [key, state]);

    return [state, setState];
}

/**
 * VOD Helpers
 * Chứa các hàm xử lý logic cho Video On Demand
 */

/**
 * Lấy episode key chuẩn hóa từ slug hoặc name
 * @param {string} episodeSlug 
 * @param {string} episodeName 
 * @returns {string|number|null}
 */
export function getEpisodeKey(episodeSlug, episodeName = "") {
    let slugStr = typeof episodeSlug === "string" ? episodeSlug : String(episodeSlug || "");
    if (!slugStr && episodeName) {
        slugStr = typeof episodeName === "string" ? episodeName : String(episodeName);
    }
    if (!slugStr) return null;
    if (slugStr.toLowerCase() === "full") return "full";
    const numberMatch = /\d+/.exec(slugStr);
    if (numberMatch) return Number.parseInt(numberMatch[0], 10);
    return slugStr;
}

/**
 * Chuẩn hóa key để so sánh và lưu trữ nhất quán
 * @param {any} key 
 * @returns {string|number|null}
 */
export function normalizeKey(key) {
    if (key === null || key === undefined) return key;
    if (typeof key === "number") return key;
    const s = String(key).trim();
    if (/^\d+$/.test(s)) return Number.parseInt(s, 10);
    return s;
}

/**
 * So sánh 2 episode key (hỗ trợ cả string và number)
 * @param {any} key 
 * @param {any} key 
 * @returns {boolean}
 */
export function compareEpisodeKeys(key1, key2) {
    const n1 = normalizeKey(key1);
    const n2 = normalizeKey(key2);
    return n1 === n2;
}

/**
 * Chuyển tên server sang slug (ví dụ: "Vietsub" -> "vietsub")
 * @param {string} name 
 * @returns {string}
 */
export function serverNameToSlug(name) {
    if (!name) return "";
    const n = name.toLowerCase();
    if (n.includes("vietsub")) return "vietsub";
    if (n.includes("thuyết minh")) return "thuyet-minh";
    if (n.includes("lồng tiếng")) return "long-tieng";
    return name.replace(/\s+/g, "-").toLowerCase();
}

/**
 * Chuyển slug server về tên hiển thị (ví dụ: "vietsub" -> "Vietsub")
 * @param {string} slug 
 * @returns {string}
 */
export function slugToServerName(slug) {
    if (!slug) return "";
    const s = String(slug).toLowerCase();
    if (s === "vietsub" || s === "phu-de") return "Phụ đề";
    if (s === "thuyet-minh") return "Thuyết Minh";
    if (s === "long-tieng") return "Lồng Tiếng";
    return slug;
}

/**
 * Trích xuất loại server từ tên đầy đủ (ví dụ: "#Hà Nội (Vietsub)" -> "Phụ đề")
 * @param {string} serverName 
 * @returns {string}
 */
export function extractServerType(serverName) {
    if (!serverName) return "";
    const lastOpen = serverName.lastIndexOf("(");
    const lastClose = serverName.lastIndexOf(")");
    if (lastOpen !== -1 && lastClose > lastOpen && lastClose === serverName.length - 1) {
        return serverName.slice(lastOpen + 1, lastClose);
    }
    const lower = serverName.toLowerCase();
    if (["vietsub", "phụ đề", "phu de"].some((k) => lower.includes(k))) return "Phụ đề";
    if (serverName.includes("Thuyết Minh")) return "Thuyết Minh";
    if (serverName.includes("Lồng Tiếng")) return "Lồng Tiếng";
    return serverName;
}

/**
 * Làm sạch nội dung M3U8 (bỏ quảng cáo, discontinuity, key lỗi...)
 * @param {string} text 
 * @param {string} baseURL 
 * @returns {string}
 */
export function cleanM3U8Content(text, baseURL = "") {
    const lines = text.split("\n");
    const cleaned = [];
    let skipBlock = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();

        // Chặn block quảng cáo: #EXT-X-DISCONTINUITY + #EXT-X-KEY:METHOD=NONE
        if (!skipBlock && line === "#EXT-X-DISCONTINUITY" && lines[i + 1]?.startsWith("#EXT-X-KEY:METHOD=NONE")) {
            skipBlock = true;
            i++; 
            continue;
        }

        if (skipBlock) {
            if (line === "#EXT-X-DISCONTINUITY") skipBlock = false;
            continue;
        }

        const isSegment = /\.(ts|png|jpg|jpeg|gif)(\?|$)/i.test(line);
        if (isSegment && line.includes("convertv7/")) line = line.replace("convertv7/", "");
        if (baseURL && isSegment && !line.startsWith("http")) line = baseURL + line;
        cleaned.push(line);
    }
    return cleaned.join("\n");
}

/**
 * Lấy URL hình ảnh phim dựa trên source và đường dẫn
 * @param {string} imagePath 
 * @param {string} source 
 * @param {object} CONFIG 
 * @returns {string}
 */
export function getMovieImage(imagePath, source, CONFIG = {}) {
    if (!imagePath) {
        const base = import.meta?.env?.BASE_URL || "/";
        return `${base}no-poster.svg`;
    }

    const isHttp = imagePath.startsWith("http://") || imagePath.startsWith("https://");
    if (isHttp) {
        return imagePath;
    }

    if (source === "source_2" || source === "source_o") {
        const cdnO = CONFIG.APP_DOMAIN_SOURCE_O_CDN_IMAGE || import.meta.env.VITE_SOURCE_2_CDN_IMAGE || import.meta.env.VITE_SOURCE_O_CDN_IMAGE;
        return `${cdnO}/${imagePath}`;
    }

    const cdnK = CONFIG.APP_DOMAIN_SOURCE_K_CDN_IMAGE || import.meta.env.VITE_SOURCE_1_CDN_IMAGE || import.meta.env.VITE_SOURCE_K_CDN_IMAGE;
    return `${cdnK}/${imagePath}`;
}

/**
 * Chuẩn hóa nhãn chất lượng phim (FHD, HD, CAM, v.v.)
 * @param {string} quality 
 * @returns {string}
 */
export function getQualityBadge(quality) {
    const normalized = String(quality || "").toUpperCase();

    if (
        normalized.includes("FHD") ||
        normalized.includes("FULL HD") ||
        normalized.includes("1080")
    ) {
        return "FHD";
    }

    if (normalized.includes("HD") || normalized.includes("720")) {
        return "HD";
    }

    if (normalized.includes("CAM") || normalized.includes("TS")) {
        return "CAM";
    }

    return quality || "";
}

export {
    extractSeasonNumber,
    extractTmdbId,
    getMediaType,
    getTmdbUniqueKey,
    getMovieUniqueKey,
    getHistoryItemKey,
    isMovieMatch,
    distinctMovies,
    slugify,
    getMoviePlaySlug,
    getMoviePlayUrl,
} from "./vodIdentifier";

/**
 * Đảm bảo URL video YouTube là dạng embed URL
 * @param {string} url
 * @returns {string}
 */
export function ensureYoutubeEmbedUrl(url) {
    if (!url) return "";
    const str = String(url).trim();
    if (str.includes("youtube.com/watch?v=")) {
        const videoId = str.split("v=")[1]?.split("&")[0];
        return `https://www.youtube.com/embed/${videoId}`;
    }
    if (str.includes("youtu.be/")) {
        const videoId = str.split("youtu.be/")[1]?.split("?")[0];
        return `https://www.youtube.com/embed/${videoId}`;
    }
    return str;
}

const findBestYoutubeVideo = (list) => {
    const isYt = (v) => v?.site === "YouTube" && Boolean(v?.key);
    return (
        list.find((v) => v.type === "Trailer" && isYt(v)) ||
        list.find((v) => ["Teaser", "Clip", "Featurette"].includes(v.type) && isYt(v)) ||
        list.find(isYt)
    );
};

const resolveMovieTrailerString = (movie) => {
    const url = movie?.trailer_url;
    if (typeof url === "string" && url.trim()) {
        return url.trim();
    }
    return null;
};

const resolveVideoSourceList = (movie, tmdbVideos) => {
    if (Array.isArray(tmdbVideos) && tmdbVideos.length > 0) {
        return tmdbVideos;
    }
    const tmdbResults = movie?.tmdb?.videos?.results;
    if (Array.isArray(tmdbResults) && tmdbResults.length > 0) {
        return tmdbResults;
    }
    const movieResults = movie?.videos?.results;
    if (Array.isArray(movieResults)) {
        return movieResults;
    }
    return [];
};

/**
 * Tìm URL trailer YouTube tốt nhất từ movie hoặc danh sách TMDB videos
 * @param {object} movie
 * @param {Array} tmdbVideos
 * @returns {string|null}
 */
export function extractBestTrailerUrl(movie, tmdbVideos = []) {
    const directUrl = resolveMovieTrailerString(movie);
    if (directUrl) return directUrl;

    const list = resolveVideoSourceList(movie, tmdbVideos);
    const trailer = findBestYoutubeVideo(list);
    return trailer?.key ? `https://www.youtube.com/watch?v=${trailer.key}` : null;
}

/**
 * Thêm server group Trailer vào danh sách episodes nếu có trailer
 * @param {Array} episodesList
 * @param {string} trailerUrl
 * @returns {Array}
 */
export function appendTrailerServerGroup(episodesList, trailerUrl) {
    if (!trailerUrl) return episodesList || [];
    const list = Array.isArray(episodesList) ? [...episodesList] : [];
    const alreadyHasTrailer = list.some(
        (g) => g.type_id === "trailer" || g.server_name?.toLowerCase() === "trailer"
    );
    if (alreadyHasTrailer) return list;

    const embedUrl = ensureYoutubeEmbedUrl(trailerUrl);
    const trailerGroup = {
        server_name: "Trailer",
        type_id: "trailer",
        color: "bg-zinc-800",
        server_data: [
            {
                name: "Trailer",
                slug: "trailer",
                link_embed: embedUrl,
                link_m3u8: null,
                backups: [],
            },
        ],
    };

    return [...list, trailerGroup];
}