import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
    PaperAirplaneIcon,
    ChatBubbleLeftRightIcon,
    FaceSmileIcon,
    XMarkIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    ArrowsPointingOutIcon,
    ArrowsPointingInIcon,
} from "@heroicons/react/24/outline";
import { Button } from "../../ui";
import { UserAvatar } from "../../common";
import { formatChatTimeGMT7 } from "../../../utils/watchPartyUtils";
import {
    TIKTOK_QUICK_REACTIONS,
    renderMessageText,
    extractGifStickerInfo,
    isEmojiOnlyMessage,
} from "./tiktokEmojis";
import { getTwemojiUrl } from "./openSourceEmojis";
import { WatchPartyMediaPicker } from "./WatchPartyMediaPicker";

const IconArrowUturnLeft = ({ className = "h-3.5 w-3.5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
    </svg>
);

const renderQuotedPreview = (text, size = 14) => {
    if (!text || typeof text !== "string") return null;

    const gifInfo = extractGifStickerInfo(text);
    if (gifInfo) {
        return (
            <span className="inline-flex items-center gap-1">
                <img
                    src={gifInfo.url}
                    alt="Sticker"
                    className="h-3.5 w-3.5 rounded object-contain shrink-0"
                    loading="lazy"
                />
                <span className="italic truncate">{gifInfo.title ? `[Sticker: ${gifInfo.title}]` : "[Sticker GIF]"}</span>
            </span>
        );
    }

    return (
        <span className="inline-flex items-center flex-wrap gap-0.5 align-middle">
            {renderMessageText(text, size)}
        </span>
    );
};

const QuotedMessage = ({ replyTo }) => {
    if (!replyTo) return null;
    return (
        <div className="mb-1.5 flex items-center gap-1 rounded border-l-2 border-red-500 bg-zinc-950/80 px-2 py-1 text-[11px] text-zinc-400 max-w-full overflow-hidden">
            <span className="font-semibold text-zinc-300 shrink-0">@{replyTo.senderName}: </span>
            <span className="italic line-clamp-1 inline-flex items-center gap-1 truncate">
                {renderQuotedPreview(replyTo.text, 14)}
            </span>
        </div>
    );
};

const extractMeetUrlFromText = (text) => {
    if (!text || typeof text !== "string") return null;
    const match = text.match(/https?:\/\/[^\s]+(?:meet\.google\.com|zoom\.us|teams\.microsoft\.com)[^\s]*/i) ||
                  text.match(/(?:meet\.google\.com|zoom\.us)\/[a-z0-9_-]+/i);
    if (!match) return null;
    const url = match[0];
    return url.startsWith("http") ? url : `https://${url}`;
};

const MeetLinkCta = ({ text }) => {
    const meetUrl = extractMeetUrlFromText(text);
    if (!meetUrl) return null;
    return (
        <a
            href={meetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 flex w-fit items-center gap-1.5 rounded-lg border border-emerald-600/70 bg-emerald-950/70 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-900 transition-colors"
        >
            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Vào phòng họp trực tuyến</span>
        </a>
    );
};

const ReplyingBanner = ({ replyTo, onCancel }) => {
    if (!replyTo) return null;
    return (
        <div className="mb-2 flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300">
            <div className="flex items-center gap-1.5 truncate">
                <IconArrowUturnLeft className="h-3.5 w-3.5 text-red-500 shrink-0" />
                <span className="text-[11px] text-zinc-400 shrink-0">Đang trả lời</span>
                <span className="font-semibold text-white shrink-0">@{replyTo.senderName}</span>
                <span className="italic text-zinc-300 truncate max-w-[160px] inline-flex items-center gap-1">
                    "{renderQuotedPreview(replyTo.text, 14)}"
                </span>
            </div>
            <button
                type="button"
                onClick={onCancel}
                className="text-zinc-400 hover:text-white p-0.5"
                title="Hủy trả lời"
            >
                <XMarkIcon className="h-3.5 w-3.5 stroke-2" />
            </button>
        </div>
    );
};

const MessageItem = ({ msg, onReply }) => {
    if (msg.isSystem) {
        return (
            <div className="my-1.5 flex items-center justify-center">
                <span className="rounded-full border border-zinc-800 bg-zinc-900/90 px-3 py-0.5 text-[10px] text-zinc-400 font-medium">
                    {msg.text}
                </span>
            </div>
        );
    }

    const isGif = Boolean(extractGifStickerInfo(msg.text));
    const isEmojiOnly = isEmojiOnlyMessage(msg.text);
    const noBackground = isGif || isEmojiOnly;
    const chatTime = formatChatTimeGMT7(msg.createdAt || msg.timestamp);

    return (
        <div className="group relative flex items-start gap-2.5">
            <UserAvatar
                name={msg.senderName}
                avatarUrl={msg.avatar}
                size="sm"
                isHost={msg.isHost}
            />
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                    <div className="flex items-baseline gap-1.5">
                        <span className="font-bold text-zinc-300">
                            {msg.senderName}
                        </span>
                        {chatTime && (
                            <span className="text-[10px] font-mono text-zinc-500">
                                {chatTime}
                            </span>
                        )}
                    </div>

                    {/* Nút Trả lời chuẩn Zoom khi hover */}
                    <button
                        type="button"
                        onClick={() => onReply?.(msg)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-zinc-500 hover:text-white rounded hover:bg-zinc-800"
                        title="Trả lời tin nhắn này (Reply)"
                    >
                        <IconArrowUturnLeft className="h-3.5 w-3.5" />
                    </button>
                </div>

                {/* Nếu có tin nhắn trích dẫn reply */}
                {msg.replyTo && (
                    <div className="mt-1">
                        <QuotedMessage replyTo={msg.replyTo} />
                    </div>
                )}

                {/* Nội dung tin nhắn: chỉ text mới có background bg-zinc-900, emoji & sticker KHÔNG cần bg */}
                {noBackground ? (
                    <div className="mt-0.5 flex flex-wrap items-center">
                        {renderMessageText(msg.text, isEmojiOnly ? 32 : 22)}
                        <MeetLinkCta text={msg.text} />
                    </div>
                ) : (
                    <div className="mt-0.5 wrap-break-word rounded-lg bg-zinc-900 px-3 py-2 text-zinc-200 leading-relaxed">
                        {renderMessageText(msg.text, 20)}
                        <MeetLinkCta text={msg.text} />
                    </div>
                )}
            </div>
        </div>
    );
};

const ChatHeaderBar = ({
    messagesCount,
    isMobileCollapsed,
    isMobileExpanded,
    onToggleMobileCollapse,
    onToggleMobileExpand,
    t,
}) => {
    return (
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5 select-none">
            <div
                onClick={onToggleMobileCollapse}
                className={`flex items-center gap-2 ${
                    onToggleMobileCollapse ? "cursor-pointer lg:cursor-default" : ""
                }`}
            >
                <ChatBubbleLeftRightIcon className="h-5 w-5 text-red-500 stroke-2" />
                <span className="text-sm font-bold tracking-wide">
                    {t("watchParty.chat.title")}
                </span>
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[11px] font-semibold text-zinc-400">
                    {messagesCount}
                </span>
            </div>

            {/* Nút điều khiển chiều cao khung chat trên mobile */}
            <div className="flex items-center gap-1 lg:hidden">
                {!isMobileCollapsed && onToggleMobileExpand && (
                    <button
                        type="button"
                        onClick={onToggleMobileExpand}
                        className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                        title={isMobileExpanded ? "Thu nhỏ về mức chuẩn" : "Mở rộng tối đa"}
                    >
                        {isMobileExpanded ? (
                            <ArrowsPointingInIcon className="h-4 w-4 stroke-2" />
                        ) : (
                            <ArrowsPointingOutIcon className="h-4 w-4 stroke-2" />
                        )}
                    </button>
                )}

                {onToggleMobileCollapse && (
                    <button
                        type="button"
                        onClick={onToggleMobileCollapse}
                        className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                        title={isMobileCollapsed ? "Mở rộng trò chuyện" : "Thu gọn trò chuyện"}
                    >
                        {isMobileCollapsed ? (
                            <ChevronUpIcon className="h-4 w-4 stroke-2" />
                        ) : (
                            <ChevronDownIcon className="h-4 w-4 stroke-2" />
                        )}
                    </button>
                )}
            </div>
        </div>
    );
};

const ALL_QUICK_REACTIONS = [
    { type: "open", code: ":joy:", hex: "1f602", label: "Cười ra nước mắt" },
    { type: "open", code: ":heart:", hex: "2764", label: "Trái tim" },
    { type: "open", code: ":popcorn:", hex: "1f37f", label: "Bắp rang bơ" },
    { type: "open", code: ":fire:", hex: "1f525", label: "Cháy quá" },
    { type: "open", code: ":clap:", hex: "1f44f", label: "Vỗ tay" },
    { type: "tiktok", code: "[cry]", label: "Khóc ròng", Component: TIKTOK_QUICK_REACTIONS[2]?.Component },
    { type: "tiktok", code: "[shock]", label: "Bàng hoàng", Component: TIKTOK_QUICK_REACTIONS[3]?.Component },
    { type: "tiktok", code: "[cool]", label: "Ngầu lòi", Component: TIKTOK_QUICK_REACTIONS[4]?.Component },
];

const QuickReactionsBar = ({ isMobileCollapsed, onQuickReaction }) => (
    <div className={`flex items-center justify-around border-t border-zinc-900 bg-zinc-900/50 px-2 py-1.5 ${isMobileCollapsed ? "hidden lg:flex" : ""}`}>
        {ALL_QUICK_REACTIONS.map((item) => {
            const hasComponent = Boolean(item.Component);
            if (item.type === "tiktok" && !hasComponent) return null;
            return (
                <button
                    key={item.code}
                    type="button"
                    onClick={() => onQuickReaction(item.code)}
                    className="flex items-center justify-center rounded p-1.5 transition-transform hover:scale-125 active:scale-95"
                    title={`${item.label} (${item.code})`}
                >
                    {item.type === "open" ? (
                        <img
                            src={getTwemojiUrl(item.hex)}
                            alt={item.label}
                            className="h-5 w-5 select-none"
                            loading="lazy"
                        />
                    ) : (
                        <item.Component size={20} />
                    )}
                </button>
            );
        })}
    </div>
);

const ChatInputForm = ({
    isMobileCollapsed,
    isEmojiPickerOpen,
    setIsEmojiPickerOpen,
    handleSelectEmoji,
    handleSelectSticker,
    replyingTo,
    setReplyingTo,
    inputText,
    setInputText,
    handleSend,
    t,
}) => {
    return (
        <form onSubmit={handleSend} className={`relative border-t border-zinc-800 bg-zinc-950 p-3 ${isMobileCollapsed ? "hidden lg:block" : ""}`}>
            <WatchPartyMediaPicker
                isOpen={isEmojiPickerOpen}
                onClose={() => setIsEmojiPickerOpen(false)}
                onSelectEmoji={handleSelectEmoji}
                onSelectSticker={handleSelectSticker}
            />

            <ReplyingBanner
                replyTo={replyingTo}
                onCancel={() => setReplyingTo(null)}
            />

            <div className="flex items-center gap-1.5">
                <button
                    type="button"
                    onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                    className={`rounded-lg p-2 transition-colors ${
                        isEmojiPickerOpen
                            ? "bg-red-600 text-white"
                            : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                    }`}
                    title="Emoji mã nguồn mở & Sticker GIF"
                >
                    <FaceSmileIcon className="h-5 w-5 stroke-2" />
                </button>

                <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={replyingTo ? `Trả lời @${replyingTo.senderName}...` : t("watchParty.chat.placeholder")}
                    className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-red-600 focus:outline-none"
                />

                <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={!inputText.trim()}
                    title={t("watchParty.chat.send")}
                >
                    <PaperAirplaneIcon className="h-4 w-4 stroke-2" />
                </Button>
            </div>
        </form>
    );
};

export const WatchPartyChatSidebar = ({
    messages = [],
    onSendMessage,
    onSeekToTimestamp,
    isMobileCollapsed = false,
    isMobileExpanded = false,
    onToggleMobileCollapse,
    onToggleMobileExpand,
}) => {
    const { t } = useTranslation();
    const [inputText, setInputText] = useState("");
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
    const [replyingTo, setReplyingTo] = useState(null);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = (e) => {
        e?.preventDefault();
        if (!inputText.trim()) return;

        onSendMessage(inputText, null, replyingTo);
        setInputText("");
        setIsEmojiPickerOpen(false);
        setReplyingTo(null);
    };

    const handleQuickReaction = (reactionCode) => {
        onSendMessage(reactionCode);
    };

    const handleSelectEmoji = (emojiCode) => {
        setInputText((prev) => (prev ? `${prev} ${emojiCode} ` : `${emojiCode} `));
    };

    const handleSelectSticker = (gif) => {
        onSendMessage(`[gif:${gif.url}|${gif.title}]`);
        setIsEmojiPickerOpen(false);
    };

    const handleStartReply = (msg) => {
        setReplyingTo({
            id: msg.id,
            senderName: msg.senderName,
            text: msg.text,
        });
    };

    return (
        <aside className="relative flex h-full w-full flex-col border-l border-zinc-800 bg-zinc-950 text-white">
            <ChatHeaderBar
                messagesCount={messages.length}
                isMobileCollapsed={isMobileCollapsed}
                isMobileExpanded={isMobileExpanded}
                onToggleMobileCollapse={onToggleMobileCollapse}
                onToggleMobileExpand={onToggleMobileExpand}
                t={t}
            />

            {/* Danh sách tin nhắn */}
            <div className={`flex-1 space-y-3 overflow-y-auto p-4 text-xs ${isMobileCollapsed ? "hidden lg:block" : ""}`}>
                {messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center text-zinc-500">
                        <ChatBubbleLeftRightIcon className="mb-2 h-8 w-8 stroke-1 opacity-50" />
                        <p>{t("watchParty.chat.noMessages")}</p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <MessageItem
                            key={msg.id}
                            msg={msg}
                            onSeekToTimestamp={onSeekToTimestamp}
                            onReply={handleStartReply}
                            t={t}
                        />
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            <QuickReactionsBar
                isMobileCollapsed={isMobileCollapsed}
                onQuickReaction={handleQuickReaction}
            />

            <ChatInputForm
                isMobileCollapsed={isMobileCollapsed}
                isEmojiPickerOpen={isEmojiPickerOpen}
                setIsEmojiPickerOpen={setIsEmojiPickerOpen}
                handleSelectEmoji={handleSelectEmoji}
                handleSelectSticker={handleSelectSticker}
                replyingTo={replyingTo}
                setReplyingTo={setReplyingTo}
                inputText={inputText}
                setInputText={setInputText}
                handleSend={handleSend}
                t={t}
            />
        </aside>
    );
};
