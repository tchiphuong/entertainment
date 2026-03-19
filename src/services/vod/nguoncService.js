/**
 * NguonC Service
 * Tách biệt logic giải mã và xử lý stream từ nguồn NguonC/Phimmoi
 */

/**
 * Giải mã dữ liệu từ thuộc tính data-obf (nguonc.html)
 * @param {string} obfData - Chuỗi Base64 từ dataset.obf
 * @returns {object|null} { sUb: string, hD: string }
 */
export function decodeNguoncData(obfData) {
    if (!obfData) return null;
    try {
        const decoded = JSON.parse(atob(obfData));
        return {
            streamUrlPrefix: decoded.sUb,
            hash: decoded.hD
        };
    } catch (e) {
        console.error("Lỗi giải mã NguonC Obf Data:", e);
        return null;
    }
}

/**
 * Trích xuất Hash từ URL (clone từ player1.js)
 * Dùng để định danh phim khi lưu lịch sử xem
 * @param {string} url 
 * @returns {string|null}
 */
export function extractHashFromURL(url) {
    if (!url) return null;

    // Trường hợp 1: Link m3u8 có chứa Base64 payload (chuẩn NguonC mới)
    const parts = url.split('/');
    const encodedPayloadWithExt = parts[parts.length - 1];
    const encodedPayload = encodedPayloadWithExt.split('.')[0];

    if (encodedPayload && encodedPayload.length > 50) { // Chuỗi Base64 thường dài
        try {
            const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
            const paddedBase64 = base64 + '==='.slice((base64.length + 3) % 4); 
            const jsonString = atob(paddedBase64);
            const payload = JSON.parse(jsonString);
            if (payload && payload.h) return payload.h;
        } catch (e) {}
    }

    // Trường hợp 2: Lấy hash từ tham số URL (embed.php?hash=...)
    try {
        const urlObj = new URL(url);
        const hashParam = urlObj.searchParams.get("hash");
        if (hashParam) return hashParam;
    } catch (e) {}

    // Trường hợp 3: Lấy hash từ path trực tiếp (sing.phimmoi.net/HASH/hls.m3u8)
    const match = url.match(/\/([a-f0-9]{32})\//i);
    if (match) return match[1];

    return null;
}

/**
 * Tạo link m3u8 chuẩn NguonC từ sUb (Base64)
 * @param {string} embedUrl - Để lấy domain base
 * @param {string} sUb - Chuỗi Base64 chứa hash và token
 * @param {boolean} isMobile 
 * @returns {string} Link m3u8 hoàn chỉnh
 */
export function buildNguoncObfUrl(embedUrl, sUb, isMobile = false) {
    if (!embedUrl || !sUb) return "";
    try {
        const urlObj = new URL(embedUrl);
        const domain = `${urlObj.protocol}//${urlObj.hostname}${urlObj.port ? ':' + urlObj.port : ''}`;
        return `${domain}/${sUb}${isMobile ? '.m3u9' : '.m3u8'}`;
    } catch (e) {
        return "";
    }
}

/**
 * Thử trích xuất data-obf từ mã HTML của trang embed
 * @param {string} html 
 * @returns {string|null} Chuỗi sUb (Base64)
 */
export function extractObfFromHtml(html) {
    if (!html) return null;
    // Regex tìm data-obf="..."
    const match = html.match(/data-obf="([^"]+)"/);
    if (match && match[1]) {
        try {
            const decoded = JSON.parse(atob(match[1]));
            return decoded.sUb; // Đây chính là chuỗi Base64 cần thiết
        } catch (e) {}
    }
    return null;
}

/**
 * Xử lý link stream từ API Response để có link phát trực tiếp
 * @param {object} item - Episode item từ API { m3u8, embed, ... }
 * @param {boolean} isMobile - Check môi trường
 * @returns {string} Link m3u8/m3u9 thực tế
 */
export function getPlayableUrl(item, isMobile = false) {
    if (!item) return "";
    
    // Ưu tiên m3u8 trực tiếp từ API (nếu có)
    if (item.m3u8) {
        if (isMobile && item.m3u8.includes(".m3u8")) {
            return item.m3u8.replace(".m3u8", ".m3u9");
        }
        return item.m3u8;
    }

    return item.link_m3u8 || item.link_embed || "";
}

/**
 * Kiểm tra xem một link có thuộc nguồn NguonC/Phimmoi không
 * @param {string} url 
 * @returns {boolean}
 */
export function isNguoncSource(url) {
    if (!url) return false;
    const domains = ["phimmoi.net", "nguonc.com", "streamc.xyz", "hihihoho4.top", "hihihoho"];
    return domains.some(domain => url.includes(domain));
}
