import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

// Mock JWPlayer license response để bypass CORS
const JWPLAYER_LICENSE_MOCK = {
    canPlayAds: true,
    canPlayOutstreamAds: false,
    canUseIdentityScript: false,
    canUseVPB: false,
    overrideAdConfig: false,
};

// Intercept fetch để bypass JWPlayer CORS
const originalFetch = window.fetch;
window.fetch = function (...args) {
    const url = typeof args[0] === "string" ? args[0] : args[0]?.url;

    // Mock JWPlayer entitlements
    if (url && url.includes("entitlements.jwplayer.com")) {
        return Promise.resolve(
            new Response(JSON.stringify(JWPLAYER_LICENSE_MOCK), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }),
        );
    }

    return originalFetch.apply(this, args);
};

const fetchChannels = async () => {
    // Lấy danh sách URLs từ biến môi trường
    const channelSourcesEnv = import.meta.env.VITE_TV_CHANNEL_SOURCES || "";
    const urls = channelSourcesEnv.split(",").filter((url) => url.trim());

    // Fetch tất cả URLs song song
    const fetchPromises = urls.map(async (url) => {
        try {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(10000),
            });
            if (!response.ok) {
                console.warn(`Failed to fetch ${url}: ${response.status}`);
                return null;
            }
            return await response.text();
        } catch (error) {
            console.warn(`Error fetching ${url}:`, error.message);
            return null;
        }
    });

    const results = await Promise.all(fetchPromises);

    // Merge tất cả content lại, với filter cho bongda2.m3u chỉ lấy group 10Cam
    const allLines = results
        .filter((text) => text) // Bỏ qua null
        .flatMap((text, index) => {
            const lines = text.split(/\r?\n/).map((l) => l.trim());

            // Nếu là bongda2.m3u (index 1), chỉ lấy group 10Cam
            if (urls[index].includes("bongda2.m3u")) {
                const filtered = [];
                let inTargetGroup = false;

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];

                    if (line.startsWith("#EXTINF")) {
                        // Check group-title
                        const groupMatch = line.match(/group-title="([^"]+)"/i);
                        inTargetGroup = groupMatch && groupMatch[1] === "10Cam";

                        if (inTargetGroup) {
                            filtered.push(line);
                        }
                    } else if (inTargetGroup) {
                        // Thêm các dòng tiếp theo (EXTVLCOPT, URL) cho channel này
                        filtered.push(line);

                        // Nếu là URL (không phải comment), reset flag
                        if (line && !line.startsWith("#")) {
                            inTargetGroup = false;
                        }
                    } else {
                        // Giữ lại các dòng header như #EXTM3U
                        if (line.startsWith("#EXTM3U")) {
                            filtered.push(line);
                        }
                    }
                }

                return filtered;
            }

            return lines;
        });

    const channels = [];
    const channelsByTvgId = {}; // Group channels by tvgId
    const channelsByBaseName = {}; // Group channels by base name (bỏ quality suffix)
    const groups = {};

    // Helper function để extract base name (bỏ quality như HD, SD, FullHD, HD1, HD2, etc.)
    const getBaseName = (name) => {
        // Remove trailing quality indicators - match các pattern phổ biến
        const cleaned = name
            .replace(
                /\s*(HD\s*Nhanh|FullHD|Full\s*HD|FHD|HD\d+|HD|SD|4K|UHD)(\s*\(\d+\))?\s*$/i,
                "",
            )
            .trim();

        return cleaned;
    };

    for (let i = 0; i < allLines.length; i++) {
        const line = allLines[i];
        if (!line) continue;
        if (line.startsWith("#EXTINF")) {
            const nameMatch = line.match(/,(.+)$/);
            const name = nameMatch ? nameMatch[1].trim() : "Unknown";
            const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
            const tvgIdMatch = line.match(/tvg-id="([^"]+)"/i);
            const groupMatch = line.match(/group-title="([^"]+)"/i);

            // Parse EXTVLCOPT options (referrer, user-agent, etc.)
            let referrer = null;
            let userAgent = null;

            // Tìm các dòng EXTVLCOPT trước URL
            for (let j = i + 1; j < allLines.length; j++) {
                const optLine = allLines[j];
                if (!optLine || optLine.startsWith("#EXTINF")) break;

                if (optLine.startsWith("#EXTVLCOPT:")) {
                    const refMatch = optLine.match(/http-referrer=(.+)$/i);
                    if (refMatch) {
                        referrer = refMatch[1].trim();
                    }
                    const uaMatch = optLine.match(/http-user-agent=(.+)$/i);
                    if (uaMatch) {
                        userAgent = uaMatch[1].trim();
                    }
                }
            }

            // find next non-comment line as url
            let url = "";
            for (let j = i + 1; j < allLines.length; j++) {
                if (allLines[j] && !allLines[j].startsWith("#")) {
                    url = allLines[j];
                    break;
                }
            }

            if (!url) continue;

            const tvgId = tvgIdMatch ? tvgIdMatch[1] : null;
            const groupName = groupMatch ? groupMatch[1] : "Khác";
            const baseName = getBaseName(name);

            // Extract quality suffix để dùng làm label
            const qualityMatch = name.match(
                /\s*(HD\s*Nhanh|FullHD|Full\s*HD|FHD|HD\d+|HD|SD|4K|UHD)(\s*\(\d+\))?\s*$/i,
            );
            const quality = qualityMatch ? qualityMatch[1].trim() : "Default";

            // Xác định type của source
            const sourceType = url.includes(".mpd") ? "dash" : "hls";

            // Tạo source object
            const source = {
                file: url,
                type: sourceType,
                label: quality, // Dùng quality làm label để phân biệt các source
                referrer: referrer, // Lưu referrer nếu có
                userAgent: userAgent, // Lưu user-agent nếu có
            };

            // Ưu tiên group theo tvgId, nếu không có thì group theo baseName
            const groupKey = tvgId || baseName;

            if (
                groupKey &&
                (channelsByTvgId[groupKey] || channelsByBaseName[groupKey])
            ) {
                // Đã có channel với groupKey này, thêm vào sources
                const existingChannel =
                    channelsByTvgId[groupKey] || channelsByBaseName[groupKey];
                existingChannel.configSources.push(source);
            } else {
                // Kênh mới
                const channel = {
                    id: channels.length + 1,
                    name: baseName, // Dùng base name (không có quality suffix)
                    url,
                    logo: logoMatch ? logoMatch[1] : null,
                    tvgId: tvgId,
                    configSources: [source], // Khởi tạo với source đầu tiên
                };

                channels.push(channel);

                if (tvgId) {
                    channelsByTvgId[tvgId] = channel;
                } else {
                    channelsByBaseName[baseName] = channel;
                }

                // Thêm vào group
                if (!groups[groupName]) groups[groupName] = [];
                groups[groupName].push(channel);
            }
        }
    }

    const groupsArray = Object.keys(groups).map((groupName) => ({
        name: groupName,
        channels: groups[groupName],
    }));

    return groupsArray;
};

