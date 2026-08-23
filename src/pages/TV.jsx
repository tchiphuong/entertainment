import React, {
    useState,
    useEffect,
    useRef,
    useMemo,
    useCallback,
} from "react";
import { useSearchParams } from "react-router-dom";
import shaka from "shaka-player/dist/shaka-player.ui.js";
import "shaka-player/dist/controls.css";
import {
    fetchChannels,
    handleImageFallbackError,
} from "../services/tv/tvService";

const PROXY_WORKER_URL = import.meta.env.VITE_PROXY_WORKER_URL || "";


// Component hiển thị thông tin kênh đang chọn - Memoized
const ChannelInfo = React.memo(
    ({
        selectedChannel,
        currentSourceIdx,
        showSourceDropdown,
        setShowSourceDropdown,
        onSelectSource,
        onPrev,
        onNext,
        isFavorite,
        onToggleFavorite,
    }) => {
        if (!selectedChannel) return null;
        return (
            <div className="relative rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-2xl">
                <div className="relative z-10 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-5">
                        <div className="group relative">
                            {selectedChannel.logo ? (
                                <img
                                    loading="lazy"
                                    src={selectedChannel.logo}
                                    alt={selectedChannel.name}
                                    onError={handleImageFallbackError}
                                    className="h-14 w-14 rounded-xl border border-zinc-800 bg-zinc-950 object-contain p-1.5 shadow-lg transition-transform group-hover:scale-105"
                                />
                            ) : (
                                <div className="h-14 w-14 rounded-xl border border-zinc-800 bg-zinc-950 shadow-lg" />
                            )}
                            <div className="animate-pulse-live absolute -right-1 -top-1 h-3 w-3 rounded-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.8)]" />
                        </div>
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
                            <div className="flex min-w-0 flex-col">
                                <div className="flex items-center gap-2">
                                    <span className="rounded bg-red-600/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-500 ring-1 ring-inset ring-red-600/30">
                                        Live
                                    </span>
                                    <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                                        Đang phát
                                    </div>
                                </div>
                                <div className="mt-0.5 flex items-center gap-2">
                                    <div className="line-clamp-1 text-xl font-bold tracking-tight text-white">
                                        {selectedChannel.name}
                                    </div>
                                    <button
                                        onClick={() =>
                                            onToggleFavorite(selectedChannel.id)
                                        }
                                        className={
                                            "transition-all duration-300 " +
                                            (isFavorite
                                                ? "scale-110 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                                                : "text-zinc-600 hover:text-zinc-400")
                                        }
                                    >
                                        <svg
                                            className="h-5 w-5"
                                            fill={
                                                isFavorite ? "currentColor" : "none"
                                            }
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                                            />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* Source Selection Block */}
                            {selectedChannel.configSources && selectedChannel.configSources.length > 1 && (
                                <div className="ml-auto flex shrink-0 items-center gap-3 border-l border-zinc-800 pl-4">
                                    <div className="hidden items-center gap-1.5 sm:flex">
                                        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-600" />
                                        <span className="text-[10px] font-bold uppercase tracking-tight text-zinc-500">
                                            Nguồn {currentSourceIdx + 1}/{selectedChannel.configSources.length}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <div className="relative">
                                            <button
                                                onClick={() =>
                                                    setShowSourceDropdown(
                                                        !showSourceDropdown,
                                                    )
                                                }
                                                className={
                                                    "flex h-7 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-bold transition-all " +
                                                    (showSourceDropdown
                                                        ? "border-red-600 bg-red-600/20 text-white"
                                                        : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white")
                                                }
                                            >
                                                <span>Nguồn {currentSourceIdx + 1}</span>
                                                <svg
                                                    className={
                                                        "h-3 w-3 transition-transform duration-300 " +
                                                        (showSourceDropdown
                                                            ? "rotate-180 text-red-500"
                                                            : "")
                                                    }
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>

                                            {showSourceDropdown && (
                                                <>
                                                    <div className="fixed inset-0 z-40" onClick={() => setShowSourceDropdown(false)} />
                                                    <div className="animate-in fade-in slide-in-from-top-2 absolute left-0 top-full z-50 mt-1.5 min-w-[120px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl duration-200">
                                                        <div className="flex flex-col p-1.5">
                                                            {selectedChannel.configSources.map((_, idx) => {
                                                                const isSelected = currentSourceIdx === idx;
                                                                return (
                                                                    <button
                                                                        key={idx}
                                                                        onClick={() => {
                                                                            onSelectSource(idx);
                                                                            setShowSourceDropdown(false);
                                                                        }}
                                                                        className={"flex items-center justify-between rounded-lg px-3 py-2 text-left text-[11px] font-bold transition-all " + (isSelected ? "bg-red-600 text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-white")}
                                                                    >
                                                                        <span>Nguồn {idx + 1}</span>
                                                                        {isSelected && <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => onSelectSource((currentSourceIdx + 1) % selectedChannel.configSources.length)}
                                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-white"
                                            title="Đổi sang nguồn tiếp theo"
                                        >
                                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <button
                            onClick={onPrev}
                            className="rounded-full border border-zinc-800 bg-zinc-950 p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                            title="Kênh trước"
                        >
                            <svg
                                className="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 19l-7-7 7-7"
                                />
                            </svg>
                        </button>
                        <button
                            onClick={onNext}
                            className="rounded-full border border-zinc-800 bg-zinc-950 p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                            title="Kênh sau"
                        >
                            <svg
                                className="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 5l7 7-7 7"
                                />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        );
    },
);

// Component hiển thị từng mục trong lịch phát sóng - Memoized

const ScheduleItem = React.memo(
    ({ item, isCurrent, formatTime, programProgress }) => {
        const startMs = item.startMs ?? item.start ?? item.s ?? null;
        const endMs = item.stopMs ?? item.end ?? item.stop ?? item.e ?? null;
        const start = formatTime(startMs);
        const end = formatTime(endMs);
        const prog = isCurrent ? programProgress(item) : 0;

        // Calculate time remaining for current program
        const getRemainingText = () => {
            if (!isCurrent || !endMs) return null;
            const diff = endMs - Date.now();
            if (diff <= 0) return "Sắp kết thúc";
            const mins = Math.ceil(diff / 60000);
            if (mins > 60) {
                const h = Math.floor(mins / 60);
                const m = mins % 60;
                return `Còn ${h}h ${m}m`;
            }
            return `Còn ${mins}m`;
        };

        const remaining = getRemainingText();

        return (
            <div
                data-current={isCurrent ? "1" : "0"}
                data-start-ms={startMs}
                className={
                    "group relative flex items-start gap-2 overflow-hidden rounded-lg border px-3 py-2 transition-all duration-200 " +
                    (isCurrent
                        ? "border-l-4 border-l-red-600 border-zinc-800 bg-zinc-950"
                        : "border-zinc-800/60 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-900")
                }
            >
                <div className="w-24 flex-none shrink-0">
                    <div
                        className={
                            "flex justify-between gap-1 text-xs font-medium tracking-tight " +
                            (isCurrent ? "text-red-500 font-bold" : "text-zinc-500")
                        }
                    >
                        <span className="flex-1">{start}</span>—
                        <span className="flex-1">{end}</span>
                    </div>
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <div
                            className={
                                "line-clamp-1 text-[13px] font-semibold tracking-tight transition-colors " +
                                (isCurrent
                                    ? "text-white"
                                    : "text-zinc-300 group-hover:text-white")
                            }
                        >
                            {item.title ||
                                item.name ||
                                item.program ||
                                "Chương trình"}
                        </div>
                        {isCurrent && (
                            <div className="flex shrink-0 flex-col items-end gap-1">
                                <div className="rounded-full bg-red-600/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-500 ring-1 ring-inset ring-red-600/30">
                                    LIVE
                                </div>
                                {remaining && (
                                    <div className="text-[10px] font-medium uppercase tracking-tighter text-zinc-500">
                                        {remaining}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {isCurrent && (
                        <div className="relative mt-2">
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                                <div
                                    className="h-full rounded-full bg-red-600 transition-all duration-1000"
                                    style={{ width: `${prog}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {item.desc && (
                        <div
                            className={
                                "mt-1 line-clamp-1 text-[11px] leading-relaxed transition-opacity " +
                                (isCurrent
                                    ? "text-zinc-400"
                                    : "text-zinc-600 group-hover:text-zinc-400")
                            }
                        >
                            {item.desc}
                        </div>
                    )}
                </div>
            </div>
        );
    },
);

// Component danh sách lịch phát sóng - Memoized
const ScheduleList = React.memo(
    ({
        schedule,
        loading,
        error,
        lastUpdated,
        formatDateTime,
        isCurrentProgram,
        formatTime,
        programProgress,
        containerRef,
        expanded,
        onToggle,
    }) => {
        // Đăng ký wheel event với { passive: false } để có thể preventDefault
        useEffect(() => {
            const el = containerRef?.current;
            if (!el) return;

            const handleWheel = (e) => {
                const canScroll = el.scrollHeight > el.clientHeight;
                if (!canScroll) return;
                e.preventDefault();
                el.scrollTop += e.deltaY;
            };

            el.addEventListener("wheel", handleWheel, { passive: false });
            return () => el.removeEventListener("wheel", handleWheel);
        }, [containerRef]);

        return (
            <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-2xl">
                <div
                    className="relative z-10 flex cursor-pointer items-center justify-between border-b border-zinc-800 bg-zinc-950 p-4"
                    onClick={onToggle}
                >
                    <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-white">
                        <svg
                            className="h-4 w-4 text-red-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                            />
                        </svg>
                        Lịch Phát Sóng
                        {/* Mũi tên toggle */}
                        <svg
                            className={
                                "h-3 w-3 text-zinc-500 transition-transform " +
                                (expanded !== false ? "rotate-90" : "rotate-0")
                            }
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.5}
                                d="M9 5l7 7-7 7"
                            />
                        </svg>
                    </h3>
                    <div className="text-xs text-zinc-400">
                        {lastUpdated
                            ? `Cập nhật: ${formatDateTime(lastUpdated)}`
                            : "--"}
                    </div>
                </div>

                <div
                    ref={containerRef}
                    className={
                        "custom-scrollbar h-0 min-h-96 grow overflow-auto text-sm text-zinc-300 " +
                        (expanded === false ? "hidden" : "")
                    }
                >
                    {loading ? (
                        <div className="flex items-center gap-2 px-5 py-4 text-xs font-bold text-zinc-400">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-800 border-t-red-600"></div>
                            <div>Đang tải lịch phát sóng...</div>
                        </div>
                    ) : error ? (
                        <div className="px-5 py-4 text-xs font-bold text-zinc-500">{error}</div>
                    ) : !schedule || schedule.length === 0 ? (
                        <div className="px-5 py-4 text-xs text-zinc-500">
                            Chưa có dữ liệu lịch cho kênh này.
                        </div>
                    ) : (
                        <div className="space-y-1 p-2">
                            {schedule.map((item, idx) => {
                                const startMs = toMs(
                                    item.startMs ??
                                        item.start ??
                                        item.s ??
                                        null,
                                );
                                const itemDate = startMs
                                    ? new Date(startMs)
                                    : null;
                                const prevItem =
                                    idx > 0 ? schedule[idx - 1] : null;
                                const prevMs = prevItem
                                    ? toMs(
                                          prevItem.startMs ??
                                              prevItem.start ??
                                              prevItem.s ??
                                              null,
                                      )
                                    : null;
                                const prevDate = prevMs
                                    ? new Date(prevMs)
                                    : null;

                                // Hiện date separator khi ngày thay đổi
                                const showDateSep =
                                    itemDate &&
                                    (idx === 0 ||
                                        !prevDate ||
                                        itemDate.toDateString() !==
                                            prevDate.toDateString());

                                const getDateLabel = (d) => {
                                    const today = new Date();
                                    const tomorrow = new Date(today);
                                    tomorrow.setDate(today.getDate() + 1);
                                    const yesterday = new Date(today);
                                    yesterday.setDate(today.getDate() - 1);

                                    if (
                                        d.toDateString() ===
                                        today.toDateString()
                                    )
                                        return "Hôm nay";
                                    if (
                                        d.toDateString() ===
                                        tomorrow.toDateString()
                                    )
                                        return "Ngày mai";
                                    if (
                                        d.toDateString() ===
                                        yesterday.toDateString()
                                    )
                                        return "Hôm qua";
                                    return d.toLocaleDateString("vi-VN", {
                                        weekday: "long",
                                        day: "2-digit",
                                        month: "2-digit",
                                    });
                                };

                                return (
                                    <React.Fragment key={idx}>
                                        {showDateSep && itemDate && (
                                            <div className="flex items-center gap-2 py-2">
                                                <div className="h-px flex-1 bg-white/10" />
                                                <span className="rounded-full bg-white/10 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white/50">
                                                    {getDateLabel(itemDate)}
                                                </span>
                                                <div className="h-px flex-1 bg-white/10" />
                                            </div>
                                        )}
                                        <ScheduleItem
                                            item={item}
                                            isCurrent={isCurrentProgram(item)}
                                            formatTime={formatTime}
                                            programProgress={programProgress}
                                        />
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    },
);

// --- PURE UTILITY FUNCTIONS (stable references, no React state dependency) ---

const toMs = (v) => {
    if (v == null) return null;
    if (typeof v === "number") return v;
    if (typeof v === "string") {
        const n = Date.parse(v);
        return isNaN(n) ? null : n;
    }
    if (v instanceof Date) return v.getTime();
    return null;
};

const getStartEndMs = (item) => {
    const s = toMs(item.startMs ?? item.start ?? item.s ?? null);
    const e = toMs(item.stopMs ?? item.end ?? item.stop ?? null);
    return { s, e };
};

const getChannelParamId = (channel) => {
    if (!channel) return "";
    if (channel.tvgId) return String(channel.tvgId).trim();
    if (channel.id != null) return `ch-${String(channel.id).trim()}`;
    return "";
};

const findChannelByParamId = (allChannels, paramId) => {
    const normalizedParam = String(paramId || "")
        .trim()
        .toLowerCase();
    if (!normalizedParam) return null;

    const byTvgId = allChannels.find((channel) => {
        if (!channel.tvgId) return false;
        return String(channel.tvgId).trim().toLowerCase() === normalizedParam;
    });
    if (byTvgId) return byTvgId;

    if (normalizedParam.startsWith("ch-")) {
        const numericId = normalizedParam.slice(3);
        const byInternalId = allChannels.find(
            (channel) => String(channel.id).trim().toLowerCase() === numericId,
        );
        if (byInternalId) return byInternalId;
    }

    return (
        allChannels.find(
            (channel) =>
                String(channel.id).trim().toLowerCase() === normalizedParam,
        ) || null
    );
};

export default function TV() {
    const [searchParams, setSearchParams] = useSearchParams();
    const urlChannelId = String(searchParams.get("id") || "").trim();
    // Simple toast helper (DOM-based) - useCallback to stabilize reference
    const showToast = useCallback((message, opts = {}) => {
        try {
            const { duration = 5000, type = "error" } = opts;
            const id = `tv-toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const containerId = "tv-toast-container";
            let container = document.getElementById(containerId);
            if (!container) {
                container = document.createElement("div");
                container.id = containerId;
                container.className =
                    "fixed top-4 right-4 z-[99999] flex flex-col gap-2";
                document.body.appendChild(container);
            }

            const el = document.createElement("div");
            el.id = id;
            el.textContent = message;

            const base =
                "min-w-[200px] max-w-[420px] px-4 py-2 rounded-lg shadow-lg text-white text-sm leading-tight transform transition-all duration-200 cursor-pointer";
            const hidden = "opacity-0 -translate-y-1";

            let colorClass = "bg-zinc-800 border border-zinc-700";
            if (type === "error")
                colorClass = "bg-red-600 border border-red-500 text-white";
            else if (type === "warn")
                colorClass = "bg-amber-600 border border-amber-500 text-white";

            el.className = `${base} ${colorClass} ${hidden}`;

            container.appendChild(el);

            requestAnimationFrame(() => {
                el.classList.remove("opacity-0", "-translate-y-1");
                el.classList.add("opacity-100", "translate-y-0");
            });

            const to = setTimeout(() => {
                try {
                    el.classList.remove("opacity-100", "translate-y-0");
                    el.classList.add("opacity-0", "-translate-y-1");
                    setTimeout(() => el.remove(), 220);
                } catch (e) {}
            }, duration);

            el.addEventListener("click", () => {
                clearTimeout(to);
                try {
                    el.remove();
                } catch (e) {}
            });

            return () => {
                clearTimeout(to);
                try {
                    el.remove();
                } catch (e) {}
            };
        } catch (e) {
            // ignore toast errors
        }
    }, []);
    const [rawGroups, setRawGroups] = useState([]); // Lưu dữ liệu gốc từ API
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedChannel, setSelectedChannel] = useState(null);
    const [currentSourceIdx, setCurrentSourceIdx] = useState(0); // Track nguồn đang phát hiện tại
    const [showSourceDropdown, setShowSourceDropdown] = useState(false); // Đóng/mở menu chọn nguồn
    const [lastUpdated, setLastUpdated] = useState(null);
    const [schedule, setSchedule] = useState([]);
    const [scheduleLoading, setScheduleLoading] = useState(false);
    const [scheduleError, setScheduleError] = useState(null);
    const [activeGroupId, setActiveGroupId] = useState(null); // ID của nhóm đang chọn (Tab)

    // Favorites & Play Counts
    const [favorites, setFavorites] = useState(() => {
        const saved = localStorage.getItem("tv_favorites");
        return saved ? JSON.parse(saved) : [];
    });
    const [playCounts, setPlayCounts] = useState(() => {
        const saved = localStorage.getItem("tv_play_counts");
        return saved ? JSON.parse(saved) : {};
    });

    const [epgChannels, setEpgChannels] = useState(new Map()); // Map tvgId -> channel info từ EPG API
    const [showEpg, setShowEpg] = useState(true);
    const [isPseudoPip, setIsPseudoPip] = useState(false); // PiP giả lập bằng CSS
    const [showScrollTopButton, setShowScrollTopButton] = useState(false);
    // Refs for video element và Shaka
    const videoRef = useRef(null);
    const playerFrameRef = useRef(null); // Frame gốc để detect scroll ra khỏi viewport
    const shakaPlayerRef = useRef(null); // Ref cho Shaka Player (DASH/MPD)
    const shakaUiOverlayRef = useRef(null); // Ref cho Shaka UI Overlay
    const scheduleContainerRef = useRef(null);
    const currentChannelRef = useRef(null); // Track channel đang phát để tránh duplicate init
    const hasLoadedChannelsRef = useRef(false); // Track đã load channels chưa để tránh duplicate fetch
    const hasLoadedEpgChannelsRef = useRef(false); // Track đã load EPG channels chưa
    const scrollPosRef = useRef(0);
    const isSyncingUrlRef = useRef(false);
    const lastSyncedIdRef = useRef(null); // Ghi nhớ ID cuối cùng đã đồng bộ thành công
    const tabsRef = useRef(null); // Ref cho thanh cuộn Tab Nhóm

    const scheduleCacheRef = useRef(new Map()); // Cache schedule theo channelId, tránh spam API
    const errorCountRef = useRef(0); // Track số lần lỗi liên tiếp
    const triedSourcesRef = useRef(new Set()); // Track các source đã thử
    const retryTimeoutsRef = useRef(new Set()); // Lưu timeout retry để clear khi đổi kênh
    const playSessionRef = useRef(0); // Phiên phát hiện tại để chặn retry cũ
    const sourceTimeoutRef = useRef(null); // Timeout watchdog cho source hiện tại
    const activeVideoElementRef = useRef(null); // Track video element đang phát để destroy triệt để

    // Cache source index hoạt động gần nhất theo channelId - persist vào localStorage
    const workingSourceCacheRef = useRef(null);
    if (workingSourceCacheRef.current === null) {
        try {
            const saved = localStorage.getItem("tv-source-cache");
            workingSourceCacheRef.current = saved
                ? new Map(JSON.parse(saved))
                : new Map();
        } catch (e) {
            workingSourceCacheRef.current = new Map();
        }
    }


    // getChannelParamId & findChannelByParamId đã được đưa ra ngoài component

    // --- LOAD EPG SUPPORTED CHANNELS ON MOUNT ---
    useEffect(() => {
        const loadEpgChannels = async () => {
            if (hasLoadedEpgChannelsRef.current) return;
            hasLoadedEpgChannelsRef.current = true;

            try {
                const epgBaseUrl =
                    import.meta.env.VITE_EPG_API_URL ||
                    "https://vnepg.site/api/schedule";
                // Lấy base URL từ schedule API (bỏ phần /schedule)
                const channelsUrl = epgBaseUrl.replace(
                    "/schedule",
                    "/channels",
                );

                const resp = await fetch(channelsUrl, {
                    signal: AbortSignal.timeout(10000),
                });
                if (!resp.ok) {
                    console.warn("Failed to fetch EPG channels list");
                    return;
                }
                const json = await resp.json();
                const channels = json.channels || [];

                // Tạo Map để lookup nhanh theo id
                const channelMap = new Map();
                channels.forEach((ch) => {
                    if (ch.id && ch.hasEpg) {
                        channelMap.set(ch.id.toLowerCase(), ch);
                    }
                });
                setEpgChannels(channelMap);
                console.log(`Loaded ${channelMap.size} EPG-supported channels`);
            } catch (e) {
                console.warn("Error loading EPG channels:", e.message);
            }
        };

        loadEpgChannels();
    }, []);

    // Cập nhật tiêu đề trang động theo kênh TV
    useEffect(() => {
        if (selectedChannel?.name) {
            document.title = `${selectedChannel.name} • Truyền Hình Trực Tuyến`;
        } else {
            document.title = "Truyền Hình Trực Tuyến • Live TV";
        }
    }, [selectedChannel]);

    // --- LOAD CHANNELS ON MOUNT ---
    useEffect(() => {
        const loadChannels = async () => {
            if (hasLoadedChannelsRef.current) return;
            hasLoadedChannelsRef.current = true;

            try {
                const response = await fetchChannels();
                const data = Array.isArray(response)
                    ? response
                    : Array.isArray(response?.groups)
                      ? response.groups
                      : [];

                setRawGroups(data);

                // Tự động chọn kênh từ URL param id trước, nếu không có thì chọn kênh đầu tiên
                if (data && data.length > 0) {
                    const allChannels = data.flatMap((group) =>
                        group && Array.isArray(group.channels)
                            ? group.channels
                            : [],
                    );
                    const channelFromParam = findChannelByParamId(
                        allChannels,
                        urlChannelId,
                    );

                    if (channelFromParam) {
                        setSelectedChannel(channelFromParam);
                    } else if (allChannels.length > 0) {
                        setSelectedChannel(allChannels[0]);
                    }
                }
            } catch (err) {
                console.error("Lỗi tải kênh:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        loadChannels();
    }, []);

    // Tính toán groups hiển thị (bao gồm nhóm ảo) - Reactive theo favorites/playCounts
    const groups = useMemo(() => {
        const allChannelsMap = new Map();
        (rawGroups || []).forEach((g) => {
            if (g && Array.isArray(g.channels)) {
                g.channels.forEach((c) => {
                    if (c && c.id) {
                        // Ưu tiên giữ lại bản ghi đầy đủ nhất nếu trùng ID
                        if (
                            !allChannelsMap.has(c.id) ||
                            (c.configSources &&
                                !allChannelsMap.get(c.id).configSources)
                        ) {
                            allChannelsMap.set(c.id, c);
                        }
                    }
                });
            }
        });

        const virtualGroups = [];

        // Nhóm Yêu thích
        if (Array.isArray(favorites) && favorites.length > 0) {
            const favoriteChannels = favorites
                .map((id) => allChannelsMap.get(id))
                .filter(Boolean);

            if (favoriteChannels.length > 0) {
                virtualGroups.push({
                    id: "favorites",
                    name: "Yêu thích",
                    channels: favoriteChannels,
                });
            }
        }

        // Nhóm Xem nhiều
        if (playCounts) {
            const mostWatchedIds = Object.keys(playCounts)
                .sort((a, b) => playCounts[b] - playCounts[a])
                .slice(0, 20);

            const mostWatchedChannels = mostWatchedIds
                .map((id) => allChannelsMap.get(id))
                .filter(Boolean);

            if (mostWatchedChannels.length > 0) {
                virtualGroups.push({
                    id: "most_watched",
                    name: "Xem nhiều",
                    channels: mostWatchedChannels,
                });
            }
        }

        return [...virtualGroups, ...(rawGroups || [])];
    }, [rawGroups, favorites, playCounts]);

    // Đồng bộ activeGroupId khi groups thay đổi hoặc khi chọn kênh mới
    useEffect(() => {
        if (!Array.isArray(groups) || groups.length === 0) return;

        // Nếu chưa có Tab nào được chọn, hoặc Tab hiện tại không còn tồn tại
        const currentGroupExists = groups.some(
            (g) => g && g.id === activeGroupId,
        );
        if (!activeGroupId || !currentGroupExists) {
            // Ưu tiên chọn Tab chứa kênh đang xem hiện tại
            if (selectedChannel) {
                const foundGroup = groups.find(
                    (g) =>
                        g &&
                        Array.isArray(g.channels) &&
                        g.channels.some(
                            (c) => c && c.id === selectedChannel.id,
                        ),
                );
                if (foundGroup) {
                    setActiveGroupId(foundGroup.id);
                    return;
                }
            }
            setActiveGroupId(groups[0]?.id);
        }
    }, [groups, activeGroupId, selectedChannel?.id]);

    // Đồng bộ từ URL param id -> selectedChannel (khi người dùng sửa URL thủ công hoặc back/forward)
    useEffect(() => {
        if (!Array.isArray(groups) || groups.length === 0) return;

        // Nếu là do state vừa update URL, ta bỏ qua
        if (isSyncingUrlRef.current) {
            isSyncingUrlRef.current = false;
            return;
        }

        const currentUrlId = String(urlChannelId || "")
            .trim()
            .toLowerCase();
        if (!currentUrlId) return;

        // Nếu ID trên URL trùng với ID ta vừa chủ động đẩy lên, không cần xử lý lại
        if (lastSyncedIdRef.current === currentUrlId) return;

        // Lấy danh sách kênh duy nhất
        const allChannelsMap = new Map();
        groups.forEach((g) => {
            if (g && Array.isArray(g.channels)) {
                g.channels.forEach((c) => {
                    if (c && c.id && !allChannelsMap.has(c.id)) {
                        allChannelsMap.set(c.id, c);
                    }
                });
            }
        });
        const allUniqueChannels = Array.from(allChannelsMap.values());

        const matchedChannel = findChannelByParamId(
            allUniqueChannels,
            currentUrlId,
        );

        if (matchedChannel && matchedChannel.id !== selectedChannel?.id) {
            lastSyncedIdRef.current = currentUrlId;
            setSelectedChannel(matchedChannel);
        }
    }, [groups, urlChannelId, selectedChannel?.id]);

    // Đồng bộ selectedChannel -> URL param id
    useEffect(() => {
        if (!selectedChannel) return;

        const nextId = getChannelParamId(selectedChannel);
        const nextIdNormalized = String(nextId || "")
            .trim()
            .toLowerCase();
        const currentUrlId = String(urlChannelId || "")
            .trim()
            .toLowerCase();

        if (!nextIdNormalized || currentUrlId === nextIdNormalized) {
            lastSyncedIdRef.current = nextIdNormalized;
            return;
        }

        scrollPosRef.current = window.scrollY;
        isSyncingUrlRef.current = true;
        lastSyncedIdRef.current = nextIdNormalized;

        const nextParams = new URLSearchParams(window.location.search);
        nextParams.set("id", nextId);
        setSearchParams(nextParams, { replace: true });

        requestAnimationFrame(() => {
            if (window.scrollY !== scrollPosRef.current) {
                window.scrollTo(0, scrollPosRef.current);
            }
        });
    }, [selectedChannel?.id, urlChannelId, setSearchParams]);

    // Ref để lưu danh sách sources đã filter cho channel hiện tại
    const currentSourcesRef = useRef([]);
    const currentSourceIndexRef = useRef(0);

    // Hàm destroy tất cả player instances của Shaka
    const destroyAllPlayers = async () => {
        // Dừng hẳn video cũ trước khi destroy player để tránh âm thanh/stream còn chạy nền
        const activeVideo = activeVideoElementRef.current;
        if (activeVideo) {
            try {
                activeVideo.pause();
                activeVideo.removeAttribute("src");
                activeVideo.load();
            } catch (e) {
                console.warn("Error hard-stopping active video:", e);
            } finally {
                activeVideoElementRef.current = null;
            }
        }

        // Destroy Shaka UI Overlay
        if (shakaUiOverlayRef.current) {
            try {
                shakaUiOverlayRef.current.destroy();
                shakaUiOverlayRef.current = null;
            } catch (e) {
                console.warn("Error destroying Shaka UI Overlay:", e);
            }
        }

        // Destroy Shaka Player
        if (shakaPlayerRef.current) {
            try {
                await shakaPlayerRef.current.destroy();
                shakaPlayerRef.current = null;
            } catch (e) {
                console.warn("Error destroying Shaka Player:", e);
            }
        }
    };

    const clearPendingRetries = useCallback(() => {
        retryTimeoutsRef.current.forEach((timeoutId) => {
            window.clearTimeout(timeoutId);
        });
        retryTimeoutsRef.current.clear();
    }, []);

    const clearSourceTimeout = useCallback(() => {
        if (sourceTimeoutRef.current) {
            window.clearTimeout(sourceTimeoutRef.current);
            sourceTimeoutRef.current = null;
        }
    }, []);

    const scheduleRetry = useCallback((callback, delayMs) => {
        const sessionAtSchedule = playSessionRef.current;
        const timeoutId = window.setTimeout(() => {
            retryTimeoutsRef.current.delete(timeoutId);
            // Chỉ thực thi nếu vẫn đang ở cùng phiên phát
            if (sessionAtSchedule !== playSessionRef.current) return;
            callback();
        }, delayMs);
        retryTimeoutsRef.current.add(timeoutId);
        return timeoutId;
    }, []);

    // Convert hex string -> base64url (không padding)
    const hexToBase64Url = (hexValue) => {
        try {
            const normalizedHex = String(hexValue || "")
                .replace(/[^a-fA-F0-9]/g, "")
                .toLowerCase();
            if (!normalizedHex || normalizedHex.length % 2 !== 0) return "";

            const bytes = normalizedHex
                .match(/.{1,2}/g)
                .map((part) => parseInt(part, 16));
            const binary = String.fromCharCode(...bytes);
            return btoa(binary)
                .replace(/\+/g, "-")
                .replace(/\//g, "_")
                .replace(/=+$/g, "");
        } catch (e) {
            return "";
        }
    };

    // Convert base64url string -> hex (cho drm.clearKeys cần hex)
    const base64UrlToHex = (b64url) => {
        try {
            let b64 = String(b64url || "")
                .replace(/-/g, "+")
                .replace(/_/g, "/");
            // Thêm padding nếu thiếu
            while (b64.length % 4) b64 += "=";
            const binary = atob(b64);
            return Array.from(binary, (c) =>
                c.charCodeAt(0).toString(16).padStart(2, "0"),
            ).join("");
        } catch (e) {
            return "";
        }
    };

    // Hàm setup Shaka Player cho DASH/MPD
    const setupShakaPlayer = async (
        source,
        sourceIndex,
        clearKeyMode = "hex",
        useProxy = false,
        sessionId = playSessionRef.current,
    ) => {
        if (sessionId !== playSessionRef.current) return;
        clearSourceTimeout();
        setCurrentSourceIdx(sourceIndex);

        console.log(`[Shaka Setup] Source ${sourceIndex}:`, {
            file: source.file,
            licenseType: source.licenseType,
            clearKeys: source.clearKeys,
            clearKeyMode,
            useProxy,
        });

        const sources = currentSourcesRef.current;
        const playerDiv = document.getElementById("tv-player");
        if (!playerDiv) return;

        // Clear container và tạo wrapper cho Shaka UI
        playerDiv.innerHTML = "";

        const themeWrapper = document.createElement("div");
        themeWrapper.className = "youtube-theme h-full w-full";

        const uiContainer = document.createElement("div");
        uiContainer.className = "shaka-video-container h-full w-full";

        const video = document.createElement("video");
        video.id = "shaka-video";
        video.className = "h-full w-full";
        video.autoplay = true;
        video.playsInline = true;
        activeVideoElementRef.current = video;

        // Khôi phục âm lượng đã cache
        const cachedVolume = localStorage.getItem("tv-volume");
        if (cachedVolume !== null) {
            video.volume = parseFloat(cachedVolume);
        }
        const cachedMuted = localStorage.getItem("tv-muted");
        if (cachedMuted !== null) {
            video.muted = cachedMuted === "true";
        }

        // Lưu âm lượng khi user thay đổi
        video.addEventListener("volumechange", () => {
            localStorage.setItem("tv-volume", String(video.volume));
            localStorage.setItem("tv-muted", String(video.muted));
        });

        uiContainer.appendChild(video);
        themeWrapper.appendChild(uiContainer);
        playerDiv.appendChild(themeWrapper);

        // Khởi tạo Shaka Player
        const player = new shaka.Player(video);
        shakaPlayerRef.current = player;

        // Khởi tạo Shaka UI Overlay để áp theme controls
        const uiOverlay = new shaka.ui.Overlay(player, uiContainer, video);
        shakaUiOverlayRef.current = uiOverlay;

        // Cấu hình ngôn ngữ Tiếng Việt cho Shaka Player UI
        // Tương thích nhiều phiên bản Shaka: ưu tiên lấy qua controls
        const controls =
            typeof uiOverlay.getControls === "function"
                ? uiOverlay.getControls()
                : null;
        const localization =
            (controls &&
                typeof controls.getLocalization === "function" &&
                controls.getLocalization()) ||
            (typeof uiOverlay.getLocalization === "function" &&
                uiOverlay.getLocalization()) ||
            null;
        const viTranslations = {
            AD_CHIP: "Qu\u1ea3ng c\u00e1o",
            AUDIO_TRACK: "\u00c2m thanh",
            AUTO: "T\u1ef1 \u0111\u1ed9ng",
            BACK: "Quay l\u1ea1i",
            CAPTIONS: "Ph\u1ee5 \u0111\u1ec1",
            CAST: "Truy\u1ec1n",
            CLOSE: "\u0110\u00f3ng",
            EXIT_FULL_SCREEN: "Tho\u00e1t to\u00e0n m\u00e0n h\u00ecnh",
            FULL_SCREEN: "To\u00e0n m\u00e0n h\u00ecnh",
            LANGUAGE: "Ng\u00f4n ng\u1eef",
            LIVE: "TR\u1ef0C TI\u1ebeP",
            MORE_SETTINGS: "C\u00e0i \u0111\u1eb7t",
            MUTE: "T\u1eaft ti\u1ebfng",
            OFF: "T\u1eaft",
            PAUSE: "T\u1ea1m d\u1eebng",
            PICTURE_IN_PICTURE: "Hình trong hình",
            PLAY: "Ph\u00e1t",
            PLAYBACK_RATE: "T\u1ed1c \u0111\u1ed9 ph\u00e1t",
            QUALITY: "Ch\u1ea5t l\u01b0\u1ee3ng",
            RESOLUTION: "\u0110\u1ed9 ph\u00e2n gi\u1ea3i",
            REWIND: "Tua l\u1ea1i",
            SKIP_AD: "B\u1ecf qua qu\u1ea3ng c\u00e1o",
            SUBTITLES_TRACK: "Ph\u1ee5 \u0111\u1ec1",
            UNMUTE: "B\u1eadt ti\u1ebfng",
            VOLUME: "\u00c2m l\u01b0\u1ee3ng",
        };
        if (
            localization &&
            typeof localization.insert === "function" &&
            typeof localization.changeLocale === "function"
        ) {
            // Một số phiên bản Shaka yêu cầu tham số thứ 2 là Map
            const viTranslationsMap = new Map(Object.entries(viTranslations));
            localization.insert("vi", viTranslationsMap);
            localization.changeLocale(["vi"]);
        } else {
            console.warn(
                "Shaka UI localization API không khả dụng ở phiên bản hiện tại.",
            );
        }

        uiOverlay.configure({
            controlPanelElements: [
                "play_pause",
                "mute",
                "volume",
                "time_and_duration",
                "spacer",
                "overflow_menu",
                "fullscreen",
            ],
            overflowMenuButtons: [
                "quality",
                "language",
                "captions",
                "playback_rate",
                "picture_in_picture",
            ],
            seekBarColors: {
                base: "rgba(255,255,255,.1)",
                buffered: "rgba(255,255,255,.2)",
                played: "#06b6d4",
            },
            addSeekBar: true,
            enableKeyboardPlaybackControls: true,
        });

        // Cấu hình DRM clearkey nếu có
        // Retry chain: hex -> server -> none -> next source
        // drm.clearKeys luôn cần hex string; server mode dùng base64url JSON
        if (source.licenseType === "clearkey") {
            if (source.clearKeys && source.clearKeys.length > 0) {
                try {
                    if (clearKeyMode === "none") {
                        // Mode 3: Bỏ DRM, phát trực tiếp (stream có thể không mã hóa thật)
                        console.log("[Shaka DRM] Bỏ qua DRM config (mode: none)");
                    } else if (clearKeyMode === "server") {
                        // Mode 2: Tạo ClearKey license server qua data URI
                        // Bypass vấn đề manifest khai báo Widevine nhưng thực tế dùng ClearKey
                        const base64Keys = source.clearKeys
                            .map((ck) => {
                                // Chuyển về base64url cho JSON format
                                let kidB64, keyB64;
                                if (ck.isBase64) {
                                    kidB64 = String(ck.kid || "");
                                    keyB64 = String(ck.key || "");
                                } else {
                                    const kidHex = String(ck.kid || "")
                                        .replace(/[^a-fA-F0-9]/g, "")
                                        .toLowerCase();
                                    const keyHex = String(ck.key || "")
                                        .replace(/[^a-fA-F0-9]/g, "")
                                        .toLowerCase();
                                    kidB64 = hexToBase64Url(kidHex);
                                    keyB64 = hexToBase64Url(keyHex);
                                }
                                return { kty: "oct", k: keyB64, kid: kidB64 };
                            })
                            .filter((k) => k.k && k.kid);

                        const licenseJson = JSON.stringify({
                            keys: base64Keys,
                            type: "temporary",
                        });
                        const licenseDataUri = `data:application/json;base64,${btoa(licenseJson)}`;

                        player.configure({
                            drm: {
                                servers: {
                                    "org.w3c.clearkey": licenseDataUri,
                                },
                            },
                        });
                        console.log(
                            "[Shaka DRM] Configured ClearKey license server (data URI):",
                            base64Keys,
                        );
                    } else {
                        // Mode 1 (hex): drm.clearKeys - Shaka luôn yêu cầu hex string
                        const clearKeyConfig = {};

                        source.clearKeys.forEach((ck) => {
                            let kidHex, keyHex;
                            if (ck.isBase64) {
                                // Base64url -> hex (ví dụ: Dreamworks JSON format)
                                kidHex = base64UrlToHex(ck.kid);
                                keyHex = base64UrlToHex(ck.key);
                            } else {
                                // Hex trực tiếp, loại bỏ ký tự không hợp lệ và đảm bảo chiều dài chẵn
                                kidHex = String(ck.kid || "")
                                    .replace(/[^a-fA-F0-9]/g, "")
                                    .toLowerCase();
                                keyHex = String(ck.key || "")
                                    .replace(/[^a-fA-F0-9]/g, "")
                                    .toLowerCase();
                            }
                            // Đảm bảo chiều dài chẵn (Shaka yêu cầu string hex even-length)
                            if (kidHex.length % 2 !== 0) kidHex = "0" + kidHex;
                            if (keyHex.length % 2 !== 0) keyHex = "0" + keyHex;

                            if (kidHex && keyHex) {
                                clearKeyConfig[kidHex] = keyHex;
                            }
                        });

                        player.configure({
                            drm: {
                                clearKeys: clearKeyConfig,
                            },
                        });
                        console.log(
                            "[Shaka DRM] Configured clearKeys (hex):",
                            clearKeyConfig,
                        );
                    }
                } catch (e) {
                    console.warn("Error configuring clearKeys:", e);
                }
            } else if (source.licenseKey && source.licenseKey.startsWith("http")) {
                // Cấu hình ClearKey License Server URL thực tế
                try {
                    player.configure({
                        drm: {
                            servers: {
                                "org.w3c.clearkey": source.licenseKey,
                            },
                        },
                    });
                    console.log(
                        "[Shaka DRM] Configured ClearKey license server URL:",
                        source.licenseKey,
                    );
                } catch (e) {
                    console.warn("Error configuring ClearKey license server URL:", e);
                }
            }
        }

        // Cấu hình network request filters để gán các headers tùy chỉnh (User-Agent, Referer) và CORS Proxy
        {
            const networkingEngine = player.getNetworkingEngine();
            if (networkingEngine) {
                // Map để lưu trữ tạm thời original URLs cho việc khôi phục Base URI
                const originalUriMap = new Map();

                networkingEngine.registerRequestFilter((type, request) => {
                    const originalUri = request.uris[0] || "";
                    
                    // Ngăn chặn vòng lặp lồng nhau vô tận nếu URL đã bị proxy
                    if (PROXY_WORKER_URL && originalUri.startsWith(PROXY_WORKER_URL)) {
                        return;
                    }

                    const shouldProxy =
                        useProxy &&
                        originalUri &&
                        !originalUri.startsWith("data:");

                    if (shouldProxy) {
                        // Sao chép các headers gốc để gửi qua proxy
                        const headersToSend = {};
                        for (const key in request.headers) {
                            if (key.toLowerCase() !== "content-type") {
                                headersToSend[key] = request.headers[key];
                            }
                        }

                        // Xử lý request body (nếu có, ví dụ như LICENSE request challenge)
                        let bodyPayload = undefined;
                        if (request.body) {
                            try {
                                // Giải mã ArrayBuffer/Uint8Array thành string UTF-8
                                bodyPayload = new TextDecoder("utf-8").decode(request.body);
                            } catch (e) {
                                // Fallback sang Latin-1 để giữ nguyên byte mapping
                                bodyPayload = Array.from(
                                    new Uint8Array(request.body),
                                    (byte) => String.fromCharCode(byte),
                                ).join("");
                            }
                        }

                        let fallbackOrigin = null;
                        let fallbackReferer = null;
                        try {
                            const urlObj = new URL(originalUri);
                            fallbackOrigin = urlObj.origin;
                            fallbackReferer = urlObj.origin + "/";
                        } catch(e) {}

                        const payload = {
                            url: originalUri,
                            method: request.method || "GET",
                            headers: headersToSend,
                            body: bodyPayload,
                            referer: source.referrer || fallbackReferer,
                            origin: source.origin || fallbackOrigin,
                        };

                        // Tạo một request ID ngẫu nhiên để track URL gốc
                        const reqId = Math.random().toString(36).substring(2, 10);
                        originalUriMap.set(reqId, originalUri);

                        // Đính kèm reqId vào Proxy URL để responseFilter nhận diện
                        const proxyUrlWithId = PROXY_WORKER_URL + (PROXY_WORKER_URL.includes("?") ? "&" : "?") + "proxyReqId=" + reqId;

                        request.uris = [proxyUrlWithId];
                        request.method = "POST";
                        request.headers["Content-Type"] = "application/json";

                        const encoder = new TextEncoder();
                        request.body = encoder.encode(JSON.stringify(payload));
                    } else {
                        // Phát trực tiếp không qua proxy
                        if (source.userAgent)
                            request.headers["User-Agent"] = source.userAgent;
                        if (source.referrer)
                            request.headers["Referer"] = source.referrer;
                    }
                });

                // Khôi phục URL thực tế từ response để Shaka Player dùng làm Base URL
                networkingEngine.registerResponseFilter((type, response) => {
                    if (response.uri && response.uri.includes("proxyReqId=")) {
                        try {
                            const urlObj = new URL(response.uri);
                            const reqId = urlObj.searchParams.get("proxyReqId");
                            if (reqId && originalUriMap.has(reqId)) {
                                response.uri = originalUriMap.get(reqId);
                                originalUriMap.delete(reqId);
                            }
                        } catch (e) {
                            // Bỏ qua lỗi URL parse
                        }
                    }
                });
            }
        }

        // Error handler cho Shaka
        player.addEventListener("error", (event) => {
            if (sessionId !== playSessionRef.current) return;
            clearSourceTimeout();

            const error = event.detail;
            console.error(
                `Shaka Player error (source ${sourceIndex + 1}):`,
                error,
            );
            console.error("Shaka error detail:", {
                code: error?.code,
                category: error?.category,
                severity: error?.severity,
                data: error?.data,
                message: error?.message,
            });

            // Retry cùng source với clear key mode khác khi dính lỗi DRM 6008
            // Chain: hex -> server -> none -> next source
            if (
                error?.code === 6008 &&
                source.licenseType === "clearkey" &&
                Array.isArray(source.clearKeys) &&
                source.clearKeys.length > 0
            ) {
                const nextMode = {
                    hex: "server",
                    server: "none",
                };
                const retry = nextMode[clearKeyMode];
                if (retry) {
                    showToast(`DRM 6008: thử lại mode "${retry}"...`, {
                        type: "warn",
                        duration: 2500,
                    });
                    scheduleRetry(
                        () =>
                            setupShakaPlayer(
                                source,
                                sourceIndex,
                                retry,
                                useProxy,
                                sessionId,
                            ),
                        300,
                    );
                    return;
                }
                // Đã thử hết 3 modes, chuyển sang source tiếp theo
            }

            // Thử lại bằng CORS Proxy nếu gặp lỗi mạng/CORS và chưa từng dùng proxy
            const isCorsError =
                error?.code === 1001 ||
                error?.code === 1002 ||
                error?.category === 1;

            if (isCorsError && !useProxy) {
                console.log(
                    "[CORS Retry] Shaka error event detected CORS/Network error. Retrying with proxy...",
                );
                showToast("Lỗi CORS/mạng, đang thử lại qua proxy...", {
                    type: "warn",
                    duration: 2500,
                });
                scheduleRetry(
                    () =>
                        setupShakaPlayer(
                            source,
                            sourceIndex,
                            clearKeyMode,
                            true, // kích hoạt useProxy
                            sessionId,
                        ),
                    300,
                );
                return;
            }

            // Thử source tiếp theo
            const nextIndex = sourceIndex + 1;
            if (nextIndex < sources.length) {
                showToast(
                    `Nguồn ${sourceIndex + 1} lỗi, đang thử nguồn ${nextIndex + 1}...`,
                    { type: "warn", duration: 2000 },
                );
                scheduleRetry(
                    () => setupPlayerWithSource(nextIndex, sessionId),
                    500,
                );
            } else {
                showToast(
                    `Không thể phát kênh ${selectedChannel.name}. Mã lỗi Shaka: ${error?.code || "unknown"}.`,
                    { type: "error", duration: 8000 },
                );
            }
        });

        try {
            // Load manifest
            await player.load(source.file);
            if (sessionId !== playSessionRef.current) return;
            clearSourceTimeout();
            console.log(`Shaka Player loaded: ${source.file}`);

            if (sourceIndex > 0) {
                showToast(
                    `Đang phát từ nguồn ${sourceIndex + 1}/${sources.length}: ${source.label}`,
                    { type: "info", duration: 3000 },
                );
            }

            // Cache source index hoạt động cho channel hiện tại
            // Lưu vào cả ref và localStorage để persist qua reload
            if (selectedChannel) {
                const chCacheKey =
                    getChannelParamId(selectedChannel) || selectedChannel.id;
                const cacheEntry = {
                    sourceIndex,
                    clearKeyMode: clearKeyMode,
                    useProxy: useProxy,
                };
                workingSourceCacheRef.current.set(chCacheKey, cacheEntry);
                try {
                    // Giới hạn cache 50 kênh gần nhất để không phình localStorage
                    const map = workingSourceCacheRef.current;
                    if (map.size > 50) {
                        const firstKey = map.keys().next().value;
                        map.delete(firstKey);
                    }
                    localStorage.setItem(
                        "tv-source-cache",
                        JSON.stringify([...map]),
                    );
                } catch (e) {
                    /* ignore storage errors */
                }
            }
        } catch (error) {
            clearSourceTimeout();
            console.error(
                `Shaka Player load error (source ${sourceIndex + 1}):`,
                error,
            );
            console.error("Shaka load error detail:", {
                code: error?.code,
                category: error?.category,
                severity: error?.severity,
                data: error?.data,
                message: error?.message,
            });

            // Retry cùng source với clear key mode khác khi dính lỗi DRM (6008 hoặc SyntaxError hex)
            // Chain: hex -> server -> none -> next source
            const isDrmError =
                error?.code === 6008 ||
                (error instanceof SyntaxError &&
                    String(error.message || "").includes("hex"));
            if (
                isDrmError &&
                source.licenseType === "clearkey" &&
                Array.isArray(source.clearKeys) &&
                source.clearKeys.length > 0
            ) {
                const nextMode = {
                    hex: "server",
                    server: "none",
                };
                const retry = nextMode[clearKeyMode];
                if (retry) {
                    showToast(`DRM lỗi: thử lại mode "${retry}"...`, {
                        type: "warn",
                        duration: 2500,
                    });
                    scheduleRetry(
                        () =>
                            setupShakaPlayer(
                                source,
                                sourceIndex,
                                retry,
                                useProxy,
                                sessionId,
                            ),
                        300,
                    );
                    return;
                }
                // Đã thử hết 3 modes, chuyển sang source tiếp theo
            }

            // Thử lại bằng CORS Proxy nếu gặp lỗi mạng/CORS và chưa từng dùng proxy
            const isCorsError =
                error?.code === 1001 ||
                error?.code === 1002 ||
                error?.category === 1 ||
                error instanceof TypeError;

            if (isCorsError && !useProxy) {
                console.log(
                    "[CORS Retry] Shaka load failed with CORS/Network error. Retrying with proxy...",
                );
                showToast("Lỗi tải nguồn, đang thử lại qua proxy...", {
                    type: "warn",
                    duration: 2500,
                });
                scheduleRetry(
                    () =>
                        setupShakaPlayer(
                            source,
                            sourceIndex,
                            clearKeyMode,
                            true, // kích hoạt useProxy
                            sessionId,
                        ),
                    300,
                );
                return;
            }

            // Thử source tiếp theo
            const nextIndex = sourceIndex + 1;
            if (nextIndex < sources.length) {
                showToast(
                    `Nguồn ${sourceIndex + 1} lỗi, đang thử nguồn ${nextIndex + 1}...`,
                    { type: "warn", duration: 2000 },
                );
                scheduleRetry(
                    () => setupPlayerWithSource(nextIndex, sessionId),
                    500,
                );
            } else {
                showToast(
                    `Không thể phát kênh ${selectedChannel.name}. Mã lỗi Shaka: ${error?.code || "unknown"}.`,
                    { type: "error", duration: 8000 },
                );
            }
        }
    };

    // Hàm helper để setup player với source cụ thể (Shaka-only)
    const setupPlayerWithSource = async (
        sourceIndex,
        sessionId = playSessionRef.current,
    ) => {
        if (sessionId !== playSessionRef.current) return;
        clearSourceTimeout();

        const sources = currentSourcesRef.current;
        if (sourceIndex >= sources.length) {
            // Đã thử hết tất cả sources
            showToast(
                `Không thể phát kênh ${selectedChannel.name}. Đã thử ${sources.length} nguồn nhưng tất cả đều lỗi.`,
                { type: "error", duration: 8000 },
            );
            return;
        }

        const rawSource = sources[sourceIndex] || {};
        const source = {
            ...rawSource,
            file: rawSource.file || "",
            label: rawSource.label || "Default",
            referrer: rawSource.referrer ?? null,
            userAgent: rawSource.userAgent ?? null,
            licenseType: rawSource.licenseType ?? null,
            licenseKey: rawSource.licenseKey ?? null,
            clearKeys: Array.isArray(rawSource.clearKeys)
                ? rawSource.clearKeys
                : null,
        };

        if (!source.file) {
            showToast("Source không hợp lệ: thiếu URL phát", {
                type: "error",
                duration: 5000,
            });
            return;
        }

        currentSourceIndexRef.current = sourceIndex;
        triedSourcesRef.current.add(sourceIndex);

        // Destroy old players
        await destroyAllPlayers();
        if (sessionId !== playSessionRef.current) return;

        const playerDiv = document.getElementById("tv-player");
        if (!playerDiv) return;

        // Dùng Shaka cho tất cả nguồn (HLS + DASH)
        if (!shaka.Player.isBrowserSupported()) {
            const nextIndex = sourceIndex + 1;
            if (nextIndex < sources.length) {
                showToast(
                    `Nguồn ${sourceIndex + 1} không hỗ trợ, đang thử nguồn ${nextIndex + 1}...`,
                    { type: "warn", duration: 2000 },
                );
                scheduleRetry(
                    () => setupPlayerWithSource(nextIndex, sessionId),
                    500,
                );
            } else {
                showToast(
                    "Trình duyệt không hỗ trợ Shaka Player. Vui lòng dùng Chrome, Firefox hoặc Edge.",
                    { type: "error", duration: 8000 },
                );
            }
            return;
        }

        const chCacheKey =
            getChannelParamId(selectedChannel) || selectedChannel.id;
        const cachedSource = workingSourceCacheRef.current.get(chCacheKey);
        let startMode = "hex";
        let startUseProxy = false;
        if (cachedSource && cachedSource.sourceIndex === sourceIndex) {
            startMode = cachedSource.clearKeyMode || "hex";
            startUseProxy = cachedSource.useProxy || false;
        }

        shaka.polyfill.installAll();
        await setupShakaPlayer(
            source,
            sourceIndex,
            startMode,
            startUseProxy,
            sessionId,
        );
    };

    // --- LOAD CHANNEL KHI selectedChannel THAY ĐỔI ---
    useEffect(() => {
        const loadChannel = async () => {
            if (!selectedChannel) return;

            // Tạo phiên phát mới để vô hiệu toàn bộ retry từ kênh trước
            playSessionRef.current += 1;
            const sessionId = playSessionRef.current;
            clearPendingRetries();
            clearSourceTimeout();

            // Track current channel
            currentChannelRef.current = selectedChannel;

            // Reset error tracking khi chuyển kênh mới
            errorCountRef.current = 0;
            triedSourcesRef.current = new Set();
            currentSourceIndexRef.current = 0;

            try {
                // Wait for container to be ready
                const playerDiv = document.getElementById("tv-player");
                if (!playerDiv) {
                    throw new Error("Player container not found");
                }

                // Clear container
                playerDiv.innerHTML = "";

                // Destroy existing players trước khi setup mới
                await destroyAllPlayers();
                // Clear lần 2: bắt bất kỳ retry nào được schedule bởi error handler trong quá trình destroy
                clearPendingRetries();

                // Nếu có configSources, build sources array và dùng logic retry
                if (
                    selectedChannel.configSources &&
                    selectedChannel.configSources.length > 0
                ) {
                    // Filter FLV
                    const filteredSources =
                        selectedChannel.configSources.filter((sourceConfig) => {
                            const isFLV = sourceConfig.file
                                .toLowerCase()
                                .includes(".flv");
                            if (isFLV) {
                                console.warn(
                                    `Skipping FLV source: ${sourceConfig.label || sourceConfig.file}`,
                                );
                                return false;
                            }
                            return true;
                        });

                    // Sort by quality
                    const qualityOrder = {
                        "4K": 5,
                        UHD: 5,
                        FullHD: 4,
                        "Full HD": 4,
                        FHD: 4,
                        HD: 3,
                        "HD Nhanh": 3,
                        HD1: 3,
                        HD2: 3,
                        SD: 2,
                        Default: 1,
                    };

                    const getQuality = (label) => {
                        const normalized = label.trim();
                        return qualityOrder[normalized] || 0;
                    };

                    filteredSources.sort((a, b) => {
                        const aIsDash = a.file.toLowerCase().includes(".mpd");
                        const bIsDash = b.file.toLowerCase().includes(".mpd");
                        const aHasKeys =
                            a.licenseType === "clearkey" &&
                            Array.isArray(a.clearKeys) &&
                            a.clearKeys.length > 0;
                        const bHasKeys =
                            b.licenseType === "clearkey" &&
                            Array.isArray(b.clearKeys) &&
                            b.clearKeys.length > 0;

                        // Ưu tiên DASH có clear keys để tránh chọn nhầm source không đủ metadata DRM
                        if (aIsDash && bIsDash && aHasKeys !== bHasKeys) {
                            return bHasKeys ? 1 : -1;
                        }

                        return getQuality(b.label) - getQuality(a.label);
                    });

                    if (filteredSources.length === 0) {
                        throw new Error(
                            "Tất cả nguồn đều là FLV (Flash Video) - không được hỗ trợ",
                        );
                    }

                    // Lưu danh sách sources
                    currentSourcesRef.current = filteredSources;

                    // Kiểm tra cache source đã hoạt động trước đó cho kênh này
                    const chCacheKey =
                        getChannelParamId(selectedChannel) ||
                        selectedChannel.id;
                    const cachedSource =
                        workingSourceCacheRef.current.get(chCacheKey);
                    const startIndex =
                        cachedSource &&
                        cachedSource.sourceIndex < filteredSources.length
                            ? cachedSource.sourceIndex
                            : 0;

                    if (startIndex > 0) {
                        console.log(
                            `[Cache] Bắt đầu từ source ${startIndex + 1} (đã cache từ lần phát trước)`,
                        );
                    }

                    await setupPlayerWithSource(startIndex, sessionId);
                } else {
                    // Fallback: single source - setup trực tiếp
                    currentSourcesRef.current = [
                        {
                            file: selectedChannel.url,
                            label: "Default",
                            referrer: null,
                            userAgent: null,
                            licenseType: null,
                            licenseKey: null,
                            clearKeys: null,
                        },
                    ];
                    await setupPlayerWithSource(0, sessionId);
                }
            } catch (error) {
                console.error("Failed to setup Shaka Player:", error);
                showToast(
                    `Lỗi tải kênh: ${error.message || "Không rõ nguyên nhân"}`,
                    { type: "error", duration: 6000 },
                );
            }
        };

        loadChannel();

        // Cleanup khi unmount
        return () => {
            clearPendingRetries();
            clearSourceTimeout();
            destroyAllPlayers().catch((e) => {
                console.error("Cleanup error:", e);
            });
        };
    }, [selectedChannel, clearPendingRetries, clearSourceTimeout]);

    // Khi lịch phát (schedule) thay đổi, cuộn tới chương trình đang phát
    useEffect(() => {
        try {
            if (!schedule || schedule.length === 0) return;
            const container = scheduleContainerRef.current;
            if (!container) return;
            const currentEl = container.querySelector('[data-current="1"]');
            if (currentEl) {
                // delay nhỏ để đảm bảo DOM đã render xong
                setTimeout(() => {
                    try {
                        currentEl.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                        });
                    } catch (e) {}
                }, 50);
            }
        } catch (e) {}
    }, [schedule, selectedChannel]);

    // Kiểm tra theo thời gian thực: nếu giờ:phút trùng với start của 1 chương trình, focus vào chương trình đó
    useEffect(() => {
        if (!schedule || schedule.length === 0) return;

        const checkAndFocus = () => {
            try {
                const now = new Date();
                const h = now.getHours();
                const m = now.getMinutes();
                for (let i = 0; i < schedule.length; i++) {
                    const item = schedule[i];
                    const s = toMs(
                        item.startMs ?? item.start ?? item.s ?? null,
                    );
                    if (!s) continue;
                    const d = new Date(s);
                    if (d.getHours() === h && d.getMinutes() === m) {
                        const container = scheduleContainerRef.current;
                        if (!container) return;
                        const el = container.querySelector(
                            `[data-start-ms="${s}"]`,
                        );
                        if (el) {
                            el.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                            });
                        }
                        break;
                    }
                }
            } catch (e) {
                // ignore
            }
        };

        // chạy ngay và sau đó poll mỗi 5s
        checkAndFocus();
        const id = setInterval(checkAndFocus, 60000);
        return () => clearInterval(id);
    }, [schedule]);

    // Fetch EPG schedule for selected channel via API (có cache 5 phút)
    useEffect(() => {
        const CACHE_TTL = 5 * 60 * 1000; // 5 phút

        const fetchSchedule = async (channel) => {
            setSchedule([]);
            setScheduleError(null);
            setLastUpdated(null); // Reset thời gian cập nhật của kênh cũ
            if (!channel) return;

            const channelId = channel.tvgId || channel.tvg_id || channel.id;
            if (!channelId) {
                setScheduleError("Kênh không có ID lịch (tvg-id)");
                return;
            }

            // Kiểm tra xem channel có được hỗ trợ EPG không
            const normalizedId = String(channelId).toLowerCase();
            let epgInfo = epgChannels.get(normalizedId);

            // FALLBACK MATCHING: Thử thêm/bớt hậu tố 'hd' nếu không tìm thấy chính xác
            if (!epgInfo) {
                if (normalizedId.endsWith("hd")) {
                    epgInfo = epgChannels.get(normalizedId.replace(/hd$/, ""));
                } else {
                    epgInfo = epgChannels.get(normalizedId + "hd");
                }
            }

            if (!epgInfo) {
                // Không có trong danh sách EPG - không gọi API
                setScheduleError("Kênh hiện chưa hỗ trợ lịch phát sóng");
                return;
            }

            // Kiểm tra cache trước khi fetch
            const cached = scheduleCacheRef.current.get(normalizedId);
            if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
                // Dùng cache nếu còn hạn
                setSchedule(cached.data);
                if (cached.updatedAt) setLastUpdated(cached.updatedAt);
                return;
            }

            setScheduleLoading(true);
            try {
                // Fetch schedule từ EPG API (lấy từ env)
                const epgBaseUrl =
                    import.meta.env.VITE_EPG_API_URL ||
                    "https://vnepg.site/api/schedule";
                const endpoint = `${epgBaseUrl}/${encodeURIComponent(channelId)}`;

                const resp = await fetch(endpoint, {
                    signal: AbortSignal.timeout(7000),
                });

                if (!resp.ok) {
                    throw new Error(`HTTP ${resp.status}`);
                }

                const json = await resp.json();

                // Capture updatedAt nếu có
                const updatedAt =
                    json.updatedAt ||
                    json.updated_at ||
                    json.updated ||
                    (epgInfo ? epgInfo.updatedAt : null);
                if (updatedAt) setLastUpdated(updatedAt);

                const list = Array.isArray(json)
                    ? json
                    : json.schedule || json.items || [];

                // Lưu vào cache
                scheduleCacheRef.current.set(normalizedId, {
                    data: list,
                    updatedAt: updatedAt,
                    timestamp: Date.now(),
                });

                setSchedule(list);
            } catch (e) {
                console.warn("Failed to fetch schedule:", e.message);
                setScheduleError("Không thể tải lịch phát sóng");
            } finally {
                setScheduleLoading(false);
            }
        };

        if (selectedChannel) {
            fetchSchedule(selectedChannel);
        } else {
            setSchedule([]);
            setLastUpdated(null);
        }
    }, [selectedChannel, epgChannels]);

    // Inject custom modern scrollbar styles and ensure player controls receive pointer events
    useEffect(() => {
        const styleId = "custom-scrollbar-style";
        if (!document.getElementById(styleId)) {
            const s = document.createElement("style");
            s.id = styleId;
            document.head.appendChild(s);
        }
        return () => {};
    }, []);

    // toMs & getStartEndMs đã được đưa ra ngoài component

    // PiP giả lập: khi frame player gốc ra khỏi viewport thì nổi ở góc phải dưới
    // Gộp logic + throttle scroll handler để giảm lag
    useEffect(() => {
        // Reset PiP khi đổi kênh
        setIsPseudoPip(false);

        let rafId = null;
        const evaluatePseudoPip = () => {
            // Bỏ PiP trên Web (Desktop - màn hình >= 1024px)
            if (window.innerWidth >= 1024) {
                setIsPseudoPip(false);
                return;
            }

            const frame = playerFrameRef.current;
            if (!frame) {
                setIsPseudoPip(false);
                return;
            }

            const rect = frame.getBoundingClientRect();
            // Kích hoạt khi video gốc biến mất khỏi màn hình
            const isOutOfViewport = rect.bottom <= 0;
            setIsPseudoPip(isOutOfViewport);
        };

        // Dùng requestAnimationFrame để throttle, tránh gọi setState quá nhiều lần
        const handleScrollThrottled = () => {
            if (rafId) return;
            rafId = requestAnimationFrame(() => {
                evaluatePseudoPip();
                rafId = null;
            });
        };

        window.addEventListener("scroll", handleScrollThrottled, {
            passive: true,
        });
        window.addEventListener("resize", handleScrollThrottled);

        evaluatePseudoPip();

        return () => {
            window.removeEventListener("scroll", handleScrollThrottled);
            window.removeEventListener("resize", handleScrollThrottled);
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, [selectedChannel?.id]);

    useEffect(() => {
        const handleScroll = () => {
            setShowScrollTopButton(window.scrollY > 320);
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        handleScroll();

        return () => {
            window.removeEventListener("scroll", handleScroll);
        };
    }, []);

    const formatTime = useCallback((v) => {
        const ms = toMs(v);
        if (!ms) return "--:--";
        const d = new Date(ms);
        return d.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        });
    }, []);

    const formatDateTime = useCallback((v) => {
        const ms = toMs(v);
        if (!ms) return "--";
        const d = new Date(ms);
        return d.toLocaleString([], {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        });
    }, []);

    const isCurrentProgram = useCallback((item) => {
        const { s, e } = getStartEndMs(item);
        if (!s || !e) return false;
        const now = Date.now();
        return now >= s && now <= e;
    }, []);

    const programProgress = useCallback((item) => {
        const { s, e } = getStartEndMs(item);
        if (!s || !e) return 0;
        const now = Date.now();
        if (now <= s) return 0;
        if (now >= e) return 100;
        return Math.round(((now - s) / (e - s)) * 100);
    }, []);

    // Helper: lấy danh sách tất cả channels (flatten từ groups)
    // Memoize the flattened list of channels to avoid flatMap on every render
    const allChannels = useMemo(() => {
        return groups.flatMap((g) => g.channels);
    }, [groups]);

    // Scroll thanh tab nhóm kênh trái/phải
    const scrollTabs = useCallback((direction) => {
        const el = tabsRef.current;
        if (!el) return;
        const scrollAmount = direction === "left" ? -300 : 300;
        el.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }, []);

    // Lấy danh sách kênh trong group hiện tại để điều hướng prev/next
    const activeGroupChannels = useMemo(() => {
        if (!activeGroupId || !groups.length) return allChannels;
        const group = groups.find((g) => g && g.id === activeGroupId);
        return group?.channels || allChannels;
    }, [activeGroupId, groups, allChannels]);

    // Chuyển kênh trước/sau (hỗ trợ chuyển group nếu ở đầu/cuối danh sách)
    const handlePrevChannel = useCallback(() => {
        if (
            !selectedChannel ||
            activeGroupChannels.length === 0 ||
            groups.length === 0
        )
            return;
        const currentIndex = activeGroupChannels.findIndex(
            (c) => c.id === selectedChannel.id,
        );

        if (currentIndex <= 0) {
            // Đã ở kênh đầu tiên -> lùi về group trước đó
            let currentGroupIndex = groups.findIndex(
                (g) => g.id === activeGroupId,
            );
            if (currentGroupIndex === -1) currentGroupIndex = 0;

            let prevGroupIndex =
                (currentGroupIndex - 1 + groups.length) % groups.length;
            // Bỏ qua các group không có kênh
            while (
                groups[prevGroupIndex].channels.length === 0 &&
                prevGroupIndex !== currentGroupIndex
            ) {
                prevGroupIndex =
                    (prevGroupIndex - 1 + groups.length) % groups.length;
            }

            const prevGroup = groups[prevGroupIndex];
            setActiveGroupId(prevGroup.id);
            setSelectedChannel(
                prevGroup.channels[prevGroup.channels.length - 1],
            );

            // Tự động cuộn tab đến group mới
            requestAnimationFrame(() => {
                if (tabsRef.current) {
                    const activeTab = tabsRef.current.querySelector(
                        `button:nth-child(${prevGroupIndex + 1})`,
                    );
                    if (activeTab) {
                        activeTab.scrollIntoView({
                            behavior: "smooth",
                            block: "nearest",
                            inline: "center",
                        });
                    }
                }
            });
        } else {
            // Lùi về kênh trước trong cùng group
            setSelectedChannel(activeGroupChannels[currentIndex - 1]);
        }
    }, [selectedChannel, activeGroupChannels, groups, activeGroupId]);

    const handleNextChannel = useCallback(() => {
        if (
            !selectedChannel ||
            activeGroupChannels.length === 0 ||
            groups.length === 0
        )
            return;
        const currentIndex = activeGroupChannels.findIndex(
            (c) => c.id === selectedChannel.id,
        );

        if (currentIndex >= activeGroupChannels.length - 1) {
            // Đã ở kênh cuối cùng -> tiến sang group tiếp theo
            let currentGroupIndex = groups.findIndex(
                (g) => g.id === activeGroupId,
            );
            if (currentGroupIndex === -1) currentGroupIndex = 0;

            let nextGroupIndex = (currentGroupIndex + 1) % groups.length;
            // Bỏ qua các group không có kênh
            while (
                groups[nextGroupIndex].channels.length === 0 &&
                nextGroupIndex !== currentGroupIndex
            ) {
                nextGroupIndex = (nextGroupIndex + 1) % groups.length;
            }

            const nextGroup = groups[nextGroupIndex];
            setActiveGroupId(nextGroup.id);
            setSelectedChannel(nextGroup.channels[0]);

            // Tự động cuộn tab đến group mới
            requestAnimationFrame(() => {
                if (tabsRef.current) {
                    const activeTab = tabsRef.current.querySelector(
                        `button:nth-child(${nextGroupIndex + 1})`,
                    );
                    if (activeTab) {
                        activeTab.scrollIntoView({
                            behavior: "smooth",
                            block: "nearest",
                            inline: "center",
                        });
                    }
                }
            });
        } else {
            // Tiến tới kênh tiếp theo trong cùng group
            setSelectedChannel(activeGroupChannels[currentIndex + 1]);
        }
    }, [selectedChannel, activeGroupChannels, groups, activeGroupId]);

    const handleManualSelectSource = useCallback(
        (idx) => {
            if (!selectedChannel || !selectedChannel.configSources[idx]) return;

            // Reset trackings để bắt đầu lại từ nguồn này
            errorCountRef.current = 0;
            triedSourcesRef.current.clear();

            const playerDiv = document.getElementById("tv-player");
            if (playerDiv) playerDiv.innerHTML = "";

            setCurrentSourceIdx(idx);
            setupShakaPlayer(selectedChannel.configSources[idx], idx);
        },
        [selectedChannel, setupShakaPlayer],
    );

    const toggleFavorite = useCallback((channelId) => {
        setFavorites((prev) => {
            const newFavs = prev.includes(channelId)
                ? prev.filter((id) => id !== channelId)
                : [...prev, channelId];
            localStorage.setItem("tv_favorites", JSON.stringify(newFavs));
            return newFavs;
        });
    }, []);

    const recordPlay = useCallback((channelId) => {
        setPlayCounts((prev) => {
            const newCounts = {
                ...prev,
                [channelId]: (prev[channelId] || 0) + 1,
            };
            localStorage.setItem("tv_play_counts", JSON.stringify(newCounts));
            return newCounts;
        });
    }, []);

    const handleSelectChannel = useCallback((channel) => {
        // Lưu vị trí cuộn hiện tại
        scrollPosRef.current = window.scrollY;

        // Tăng lượt xem
        recordPlay(channel.id);

        // Clear immediately to avoid seeing old video frame
        const playerDiv = document.getElementById("tv-player");
        if (playerDiv) playerDiv.innerHTML = "";

        setSelectedChannel(channel);

        // Đảm bảo không nhảy lên đầu sau khi state update
        requestAnimationFrame(() => {
            if (window.scrollY !== scrollPosRef.current) {
                window.scrollTo(0, scrollPosRef.current);
            }
        });
    }, []);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-zinc-950 font-sans text-white">
                <div className="text-balance text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-zinc-800 border-t-red-600"></div>
                    <p className="text-sm font-bold text-zinc-400">Đang tải danh sách kênh...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-zinc-900 text-white">
                <div className="text-balance text-center">
                    <p className="mb-4 text-red-500">404 - Page Not Found</p>
                </div>
            </div>
        );
    }

    // Flatten all channels for the horizontal scroller
    // Channels will be shown grouped below; no flattening needed

    return (
        <div className="relative flex min-h-screen flex-col overflow-hidden bg-zinc-950 font-sans text-white selection:bg-red-600/30">
            <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-4 p-4">
                <div className="grid h-full min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-5">
                    <div className={`relative flex h-full flex-col gap-4 ${showEpg ? 'lg:col-span-3' : 'lg:col-span-5'}`}>
                        <ChannelInfo
                            selectedChannel={selectedChannel}
                            currentSourceIdx={currentSourceIdx}
                            showSourceDropdown={showSourceDropdown}
                            setShowSourceDropdown={setShowSourceDropdown}
                            onSelectSource={handleManualSelectSource}
                            onPrev={handlePrevChannel}
                            onNext={handleNextChannel}
                            isFavorite={favorites.includes(selectedChannel?.id)}
                            onToggleFavorite={toggleFavorite}
                        />

                        <div className="flex flex-1 items-start justify-center overflow-hidden rounded-xl border border-zinc-800 bg-black/40">
                            <div className="w-full">
                                <div
                                    ref={playerFrameRef}
                                    className="mx-auto aspect-video w-full max-h-[75vh]"
                                >
                                    <div
                                        ref={videoRef}
                                        id="tv-player"
                                        className={
                                            isPseudoPip
                                                ? "z-50 fixed left-0 top-0 aspect-video w-full border-b border-zinc-800 bg-black shadow-2xl"
                                                : "h-full w-full"
                                        }
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Nút đóng/mở EPG dạng ngăn kéo trên Desktop */}
                        <button
                            onClick={() => setShowEpg(!showEpg)}
                            className="absolute -right-4 top-1/2 z-40 hidden -translate-y-1/2 items-center justify-center rounded-l-xl border border-r-0 border-zinc-800 bg-zinc-900/90 py-8 text-zinc-400 backdrop-blur-md transition-all hover:bg-zinc-800 hover:text-white lg:flex"
                            title={showEpg ? "Đóng Lịch Phát Sóng" : "Mở Lịch Phát Sóng"}
                        >
                            <svg className={`h-3 w-3 transition-transform ${showEpg ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>

                    {/* EPG: Toggleable qua header ScheduleList */}
                    <div className={`custom-scrollbar flex h-full flex-col space-y-4 overflow-auto rounded-xl lg:col-span-2 ${showEpg ? '' : 'max-lg:flex! lg:hidden'}`}>
                        <ScheduleList
                            schedule={schedule}
                            loading={scheduleLoading}
                            error={scheduleError}
                            lastUpdated={lastUpdated}
                            formatDateTime={formatDateTime}
                            isCurrentProgram={isCurrentProgram}
                            formatTime={formatTime}
                            programProgress={programProgress}
                            containerRef={scheduleContainerRef}
                            expanded={showEpg}
                            onToggle={() => setShowEpg((v) => !v)}
                        />
                    </div>
                </div>

                {/* Tabs & Channel Grid section */}
                <div className="mt-2 flex w-full flex-col gap-6">
                    {/* Tab Navigation - Group List with Arrows */}
                    <div className="relative flex items-center">
                        {/* Left Arrow */}
                        <button
                            type="button"
                            onClick={() => scrollTabs("left")}
                            className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 transition-all hover:border-red-600 hover:bg-red-600 hover:text-white"
                        >
                            <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={3}
                                    d="M15 19l-7-7 7-7"
                                />
                            </svg>
                        </button>

                        <div
                            ref={tabsRef}
                            className="horizontal scrollbar-hide flex flex-1 items-center gap-2 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        >
                            {groups.map((group) => {
                                const isActive = activeGroupId === group.id;
                                return (
                                    <button
                                        key={group.id}
                                        onClick={() =>
                                            setActiveGroupId(group.id)
                                        }
                                        className={
                                            "relative flex shrink-0 items-center gap-2 rounded-full px-5 py-2 text-sm font-bold tracking-tight transition-all duration-300 " +
                                            (isActive
                                                ? "bg-red-600 text-white shadow-lg"
                                                : "border border-zinc-800/80 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800 hover:text-white")
                                        }
                                    >
                                        {group.id === "favorites" && (
                                            <svg
                                                className="h-4 w-4"
                                                fill="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                            </svg>
                                        )}
                                        {group.id === "most_watched" && (
                                            <svg
                                                className="h-4 w-4"
                                                fill="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8c0-3.12-1.12-6.57-2.61-8.52-1.38-1.81-3.89-4.81-3.89-4.81zM12 19c-2.76 0-5-2.24-5-5 0-1.47.64-2.82 1.67-3.74.39-.35.9-.62 1.4-.79.43-.14.65-.58.55-1.01-.13-.53-.22-1.07-.22-1.64 0 1.25.79 2.21 2.07 2.21 1.26 0 2.1-.96 2.1-2.21 0-.32-.04-.62-.12-.9.23.27.46.56.66.86.83 1.23 1.39 2.48 1.39 3.51 0 2.76-2.24 5-5 5z" />
                                            </svg>
                                        )}
                                        {group.name}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Right Arrow */}
                        <button
                            type="button"
                            onClick={() => scrollTabs("right")}
                            className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 transition-all hover:border-red-600 hover:bg-red-600 hover:text-white"
                        >
                            <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={3}
                                    d="M9 5l7 7-7 7"
                                />
                            </svg>
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
                        {(
                            groups.find((g) => g && g.id === activeGroupId)
                                ?.channels || []
                        ).map((channel) => {
                            const isSelected =
                                selectedChannel?.id === channel.id;
                            return (
                                <div
                                    key={channel.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => handleSelectChannel(channel)}
                                    onKeyDown={(e) => {
                                        if (
                                            e.key === "Enter" ||
                                            e.key === " "
                                        ) {
                                            e.preventDefault();
                                            handleSelectChannel(channel);
                                        }
                                    }}
                                    className={
                                        "group relative flex cursor-pointer flex-col items-center gap-3 rounded-2xl border p-4 transition-all duration-300 " +
                                        (isSelected
                                            ? "border-red-600 bg-red-600/10 shadow-lg ring-1 ring-red-600"
                                            : "border-zinc-800/80 bg-zinc-900/60 hover:scale-[1.03] hover:border-zinc-700 hover:bg-zinc-800/70")
                                    }
                                >
                                    {/* Favorite Toggle on Card */}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleFavorite(channel.id);
                                        }}
                                        className={
                                            "absolute right-2 top-2 z-20 p-1.5 transition-all duration-300 " +
                                            (favorites.includes(channel.id)
                                                ? "scale-110 text-red-500"
                                                : "text-zinc-600 opacity-0 hover:text-zinc-300 group-hover:opacity-100")
                                        }
                                        aria-label="Yêu thích"
                                    >
                                        <svg
                                            className="h-4 w-4"
                                            fill={
                                                favorites.includes(channel.id)
                                                    ? "currentColor"
                                                    : "none"
                                            }
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                                            />
                                        </svg>
                                    </button>
                                    <div className="relative flex h-16 w-16 items-center justify-center">
                                        {channel.logo ? (
                                            <img
                                                src={channel.logo}
                                                alt={channel.name}
                                                onError={
                                                    handleImageFallbackError
                                                }
                                                className={
                                                    "h-full w-full object-contain transition-transform duration-500 group-hover:scale-110 " +
                                                    (isSelected
                                                        ? "drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                                                        : "opacity-80 group-hover:opacity-100")
                                                }
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 p-2">
                                                <span className="text-2xl font-bold text-zinc-600">
                                                    {channel.name[0]}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div
                                        className={
                                            "line-clamp-1 w-full text-center text-xs font-bold tracking-tight transition-colors " +
                                            (isSelected
                                                ? "text-red-500"
                                                : "text-zinc-300 group-hover:text-white")
                                        }
                                    >
                                        {channel.name}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {showScrollTopButton && (
                    <button
                        onClick={() =>
                            window.scrollTo({ top: 0, behavior: "smooth" })
                        }
                        className="fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-white shadow-xl transition-colors hover:bg-zinc-800"
                        aria-label="Trở về đầu trang"
                    >
                        <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 15l7-7 7 7"
                            />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
}
