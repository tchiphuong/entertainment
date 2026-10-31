import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import shaka from "shaka-player/dist/shaka-player.ui.js";
import {
    createShakaPlayerVideo,
    configureShakaUi,
    injectShakaAudioVersionButton,
    registerShakaNetworkFilter,
    registerShakaUriResolver,
    getNextEpisodeData,
    getPrevEpisodeData,
    handleCastTV,
    togglePiP,
} from "../../utils/vodPlayHelpers";
import {
    useVodPlayIntroSettings,
    useVodPlayCountdown,
    useVideoKeyboardShortcuts,
    useLocalStorage,
} from "./useVodPlayLogic";
import { fetchSourceData } from "../../services/vod/vodService";
import { calculateSynchronizedTime } from "../../utils/watchPartyUtils";
import { SOURCES } from "../../constants";

/**
 * Cấu hình hiệu năng streaming ABR tối ưu cho Shaka Player
 */
const configureShakaStreaming = (player) => {
    player.configure({
        streaming: {
            rebufferingGoal: 2,
            bufferingGoal: 10,
            lowLatencyMode: true,
            ignoreTextStreamFailures: true,
        },
    });
};

/**
 * Dọn dẹp an toàn Shaka Player và UI Overlay
 */
const cleanupShakaInstances = async (playerRef, overlayRef) => {
    if (overlayRef.current) {
        try {
            await overlayRef.current.destroy();
        } catch {
            // bỏ qua lỗi dọn dẹp overlay
        }
        overlayRef.current = null;
    }
    if (playerRef.current) {
        try {
            await playerRef.current.destroy();
        } catch {
            // bỏ qua lỗi dọn dẹp player
        }
        playerRef.current = null;
    }
};

const serverHasEpisode = (server, currentEpisode) => {
    if (!server?.server_data || !currentEpisode) return false;
    return server.server_data.some(
        (ep) => ep.slug === currentEpisode.slug || ep.name === currentEpisode.name
    );
};

const findMatchingServer = (serverList, currentEpisode) => {
    return serverList.find((srv) => serverHasEpisode(srv, currentEpisode)) || serverList[0] || null;
};

/**
 * Hook tải và lưu trữ danh sách server và tập của phim cho phòng xem chung
 */
export const useWatchPartyMovieEpisodes = (movieSlug, currentEpisode) => {
    const [episodes, setEpisodes] = useState([]);
    const [activeEpisode, setActiveEpisode] = useState(null);

    useEffect(() => {
        if (!movieSlug) return;
        let isMounted = true;

        fetchSourceData(movieSlug, SOURCES.SOURCE_K)
            .then((res) => {
                if (!isMounted) return;
                const serverList = res?.episodes || [];
                setEpisodes(serverList);
                setActiveEpisode(findMatchingServer(serverList, currentEpisode));
            })
            .catch((err) => {
                console.warn("Lỗi tải danh sách tập phim cho phòng xem chung:", err);
            });

        return () => {
            isMounted = false;
        };
    }, [movieSlug, currentEpisode?.slug, currentEpisode?.name]);

    return { episodes, setEpisodes, activeEpisode, setActiveEpisode };
};

/**
 * Hook điều hướng tập trước / tập sau cho phòng xem chung
 */
export const useWatchPartyEpisodeNavigation = ({
    episodes,
    activeEpisode,
    currentEpisode,
    canControl,
    changeEpisode,
}) => {
    const currentEpisodeId = currentEpisode?.slug || currentEpisode?.name;
    const nextData = useMemo(() => getNextEpisodeData(episodes, activeEpisode, currentEpisodeId), [episodes, activeEpisode, currentEpisodeId]);
    const prevData = useMemo(() => getPrevEpisodeData(episodes, activeEpisode, currentEpisodeId), [episodes, activeEpisode, currentEpisodeId]);

    const playNextEpisode = useCallback(() => {
        if (nextData?.episode && canControl && changeEpisode) {
            changeEpisode({
                ...nextData.episode,
                server_name: activeEpisode?.server_name || "Vietsub",
            });
        }
    }, [nextData, canControl, changeEpisode, activeEpisode]);

    const playPrevEpisode = useCallback(() => {
        if (prevData?.episode && canControl && changeEpisode) {
            changeEpisode({
                ...prevData.episode,
                server_name: activeEpisode?.server_name || "Vietsub",
            });
        }
    }, [prevData, canControl, changeEpisode, activeEpisode]);

    return {
        nextData,
        prevData,
        playNextEpisode,
        playPrevEpisode,
        currentEpisodeId,
    };
};

