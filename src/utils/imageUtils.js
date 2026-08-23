/**
 * Image Utilities dùng chung cho toàn hệ thống
 */

export const IMAGE_PROXY_PREFIX = "https://external-content.duckduckgo.com/iu/?u=";

export const FALLBACK_LOGO_DATA_URI =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <rect width="96" height="96" rx="16" fill="#18181b"/>
    <rect x="12" y="12" width="72" height="72" rx="12" fill="#27272a"/>
    <path d="M26 62l13-14 10 10 12-13 9 9" fill="none" stroke="#a1a1aa" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="39" cy="34" r="6" fill="#71717a"/>
</svg>
`);

export const FALLBACK_POSTER_DATA_URI =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 450">
    <rect width="300" height="450" fill="#09090b"/>
    <rect x="20" y="20" width="260" height="410" rx="8" fill="#18181b" stroke="#27272a" stroke-width="2"/>
    <circle cx="150" cy="180" r="40" fill="#27272a"/>
    <path d="M70 330l60-70 40 40 50-60 40 50" fill="none" stroke="#3f3f46" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`);

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
