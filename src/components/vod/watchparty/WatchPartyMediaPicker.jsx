import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
    MagnifyingGlassIcon,
    XMarkIcon,
    FaceSmileIcon,
    PhotoIcon,
} from "@heroicons/react/24/outline";
import {
    OPEN_SOURCE_EMOJIS,
    OPEN_EMOJI_CATEGORIES,
    getTwemojiUrl,
} from "./openSourceEmojis";
import { TIKTOK_EMOJIS } from "./tiktokEmojis";
import {
    GIF_CATEGORIES,
    fetchGifsByCategory,
    searchGifs,
} from "../../../services/vod/gifService";

const MediaPickerHeader = ({
    activeTab,
    setActiveTab,
    searchTerm,
    setSearchTerm,
    onClose,
    t,
}) => {
    return (
        <div className="flex flex-col gap-2 border-b border-zinc-800 pb-2">
            <div className="flex items-center justify-between">
                {/* Tabs chuyển đổi Emoji Mã Nguồn Mở & Sticker GIF */}
                <div className="flex items-center gap-1 rounded-lg bg-zinc-900 p-0.5">
                    <button
                        type="button"
                        onClick={() => setActiveTab("emoji")}
                        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                            activeTab === "emoji"
                                ? "bg-red-600 text-white"
                                : "text-zinc-400 hover:text-white"
                        }`}
                    >
                        <FaceSmileIcon className="h-3.5 w-3.5 stroke-2" />
                        <span>Emoji mở</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("gif")}
                        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                            activeTab === "gif"
                                ? "bg-red-600 text-white"
                                : "text-zinc-400 hover:text-white"
                        }`}
                    >
                        <PhotoIcon className="h-3.5 w-3.5 stroke-2" />
                        <span>Sticker GIF</span>
                    </button>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                    title={t("common.close", { defaultValue: "Đóng" })}
                >
                    <XMarkIcon className="h-4 w-4 stroke-2" />
                </button>
            </div>

            {/* Thanh tìm kiếm */}
            <div className="relative">
                <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500 stroke-2" />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={
                        activeTab === "emoji"
                            ? "Tìm emoji, cảm xúc, biểu tượng..."
                            : "Tìm sticker GIF phản ứng xem phim..."
                    }
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-1 pl-8 pr-2 text-xs text-white placeholder-zinc-500 focus:border-red-600 focus:outline-none"
                />
            </div>
        </div>
    );
};

