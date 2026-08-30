/**
 * Image Utilities dùng chung cho toàn hệ thống
 */
import {
    IMAGE_PROXY_PREFIX,
    FALLBACK_LOGO_DATA_URI,
    FALLBACK_POSTER_DATA_URI,
} from "../constants";

export { IMAGE_PROXY_PREFIX, FALLBACK_LOGO_DATA_URI, FALLBACK_POSTER_DATA_URI };

/**
 * Chuyển đổi URL ảnh qua proxy để vượt chặn CORS / hotlink
 */
export const toProxyImageUrl = (rawUrl) => {
    const url = String(rawUrl || "").trim();
    if (!url) return null;
    if (
        url.startsWith("https://i.imgur.com") ||
        url.startsWith(IMAGE_PROXY_PREFIX) ||
        url.startsWith("data:")
    ) {
        return url;
    }
    return `${IMAGE_PROXY_PREFIX}${encodeURIComponent(url)}`;
};

/**
 * Xử lý fallback khi load ảnh bị lỗi
 */
export const handleImageFallbackError = (event, fallbackUri = FALLBACK_LOGO_DATA_URI) => {
    const target = event.currentTarget;
    if (!target) return;
    target.onerror = null;
    target.src = fallbackUri;
};