// Component ChannelScroller với nút scroll ẩn/hiện khi cần
function ChannelScroller({ channels, selectedChannel, onSelectChannel }) {
    const scrollRef = useRef(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    // Kiểm tra trạng thái scroll
    const checkScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 0);
        setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
    };

    useEffect(() => {
        checkScroll();
        const el = scrollRef.current;
        if (el) {
            el.addEventListener("scroll", checkScroll);
            window.addEventListener("resize", checkScroll);
        }
        return () => {
            if (el) el.removeEventListener("scroll", checkScroll);
            window.removeEventListener("resize", checkScroll);
        };
    }, [channels]);

    const scrollLeft = () => {
        scrollRef.current?.scrollBy({ left: -300, behavior: "smooth" });
    };

    const scrollRight = () => {
        scrollRef.current?.scrollBy({ left: 300, behavior: "smooth" });
    };

    return (
        <div className="relative">
            {/* Nút scroll trái - ẩn khi đã scroll hết */}
            {canScrollLeft && (
                <button
                    onClick={scrollLeft}
                    className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-zinc-800/90 p-2 text-white/80 shadow-lg backdrop-blur-sm transition-all hover:bg-zinc-700 hover:text-white"
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
            )}

            <div
                ref={scrollRef}
                className="custom-scrollbar horizontal mx-8 overflow-x-auto py-2"
            >
                <div className="flex gap-3 px-1">
                    {channels.map((channel) => (
                        <button
                            key={channel.id}
                            onClick={() => onSelectChannel(channel)}
                            className={
                                "bg-white/6 border-white/8 flex w-36 shrink-0 transform-gpu cursor-pointer flex-col items-center text-balance rounded-lg border p-3 text-center transition-transform duration-150 hover:scale-105" +
                                (selectedChannel?.id === channel.id
                                    ? " ring-2 ring-cyan-400/30"
                                    : "")
                            }
                        >
                            {channel.logo ? (
                                <img
                                    src={channel.logo}
                                    alt={channel.name}
                                    className="mb-2 h-12 w-12 object-contain"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="mb-2 h-12 w-12 rounded-full bg-zinc-600/40"></div>
                            )}
                            <div
                                className="line-clamp-3 text-balance text-xs text-white"
                                title={channel.name}
                            >
                                {channel.name}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Nút scroll phải - ẩn khi đã scroll hết */}
            {canScrollRight && (
                <button
                    onClick={scrollRight}
                    className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-zinc-800/90 p-2 text-white/80 shadow-lg backdrop-blur-sm transition-all hover:bg-zinc-700 hover:text-white"
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
            )}
        </div>
    );
}

export default function TV() {
    // Simple toast helper (DOM-based) using Tailwind classes (no inline CSS)
    const showToast = (message, opts = {}) => {
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

            // base Tailwind classes for toast
            const base =
                "min-w-[200px] max-w-[420px] px-4 py-2 rounded-lg shadow-lg text-white text-sm leading-tight transform transition-all duration-200 cursor-pointer";
            const hidden = "opacity-0 -translate-y-1";
            const visible = "opacity-100 translate-y-0";

            let colorClass = "bg-cyan-500";
            if (type === "error")
                colorClass = "bg-gradient-to-r from-red-500 to-pink-500";
            else if (type === "warn")
                colorClass = "bg-gradient-to-r from-amber-400 to-orange-500";

            el.className = `${base} ${colorClass} ${hidden}`;

            container.appendChild(el);

            // animate in
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
    };
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedChannel, setSelectedChannel] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [schedule, setSchedule] = useState([]);
    const [scheduleLoading, setScheduleLoading] = useState(false);
    const [scheduleError, setScheduleError] = useState(null);
    const [expandedGroups, setExpandedGroups] = useState(new Set()); // Track các group đang mở
    const [epgChannels, setEpgChannels] = useState(new Map()); // Map tvgId -> channel info từ EPG API
    // Refs for video element and JWPlayer instance
    const videoRef = useRef(null);
    const playerRef = useRef(null);
    const scheduleContainerRef = useRef(null);
    const currentChannelRef = useRef(null); // Track channel đang phát để tránh duplicate init
    const hasLoadedChannelsRef = useRef(false); // Track đã load channels chưa để tránh duplicate fetch
    const hasLoadedEpgChannelsRef = useRef(false); // Track đã load EPG channels chưa
    const scheduleCacheRef = useRef(new Map()); // Cache schedule theo channelId, tránh spam API
    const errorCountRef = useRef(0); // Track số lần lỗi liên tiếp
    const triedSourcesRef = useRef(new Set()); // Track các source đã thử

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

    // --- LOAD CHANNELS ON MOUNT ---
    useEffect(() => {
        const loadChannels = async () => {
            // Tránh fetch duplicate trong React Strict Mode
            if (hasLoadedChannelsRef.current) {
                return;
            }
            hasLoadedChannelsRef.current = true;

            try {
                const data = await fetchChannels();
                setGroups(data);

                // Mở tất cả groups mặc định
                setExpandedGroups(new Set(data.map((g) => g.name)));

                // Tự động chọn kênh đầu tiên nếu có
                if (data && data.length > 0 && data[0].channels.length > 0) {
                    const firstChannel = data[0].channels[0];
                    setSelectedChannel(firstChannel);
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

    // Ref để lưu danh sách sources đã filter cho channel hiện tại
    const currentSourcesRef = useRef([]);
    const currentSourceIndexRef = useRef(0);

    // Hàm helper để setup player với source cụ thể
    const setupPlayerWithSource = (sourceIndex) => {
        const sources = currentSourcesRef.current;
        if (sourceIndex >= sources.length) {
            // Đã thử hết tất cả sources
            showToast(
                `Không thể phát kênh ${selectedChannel.name}. Đã thử ${sources.length} nguồn nhưng tất cả đều lỗi.`,
                { type: "error", duration: 8000 },
            );
            return;
        }

        const source = sources[sourceIndex];
        currentSourceIndexRef.current = sourceIndex;
        triedSourcesRef.current.add(sourceIndex);

        // Destroy old player
        if (playerRef.current) {
            try {
                playerRef.current.remove();
                playerRef.current = null;
            } catch (e) {
                console.warn("Error removing old player:", e);
            }
        }

        const playerDiv = document.getElementById("tv-player");
        if (!playerDiv) return;
        playerDiv.innerHTML = "";

        const playlistItem = {
            title: selectedChannel.name,
            file: source.file,
            type: source.file.includes(".mpd") ? "dash" : "hls",
        };

        const playerConfig = {
            playlist: [playlistItem],
            width: "100%",
            aspectratio: "16:9",
            controls: true,
            autostart: true,
            mute: false,
            playsinline: true,
            primary: "html5",
        };

        const player = window.jwplayer("tv-player").setup(playerConfig);
        playerRef.current = player;

        player.on("ready", () => {
            try {
                addCustomControls(player);
                if (sourceIndex > 0) {
                    showToast(
                        `Đang phát từ nguồn ${sourceIndex + 1}/${sources.length}: ${source.label}`,
                        { type: "info", duration: 3000 },
                    );
                }
            } catch (e) {
                console.warn("Error adding custom controls:", e);
            }
        });

        player.on("setupError", (err) => {
            console.error(
                `JWPlayer setup error (source ${sourceIndex + 1}):`,
                err,
            );
            // Thử source tiếp theo
            const nextIndex = sourceIndex + 1;
            if (nextIndex < sources.length) {
                showToast(
                    `Nguồn ${sourceIndex + 1} lỗi, đang thử nguồn ${nextIndex + 1}...`,
                    { type: "warn", duration: 2000 },
                );
                setTimeout(() => setupPlayerWithSource(nextIndex), 500);
            } else {
                showToast(
                    `Không thể phát kênh ${selectedChannel.name}. Đã thử ${sources.length} nguồn.`,
                    { type: "error", duration: 8000 },
                );
            }
        });

        player.on("error", (err) => {
            console.error(
                `JWPlayer playback error (source ${sourceIndex + 1}):`,
                err,
            );
            // Thử source tiếp theo
            const nextIndex = sourceIndex + 1;
            if (nextIndex < sources.length) {
                showToast(
                    `Nguồn ${sourceIndex + 1} lỗi, đang thử nguồn ${nextIndex + 1}...`,
                    { type: "warn", duration: 2000 },
                );
                setTimeout(() => setupPlayerWithSource(nextIndex), 500);
            } else {
                showToast(
                    `Không thể phát kênh ${selectedChannel.name}. Đã thử ${sources.length} nguồn.`,
                    { type: "error", duration: 8000 },
                );
            }
        });
    };

    // --- LOAD CHANNEL KHI selectedChannel THAY ĐỔI ---
    useEffect(() => {
        const loadChannel = async () => {
            if (!selectedChannel) return;

            // Check if JWPlayer is loaded
            if (!window.jwplayer) {
                console.error("JWPlayer chưa được load!");
                showToast("JWPlayer chưa được load", { type: "error" });
                return;
            }

            // Track current channel
            currentChannelRef.current = selectedChannel;

            // Reset error tracking khi chuyển kênh mới
            errorCountRef.current = 0;
            triedSourcesRef.current = new Set();
            currentSourceIndexRef.current = 0;

            try {
                // Destroy old player instance
                if (playerRef.current) {
                    try {
                        playerRef.current.remove();
                        playerRef.current = null;
                    } catch (e) {
                        console.warn("Error removing old player:", e);
                    }
                }

                // Wait for container to be ready
                const playerDiv = document.getElementById("tv-player");
                if (!playerDiv) {
                    throw new Error("Player container not found");
                }

                // Clear container
                playerDiv.innerHTML = "";

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
                        return getQuality(b.label) - getQuality(a.label);
                    });

                    if (filteredSources.length === 0) {
                        throw new Error(
                            "Tất cả nguồn đều là FLV (Flash Video) - không được hỗ trợ",
                        );
                    }

                    // Lưu danh sách sources và bắt đầu với source đầu tiên
                    currentSourcesRef.current = filteredSources;
                    setupPlayerWithSource(0);
                } else {
                    // Fallback: single source - setup trực tiếp
                    currentSourcesRef.current = [
                        {
                            file: selectedChannel.url,
                            label: "Default",
                        },
                    ];
                    setupPlayerWithSource(0);
                }
            } catch (error) {
                console.error("Failed to setup JWPlayer:", error);
                showToast(
                    `Lỗi tải kênh: ${error.message || "Không rõ nguyên nhân"}`,
                    { type: "error", duration: 6000 },
                );
            }
        };

        loadChannel();

        // Cleanup khi unmount
        return () => {
            try {
                if (playerRef.current) {
                    playerRef.current.remove();
                    playerRef.current = null;
                }
            } catch (e) {
                console.error("Cleanup error:", e);
            }
        };
    }, [selectedChannel]);

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
            if (!channel) return;

            const channelId = channel.tvgId || channel.tvg_id || channel.id;
            if (!channelId) {
                setScheduleError("Kênh không có tvg-id");
                return;
            }

            // Kiểm tra xem channel có được hỗ trợ EPG không
            const normalizedId = String(channelId).toLowerCase();
            const epgInfo = epgChannels.get(normalizedId);

            if (!epgInfo) {
                // Không có trong danh sách EPG - không gọi API
                setScheduleError("Không có lịch phát sóng");
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
        }
    }, [selectedChannel, epgChannels]);

    // Inject custom modern scrollbar styles and ensure player controls receive pointer events
    useEffect(() => {
        const styleId = "custom-scrollbar-style";
        if (!document.getElementById(styleId)) {
            const s = document.createElement("style");
            s.id = styleId;
            s.innerHTML = `
                /* Modern rounded scrollbar */
                .custom-scrollbar {
                    scrollbar-width: thin;
                    scrollbar-color: rgba(6,182,212,0.9) rgba(255,255,255,0.03);
                }
                .custom-scrollbar::-webkit-scrollbar { width: 10px; height: 10px; }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(255,255,255,0.03);
                    border-radius: 9999px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #06b6d4;
                    border-radius: 9999px;
                    border: 2px solid rgba(0,0,0,0.12);
                    box-shadow: inset 0 0 6px rgba(0,0,0,0.12);
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    filter: brightness(0.95);
                }
                /* Slight inset shadow for track */
                .custom-scrollbar::-webkit-scrollbar-track-piece {
                    box-shadow: inset 0 0 6px rgba(0,0,0,0.06);
                    border-radius: 9999px;
                }
                /* Optional: small rounded indicator for horizontal scrollers */
                .custom-scrollbar.horizontal::-webkit-scrollbar { height: 8px; }
            `;
            document.head.appendChild(s);
        }
        return () => {};
    }, []);

    // Helper: parse/format schedule times and progress
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
        // support vnepg: startMs/stopMs, or generic start/end strings
        const s = toMs(item.startMs ?? item.start ?? item.s ?? null);
        const e = toMs(item.stopMs ?? item.end ?? item.stop ?? null);
        return { s, e };
    };

    const formatTime = (v) => {
        const ms = toMs(v);
        if (!ms) return "--:--";
        const d = new Date(ms);
        return d.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        });
    };

    const formatDateTime = (v) => {
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
    };

    const isCurrentProgram = (item) => {
        const { s, e } = getStartEndMs(item);
        if (!s || !e) return false;
        const now = Date.now();
        return now >= s && now <= e;
    };

    const programProgress = (item) => {
        const { s, e } = getStartEndMs(item);
        if (!s || !e) return 0;
        const now = Date.now();
        if (now <= s) return 0;
        if (now >= e) return 100;
        return Math.round(((now - s) / (e - s)) * 100);
    };

    // Add custom rewind/forward buttons to JWPlayer
    function addCustomControls(player) {
        const controlbar = player
            .getContainer()
            .querySelector(".jw-controlbar");
        if (!controlbar) return;

        // Nút tua lùi 10s
        const rewindBtn = document.createElement("div");
        rewindBtn.className =
            "jw-icon jw-icon-inline jw-button-color jw-reset jw-icon-rewind";
        rewindBtn.setAttribute("role", "button");
        rewindBtn.setAttribute("tabindex", "0");
        rewindBtn.setAttribute("aria-label", "Tua lùi 10 giây");
        rewindBtn.title = "Tua lùi 10 giây";
        rewindBtn.style.cssText = "cursor: pointer;";
        rewindBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                <text x="12" y="16" text-anchor="middle" font-size="7" font-weight="bold" fill="currentColor">10</text>
            </svg>
        `;
        rewindBtn.onclick = () => {
            const currentTime = player.getPosition();
            player.seek(Math.max(0, currentTime - 10));
        };

        // Nút tua tiến 10s
        const forwardBtn = document.createElement("div");
        forwardBtn.className =
            "jw-icon jw-icon-inline jw-button-color jw-reset jw-icon-forward";
        forwardBtn.setAttribute("role", "button");
        forwardBtn.setAttribute("tabindex", "0");
        forwardBtn.setAttribute("aria-label", "Tua tiến 10 giây");
        forwardBtn.title = "Tua tiến 10 giây";
        forwardBtn.style.cssText = "cursor: pointer;";
        forwardBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
                <text x="12" y="16" text-anchor="middle" font-size="7" font-weight="bold" fill="currentColor">10</text>
            </svg>
        `;
        forwardBtn.onclick = () => {
            const currentTime = player.getPosition();
            const duration = player.getDuration();
            player.seek(Math.min(duration, currentTime + 10));
        };

        // Tìm vị trí để insert (sau nút play/pause)
        const playButton = controlbar.querySelector(".jw-icon-playback");
        if (playButton && playButton.parentElement) {
            playButton.parentElement.insertBefore(
                rewindBtn,
                playButton.nextSibling,
            );
            playButton.parentElement.insertBefore(
                forwardBtn,
                rewindBtn.nextSibling,
            );
        } else {
            controlbar.insertBefore(rewindBtn, controlbar.firstChild);
            controlbar.insertBefore(forwardBtn, rewindBtn.nextSibling);
        }
    }

    const handleSelectChannel = (channel) => {
        setSelectedChannel(channel);
    };

    // Helper: lấy danh sách tất cả channels (flatten từ groups)
    const getAllChannels = () => {
        return groups.flatMap((g) => g.channels);
    };

    // Chuyển kênh trước/sau
    const handlePrevChannel = () => {
        const allChannels = getAllChannels();
        if (!selectedChannel || allChannels.length === 0) return;
        const currentIndex = allChannels.findIndex(
            (c) => c.id === selectedChannel.id,
        );
        const prevIndex =
            currentIndex <= 0 ? allChannels.length - 1 : currentIndex - 1;
        setSelectedChannel(allChannels[prevIndex]);
    };

    const handleNextChannel = () => {
        const allChannels = getAllChannels();
        if (!selectedChannel || allChannels.length === 0) return;
        const currentIndex = allChannels.findIndex(
            (c) => c.id === selectedChannel.id,
        );
        const nextIndex =
            currentIndex >= allChannels.length - 1 ? 0 : currentIndex + 1;
        setSelectedChannel(allChannels[nextIndex]);
    };

    const toggleGroup = (groupName) => {
        setExpandedGroups((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(groupName)) {
                newSet.delete(groupName);
            } else {
                newSet.add(groupName);
            }
            return newSet;
        });
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-zinc-900 text-white">
                <div className="text-balance text-center">
                    <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-cyan-500"></div>
                    <p>Đang tải danh sách kênh...</p>
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
        <div className="bg-linear-to-br font-inter relative flex min-h-screen flex-col overflow-hidden from-zinc-900 via-zinc-800 to-zinc-900 text-white">
            {/* Subtle static liquid-glass overlay */}
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(120,119,198,0.06),transparent)]"></div>

            <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-4 p-4">
                <div className="grid h-full min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-5">
                    <div className="flex h-full flex-col gap-4 lg:col-span-3">
                        <div className="bg-white/6  border-white/12 rounded-xl border p-4 shadow-sm backdrop-blur-sm">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    {selectedChannel?.logo && (
                                        <img
                                            src={selectedChannel.logo}
                                            alt={selectedChannel.name}
                                            className="border-white/12 h-12 w-12 rounded-full border object-contain"
                                        />
                                    )}
                                    <div>
                                        <div className="text-sm text-white/80">
                                            Đang xem
                                        </div>
                                        <div className="line-clamp-2 text-lg font-semibold text-white">
                                            {selectedChannel?.name ||
                                                "Chưa chọn kênh"}
                                        </div>
                                        {selectedChannel?.configSources &&
                                            selectedChannel.configSources
                                                .length > 1 && (
                                                <div className="mt-1 text-xs text-white/60">
                                                    {
                                                        selectedChannel
                                                            .configSources
                                                            .length
                                                    }{" "}
                                                    nguồn khả dụng
                                                </div>
                                            )}
                                    </div>
                                </div>
                                {/* Nút chuyển kênh trước/sau */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handlePrevChannel}
                                        className="rounded-full bg-white/10 p-2 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
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
                                        onClick={handleNextChannel}
                                        className="rounded-full bg-white/10 p-2 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
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

                        <div className="border-white/8 flex flex-1 items-start justify-center overflow-hidden rounded-xl border bg-black/40 backdrop-blur-sm">
                            <div className="w-full">
                                {/* 16:9 aspect ratio wrapper (matching VodPlay.jsx) */}
                                <div className="mx-auto aspect-video w-full max-w-[1100px]">
                                    <div
                                        ref={videoRef}
                                        id="tv-player"
                                        className="h-full w-full"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="border-white/12 custom-scrollbar flex h-full flex-col space-y-4 overflow-auto rounded-xl border lg:col-span-2">
                        <div className="bg-white/6 flex h-full flex-col p-4 shadow-sm backdrop-blur-sm">
                            <div className="flex items-center justify-between">
                                <h3 className="flex items-center gap-2 text-sm font-semibold text-white/90">
                                    <svg
                                        className="h-4 w-4 text-cyan-400"
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
                                </h3>
                                <div className="text-xs text-white/70">
                                    {lastUpdated
                                        ? `Cập nhật: ${formatDateTime(lastUpdated)}`
                                        : "--"}
                                </div>
                            </div>

                            <div
                                ref={scheduleContainerRef}
                                className="custom-scrollbar mt-3 h-0 min-h-96 grow overflow-auto text-sm text-white/80"
                            >
                                {scheduleLoading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-cyan-400"></div>
                                        <div>Đang tải lịch phát sóng...</div>
                                    </div>
                                ) : scheduleError ? (
                                    <div className="text-white/60">
                                        {scheduleError}
                                    </div>
                                ) : !schedule || schedule.length === 0 ? (
                                    <div>
                                        Chưa có dữ liệu lịch cho kênh này.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {schedule.map((item, idx) => {
                                            const current =
                                                isCurrentProgram(item);
                                            const startMs = toMs(
                                                item.startMs ??
                                                    item.start ??
                                                    item.s ??
                                                    null,
                                            );
                                            const endMs = toMs(
                                                item.stopMs ??
                                                    item.end ??
                                                    item.stop ??
                                                    item.e ??
                                                    null,
                                            );
                                            const start = formatTime(startMs);
                                            const end = formatTime(endMs);
                                            const prog = programProgress(item);
                                            return (
                                                <div
                                                    key={idx}
                                                    data-current={
                                                        current ? "1" : "0"
                                                    }
                                                    data-start-ms={
                                                        startMs ?? ""
                                                    }
                                                    className={
                                                        "flex items-start justify-between gap-3 rounded-md p-2 " +
                                                        (current
                                                            ? "bg-cyan-500/10"
                                                            : "bg-white/2")
                                                    }
                                                >
                                                    <div className="w-28 text-xs text-white/70">
                                                        {start} — {end}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="line-clamp-2 text-sm font-medium">
                                                                {item.title ||
                                                                    item.name ||
                                                                    item.program ||
                                                                    "Không rõ"}
                                                            </div>
                                                            {current && (
                                                                <div className="rounded-full bg-red-600/20 px-2 py-0.5 text-xs text-red-300">
                                                                    Đang phát
                                                                </div>
                                                            )}
                                                        </div>
                                                        {current && (
                                                            <div className="mt-2 h-2 w-full rounded-full bg-white/10">
                                                                <div
                                                                    className="h-2 rounded-full bg-cyan-400"
                                                                    style={{
                                                                        width: `${prog}%`,
                                                                    }}
                                                                />
                                                            </div>
                                                        )}
                                                        {current &&
                                                            (item.icon ||
                                                                item.desc) && (
                                                                <div className="mt-2 flex gap-2">
                                                                    {/* {item.icon && (
                                                                        <img
                                                                            src={
                                                                                item.icon
                                                                            }
                                                                            alt=""
                                                                            className="aspect-video h-16 rounded-md object-cover"
                                                                        />
                                                                    )} */}
                                                                    {item.desc && (
                                                                        <div className="flex-1 text-xs text-white/70">
                                                                            {
                                                                                item.desc
                                                                            }
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* Right column fills remaining space; channel scroller moved below full-width */}
                    </div>
                </div>
                {/* Channel groups: each group has its own horizontal scroller */}
                <div className="mt-4 w-full space-y-4">
                    {groups.map((group) => {
                        const isExpanded = expandedGroups.has(group.name);
                        return (
                            <div
                                key={group.name}
                                className="bg-white/6 border-white/12 flex flex-col gap-2 rounded-xl border p-3 shadow-sm backdrop-blur-sm"
                            >
                                <button
                                    onClick={() => toggleGroup(group.name)}
                                    className="flex w-full items-center justify-between transition-opacity hover:opacity-80"
                                >
                                    <div className="flex items-center gap-2">
                                        <svg
                                            className="h-4 w-4 text-cyan-400 transition-transform duration-200"
                                            style={{
                                                transform: isExpanded
                                                    ? "rotate(90deg)"
                                                    : "rotate(0deg)",
                                            }}
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
                                        <div className="text-sm font-semibold text-white/90">
                                            {group.name}
                                        </div>
                                    </div>
                                    <div className="text-xs text-white/70">
                                        {group.channels.length} kênh
                                    </div>
                                </button>
                                {isExpanded && (
                                    <ChannelScroller
                                        channels={group.channels}
                                        selectedChannel={selectedChannel}
                                        onSelectChannel={handleSelectChannel}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
