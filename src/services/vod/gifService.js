/**
 * Service tích hợp API GIF động cho Watch Party (Giphy API)
 * Tuân thủ quy tắc bảo mật Endpoint: không hardcode URL, đọc qua biến môi trường
 */

import { MEDIA_CONFIG } from "../../constants";

const GIPHY_BASE_URL = import.meta.env.VITE_GIPHY_API_BASE_URL || MEDIA_CONFIG.DEFAULT_GIPHY_API_BASE_URL;
const GIPHY_KEY = import.meta.env.VITE_GIPHY_API_KEY || MEDIA_CONFIG.DEFAULT_GIPHY_API_KEY;

// Danh mục chủ đề Sticker GIF phản ứng xem phim
export const GIF_CATEGORIES = [
    { id: "all", label: "Thịnh hành", query: "" },
    { id: "popcorn", label: "Ăn bắp hóng phim", query: "movie popcorn reaction" },
    { id: "funny", label: "Hài hước / LOL", query: "funny lol movie reaction" },
    { id: "shock", label: "Kinh ngạc / OMG", query: "shocked omg reaction" },
    { id: "sad", label: "Khóc ròng / Buồn", query: "crying sad reaction" },
    { id: "applause", label: "Vỗ tay / Cổ vũ", query: "clapping applause cheers" },
    { id: "love", label: "Thả tim / Yêu thích", query: "love hearts reaction" },
    { id: "hype", label: "Cháy quá / Quẩy", query: "hype celebration excited" },
];

const extractGiphyUrls = (images) => {
    if (!images) return { url: "", previewUrl: "" };
    const url = images.downsized_medium?.url || images.original?.url || "";
    const previewUrl = images.fixed_width_small?.url || images.preview_gif?.url || url;
    return { url, previewUrl };
};

/**
 * Chuẩn hoá dữ liệu GIF từ API Giphy
 */
const normalizeGiphyItem = (item) => {
    const { url, previewUrl } = extractGiphyUrls(item?.images);

    return {
        id: item?.id || String(Math.random()),
        title: item?.title || "Sticker GIF",
        url,
        previewUrl,
    };
};

/**
 * Lấy danh sách GIF thịnh hành từ API
 */
export const fetchTrendingGifs = async (limit = 18) => {
    if (!GIPHY_BASE_URL || !GIPHY_KEY) {
        console.warn("gifService: Thiếu cấu hình VITE_GIPHY_API_BASE_URL hoặc VITE_GIPHY_API_KEY");
        return [];
    }

    try {
        const endpoint = `${GIPHY_BASE_URL}/gifs/trending?api_key=${encodeURIComponent(GIPHY_KEY)}&limit=${limit}&rating=g`;
        const res = await fetch(endpoint);
        if (!res.ok) return [];

        const data = await res.json();
        const items = data?.data || [];
        return items.map(normalizeGiphyItem).filter((g) => Boolean(g.url));
    } catch (err) {
        console.warn("fetchTrendingGifs error:", err);
        return [];
    }
};

/**
 * Tìm kiếm GIF theo từ khoá qua API
 */
export const searchGifs = async (keyword, limit = 18) => {
    if (!GIPHY_BASE_URL || !GIPHY_KEY) {
        console.warn("gifService: Thiếu cấu hình VITE_GIPHY_API_BASE_URL hoặc VITE_GIPHY_API_KEY");
        return [];
    }

    const cleanKeyword = (keyword || "").trim();
    if (!cleanKeyword) {
        return fetchTrendingGifs(limit);
    }

    try {
        const endpoint = `${GIPHY_BASE_URL}/gifs/search?api_key=${encodeURIComponent(GIPHY_KEY)}&q=${encodeURIComponent(cleanKeyword)}&limit=${limit}&rating=g`;
        const res = await fetch(endpoint);
        if (!res.ok) return [];

        const data = await res.json();
        const items = data?.data || [];
        return items.map(normalizeGiphyItem).filter((g) => Boolean(g.url));
    } catch (err) {
        console.warn("searchGifs error:", err);
        return [];
    }
};

/**
 * Lấy danh sách GIF theo danh mục thông qua API
 */
export const fetchGifsByCategory = async (categoryId = "all", limit = 18) => {
    if (!categoryId || categoryId === "all") {
        return fetchTrendingGifs(limit);
    }

    const matchedCat = GIF_CATEGORIES.find((c) => c.id === categoryId);
    const query = matchedCat?.query || categoryId;
    return searchGifs(query, limit);
};
