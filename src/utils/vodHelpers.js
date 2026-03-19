import React, { useState, useEffect } from "react";

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
        } catch (e) { return initial; }
    });

    useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(state));
        } catch (e) {}
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
    const numberMatch = slugStr.match(/\d+/);
    if (numberMatch) return parseInt(numberMatch[0], 10);
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
    if (/^\d+$/.test(s)) return parseInt(s, 10);
    return s;
}

/**
 * So sánh 2 episode key (hỗ trợ cả string và number)
 * @param {any} key1 
 * @param {any} key2 
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
    const match = serverName.match(/\(([^)]+)\)$/);
    if (match) return match[1];
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
        const base = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL ? import.meta.env.BASE_URL : "/";
        return `${base}no-poster.svg`;
    }

    if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
        if (source === "source_k" || source === "source_o") {
            const hostname = (() => {
                try { return new URL(imagePath).hostname || ""; } catch (e) { return ""; }
            })();

            if (hostname.indexOf("phimimg.com") !== -1 || hostname.indexOf("phimapi.com") !== -1 || hostname.indexOf("img.ophim.live") !== -1) {
                const domain = source === "source_k" ? CONFIG.APP_DOMAIN_SOURCE_K : CONFIG.APP_DOMAIN_SOURCE_O_FRONTEND;
                if (source === "source_o") return imagePath;
                return `${domain}/image.php?url=${encodeURIComponent(imagePath)}`;
            }
        }
        return imagePath;
    }

    const cdnUrl = `${source === "source_k" ? CONFIG.APP_DOMAIN_SOURCE_K_CDN_IMAGE : CONFIG.APP_DOMAIN_SOURCE_O_CDN_IMAGE}/${imagePath}`;
    if (source === "source_k" || source === "source_o") {
        const domain = source === "source_k" ? CONFIG.APP_DOMAIN_SOURCE_K : CONFIG.APP_DOMAIN_SOURCE_O_FRONTEND;
        if (source === "source_o") return cdnUrl;
        return `${domain}/image.php?url=${encodeURIComponent(cdnUrl)}`;
    }

    return cdnUrl;
}
