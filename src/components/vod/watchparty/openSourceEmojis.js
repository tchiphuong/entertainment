/**
 * Thư viện Emoji Mã Nguồn Mở (Twemoji - Open Source by Twitter / CC-BY 4.0)
 * Sử dụng định dạng vector SVG sắc nét, tối ưu cho mọi màn hình
 */

import { MEDIA_CONFIG } from "../../../constants";

const TWEMOJI_BASE_URL = import.meta.env.VITE_TWEMOJI_CDN_URL || MEDIA_CONFIG.DEFAULT_TWEMOJI_CDN;

/**
 * Lấy URL ảnh SVG mã nguồn mở Twemoji từ mã hex Unicode
 */
export const getTwemojiUrl = (hex) => {
    if (!hex) return "";
    const cleanHex = hex.toLowerCase().replace(/-fe0f/g, "");
    return `${TWEMOJI_BASE_URL}/${cleanHex}.svg`;
};

/**
 * Danh mục nhóm Emoji mã nguồn mở
 */
export const OPEN_EMOJI_CATEGORIES = [
    { id: "all", label: "Tất cả" },
    { id: "smileys", label: "Mặt cười & Cảm xúc" },
    { id: "gestures", label: "Bàn tay & Cử chỉ" },
    { id: "cinema", label: "Xem phim & Giải trí" },
];

/**
 * Danh sách Emoji mã nguồn mở Twemoji tuyển chọn phong phú
 */
export const OPEN_SOURCE_EMOJIS = [
    // --- Nhóm Mặt cười & Cảm xúc (Smileys) ---
    { hex: "1f600", code: ":grinning:", label: "Cười toe toét", category: "smileys" },
    { hex: "1f604", code: ":smile:", label: "Cười tít mắt", category: "smileys" },
    { hex: "1f602", code: ":joy:", label: "Cười ra nước mắt", category: "smileys" },
    { hex: "1f923", code: ":rofl:", label: "Cười lăn lộn", category: "smileys" },
    { hex: "1f60d", code: ":heart_eyes:", label: "Mắt hình trái tim", category: "smileys" },
    { hex: "1f618", code: ":kissing_heart:", label: "Hôn gió", category: "smileys" },
    { hex: "1f60e", code: ":sunglasses:", label: "Kính ngầu", category: "smileys" },
    { hex: "1f914", code: ":thinking:", label: "Suy ngẫm", category: "smileys" },
    { hex: "1f92f", code: ":exploding_head:", label: "Bùng nổ não", category: "smileys" },
    { hex: "1f631", code: ":scream:", label: "Hét lên kinh hãi", category: "smileys" },
    { hex: "1f62d", code: ":sob:", label: "Khóc như mưa", category: "smileys" },
    { hex: "1f621", code: ":rage:", label: "Giận đỏ mặt", category: "smileys" },
    { hex: "1f633", code: ":flushed:", label: "Ngượng ngùng", category: "smileys" },
    { hex: "1f608", code: ":smiling_imp:", label: "Quỷ tinh nghịch", category: "smileys" },
    { hex: "1f921", code: ":clown:", label: "Mặt hề hài hước", category: "smileys" },
    { hex: "1f634", code: ":sleeping:", label: "Buồn ngủ díu mắt", category: "smileys" },
    { hex: "1f970", code: ":smiling_face_with_hearts:", label: "Hạnh phúc ngập tràn", category: "smileys" },
    { hex: "1f97a", code: ":pleading_face:", label: "Ánh mắt van nài", category: "smileys" },
    { hex: "1f924", code: ":drooling_face:", label: "Thèm thuồng", category: "smileys" },

    // --- Nhóm Bàn tay & Cử chỉ (Gestures) ---
    { hex: "1f44d", code: ":thumbsup:", label: "Thích / Like", category: "gestures" },
    { hex: "1f44e", code: ":thumbsdown:", label: "Không thích / Dislike", category: "gestures" },
    { hex: "1f44f", code: ":clap:", label: "Vỗ tay tán thưởng", category: "gestures" },
    { hex: "1f44c", code: ":ok_hand:", label: "Dấu tay OK chuẩn chỉ", category: "gestures" },
    { hex: "1faf0", code: ":finger_heart:", label: "Bắn tim ngón tay", category: "gestures" },
    { hex: "1f64f", code: ":pray:", label: "Cầu nguyện / Cảm ơn", category: "gestures" },
    { hex: "1f44a", code: ":fist:", label: "Cụng tay quyết tâm", category: "gestures" },
    { hex: "1f44b", code: ":wave:", label: "Vẫy tay chào", category: "gestures" },
    { hex: "1f91d", code: ":handshake:", label: "Bắt tay hợp tác", category: "gestures" },
    { hex: "1f4aa", code: ":muscle:", label: "Cơ bắp mạnh mẽ", category: "gestures" },
    { hex: "1f648", code: ":see_no_evil:", label: "Bịt mắt không dám nhìn", category: "gestures" },
    { hex: "270c", code: ":peace:", label: "Chiến thắng / Peace", category: "gestures" },

    // --- Nhóm Xem phim & Giải trí (Cinema) ---
    { hex: "1f37f", code: ":popcorn:", label: "Bắp rang bơ", category: "cinema" },
    { hex: "1f39f", code: ":ticket:", label: "Vé xem phim", category: "cinema" },
    { hex: "1f3a5", code: ":movie_camera:", label: "Máy quay phim", category: "cinema" },
    { hex: "1f39e", code: ":film_frames:", label: "Cuộn phim điện ảnh", category: "cinema" },
    { hex: "1f525", code: ":fire:", label: "Cháy quá / Cực phẩm", category: "cinema" },
    { hex: "2728", code: ":sparkles:", label: "Lấp lánh tỏa sáng", category: "cinema" },
    { hex: "2764", code: ":heart:", label: "Trái tim đỏ thắm", category: "cinema" },
    { hex: "1f494", code: ":broken_heart:", label: "Trái tim tan vỡ", category: "cinema" },
    { hex: "1f480", code: ":skull:", label: "Chết cười / Đầu lâu", category: "cinema" },
    { hex: "2b50", code: ":star:", label: "Ngôi sao 5 sao", category: "cinema" },
    { hex: "1f4af", code: ":100:", label: "100 điểm tròn", category: "cinema" },
    { hex: "1f389", code: ":tada:", label: "Pháo hoa chúc mừng", category: "cinema" },
];

/**
 * Map tra cứu nhanh emoji theo shortcode (ví dụ: ":joy:" => data)
 */
export const OPEN_EMOJI_MAP = new Map(
    OPEN_SOURCE_EMOJIS.map((item) => [item.code.toLowerCase(), item])
);

/**
 * Các biểu tượng phản ứng nhanh (Quick Reactions) mở rộng
 */
export const OPEN_QUICK_REACTIONS = [
    OPEN_EMOJI_MAP.get(":joy:"),
    OPEN_EMOJI_MAP.get(":heart:"),
    OPEN_EMOJI_MAP.get(":popcorn:"),
    OPEN_EMOJI_MAP.get(":fire:"),
    OPEN_EMOJI_MAP.get(":clap:"),
    OPEN_EMOJI_MAP.get(":sob:"),
].filter(Boolean);
