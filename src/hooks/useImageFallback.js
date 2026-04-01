import { useCallback } from "react";

// Fallback SVG image used when movie poster or thumbnail is missing or broken
const FALLBACK_IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 96 96"
     width="64"
     height="96"
     preserveAspectRatio="xMidYMid meet">
  <rect width="96" height="96" rx="16" fill="#18181b"/>
  <rect x="12" y="12" width="72" height="72" rx="12" fill="#27272a"/>
  <path d="m26 62 13-14 10 10 12-13 9 9"
        fill="none"
        stroke="#a1a1aa"
        stroke-width="5"
        stroke-linecap="round"
        stroke-linejoin="round"/>
  <circle cx="39" cy="34" r="6" fill="#71717a"/>
</svg>`)}`;

const CONFIG = {
    APP_DOMAIN_SOURCE_K: import.meta.env.VITE_SOURCE_K_API,
    APP_DOMAIN_SOURCE_K_CDN_IMAGE: import.meta.env.VITE_SOURCE_K_CDN_IMAGE,
    APP_DOMAIN_SOURCE_O_FRONTEND: import.meta.env.VITE_SOURCE_O_FRONTEND,
    APP_DOMAIN_SOURCE_O_CDN_IMAGE: import.meta.env.VITE_SOURCE_O_CDN_IMAGE,
    APP_DOMAIN_SOURCE_C: import.meta.env.VITE_SOURCE_C_API,
};

const SOURCES = {
    SOURCE_C: "source_c",
    SOURCE_K: "source_k",
    SOURCE_O: "source_o",
    SOURCE_R: "source_r",
};

export const useImageFallback = () => {
    const getImageUrl = useCallback((item, type = "poster") => {
        if (!item) return FALLBACK_IMAGE;

        let imagePath = type === "poster" ? item.poster : item.thumbnail;

        if (!imagePath) return FALLBACK_IMAGE;

        const source = item.source || SOURCES.SOURCE_K;

        // Logic from Vods.jsx getMovieImage
        if (
            imagePath.startsWith("http://") ||
            imagePath.startsWith("https://")
        ) {
            // Priority: direct access to CDN images to avoid broken proxies
            return imagePath;
        }

        // Relative paths handle
        if (source === SOURCES.SOURCE_O) {
            return `${CONFIG.APP_DOMAIN_SOURCE_O_CDN_IMAGE}/${imagePath}`;
        } else if (source === SOURCES.SOURCE_K) {
            return `${CONFIG.APP_DOMAIN_SOURCE_K_CDN_IMAGE}/${imagePath}`;
        }

        if (source === SOURCES.SOURCE_C) {
            return `${CONFIG.APP_DOMAIN_SOURCE_C}/api/uploads/films/${imagePath}`;
        }

        return imagePath || FALLBACK_IMAGE;
    }, []);

    const handleImageError = useCallback((e) => {
        e.target.src = FALLBACK_IMAGE;
        e.target.onerror = null;
    }, []);

    return { getImageUrl, handleImageError };
};
