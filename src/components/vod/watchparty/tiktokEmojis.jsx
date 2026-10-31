import React from "react";
import {
    Smile,
    Happy,
    Angry,
    Cry,
    Embarrassed,
    Surprised,
    Wronged,
    Shout,
    Flushed,
    Yummy,
    Complacent,
    Drool,
    Scream,
    Weep,
    Speechless,
    Funnyface,
    Laughwithtears,
    Wicked,
    Facewithrollingeyes,
    Sulk,
    Thinking,
    Lovely,
    Greedy,
    Wow,
    Joyful,
    Hehe,
    Slap,
    Tears,
    Stun,
    Cute,
    Blink,
    Disdain,
    Astonish,
    Rage,
    Cool,
    Excited,
    Proud,
    Smileface,
    Evil,
    Angel,
    Laugh,
    Pride,
    Nap,
    Loveface,
    Awkward,
    Shock,
} from "@tiktok-emojis/react";
import { getTwemojiUrl, OPEN_EMOJI_MAP, OPEN_QUICK_REACTIONS } from "./openSourceEmojis";

/**
 * Danh sách 46 biểu tượng cảm xúc bí mật của TikTok (100% SVG thuần)
 */
export const TIKTOK_EMOJIS = [
    { code: "[smile]", name: "Smile", label: "Mỉm cười", Component: Smile },
    { code: "[happy]", name: "Happy", label: "Vui vẻ", Component: Happy },
    { code: "[loveface]", name: "Loveface", label: "Mê mẩn", Component: Loveface },
    { code: "[joyful]", name: "Joyful", label: "Hớn hở", Component: Joyful },
    { code: "[laughwithtears]", name: "Laughwithtears", label: "Cười ra nước mắt", Component: Laughwithtears },
    { code: "[cool]", name: "Cool", label: "Ngầu lòi", Component: Cool },
    { code: "[cute]", name: "Cute", label: "Đáng yêu", Component: Cute },
    { code: "[blink]", name: "Blink", label: "Nháy mắt", Component: Blink },
    { code: "[drool]", name: "Drool", label: "Chảy nước miếng", Component: Drool },
    { code: "[yummy]", name: "Yummy", label: "Ngon lành", Component: Yummy },
    { code: "[proud]", name: "Proud", label: "Tự hào", Component: Proud },
    { code: "[excited]", name: "Excited", label: "Phấn khích", Component: Excited },
    { code: "[wow]", name: "Wow", label: "Trầm trồ", Component: Wow },
    { code: "[shock]", name: "Shock", label: "Bàng hoàng", Component: Shock },
    { code: "[cry]", name: "Cry", label: "Khóc ròng", Component: Cry },
    { code: "[weep]", name: "Weep", label: "Tủi thân", Component: Weep },
    { code: "[tears]", name: "Tears", label: "Rớm lệ", Component: Tears },
    { code: "[wronged]", name: "Wronged", label: "Oan ức", Component: Wronged },
    { code: "[angry]", name: "Angry", label: "Tức giận", Component: Angry },
    { code: "[rage]", name: "Rage", label: "Thịnh nộ", Component: Rage },
    { code: "[sulk]", name: "Sulk", label: "Hờn dỗi", Component: Sulk },
    { code: "[shout]", name: "Shout", label: "Hét to", Component: Shout },
    { code: "[scream]", name: "Scream", label: "Hốt hoảng", Component: Scream },
    { code: "[astonish]", name: "Astonish", label: "Sửng sốt", Component: Astonish },
    { code: "[stun]", name: "Stun", label: "Choáng váng", Component: Stun },
    { code: "[surprised]", name: "Surprised", label: "Bất ngờ", Component: Surprised },
    { code: "[speechless]", name: "Speechless", label: "Cạn lời", Component: Speechless },
    { code: "[thinking]", name: "Thinking", label: "Suy ngẫm", Component: Thinking },
    { code: "[facewithrollingeyes]", name: "Facewithrollingeyes", label: "Đảo mắt", Component: Facewithrollingeyes },
    { code: "[disdain]", name: "Disdain", label: "Khinh bỉ", Component: Disdain },
    { code: "[awkward]", name: "Awkward", label: "Ngại ngùng", Component: Awkward },
    { code: "[embarrassed]", name: "Embarrassed", label: "Xấu hổ", Component: Embarrassed },
    { code: "[flushed]", name: "Flushed", label: "Đỏ mặt", Component: Flushed },
    { code: "[funnyface]", name: "Funnyface", label: "Mặt hề", Component: Funnyface },
    { code: "[slap]", name: "Slap", label: "Vả mặt", Component: Slap },
    { code: "[wicked]", name: "Wicked", label: "Gian xảo", Component: Wicked },
    { code: "[evil]", name: "Evil", label: "Ác quỷ", Component: Evil },
    { code: "[angel]", name: "Angel", label: "Thiên thần", Component: Angel },
    { code: "[laugh]", name: "Laugh", label: "Cười lớn", Component: Laugh },
    { code: "[hehe]", name: "Hehe", label: "Cười thầm", Component: Hehe },
    { code: "[complacent]", name: "Complacent", label: "Đắc ý", Component: Complacent },
    { code: "[pride]", name: "Pride", label: "Hãnh diện", Component: Pride },
    { code: "[lovely]", name: "Lovely", label: "Dễ thương", Component: Lovely },
    { code: "[greedy]", name: "Greedy", label: "Tham lam", Component: Greedy },
    { code: "[smileface]", name: "Smileface", label: "Mặt cười", Component: Smileface },
    { code: "[nap]", name: "Nap", label: "Buồn ngủ", Component: Nap },
];

