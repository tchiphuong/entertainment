import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { SOURCES } from "../../constants";
import { useMovieDetail } from "../useMovieDetail";
import { vodService } from "../../services/vod/vodService";
import {
    getEpisodeKey,
    normalizeKey,
    serverNameToSlug,
    computeLastWatchedPosition,
    buildWatchlistPayload,
    isWatchlistHistoryMatch,
    syncWatchlistLocalState,
    syncWatchlistToFirestore,
    getNextEpisodeData,
    getPrevEpisodeData,
    findTargetEpisodeAndServer,
    findTargetEpisodeFromHistory,
    findBestServerTab,
    createShakaPlayerVideo,
    configureShakaUi,
    injectShakaAudioVersionButton,
    restoreVideoPosition,
    setupVideoTracking,
    destroyAllPlayersHelper,
    ensureYoutubeEmbedUrl,
    extractTmdbIdFromObject,
    updateWatchHistory,
    registerShakaNetworkFilter,
    registerShakaUriResolver,
} from "../../utils/vodPlayHelpers";
import { dedupeHistory, addHistoryToFirestore } from "../../services/firebaseHelpers";
import shaka from "shaka-player/dist/shaka-player.ui.js";

export function useLocalStorage(key, initial) {
    const [state, setState] = useState(() => {
        try {
            const v = localStorage.getItem(key);
            return v ? JSON.parse(v) : initial;
        } catch (e) {
            console.warn(`Error reading localStorage key "${key}":`, e);
            return initial;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(state));
        } catch (e) {
            console.warn(`Error setting localStorage key "${key}":`, e);
        }
    }, [key, state]);

    return [state, setState];
}

export const useVodPlayRouteParams = () => {
    const params = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const querySlug = searchParams.get("slug");
    const slug = params.slug || querySlug || "";
    const wildcard = params["*"] || "";

    let idParam = searchParams.get("id");
    let typeParam = searchParams.get("type");
    let seasonParam = searchParams.get("season");

    if (wildcard) {
        const subParams = new URLSearchParams(wildcard);
        if (!typeParam && subParams.has("type")) typeParam = subParams.get("type");
        if (!seasonParam && subParams.has("season")) seasonParam = subParams.get("season");
        if (!idParam && subParams.has("id")) idParam = subParams.get("id");
    }

    const episodeParam = searchParams.get("episode");
    const serverParam = searchParams.get("server");
    const sourceParam = searchParams.get("source") || SOURCES.SOURCE_K;
    return {
        slug,
        idParam,
        typeParam,
        seasonParam,
        episodeParam,
        serverParam,
        sourceParam,
        searchParams,
        setSearchParams,
    };
};

