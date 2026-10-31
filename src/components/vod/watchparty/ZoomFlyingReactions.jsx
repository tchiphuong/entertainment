import { useState, useEffect, useRef } from "react";
import { TIKTOK_EMOJI_MAP } from "./tiktokEmojis";
import { OPEN_EMOJI_MAP, getTwemojiUrl } from "./openSourceEmojis";

/**
 * Trích xuất emoji SVG component hoặc renderer từ tin nhắn
 */
const findReactionVisual = (text) => {
    if (!text || typeof text !== "string") return null;

    // 1. Kiểm tra Twemoji mã nguồn mở (:code:)
    const openMatch = text.match(/:\w+:/);
    if (openMatch) {
        const code = openMatch[0].toLowerCase();
        const entry = OPEN_EMOJI_MAP.get(code);
        if (entry) {
            return () => (
                <img
                    src={getTwemojiUrl(entry.hex)}
                    alt={entry.label}
                    className="h-7 w-7 select-none"
                    loading="lazy"
                />
            );
        }
    }

    // 2. Kiểm tra TikTok emoji ([code])
    const ttMatch = text.match(/\[(\w+)\]/);
    if (ttMatch) {
        const code = ttMatch[0].toLowerCase();
        const entry = TIKTOK_EMOJI_MAP.get(code);
        if (entry?.Component) {
            const Comp = entry.Component;
            return () => <Comp size={28} />;
        }
    }

    // 3. Kiểm tra Sticker GIF ([gif:url|title])
    const gifMatch = text.match(/\[gif:(https?:\/\/[^\]|]+)/i);
    if (gifMatch) {
        const url = gifMatch[1];
        return () => (
            <img
                src={url}
                alt="Sticker"
                className="h-9 w-9 rounded-md object-contain"
                loading="lazy"
            />
        );
    }

    return null;
};

const removeReactionById = (reactionsList, targetId) => {
    return reactionsList.filter((item) => item.id !== targetId);
};

/**
 * Component hiệu ứng cảm xúc bay lượn (Floating Reactions) chuẩn Zoom
 * Khi thành viên bấm reaction hoặc gửi tin nhắn cảm xúc, biểu tượng sẽ bay từ dưới lên
 */
export const ZoomFlyingReactions = ({ messages = [] }) => {
    const [reactions, setReactions] = useState([]);
    const lastProcessedIdRef = useRef(null);

    const purgeReaction = (targetId) => {
        setReactions((prev) => removeReactionById(prev, targetId));
    };

    useEffect(() => {
        if (!messages.length) return;
        const latestMsg = messages[messages.length - 1];
        if (!latestMsg || latestMsg.id === lastProcessedIdRef.current) return;
        lastProcessedIdRef.current = latestMsg.id;

        const VisualRenderer = findReactionVisual(latestMsg.text);
        if (!VisualRenderer) return;

        const newReaction = {
            id: `${latestMsg.id}_${Date.now()}`,
            Renderer: VisualRenderer,
            senderName: latestMsg.senderName || "Ẩn danh",
            leftPercent: 40 + Math.floor(Math.random() * 45), // Rơi vào vùng 40% - 85% góc phải màn hình
        };

        setReactions((prev) => [...prev.slice(-8), newReaction]);

        const timer = setTimeout(() => {
            purgeReaction(newReaction.id);
        }, 2500);

        return () => clearTimeout(timer);
    }, [messages]);

    if (!reactions.length) return null;

    return (
        <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
            {reactions.map((r) => {
                const Renderer = r.Renderer;
                return (
                    <div
                        key={r.id}
                        style={{ left: `${r.leftPercent}%` }}
                        className="animate-zoom-float-up absolute bottom-12 flex items-center gap-1.5 rounded-full border border-zinc-700/60 bg-zinc-950/90 px-3 py-1.5 shadow-2xl backdrop-blur-sm"
                    >
                        <Renderer />
                        <span className="max-w-[80px] truncate text-[11px] font-bold text-white">
                            {r.senderName}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};
