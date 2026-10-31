import { useCallback } from "react";
import { SOURCES, FALLBACK_IMAGE } from "../constants";

export { FALLBACK_IMAGE };

const CONFIG = {
    APP_DOMAIN_SOURCE_K: import.meta.env.VITE_SOURCE_1_API || import.meta.env.VITE_SOURCE_K_API,
    APP_DOMAIN_SOURCE_K_CDN_IMAGE: import.meta.env.VITE_SOURCE_1_CDN_IMAGE || import.meta.env.VITE_SOURCE_K_CDN_IMAGE,
    APP_DOMAIN_SOURCE_O_FRONTEND: import.meta.env.VITE_SOURCE_2_FRONTEND || import.meta.env.VITE_SOURCE_O_FRONTEND,
    APP_DOMAIN_SOURCE_O_CDN_IMAGE: import.meta.env.VITE_SOURCE_2_CDN_IMAGE || import.meta.env.VITE_SOURCE_O_CDN_IMAGE,
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
        if (source === SOURCES.SOURCE_2 || source === SOURCES.SOURCE_O) {
            return `${CONFIG.APP_DOMAIN_SOURCE_O_CDN_IMAGE}/${imagePath}`;
        } else if (source === SOURCES.SOURCE_1 || source === SOURCES.SOURCE_K) {
            return `${CONFIG.APP_DOMAIN_SOURCE_K_CDN_IMAGE}/${imagePath}`;
        }

        return imagePath || FALLBACK_IMAGE;
    }, []);

    const handleImageError = useCallback((e) => {
        e.target.src = FALLBACK_IMAGE;
        e.target.onerror = null;
    }, []);

    return { getImageUrl, handleImageError };
};