/**
 * Bản đồ tra cứu nhanh theo shortcode
 */
export const TIKTOK_EMOJI_MAP = new Map(
    TIKTOK_EMOJIS.map((item) => [item.code.toLowerCase(), item])
);

/**
 * Các biểu tượng phản ứng nhanh (Quick Reactions) chuẩn TikTok
 */
export const TIKTOK_QUICK_REACTIONS = [
    TIKTOK_EMOJIS.find((e) => e.code === "[loveface]"),
    TIKTOK_EMOJIS.find((e) => e.code === "[joyful]"),
    TIKTOK_EMOJIS.find((e) => e.code === "[cry]"),
    TIKTOK_EMOJIS.find((e) => e.code === "[shock]"),
    TIKTOK_EMOJIS.find((e) => e.code === "[cool]"),
].filter(Boolean);

export { OPEN_QUICK_REACTIONS };

/**
 * Trích xuất URL và tiêu đề của sticker gif từ nội dung tin nhắn
 */
export const extractGifStickerInfo = (text) => {
    if (!text || typeof text !== "string") return null;
    const match = text.match(/^\[gif:(https?:\/\/[^\]]+)\]/i);
    if (match) {
        const parts = match[1].split("|");
        return {
            url: parts[0],
            title: parts[1] || "",
        };
    }
    const trimmed = text.trim();
    if (/^https?:\/\/[^\s]+(?:\.gif)(?:\?[^\s]*)?$/i.test(trimmed)) {
        return {
            url: trimmed,
            title: "",
        };
    }
    return null;
};

/**
 * Kiểm tra xem tin nhắn có phải chỉ chứa emoji (không có chữ) hay không
 */
export const isEmojiOnlyMessage = (text) => {
    if (!text || typeof text !== "string") return false;
    const trimmed = text.trim();
    if (trimmed.startsWith("[gif:") || /^https?:\/\/[^\s]+\.gif/i.test(trimmed)) {
        return false;
    }
    const hasEmoji = /:\w+:|\[\w+\]/.test(trimmed);
    if (!hasEmoji) return false;

    const stripped = trimmed
        .replace(/:\w+:/g, "")
        .replace(/\[\w+\]/g, "")
        .trim();

    return stripped.length === 0;
};

const renderEmojiToken = (part, index, size) => {
    const lowerPart = part.toLowerCase();

    // 1. Kiểm tra Twemoji mã nguồn mở (:code:)
    const openEmoji = OPEN_EMOJI_MAP.get(lowerPart);
    if (openEmoji) {
        return (
            <img
                key={`open_emoji_${openEmoji.hex}_${index}`}
                src={getTwemojiUrl(openEmoji.hex)}
                alt={openEmoji.label}
                title={`${openEmoji.label} (${openEmoji.code})`}
                className="inline-block align-middle mx-0.5 select-none"
                style={{ width: `${size}px`, height: `${size}px` }}
                loading="lazy"
            />
        );
    }

    // 2. Kiểm tra TikTok emoji ([code])
    const tiktokEmoji = TIKTOK_EMOJI_MAP.get(lowerPart);
    if (tiktokEmoji?.Component) {
        const EmojiComponent = tiktokEmoji.Component;
        return (
            <span
                key={`tt_emoji_${tiktokEmoji.code}_${index}`}
                className="inline-flex items-center justify-center align-middle mx-0.5 select-none"
                title={tiktokEmoji.label}
            >
                <EmojiComponent size={size} />
            </span>
        );
    }

    return <React.Fragment key={`text_${index}`}>{part}</React.Fragment>;
};

/**
 * Hàm phân tích văn bản và render các shortcode emoji mã nguồn mở và TikTok
 */
export const renderMessageText = (text, size = 20) => {
    if (!text || typeof text !== "string") return null;

    // Kiểm tra nếu tin nhắn là Sticker GIF
    const gifInfo = extractGifStickerInfo(text);
    if (gifInfo) {
        return (
            <div className="mt-1 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 p-1.5 max-w-[190px] shadow-lg transition-transform hover:scale-105">
                <img
                    src={gifInfo.url}
                    alt={gifInfo.title || "Sticker GIF"}
                    className="h-auto w-full rounded-lg object-contain"
                    loading="lazy"
                />
                {gifInfo.title ? (
                    <div className="mt-1 text-center text-[10px] text-zinc-400 truncate">
                        {gifInfo.title}
                    </div>
                ) : null}
            </div>
        );
    }

    // Tách chuỗi theo mẫu [shortcode] hoặc :shortcode:
    const regex = /(\[\w+\]|:\w+:)/g;
    const parts = text.split(regex);

    return parts.map((part, index) => renderEmojiToken(part, index, size));
};
