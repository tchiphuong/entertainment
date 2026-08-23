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
    if (s === "vietsub") return "Vietsub";
    if (s === "thuyet-minh") return "Thuyết Minh";
    if (s === "long-tieng") return "Lồng Tiếng";
    return slug;
}

/**
 * Trích xuất loại server từ tên đầy đủ (ví dụ: "#Hà Nội (Vietsub)" -> "Vietsub")
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
    if (serverName.includes("Vietsub")) return "Vietsub";
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

    if (source === "source_c") {
        const cdnC = CONFIG.APP_DOMAIN_SOURCE_C || import.meta.env.VITE_SOURCE_C_API;
        return `${cdnC}/api/uploads/films/${imagePath}`;
    }

    if (source === "source_o") {
        const cdnO = CONFIG.APP_DOMAIN_SOURCE_O_CDN_IMAGE || import.meta.env.VITE_SOURCE_O_CDN_IMAGE;
        return `${cdnO}/${imagePath}`;
    }

    const cdnK = CONFIG.APP_DOMAIN_SOURCE_K_CDN_IMAGE || import.meta.env.VITE_SOURCE_K_CDN_IMAGE;
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

const matchSlugTrailingSeason = (movie) => {
    const isSeries =
        movie.type === "tv" ||
        movie.type === "series" ||
        movie.chieurap === false ||
        Boolean(movie.episode_current);

    if (isSeries && movie.slug) {
        const slugNumMatch = /(?:^|-)(\d{1,2})$/.exec(movie.slug.trim());
        if (slugNumMatch?.[1]) {
            const num = Number.parseInt(slugNumMatch[1], 10);
            if (num > 1 && num <= 50) return num;
        }
    }
    return null;
};

/**
 * Trích xuất số season từ thông tin phim (tmdb object, name, origin_name, slug)
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
        matchSlugTrailingSeason(movie)
    );
}

/**
 * Lấy khóa duy nhất (Unique Key) cho một phim để gộp các bản ghi trùng nhau
 * - Nếu có TMDB ID:
 *   + Phim bộ (hoặc có season): `tmdb_${tmdbId}_s${season}` hoặc `tmdb_${tmdbId}_${slug}`
 *   + Phim lẻ: `tmdb_${tmdbId}`
 * - Nếu không có TMDB ID: fallback về `slug`
 * @param {object} movie
 * @returns {string}
 */
export function getMovieUniqueKey(movie) {
    if (!movie) return "";

    const tmdbId = movie.tmdb?.id || movie.tmdbId;
    const season = extractSeasonNumber(movie);

    if (tmdbId) {
        if (season) {
            return `tmdb_${tmdbId}_s${season}`;
        }
        const type = movie.tmdb?.type || movie.type;
        const isSeries =
            type === "tv" ||
            type === "series" ||
            movie.chieurap === false ||
            Boolean(movie.episode_current);

        // Đối với phim bộ: nếu không tách được season cụ thể, dùng slug để chống gộp đè các mùa khác nhau
        if (isSeries) {
            return movie.slug ? `tmdb_${tmdbId}_${movie.slug}` : `tmdb_${tmdbId}_s1`;
        }
        return `tmdb_${tmdbId}`;
    }

    return movie.slug ? `slug_${movie.slug}` : `id_${movie._id || movie.id || ""}`;
}