/**
 * Hook quản lý cài đặt Autoplay, Skip Intro và Countdown chuyển tập
 */
export const useWatchPartyPlayerSettings = (movieSlug, playNextEpisode) => {
    const [autoplayEnabled, setAutoplayEnabled] = useLocalStorage("autoplayEnabled", true);
    const autoplayEnabledRef = useRef(autoplayEnabled);
    autoplayEnabledRef.current = autoplayEnabled;

    const introSettings = useVodPlayIntroSettings(movieSlug);

    const countdown = useVodPlayCountdown(playNextEpisode);

    return {
        autoplayEnabled,
        setAutoplayEnabled,
        autoplayEnabledRef,
        ...introSettings,
        ...countdown,
    };
};

/**
 * Khởi tạo Shaka Player kèm Shaka UI controls, nút bản âm thanh và nạp stream
 */
const mountShakaUiPlayer = async ({
    playerDiv,
    movie,
    playUrl,
    episodes,
    activeEpisode,
    onSelectServer,
    onFallback,
}) => {
    shaka.polyfill.installAll();
    if (!shaka.Player.isBrowserSupported()) {
        console.warn("Trình duyệt không hỗ trợ Shaka Player");
        onFallback();
        return null;
    }

    try {
        const { video, uiContainer } = createShakaPlayerVideo(playerDiv, movie, null);
        const player = new shaka.Player();
        await player.attach(video);

        registerShakaNetworkFilter(player);
        registerShakaUriResolver(player, playUrl);
        configureShakaStreaming(player);

        const uiOverlay = configureShakaUi(player, uiContainer, video, shaka);
        injectShakaAudioVersionButton({
            uiContainer,
            episodes,
            activeEpisode,
            onSelectServer,
        });

        await player.load(playUrl);
        return { video, player, uiOverlay };
    } catch (err) {
        console.warn("Lỗi tải Shaka Player trong phòng xem chung:", err);
        onFallback();
        return null;
    }
};

const enableSeekBarForHost = (range, container, controlsContainer, video, onBroadcastPlaybackRef) => {
    try {
        Object.defineProperty(range, "disabled", {
            get: () => false,
            set: () => {},
            configurable: true,
        });
    } catch {
        range.disabled = false;
    }

    range.style.pointerEvents = "auto";
    range.removeAttribute("title");

    if (container) {
        container.classList.remove("pointer-events-none", "opacity-40", "cursor-not-allowed");
        container.classList.add("pointer-events-auto");
        container.style.pointerEvents = "auto";
        container.removeAttribute("title");
    }
    if (controlsContainer) {
        controlsContainer.setAttribute("can-seek", "true");
    }

    if (!range._hasWatchPartySeekListener) {
        range._hasWatchPartySeekListener = true;
        const handleSeekInput = (e) => {
            const targetVal = Number(e.target.value);
            if (!Number.isNaN(targetVal) && video) {
                video.currentTime = targetVal;
                if (onBroadcastPlaybackRef?.current) {
                    onBroadcastPlaybackRef.current(!video.paused, targetVal);
                }
            }
        };
        range.addEventListener("input", handleSeekInput);
        range.addEventListener("change", handleSeekInput);
    }
};

