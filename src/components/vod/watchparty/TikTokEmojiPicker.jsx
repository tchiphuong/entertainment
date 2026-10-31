import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { TIKTOK_EMOJIS } from "./tiktokEmojis";

export const TikTokEmojiPicker = ({ isOpen, onClose, onSelectEmoji }) => {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState("");

    const filteredEmojis = useMemo(() => {
        if (!searchTerm.trim()) return TIKTOK_EMOJIS;
        const lower = searchTerm.toLowerCase();
        return TIKTOK_EMOJIS.filter(
            (e) =>
                e.code.toLowerCase().includes(lower) ||
                e.name.toLowerCase().includes(lower) ||
                e.label.toLowerCase().includes(lower)
        );
    }, [searchTerm]);

    if (!isOpen) return null;

    return (
        <div className="absolute bottom-full left-0 right-0 mb-2 z-50 flex flex-col rounded-xl border border-zinc-800 bg-zinc-950 p-3 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
            {/* Header & Thanh tìm kiếm */}
            <div className="mb-2 flex items-center justify-between gap-2 border-b border-zinc-800 pb-2">
                <div className="relative flex-1">
                    <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500 stroke-2" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={t("watchParty.chat.searchEmoji", { defaultValue: "Tìm biểu tượng TikTok..." })}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-1 pl-8 pr-2 text-xs text-white placeholder-zinc-500 focus:border-red-600 focus:outline-none"
                    />
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

            {/* Lưới hiển thị các emoji TikTok */}
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 max-h-48 overflow-y-auto p-1">
                {filteredEmojis.map((emoji) => {
                    const EmojiComp = emoji.Component;
                    return (
                        <button
                            key={emoji.code}
                            type="button"
                            onClick={() => onSelectEmoji(emoji.code)}
                            className="group flex flex-col items-center justify-center rounded-lg p-1.5 transition-all hover:bg-zinc-800 hover:scale-110 active:scale-95"
                            title={`${emoji.label} (${emoji.code})`}
                        >
                            <EmojiComp size={26} />
                        </button>
                    );
                })}
            </div>

            {/* Footer gợi ý shortcode */}
            <div className="mt-2 flex items-center justify-between border-t border-zinc-900 pt-1.5 text-[10px] text-zinc-500">
                <span>{filteredEmojis.length} biểu tượng TikTok</span>
                <span>Gõ [mã] để gửi nhanh</span>
            </div>
        </div>
    );
};
