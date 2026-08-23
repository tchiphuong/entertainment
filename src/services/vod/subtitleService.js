import axios from "axios";

const CONFIG = {
    BASE_URL: import.meta.env.VITE_OPENSUBTITLES_BASE_URL,
    API_KEY: import.meta.env.VITE_OPENSUBTITLES_API_KEY,
};

const apiClient = axios.create({
    baseURL: CONFIG.BASE_URL,
    headers: {
        "Api-Key": CONFIG.API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-User-Agent": "Entertainment App v1.0.0",
    },
});

/**
 * Tìm kiếm phụ đề dựa trên TMDB ID hoặc IMDb ID (Có tích hợp Cache)
 * @param {object} params { tmdb_id, imdb_id, languages }
 */
export const searchSubtitles = async ({ tmdb_id, imdb_id, languages = "vi" }) => {
    try {
        // 1. Kiểm tra Cache tìm kiếm
        const searchKey = `sub_search_${tmdb_id || imdb_id}_${languages}`;
        const cachedSearch = localStorage.getItem(searchKey);
        
        if (cachedSearch) {
            const { results, timestamp } = JSON.parse(cachedSearch);
            const isExpired = Date.now() - timestamp > 24 * 60 * 60 * 1000;
            if (!isExpired) {
                console.log("Subtitle Search Cache Hit:", searchKey);
                return results;
            }
        }

        const params = {
            languages,
            ...(tmdb_id && { tmdb_id }),
            ...(imdb_id && { imdb_id: imdb_id.replace("tt", "") }),
        };

        const response = await apiClient.get("/subtitles", { params });
        const results = response.data.data || [];

        // 2. Lưu Cache tìm kiếm
        if (results.length > 0) {
            localStorage.setItem(searchKey, JSON.stringify({
                results,
                timestamp: Date.now()
            }));
        }

        return results;
    } catch (error) {
        console.error("OpenSubtitles Search Error:", error.response?.data || error.message);
        return [];
    }
};

/**
 * Lấy link tải phụ đề từ file_id (Có tích hợp Cache để tránh tốn lượt tải)
 * @param {number} file_id 
 */
export const getDownloadUrl = async (file_id) => {
    try {
        // 1. Kiểm tra Cache trong localStorage
        const cacheKey = `sub_cache_${file_id}`;
        const cachedData = localStorage.getItem(cacheKey);
        
        if (cachedData) {
            const { link, timestamp } = JSON.parse(cachedData);
            // Link của OpenSubtitles thường có hiệu lực trong 24h
            const isExpired = Date.now() - timestamp > 24 * 60 * 60 * 1000;
            
            if (!isExpired) {
                console.log("Subtitle Cache Hit:", file_id);
                return link;
            }
        }

        // 2. Nếu không có cache hoặc hết hạn, gọi API
        const response = await apiClient.post("/download", { file_id });
        const downloadLink = response.data.link;

        if (downloadLink) {
            // 3. Lưu vào Cache
            localStorage.setItem(cacheKey, JSON.stringify({
                link: downloadLink,
                timestamp: Date.now()
            }));
        }

        return downloadLink;
    } catch (error) {
        console.error("OpenSubtitles Download Error:", error.response?.data || error.message);
        return null;
    }
};

export const subtitleService = {
    searchSubtitles,
    getDownloadUrl,
};