const disableSeekBarForViewer = (range, container) => {
    try {
        Object.defineProperty(range, "disabled", {
            get: () => true,
            set: () => {},
            configurable: true,
        });
    } catch {
        range.disabled = true;
    }

    range.style.pointerEvents = "none";
    range.setAttribute("title", "Chỉ Trưởng phòng mới được phép tua video");

    if (container) {
        container.classList.add("pointer-events-none", "opacity-40", "cursor-not-allowed");
        container.classList.remove("pointer-events-auto");
        container.style.pointerEvents = "none";
        container.setAttribute("title", "Chỉ Trưởng phòng mới được phép tua video");
    }
};

const updateSeekBarPermission = (playerDiv, canControl, onBroadcastPlaybackRef) => {
    if (!playerDiv) return;
    const range = playerDiv.querySelector(".shaka-seek-bar-container input") || playerDiv.querySelector(".shaka-range-element");
    const container = playerDiv.querySelector(".shaka-seek-bar-container");
    const controlsContainer = playerDiv.querySelector(".shaka-controls-container");
    const video = playerDiv.querySelector("video");

    if (!range) return;

    if (canControl) {
        enableSeekBarForHost(range, container, controlsContainer, video, onBroadcastPlaybackRef);
    } else {
        disableSeekBarForViewer(range, container);
    }
};

/**
 * Gắn các listeners đồng bộ phát sóng và video tracking (Skip Intro, Autoplay, Timeupdate)
 */
const attachVideoSyncListeners = ({
    playerDiv,
    video,
    canControlRef,
    onBroadcastPlaybackRef,
    skipIntroEnabledRef,
    introDurationRef,
    autoplayEnabledRef,
    setShowNextCountdown,
    setCountdownSeconds,
    COUNTDOWN_DURATION,
    setCurrentVideoTime,
}) => {
    let introSkipped = false;

    const handleReady = () => {
        updateSeekBarPermission(playerDiv, canControlRef.current, onBroadcastPlaybackRef);
    };

    const handlePlay = () => {
        handleReady();
        if (canControlRef.current && onBroadcastPlaybackRef.current) {
            onBroadcastPlaybackRef.current(true, video.currentTime);
        }
    };

    const handlePause = () => {
        if (canControlRef.current && onBroadcastPlaybackRef.current) {
            onBroadcastPlaybackRef.current(false, video.currentTime);
        }
    };

    const handleSeeked = () => {
        if (canControlRef.current && onBroadcastPlaybackRef.current) {
            onBroadcastPlaybackRef.current(!video.paused, video.currentTime);
        }
    };

    const handleTimeUpdate = () => {
        setCurrentVideoTime(video.currentTime);

        const isSkipActive = canControlRef.current && skipIntroEnabledRef?.current && !introSkipped;
        const introLimit = introDurationRef?.current || 0;
        if (isSkipActive && video.currentTime < introLimit) {
            video.currentTime = introLimit;
            introSkipped = true;
            if (onBroadcastPlaybackRef.current) {
                onBroadcastPlaybackRef.current(true, introLimit);
            }
        }
    };

    const handleEnded = () => {
        if (canControlRef.current && autoplayEnabledRef?.current) {
            setShowNextCountdown(true);
            setCountdownSeconds(COUNTDOWN_DURATION);
        }
    };

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("seeked", handleSeeked);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("canplay", handleReady);
    video.addEventListener("loadedmetadata", handleReady);

    return () => {
        video.removeEventListener("play", handlePlay);
        video.removeEventListener("pause", handlePause);
        video.removeEventListener("seeked", handleSeeked);
        video.removeEventListener("timeupdate", handleTimeUpdate);
        video.removeEventListener("ended", handleEnded);
        video.removeEventListener("canplay", handleReady);
        video.removeEventListener("loadedmetadata", handleReady);
    };
};

/**
 * Hook cập nhật nút chuyển bản âm thanh khi danh sách server thay đổi
 */