export const useVodPlayCountdown = (playNextEpisode) => {
    const COUNTDOWN_DURATION = 5;
    const [showNextCountdown, setShowNextCountdown] = useState(false);
    const [countdownSeconds, setCountdownSeconds] = useState(5);

    useEffect(() => {
        if (!showNextCountdown) return;

        const timer = setInterval(() => {
            setCountdownSeconds((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setShowNextCountdown(false);
                    setTimeout(playNextEpisode, 0);
                    return COUNTDOWN_DURATION;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [showNextCountdown, playNextEpisode]);

    const cancelCountdown = useCallback(() => {
        setShowNextCountdown(false);
        setCountdownSeconds(COUNTDOWN_DURATION);
    }, []);

    const skipCountdown = useCallback(() => {
        setShowNextCountdown(false);
        setCountdownSeconds(COUNTDOWN_DURATION);
        playNextEpisode();
    }, [playNextEpisode]);

    return {
        showNextCountdown,
        setShowNextCountdown,
        countdownSeconds,
        setCountdownSeconds,
        COUNTDOWN_DURATION,
        cancelCountdown,
        skipCountdown,
    };
};

export const useVodPlayState = () => {
    const [movie, setMovie] = useState(null);
    const [episodes, setEpisodes] = useState([]);
    const [activeEpisode, setActiveEpisode] = useState(null);
    const [currentEpisodeId, setCurrentEpisodeId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState(null);
    const [tmdbData, setTmdbData] = useState(null);
    const [tmdbCredits, setTmdbCredits] = useState(null);
    const [tmdbImages, setTmdbImages] = useState(null);
    const [tmdbVideos, setTmdbVideos] = useState(null);
    const [tmdbRelated, setTmdbRelated] = useState([]);
    const [imdbEpisodes, setImdbEpisodes] = useState([]);
    const [viewHistory, setViewHistory] = useLocalStorage("viewHistory", []);
    const [favorites, setFavorites] = useLocalStorage("favorites", []);
    const [autoplayEnabled, setAutoplayEnabled] = useLocalStorage("autoplayEnabled", true);
    const [seasons, setSeasons] = useState([]);

    return {
        movie, setMovie,
        episodes, setEpisodes,
        activeEpisode, setActiveEpisode,
        currentEpisodeId, setCurrentEpisodeId,
        isLoading, setIsLoading,
        errorMessage, setErrorMessage,
        tmdbData, setTmdbData,
        tmdbCredits, setTmdbCredits,
        tmdbImages, setTmdbImages,
        tmdbVideos, setTmdbVideos,
        tmdbRelated, setTmdbRelated,
        imdbEpisodes, setImdbEpisodes,
        viewHistory, setViewHistory,
        favorites, setFavorites,
        autoplayEnabled, setAutoplayEnabled,
        seasons, setSeasons,
    };
};

export const useVodPlayCompactView = () => {
    const [isCompactView, setIsCompactView] = useLocalStorage("isCompactView", null);
    useEffect(() => {
        if (isCompactView === null && typeof window !== "undefined") {
            setIsCompactView(window.innerWidth < 768);
        }
    }, [isCompactView, setIsCompactView]);
    return { isCompactView, setIsCompactView };
};

export const useVodPlayIntroSettings = (slug) => {
    const DEFAULT_INTRO_DURATION = 0;
    const [skipIntroEnabled, setSkipIntroEnabled] = useLocalStorage("skipIntroEnabled", false);
    const skipIntroEnabledRef = useRef(skipIntroEnabled);
    const [introDurations, setIntroDurations] = useLocalStorage("introDurations", {});
    const [introDuration, setIntroDuration] = useState(DEFAULT_INTRO_DURATION);
    const introDurationRef = useRef(introDuration);

    useEffect(() => {
        skipIntroEnabledRef.current = skipIntroEnabled;
    }, [skipIntroEnabled]);

    useEffect(() => {
        introDurationRef.current = introDuration;
    }, [introDuration]);

    useEffect(() => {
        if (slug) {
            const cleanSlug = slug.split("?")[0];
            const savedDuration = introDurations[cleanSlug];
            setIntroDuration(savedDuration || DEFAULT_INTRO_DURATION);
        }
    }, [slug, introDurations]);

    return {
        skipIntroEnabled, setSkipIntroEnabled, skipIntroEnabledRef,
        introDurations, setIntroDurations, introDuration, setIntroDuration, introDurationRef,
    };
};

export const useVodPlaySyncRefs = ({ autoplayEnabled, episodes, activeEpisode, currentEpisodeId, movie }) => {
    const autoplayEnabledRef = useRef(autoplayEnabled);
    const episodesRef = useRef(episodes);
    const activeEpisodeRef = useRef(activeEpisode);
    const currentEpisodeIdRef = useRef(currentEpisodeId);
    const movieRef = useRef(movie);

    useEffect(() => {
        autoplayEnabledRef.current = autoplayEnabled;
    }, [autoplayEnabled]);
    useEffect(() => {
        episodesRef.current = episodes;
    }, [episodes]);
    useEffect(() => {
        activeEpisodeRef.current = activeEpisode;
    }, [activeEpisode]);
    useEffect(() => {
        currentEpisodeIdRef.current = currentEpisodeId;
    }, [currentEpisodeId]);
    useEffect(() => {
        movieRef.current = movie;
    }, [movie]);

    return { autoplayEnabledRef, episodesRef, activeEpisodeRef, currentEpisodeIdRef, movieRef };
};

export const useVodPlayDetailSync = ({
    slug,
    sourceParam,
    idParam = null,
    typeParam = null,
    seasonParam = null,
    setMovie,
    setEpisodes,
    setActiveEpisode,
    setTmdbData,
    setTmdbCredits,
    setTmdbImages,
    setTmdbVideos,
    setTmdbRelated,
    setIsLoading,
    setMemoizedBackgrounds,
    setSeasons,
}) => {
    const {
        movie: fetchedMovie,
        episodes: fetchedEpisodes,
        loading: movieLoading,
        tmdbData: fetchedTmdbData,
        tmdbCredits: fetchedTmdbCredits,
        tmdbImages: fetchedTmdbImages,
        tmdbVideos: fetchedTmdbVideos,
        tmdbRelated: fetchedTmdbRelated,
        seasons: fetchedSeasons,
    } = useMovieDetail(slug, sourceParam, idParam, typeParam, seasonParam);

    useEffect(() => {
        setIsLoading(movieLoading);
    }, [movieLoading, setIsLoading]);

    useEffect(() => {
        if (setSeasons && fetchedSeasons) {
            setSeasons(fetchedSeasons);
        }
    }, [fetchedSeasons, setSeasons]);

    useEffect(() => {
        if (fetchedMovie) {
            setMovie(fetchedMovie);
            setMemoizedBackgrounds((prev) => {
                if (prev) return prev;
                return {
                    poster_url: fetchedMovie.poster_url || "",
                    thumb_url: fetchedMovie.thumb_url || "",
                };
            });
        }
        if (fetchedEpisodes && fetchedEpisodes.length > 0) {
            setEpisodes(fetchedEpisodes);
            setActiveEpisode((prev) => {
                if (!prev) return fetchedEpisodes[0];
                const matchedServer = fetchedEpisodes.find(
                    (s) => s.server_name === prev.server_name
                );
                return matchedServer || fetchedEpisodes[0];
            });
        }
    }, [fetchedMovie, fetchedEpisodes, setMovie, setEpisodes, setActiveEpisode, setMemoizedBackgrounds]);

    useEffect(() => {
        setTmdbData(fetchedTmdbData);
        setTmdbCredits(fetchedTmdbCredits);
        setTmdbImages(fetchedTmdbImages);
        setTmdbVideos(fetchedTmdbVideos);
        if (fetchedTmdbRelated) {
            setTmdbRelated(fetchedTmdbRelated);
        }
    }, [fetchedTmdbData, fetchedTmdbCredits, fetchedTmdbImages, fetchedTmdbVideos, fetchedTmdbRelated, setTmdbData, setTmdbCredits, setTmdbImages, setTmdbVideos, setTmdbRelated]);

    return { fetchedTmdbVideos };
};

export const useVodPlayerManagement = ({
    movie, slug, serverParam, episodeParam, activeEpisode, setActiveEpisode,
    currentEpisodeId, setCurrentEpisodeId, episodesRef, currentEpisodeIdRef, activeEpisodeRef, movieRef,
    hasInitializedRef, positionRestoredRef, currentUrlRef, playerRef, memoizedBackgrounds,
    introDurationRef, skipIntroEnabledRef, autoplayEnabledRef, setShowNextCountdown, setCountdownSeconds,
    COUNTDOWN_DURATION, setErrorMessage, setSearchParams, fetchedTmdbVideos, viewHistory,
    viewHistoryRef, setViewHistory, lastHistorySyncRef, currentUser, lastFirestoreSyncRef, formatEpisodeName,
}) => {
    const shakaPlayerRef = useRef(null);
    const shakaUiOverlayRef = useRef(null);
    const activeVideoElementRef = useRef(null);
    const embedTimerRef = useRef(null);

    const destroyAllPlayers = async () => {
        if (embedTimerRef.current) {
            clearInterval(embedTimerRef.current);
            embedTimerRef.current = null;
        }
        await destroyAllPlayersHelper(activeVideoElementRef, shakaUiOverlayRef, shakaPlayerRef, currentUrlRef);
    };

    useEffect(() => {
        destroyAllPlayers();
    }, [slug]);

    useEffect(() => {
        return () => {
            if (embedTimerRef.current) {
                clearInterval(embedTimerRef.current);
                embedTimerRef.current = null;
            }
        };
    }, []);

    const setupEmbedPlayer = async (embedUrl, episodeSlug, serverName = "") => {
        await destroyAllPlayers();
        const playerDiv = playerRef.current;
        if (!playerDiv) return;

        playerDiv.innerHTML = "";
        const formattedUrl = ensureYoutubeEmbedUrl(embedUrl);
        const iframe = document.createElement("iframe");
        iframe.src = formattedUrl;
        iframe.className = "w-full h-full rounded-xl shadow-2xl object-contain";
        iframe.style.cssText = "border:none;";
        iframe.allowFullscreen = true;
        iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
        iframe.referrerPolicy = "strict-origin-when-cross-origin";
        // Chặn quảng cáo/popup từ embed player (Source C - streamc.xyz)
        // allow-popups: bypass anti-adblock detection (popup bị sandbox, opaque origin → vô hại)
        // KHÔNG cấp allow-popups-to-escape-sandbox → popup không thoát được sandbox
        iframe.sandbox = "allow-scripts allow-same-origin allow-forms allow-fullscreen allow-popups";

        playerDiv.appendChild(iframe);
        const episodeKey = String(getEpisodeKey(episodeSlug, serverName));
        setCurrentEpisodeId(episodeKey);
        currentUrlRef.current = formattedUrl;

        let currentPos = getLastWatchedPosition(episodeSlug, serverName) || 0;
        embedTimerRef.current = setInterval(() => {
            currentPos += 10;
            setWatchlist(episodeSlug, currentPos, { name: serverName, server_name: serverName }, movie);
        }, 10000);
    };

    const getLastWatchedPosition = useCallback((episodeSlug, episodeName = "") => {
        return computeLastWatchedPosition(episodeSlug, episodeName, viewHistory, slug, movie);
    }, [viewHistory, slug, movie]);

    const setWatchlist = (episodeSlug, position = null, episode = null, targetMovie = {}) => {
        const episodeName = episode?.name || episode?.server_name || "";
        const episodeKeyRaw = getEpisodeKey(episodeSlug, episodeName);
        const episodeKey = normalizeKey(episodeKeyRaw);

        if (episodeKey === null || episodeKey === undefined) return;

        const routeSlug = slug.split("?")[0];
        const canonicalSlug = (targetMovie?.slug && !targetMovie.slug.startsWith("tmdb-")) ? targetMovie.slug : routeSlug;
        const targetTmdbId = extractTmdbIdFromObject(targetMovie, routeSlug);

        const { movieName, payload } = buildWatchlistPayload({
            movie: targetMovie, episode, serverParam, canonicalSlug, targetTmdbId,
            getMovieImage: (p) => p, formatEpisodeValue: (tot, name, k, slg) => String(k || slg),
            episodeKey, episodeSlug, position,
        });

        const history = Array.isArray(viewHistory) ? [...viewHistory] : [];
        const movieIndex = history.findIndex((item) =>
            isWatchlistHistoryMatch(item, routeSlug, canonicalSlug, targetTmdbId, movieName, targetMovie)
        );

        const updatedHistory = dedupeHistory(updateWatchHistory(history, movieIndex, payload));
        syncWatchlistLocalState(updatedHistory, viewHistoryRef, lastHistorySyncRef, setViewHistory);
        syncWatchlistToFirestore(currentUser, updatedHistory, lastFirestoreSyncRef, addHistoryToFirestore);
    };

const tryLoadSingleBackup = async (player, backupUrl, setupEmbedPlayer, episodeSlug, serverName) => {
    if ([".m3u8", ".mpd", ".m3u9"].some((ext) => backupUrl.includes(ext))) {
        try {
            await player.load(backupUrl);
            return { success: true, url: backupUrl };
        } catch {
            return { success: false };
        }
    }
    await setupEmbedPlayer(backupUrl, episodeSlug, serverName);
    return { success: true, url: backupUrl };
};

const tryLoadBackups = async (player, backups, masterUrl, setupEmbedPlayer, episodeSlug, serverName) => {
    if (!backups || backups.length === 0) return false;
    // 1. Luôn ưu tiên thử tất cả link m3u8 trước (ưu tiên phát Shaka Player mượt mà, không quảng cáo)
    for (const backup of backups) {
        const backupUrl = backup.link_m3u8;
        if (backupUrl && backupUrl !== masterUrl) {
            const res = await tryLoadSingleBackup(player, backupUrl, setupEmbedPlayer, episodeSlug, serverName);
            if (res.success) return true;
        }
    }
    // 2. Fallback sang link embed (như Source C) khi không có m3u8 nào hoạt động
    for (const backup of backups) {
        const backupUrl = backup.link_embed;
        if (backupUrl && backupUrl !== masterUrl) {
            const res = await tryLoadSingleBackup(player, backupUrl, setupEmbedPlayer, episodeSlug, serverName);
            if (res.success) return true;
        }
    }
    return false;
};

    const handleShakaSuccess = ({ video, uiContainer, masterUrl, episodeSlug, serverName, movieData }) => {
        currentUrlRef.current = masterUrl;

        injectShakaAudioVersionButton({
            uiContainer,
            episodes: episodesRef?.current || [],
            activeEpisode: activeEpisodeRef?.current || activeEpisode,
            onSelectServer: switchTab,
        });

        const episodeKey = String(getEpisodeKey(episodeSlug, serverName));
        setCurrentEpisodeId(episodeKey);

        const lastPosition = getLastWatchedPosition(episodeSlug, serverName);
        restoreVideoPosition(video, lastPosition, episodeKey, positionRestoredRef);

        setupVideoTracking({
            video, episodeSlug, serverName, movie: movieData, setWatchlist,
            introDurationRef, skipIntroEnabledRef, autoplayEnabledRef,
            setShowNextCountdown, setCountdownSeconds, COUNTDOWN_DURATION,
        });
    };

    const handleShakaError = async (player, error, fallbackUrl, backups, masterUrl, episodeSlug, serverName) => {
        console.error("Shaka Player load error:", error);
        const backupLoaded = await tryLoadBackups(player, backups, masterUrl, setupEmbedPlayer, episodeSlug, serverName);
        if (backupLoaded) return;

        if (fallbackUrl) {
            await setupEmbedPlayer(fallbackUrl, episodeSlug, serverName);
            return;
        }
        setErrorMessage("Không thể phát video này. Vui lòng thử lại sau hoặc đổi nguồn khác.");
    };

    const setupShakaPlayer = async (masterUrl, episodeSlug, serverName, movieData, fallbackUrl = null, _backups = []) => {
        const playerDiv = playerRef.current;
        if (!playerDiv) return;

        await destroyAllPlayers();
        const { video, uiContainer } = createShakaPlayerVideo(playerDiv, movieData, memoizedBackgrounds);
        activeVideoElementRef.current = video;

        const player = new shaka.Player();
        await player.attach(video);
        shakaPlayerRef.current = player;
        registerShakaNetworkFilter(player);
        registerShakaUriResolver(player, masterUrl);

        shakaUiOverlayRef.current = configureShakaUi(player, uiContainer, video, shaka);

        try {
            await player.load(masterUrl);
            handleShakaSuccess({ video, uiContainer, masterUrl, episodeSlug, serverName, movieData });
        } catch (error) {
            await handleShakaError(player, error, fallbackUrl, _backups, masterUrl, episodeSlug, serverName);
        }
    };

const resolveMasterPlayUrl = (server) => {
    if (server.link_m3u8) return server.link_m3u8;
    const m3u8Backup = server.backups?.find((b) => b.link_m3u8);
    if (m3u8Backup?.link_m3u8) return m3u8Backup.link_m3u8;
    return server.link_embed || null;
};

const resolveTrailerEmbedUrl = (movieData, fetchedTmdbVideos) => {
    if (movieData?.trailer_url) return ensureYoutubeEmbedUrl(movieData.trailer_url);
    if (!fetchedTmdbVideos || fetchedTmdbVideos.length === 0) return null;
    const trailer = fetchedTmdbVideos.find(
        (v) => ["Trailer", "Teaser"].includes(v.type) && v.site === "YouTube"
    );
    return trailer?.key ? ensureYoutubeEmbedUrl(`https://www.youtube.com/watch?v=${trailer.key}`) : null;
};

    const playFallbackTrailer = async (movieData, episodeSlug) => {
        const trailerUrl = resolveTrailerEmbedUrl(movieData, fetchedTmdbVideos);
        if (trailerUrl) {
            await setupEmbedPlayer(trailerUrl, episodeSlug, "Trailer");
            return true;
        }
        return false;
    };

    const initializePlayer = async (server, episodeSlug, movieData) => {
        setErrorMessage(null);
        const masterUrl = resolveMasterPlayUrl(server);
        const embedFallback = server.link_embed || server.backups?.find((b) => b.link_embed)?.link_embed;

        if (!masterUrl) {
            const hasTrailer = await playFallbackTrailer(movieData, episodeSlug);
            if (!hasTrailer) setErrorMessage("Không có link phát.");
            return;
        }

        if (currentUrlRef.current === masterUrl) return;

        if ([".m3u8", ".mpd", ".m3u9"].some((ext) => masterUrl.includes(ext))) {
            await setupShakaPlayer(masterUrl, episodeSlug, server.name, movieData, embedFallback, server.backups || []);
        } else {
            const embedUrl = ensureYoutubeEmbedUrl(masterUrl);
            await setupEmbedPlayer(embedUrl, episodeSlug, server.name);
        }
    };

    const openEpisode = (server, episode, movieData) => {
        if (!server || !episode) return;
        const targetMovie = movieData || movieRef?.current || movie;
        if (targetMovie?.name) {
            const episodeName = server.name || "Trailer";
            document.title = `[${formatEpisodeName(episodeName)}] ${targetMovie.name} • VOD Player`;
        }

        positionRestoredRef.current = null;
        setWatchlist(server.slug, null, server, targetMovie);

        try {
            const episodeKey = getEpisodeKey(server.slug, server.name);
            setCurrentEpisodeId(String(episodeKey));
            if (currentEpisodeIdRef) currentEpisodeIdRef.current = String(episodeKey);
        } catch (e) {
            console.warn("Failed to update episode state:", e);
        }

        currentUrlRef.current = null;
        initializePlayer(server, server.slug, targetMovie);

        const serverSlug = serverNameToSlug(episode.server_name);
        try {
            const episodeKey = getEpisodeKey(server.slug, server.name);
            setSearchParams(
                (prev) => {
                    const newParams = new URLSearchParams(prev);
                    newParams.delete("slug");
                    newParams.set("server", serverSlug);
                    newParams.set("episode", String(episodeKey));
                    return newParams;
                },
                { replace: true }
            );
        } catch (e) {
            console.warn("Failed to update URL parameters:", e);
        }
    };

    const switchTab = (episode) => {
        if (!episode) return;
        setActiveEpisode(episode);
        if (activeEpisodeRef) activeEpisodeRef.current = episode;
        const currentMovie = movieRef?.current || movie;
        const targetServer = findBestServerTab(
            episode,
            activeEpisodeRef?.current || activeEpisode,
            slug,
            () => viewHistoryRef?.current || viewHistory || [],
            currentEpisodeIdRef?.current || currentEpisodeId,
            episodeParam
        );

        if (targetServer) {
            openEpisode(targetServer, episode, currentMovie);
        } else if (episode.server_data?.length > 0) {
            openEpisode(episode.server_data[0], episode, currentMovie);
        } else {
            setErrorMessage("Không tìm thấy nguồn phát tương ứng.");
        }
    };

    const initializeFromUrl = (episodesList, currentMovie) => {
        if (hasInitializedRef.current) return;

        if (episodeParam) {
            const { targetEpisode, targetServer } = findTargetEpisodeAndServer(
                episodesList, episodeParam, serverParam, slug, viewHistory || []
            );

            if (targetEpisode && targetServer) {
                hasInitializedRef.current = true;
                setActiveEpisode(targetEpisode);
                openEpisode(targetServer, targetEpisode, currentMovie);
                return;
            }
        }

        const { targetEpisode, targetServer, episodeKey } = findTargetEpisodeFromHistory(
            episodesList, slug, viewHistory || [], currentMovie
        );

        if (targetEpisode && targetServer) {
            hasInitializedRef.current = true;
            setActiveEpisode(targetEpisode);
            openEpisode(targetServer, targetEpisode, currentMovie);

            if (episodeKey !== undefined && typeof window !== "undefined") {
                const params = new URLSearchParams();
                params.set("episode", episodeKey);
                params.set("server", serverNameToSlug(targetEpisode.server_name));
                window.history.replaceState({}, "", `?${params.toString()}`);
            }
        }
    };

    const playNextEpisode = () => {
        const episodesList = episodesRef.current || [];
        if (episodesList.length === 0) return;

        const targetData = getNextEpisodeData(episodesList, currentEpisodeIdRef.current, null, activeEpisodeRef.current);
        if (targetData) {
            if (targetData.setActive) setActiveEpisode(targetData.targetGroup);
            openEpisode(targetData.targetServer, targetData.targetGroup, movieRef.current);
        } else {
            setErrorMessage("Đã hết tập phim!");
            setTimeout(() => setErrorMessage(null), 3000);
        }
    };

    const playPrevEpisode = () => {
        const episodesList = episodesRef.current || [];
        if (episodesList.length === 0) return;

        const targetData = getPrevEpisodeData(episodesList, currentEpisodeIdRef.current, null, activeEpisodeRef.current);
        if (targetData) {
            if (targetData.setActive) setActiveEpisode(targetData.targetGroup);
            openEpisode(targetData.targetServer, targetData.targetGroup, movieRef.current);
        } else {
            setErrorMessage("Đây là tập đầu tiên!");
            setTimeout(() => setErrorMessage(null), 3000);
        }
    };

    return {
        playNextEpisode,
        playPrevEpisode,
        switchTab,
        openEpisode,
        initializeFromUrl,
        destroyAllPlayers,
    };
};

export const useVideoKeyboardShortcuts = ({
    showImageModal,
    showShareModal,
    playerRef,
    playNextEpisode,
    playPrevEpisode,
}) => {
    useEffect(() => {
        const handleVideoKeyDown = (e) => {
            if ([showImageModal, showShareModal].some(Boolean)) return;
            if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;

            const activeVideo = document.getElementById("hls-video") || document.getElementById("shaka-video");
            const togglePlay = () => {
                if (activeVideo) activeVideo.paused ? activeVideo.play() : activeVideo.pause();
            };

            const actions = {
                "j": () => { if (activeVideo) activeVideo.currentTime = Math.max(0, activeVideo.currentTime - 10); },
                "arrowleft": () => { if (activeVideo) activeVideo.currentTime = Math.max(0, activeVideo.currentTime - 10); },
                "l": () => { if (activeVideo) activeVideo.currentTime = Math.min(activeVideo.duration, activeVideo.currentTime + 10); },
                "arrowright": () => { if (activeVideo) activeVideo.currentTime = Math.min(activeVideo.duration, activeVideo.currentTime + 10); },
                " ": togglePlay,
                "k": togglePlay,
                "f": () => {
                    if (playerRef.current) {
                        !document.fullscreenElement ? playerRef.current.requestFullscreen() : document.exitFullscreen();
                    }
                },
                "m": () => { if (activeVideo) activeVideo.muted = !activeVideo.muted; },
                "n": () => playNextEpisode(),
                "p": () => playPrevEpisode(),
            };

            const key = e.code === "Space" ? " " : e.key.toLowerCase();
            const action = actions[key];
            if (action) {
                e.preventDefault();
                action();
            }
        };

        window.addEventListener("keydown", handleVideoKeyDown);
        return () => window.removeEventListener("keydown", handleVideoKeyDown);
    }, [showImageModal, showShareModal, playerRef, playNextEpisode, playPrevEpisode]);
};

export const usePlayerInitialization = ({
    movie,
    episodes,
    tmdbVideos,
    hasInitializedRef,
    initializeFromUrl,
    setEpisodes,
    setActiveEpisode,
    setErrorMessage,
    t,
}) => {
    useEffect(() => {
        if (movie && !hasInitializedRef.current) {
            if (episodes && episodes.length > 0) {
                initializeFromUrl(episodes, movie);
            } else if (tmdbVideos !== null && tmdbVideos !== undefined) {
                setErrorMessage(t("vodPlay.noPlayableLink") || "Không tìm thấy link xem phim");
            }
        }
    }, [movie, episodes, tmdbVideos, initializeFromUrl, setEpisodes, setActiveEpisode, setErrorMessage, t, hasInitializedRef]);
};

export const useMediaSession = (movie, currentEpisodeId, memoizedBackgrounds) => {
    useEffect(() => {
        if (!movie || !("mediaSession" in navigator)) return;

        const posterUrl = memoizedBackgrounds?.poster_url || movie.poster_url || "";
        navigator.mediaSession.metadata = new MediaMetadata({
            title: movie.name + (currentEpisodeId ? ` - Tập ${currentEpisodeId}` : ""),
            artist: "Entertainment VOD",
            album: movie.origin_name || movie.name,
            artwork: [{ src: posterUrl, sizes: "512x512", type: "image/jpeg" }],
        });
    }, [movie, currentEpisodeId, memoizedBackgrounds]);
};

export const useSeasonDetection = (movie) => {
    const [detectedSeason, setDetectedSeason] = useState(1);

    useEffect(() => {
        if (movie) {
            const seasonFromApi = movie.tmdb?.season || movie.season;
            if (seasonFromApi) {
                setDetectedSeason(Number.parseInt(seasonFromApi));
            } else if (movie.name) {
                const match = new RegExp(/(?:Phần|Season|P|S|Part)\s*(\d+)/i).exec(String(movie.name || ""));
                if (match?.[1]) {
                    setDetectedSeason(Number.parseInt(match[1]));
                }
            }
        }
    }, [movie]);

    return detectedSeason;
};

export const useFirestoreHistorySync = (currentUser, setViewHistory, fetchHistoryFromFirestore) => {
    useEffect(() => {
        if (currentUser) {
            fetchHistoryFromFirestore(currentUser.uid)
                .then((history) => {
                    if (history?.length > 0) setViewHistory(history);
                })
                .catch((e) => console.warn("Fetch Firestore history error:", e));
        }
    }, [currentUser, setViewHistory, fetchHistoryFromFirestore]);
};

export const useFetchSeasonEpisodes = (tmdbData, movie, detectedSeason, setImdbEpisodes) => {
    useEffect(() => {
        const tmdbId = tmdbData?.id;
        const isSeries = ["series", "tvshows", "tv"].includes(movie?.type) || tmdbData?.number_of_episodes > 0;
        if (!tmdbId || !isSeries) return;

        const isAvailableInTmdb = () => {
            if (Array.isArray(tmdbData?.seasons) && tmdbData.seasons.length > 0) {
                return tmdbData.seasons.some((s) => Number(s.season_number) === Number(detectedSeason));
            }
            if (tmdbData?.number_of_seasons) {
                return Number(detectedSeason) <= tmdbData.number_of_seasons;
            }
            return true;
        };

        if (!isAvailableInTmdb()) return;

        vodService.fetchTMDBSeason(tmdbId, detectedSeason)
            .then((data) => {
                if (data?.episodes) setImdbEpisodes(data.episodes);
            })
            .catch((err) => console.warn("Fetch TMDB season error:", err));
    }, [tmdbData, movie, detectedSeason, setImdbEpisodes]);
};

export const useVodFavorites = (favorites, setFavorites, setErrorMessage, getMovieImage) => {
    const isFavorited = (movieSlug) => favorites.some((fav) => fav.slug === movieSlug);

    const toggleFavorite = (targetMovie) => {
        if (!targetMovie) return;
        const exists = isFavorited(targetMovie.slug);
        if (exists) {
            setFavorites(favorites.filter((f) => f.slug !== targetMovie.slug));
            setErrorMessage("Đã xóa khỏi danh sách yêu thích");
        } else {
            const item = {
                slug: targetMovie.slug,
                name: targetMovie.name,
                poster: getMovieImage(targetMovie.poster_url || targetMovie.thumb_url, targetMovie.source),
                year: targetMovie.year,
                quality: targetMovie.quality,
                time: new Date().toISOString(),
            };
            setFavorites([item, ...favorites]);
            setErrorMessage("Đã thêm vào danh sách yêu thích");
        }
        setTimeout(() => setErrorMessage(null), 2500);
    };

    return { isFavorited, toggleFavorite };
};

export const useVodPlayModals = (t) => {
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareMessage, setShareMessage] = useState("");
    const [showImageModal, setShowImageModal] = useState(false);
    const [modalImages, setModalImages] = useState([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    const copyToClipboard = (text) => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                setShareMessage(t("vodPlay.copied") || "Đã sao chép link");
                setTimeout(() => setShareMessage(""), 2000);
            });
        }
    };

    return {
        showShareModal,
        setShowShareModal,
        shareMessage,
        showImageModal,
        setShowImageModal,
        modalImages,
        setModalImages,
        currentImageIndex,
        setCurrentImageIndex,
        copyToClipboard,
    };
};