const EmojiTabContent = ({
    searchTerm,
    selectedCategory,
    setSelectedCategory,
    onSelectEmoji,
}) => {
    const filteredEmojis = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        let list = OPEN_SOURCE_EMOJIS;
        if (selectedCategory !== "all") {
            list = list.filter((e) => e.category === selectedCategory);
        }
        if (!query) return list;
        return list.filter(
            (e) =>
                e.code.toLowerCase().includes(query) ||
                e.label.toLowerCase().includes(query)
        );
    }, [searchTerm, selectedCategory]);

    const filteredTikTok = useMemo(() => {
        if (selectedCategory !== "all" && selectedCategory !== "tiktok") return [];
        const query = searchTerm.trim().toLowerCase();
        if (!query) return TIKTOK_EMOJIS.slice(0, 16);
        return TIKTOK_EMOJIS.filter(
            (e) =>
                e.code.toLowerCase().includes(query) ||
                e.label.toLowerCase().includes(query)
        );
    }, [searchTerm, selectedCategory]);

    return (
        <div className="flex flex-col gap-2">
            {/* Thanh lọc danh mục Emoji */}
            <div className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none text-[11px]">
                {OPEN_EMOJI_CATEGORIES.map((cat) => (
                    <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`shrink-0 rounded-full px-2 py-0.5 font-medium transition-colors ${
                            selectedCategory === cat.id
                                ? "bg-red-600 text-white"
                                : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                        }`}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Lưới hiển thị Emoji Twemoji mã nguồn mở */}
            <div className="grid grid-cols-7 sm:grid-cols-8 gap-1.5 max-h-52 overflow-y-auto p-1">
                {filteredEmojis.map((emoji) => (
                    <button
                        key={emoji.code}
                        type="button"
                        onClick={() => onSelectEmoji(emoji.code)}
                        className="flex items-center justify-center rounded-lg p-1.5 transition-all hover:bg-zinc-800 hover:scale-125 active:scale-95"
                        title={`${emoji.label} (${emoji.code})`}
                    >
                        <img
                            src={getTwemojiUrl(emoji.hex)}
                            alt={emoji.label}
                            className="h-6 w-6 select-none"
                            loading="lazy"
                        />
                    </button>
                ))}

                {/* Các biểu tượng TikTok */}
                {filteredTikTok.map((emoji) => {
                    const EmojiComp = emoji.Component;
                    return (
                        <button
                            key={emoji.code}
                            type="button"
                            onClick={() => onSelectEmoji(emoji.code)}
                            className="flex items-center justify-center rounded-lg p-1.5 transition-all hover:bg-zinc-800 hover:scale-125 active:scale-95"
                            title={`${emoji.label} (${emoji.code})`}
                        >
                            <EmojiComp size={24} />
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const GifTabContent = ({
    searchTerm,
    selectedCategory,
    setSelectedCategory,
    onSelectSticker,
}) => {
    const [stickers, setStickers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isCurrent = true;
        setIsLoading(true);

        const timer = setTimeout(async () => {
            const query = searchTerm.trim();
            const results = query
                ? await searchGifs(query)
                : await fetchGifsByCategory(selectedCategory);

            if (isCurrent) {
                setStickers(results);
                setIsLoading(false);
            }
        }, 300);

        return () => {
            isCurrent = false;
            clearTimeout(timer);
        };
    }, [searchTerm, selectedCategory]);

    return (
        <div className="flex flex-col gap-2">
            {/* Thanh lọc danh mục Sticker GIF */}
            <div className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none text-[11px]">
                {GIF_CATEGORIES.map((cat) => (
                    <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`shrink-0 rounded-full px-2 py-0.5 font-medium transition-colors ${
                            selectedCategory === cat.id
                                ? "bg-red-600 text-white"
                                : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                        }`}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Lưới hiển thị các Sticker GIF động */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-52 overflow-y-auto p-1">
                {isLoading ? (
                    <div className="col-span-3 sm:col-span-4 flex items-center justify-center py-8 text-xs text-zinc-500">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-red-600 mr-2" />
                        <span>Đang tải sticker...</span>
                    </div>
                ) : stickers.length === 0 ? (
                    <div className="col-span-3 sm:col-span-4 py-8 text-center text-xs text-zinc-500">
                        Không tìm thấy sticker phù hợp
                    </div>
                ) : (
                    stickers.map((gif) => (
                        <button
                            key={gif.id}
                            type="button"
                            onClick={() => onSelectSticker(gif)}
                            className="group relative overflow-hidden rounded-lg border border-zinc-800/80 bg-zinc-900 p-1 transition-all hover:border-red-600 hover:scale-105 active:scale-95"
                            title={gif.title}
                        >
                            <img
                                src={gif.previewUrl || gif.url}
                                alt={gif.title}
                                className="h-16 w-full rounded object-contain"
                                loading="lazy"
                            />
                            <div className="absolute inset-x-0 bottom-0 bg-black/80 px-1 py-0.5 text-[9px] text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity truncate">
                                {gif.title}
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
};

/**
 * Bảng chọn Media đa năng: Emoji Mã Nguồn Mở (Twemoji) & Thư viện Sticker GIF
 */
export const WatchPartyMediaPicker = ({
    isOpen,
    onClose,
    onSelectEmoji,
    onSelectSticker,
}) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState("emoji");
    const [searchTerm, setSearchTerm] = useState("");
    const [emojiCategory, setEmojiCategory] = useState("all");
    const [gifCategory, setGifCategory] = useState("all");

    if (!isOpen) return null;

    return (
        <div className="absolute bottom-full left-0 right-0 mb-2 z-50 flex flex-col rounded-xl border border-zinc-800 bg-zinc-950 p-3 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 max-w-[340px] sm:max-w-[400px]">
            <MediaPickerHeader
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                onClose={onClose}
                t={t}
            />

            <div className="mt-2">
                {activeTab === "emoji" ? (
                    <EmojiTabContent
                        searchTerm={searchTerm}
                        selectedCategory={emojiCategory}
                        setSelectedCategory={setEmojiCategory}
                        onSelectEmoji={onSelectEmoji}
                    />
                ) : (
                    <GifTabContent
                        searchTerm={searchTerm}
                        selectedCategory={gifCategory}
                        setSelectedCategory={setGifCategory}
                        onSelectSticker={onSelectSticker}
                    />
                )}
            </div>

            {/* Footer chỉ dẫn */}
            <div className="mt-2 flex items-center justify-between border-t border-zinc-900 pt-1.5 text-[10px] text-zinc-500">
                <span>{activeTab === "emoji" ? "Mã nguồn mở Twemoji & TikTok" : "Sticker GIF xem phim"}</span>
                <span>Bấm để gửi ngay</span>
            </div>
        </div>
    );
};