const useWatchPartyAudioButton = ({
    playerRef,
    shakaUiOverlayRef,
    episodes,
    activeEpisode,
    onSelectServer,
}) => {
    useEffect(() => {
        if (!shakaUiOverlayRef.current || !Array.isArray(episodes) || episodes.length <= 1) return;
        const uiContainer = playerRef.current?.querySelector(".shaka-video-container");
        if (uiContainer) {
            injectShakaAudioVersionButton({
                uiContainer,
                episodes,
                activeEpisode,
                onSelectServer,
            });
        }
    }, [episodes, activeEpisode, onSelectServer, playerRef, shakaUiOverlayRef]);
};

/**
 * Hook kế thừa đầy đủ mọi tính năng trình phát từ VodPlay cho WatchParty
 */
export const useWatchPartyPlayer = ({
    room,
    canControl,
    onBroadcastPlayback,
    changeEpisode,
}) => {
    const [currentVideoTime, setCurrentVideoTime] = useState(0);
    const [hasInteracted, setHasInteracted] = useState(false);
    const [useEmbedFallback, setUseEmbedFallback] = useState(false);
    const [playerDivNode, setPlayerDivNode] = useState(null);

    const playerRef = useCallback((node) => {
        playerRef.current = node;
        setPlayerDivNode(node);
    }, []);
    playerRef.current = playerDivNode;

    const currentUrlRef = useRef(null);
    const shakaPlayerRef = useRef(null);
    const shakaUiOverlayRef = useRef(null);

    const canControlRef = useRef(canControl);
    canControlRef.current = canControl;
    const onBroadcastPlaybackRef = useRef(onBroadcastPlayback);
    onBroadcastPlaybackRef.current = onBroadcastPlayback;

    const movieSlug = room?.movie?.slug;
    const currentEpisode = room?.episode;
    const m3u8Url = currentEpisode?.link_m3u8;

    const { episodes, activeEpisode, setActiveEpisode } = useWatchPartyMovieEpisodes(movieSlug, currentEpisode);
    const { playNextEpisode, playPrevEpisode, currentEpisodeId } = useWatchPartyEpisodeNavigation({
        episodes, activeEpisode, currentEpisode, canControl, changeEpisode,
    });

    const settings = useWatchPartyPlayerSettings(movieSlug, playNextEpisode);

    useVideoKeyboardShortcuts({
        showImageModal: false, showShareModal: false, playerRef, playNextEpisode, playPrevEpisode,
    });

    useEffect(() => {
        setUseEmbedFallback(false);
    }, [m3u8Url]);

    const handleSelectServerGroup = useCallback((serverGroup) => {
        setActiveEpisode(serverGroup);
        if (!canControlRef.current || !changeEpisode) return;

        const matchedEp = serverGroup?.server_data?.find(
            (ep) => ep.slug === currentEpisode?.slug || ep.name === currentEpisode?.name
        ) || serverGroup?.server_data?.[0];

        if (matchedEp) {
            changeEpisode({ ...matchedEp, server_name: serverGroup.server_name });
        }
    }, [currentEpisode, changeEpisode, setActiveEpisode]);

    useWatchPartyAudioButton({
        playerRef, shakaUiOverlayRef, episodes, activeEpisode, onSelectServer: handleSelectServerGroup,
    });

    useEffect(() => {
        const playerDiv = playerDivNode || playerRef.current;
        if (!playerDiv || !m3u8Url || useEmbedFallback) return;

        let isCancelled = false;
        let detachListeners = null;

        const setup = async () => {
            await cleanupShakaInstances(shakaPlayerRef, shakaUiOverlayRef);
            if (isCancelled) return;

            const mounted = await mountShakaUiPlayer({
                playerDiv,
                movie: room?.movie,
                playUrl: m3u8Url,
                episodes,
                activeEpisode,
                onSelectServer: handleSelectServerGroup,
                onFallback: () => {
                    if (!isCancelled && room?.episode?.link_embed) {
                        setUseEmbedFallback(true);
                    }
                },
            });

            if (isCancelled || !mounted) {
                if (mounted?.uiOverlay) mounted.uiOverlay.destroy().catch(() => {});
                if (mounted?.player) mounted.player.destroy().catch(() => {});
                return;
            }

            const { video, player, uiOverlay } = mounted;
            shakaPlayerRef.current = player;
            shakaUiOverlayRef.current = uiOverlay;
            currentUrlRef.current = m3u8Url;

            const initialSyncTime = calculateSynchronizedTime(room?.playback);
            if (initialSyncTime > 0) {
                video.currentTime = initialSyncTime;
            }
            if (room?.playback?.isPlaying) {
                video.play().catch(() => {});
            }

            updateSeekBarPermission(playerDiv, canControlRef.current, onBroadcastPlaybackRef);

            detachListeners = attachVideoSyncListeners({
                playerDiv,
                video,
                canControlRef,
                onBroadcastPlaybackRef,
                skipIntroEnabledRef: settings.skipIntroEnabledRef,
                introDurationRef: settings.introDurationRef,
                autoplayEnabledRef: settings.autoplayEnabledRef,
                setShowNextCountdown: settings.setShowNextCountdown,
                setCountdownSeconds: settings.setCountdownSeconds,
                COUNTDOWN_DURATION: settings.COUNTDOWN_DURATION,
                setCurrentVideoTime,
            });
        };

        setup();

        return () => {
            isCancelled = true;
            if (detachListeners) detachListeners();
            cleanupShakaInstances(shakaPlayerRef, shakaUiOverlayRef);
        };
    }, [playerDivNode, m3u8Url, useEmbedFallback]);

    // Đồng bộ quyền kéo tua (Seek Bar) theo quyền hạn Trưởng phòng / Thành viên
    useEffect(() => {
        const playerDiv = playerDivNode || playerRef.current;
        updateSeekBarPermission(playerDiv, canControl, onBroadcastPlaybackRef);

        const video = playerDiv?.querySelector("video");
        if (!video) return;

        const handleReady = () => updateSeekBarPermission(playerDiv, canControlRef.current, onBroadcastPlaybackRef);
        video.addEventListener("loadedmetadata", handleReady);
        video.addEventListener("canplay", handleReady);
        video.addEventListener("playing", handleReady);

        return () => {
            video.removeEventListener("loadedmetadata", handleReady);
            video.removeEventListener("canplay", handleReady);
            video.removeEventListener("playing", handleReady);
        };
    }, [playerDivNode, canControl]);

    const handleSeekStep = (deltaSeconds) => {
        const video = document.getElementById("shaka-video") || document.querySelector("video");
        if (video && canControlRef.current) {
            const nextTime = Math.max(0, Math.min(video.duration || Infinity, video.currentTime + deltaSeconds));
            video.currentTime = nextTime;
            if (onBroadcastPlaybackRef.current) {
                onBroadcastPlaybackRef.current(!video.paused, nextTime);
            }
        }
    };

    const handleSeekToTimestamp = (seconds) => {
        const video = document.getElementById("shaka-video") || document.querySelector("video");
        if (video && canControlRef.current) {
            video.currentTime = seconds;
            if (onBroadcastPlaybackRef.current) {
                onBroadcastPlaybackRef.current(!video.paused, seconds);
            }
        }
    };

    const handleStartPlayback = () => {
        setHasInteracted(true);
        const video = document.getElementById("shaka-video") || document.querySelector("video");
        video?.play().catch(() => {});
    };

    const effectiveEpisode = useEmbedFallback && room?.episode?.link_embed
        ? { ...room.episode, link_m3u8: null }
        : room?.episode;

    return {
        playerRef: useEmbedFallback ? null : playerRef,
        currentUrlRef,
        currentVideoTime,
        hasInteracted,
        effectiveEpisode,
        episodes,
        activeEpisode,
        currentEpisodeId,
        playNextEpisode,
        playPrevEpisode,
        handleCastTV: () => handleCastTV(m3u8Url),
        togglePiP,
        handleSeekToTimestamp,
        handleSeekStep,
        handleStartPlayback,
        ...settings,
    };
};
