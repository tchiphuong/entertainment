import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import LoadingSpinner from "../components/LoadingSpinner";
// Dynamic import HLS.js khi cần
let Hls = null;

const CONFIG = {
    API_ENDPOINT: "https://phimapi.com/phim",
    TMDB_API_KEY: "3356865d41894a2fa9bfa84b2b5f59bb",
    TMDB_BASE_URL: "https://api.themoviedb.org/3",
};

// Detect mobile device - support debug mode via ?debugMobile=true
const isMobileDevice = (debugMode = false) => {
    if (debugMode) return true;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
    );
};

// Mock JWPlayer license response để bypass CORS
const JWPLAYER_LICENSE_MOCK = {
    canPlayAds: true,
    canPlayOutstreamAds: false,
    canUseIdentityScript: false,
    canUseVPB: false,
    overrideAdConfig: false,
};

// Helper function để clean M3U8 content
function cleanM3U8Content(text) {
    const lines = text.split("\n");
    const finalLines = [];

    let skip = false;
    for (const line of lines) {
        if (line.includes("#EXT-X-DISCONTINUITY")) {
            // Toggle vùng bỏ qua
            skip = !skip;
            continue; // không giữ dòng này
        }

        if (!skip) {
            finalLines.push(line);
        }
    }

    // Loại bỏ dòng trống liên tiếp
    const cleaned = [];
    let lastEmpty = false;
    for (const line of finalLines) {
        const isEmpty = line.trim() === "";
        if (!isEmpty || !lastEmpty) {
            cleaned.push(line);
        }
        lastEmpty = isEmpty;
    }

    return cleaned.join("\n");
}

// Intercept fetch để bypass JWPlayer CORS + clean M3U8
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

    // Intercept M3U8 requests to strip #EXT-X-DISCONTINUITY
    const fetchPromise = originalFetch.apply(this, args);

    if (url && url.includes(".m3u8")) {
        return fetchPromise.then((response) => {
            if (!response.ok) return response;

            return response
                .clone()
                .text()
                .then((text) => {
                    const originalDiscontinuityCount = (
                        text.match(/#EXT-X-DISCONTINUITY/g) || []
                    ).length;
                    const cleanedText = cleanM3U8Content(text);

                    return new Response(cleanedText, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers,
                    });
                });
        });
    }

    return fetchPromise;
};

// Intercept XMLHttpRequest để catch HLS.js requests
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function (method, url, ...args) {
    this._url = url;
    return originalXHROpen.call(this, method, url, ...args);
};

XMLHttpRequest.prototype.send = function (...args) {
    if (this._url && this._url.includes(".m3u8")) {
        const originalOnReadyStateChange = this.onreadystatechange;

        this.onreadystatechange = function () {
            if (this.readyState === 4 && this.status === 200) {
                try {
                    const originalText = this.responseText;
                    const discontinuityCount = (
                        originalText.match(/#EXT-X-DISCONTINUITY/g) || []
                    ).length;

                    if (discontinuityCount > 0) {
                        const cleanedText = cleanM3U8Content(originalText);

                        // Override responseText
                        Object.defineProperty(this, "responseText", {
                            writable: true,
                            value: cleanedText,
                        });
                        Object.defineProperty(this, "response", {
                            writable: true,
                            value: cleanedText,
                        });
                    }
                } catch (e) {
                    console.warn("Failed to clean M3U8 via XHR:", e);
                }
            }

            if (originalOnReadyStateChange) {
                return originalOnReadyStateChange.apply(this, arguments);
            }
        };
    }

    return originalXHRSend.apply(this, args);
};

function useQuery() {
    return new URLSearchParams(window.location.search);
}

function useLocalStorage(key, initial) {
    const [state, setState] = useState(() => {
        try {
            const v = localStorage.getItem(key);
            return v ? JSON.parse(v) : initial;
        } catch (e) {
            return initial;
        }
    });
    useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(state));
        } catch (e) {}
    }, [key, state]);
    return [state, setState];
}

export default function VodPlay() {
    const query = useQuery();
    const slug = query.get("slug");
    const episodeParam = query.get("episode");
    const debugTmdb = query.get("debugTmdb") === "true"; // toggle to show raw TMDb JSON for debugging
    const debugMobile = query.get("debugMobile") === "true"; // Debug mode để test mobile behavior
    const navigate = useNavigate();
    const playerRef = useRef(null);
    const currentUrlRef = useRef(null); // Track URL hiện tại đang play để tránh duplicate init
    const hasInitializedRef = useRef(false); // Track xem đã initialize player hay chưa
    const [movie, setMovie] = useState(null);
    const [episodes, setEpisodes] = useState([]);
    const [activeEpisode, setActiveEpisode] = useState(null);
    const [currentEpisodeId, setCurrentEpisodeId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState(null);
    const [tmdbData, setTmdbData] = useState(null); // Store TMDb data
    const [tmdbCredits, setTmdbCredits] = useState(null); // Store TMDb credits (cast/crew)
    const [tmdbImages, setTmdbImages] = useState(null); // Store TMDb images
    const [lastWatchedEpisodes, setLastWatchedEpisodes] = useLocalStorage(
        "lastWatchedEpisodes",
        [],
    );
    const [, setHistory] = useLocalStorage("viewHistory", []);
    const [showImageModal, setShowImageModal] = useState(false);
    const [modalImages, setModalImages] = useState([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const modalRef = useRef(null);

    // Interceptors đã setup từ đầu file

    useEffect(() => {
        document.title = "VOD Player";
        if (slug) {
            // Reset flags khi load video khác
            hasInitializedRef.current = false;
            currentUrlRef.current = null;
            fetchMovieDetails();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug]);

    // Xử lý phím ESC để đóng modal
    useEffect(() => {
        if (!showImageModal) return;

        // Focus modal để capture keyboard events
        if (modalRef.current) {
            modalRef.current.focus();
        }

        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                setShowImageModal(false);
            }
            // Phím mũi tên trái/phải để điều hướng
            if (e.key === "ArrowLeft") {
                setCurrentImageIndex((prev) =>
                    prev > 0 ? prev - 1 : modalImages.length - 1,
                );
            }
            if (e.key === "ArrowRight") {
                setCurrentImageIndex((prev) =>
                    prev < modalImages.length - 1 ? prev + 1 : 0,
                );
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [showImageModal, modalImages.length]);

    // Get last watched episodes list
    const getLastWatchedList = useCallback(() => {
        return lastWatchedEpisodes || [];
    }, [lastWatchedEpisodes]);

    // Fetch movie details
    async function fetchMovieDetails() {
        setIsLoading(true);
        try {
            const res = await fetch(`${CONFIG.API_ENDPOINT}/${slug}`);
            const json = await res.json();
            const data = json;
            if (data.status && data.movie) {
                setMovie(data.movie);
                setEpisodes(data.episodes || []);
                addToHistory(data.movie);

                // Fetch TMDb data, credits, and images nếu có tmdb info
                if (data.movie.tmdb?.id) {
                    const tmdbId = data.movie.tmdb.id;
                    const tmdbType = data.movie.tmdb.type; // "movie" hoặc "tv"

                    if (tmdbType === "movie") {
                        fetchTmdbMovieData(tmdbId);
                    } else if (tmdbType === "tv") {
                        fetchTmdbTvData(tmdbId);
                    }

                    fetchTmdbCredits(tmdbId, tmdbType);
                    fetchTmdbImages(tmdbId, tmdbType);
                }

                if ((data.episodes || []).length > 0) {
                    initializeFromUrl(data.episodes);
                }
            } else {
                setErrorMessage("Failed to load movie details.");
            }
        } catch (err) {
            console.error(err);
            setErrorMessage("Failed to load movie details.");
        } finally {
            setIsLoading(false);
        }
    }

    // Fetch TMDb movie data
    async function fetchTmdbMovieData(tmdbId) {
        try {
            const encodedKey =
                typeof btoa !== "undefined"
                    ? btoa(CONFIG.TMDB_API_KEY)
                    : CONFIG.TMDB_API_KEY;
            const apiKey =
                typeof atob !== "undefined" ? atob(encodedKey) : encodedKey;

            const response = await fetch(
                `${CONFIG.TMDB_BASE_URL}/movie/${tmdbId}?api_key=${apiKey}&language=vi`,
            );
            if (response.ok) {
                const data = await response.json();
                setTmdbData(data);
            }
        } catch (err) {
            console.warn("Failed to fetch TMDb data:", err);
        }
    }

    // Fetch TMDb TV data
    async function fetchTmdbTvData(tmdbId) {
        try {
            const encodedKey =
                typeof btoa !== "undefined"
                    ? btoa(CONFIG.TMDB_API_KEY)
                    : CONFIG.TMDB_API_KEY;
            const apiKey =
                typeof atob !== "undefined" ? atob(encodedKey) : encodedKey;

            const response = await fetch(
                `${CONFIG.TMDB_BASE_URL}/tv/${tmdbId}?api_key=${apiKey}&language=vi`,
            );
            if (response.ok) {
                const data = await response.json();
                setTmdbData(data);
            }
        } catch (err) {
            console.warn("Failed to fetch TMDb TV data:", err);
        }
    }

    // Fetch TMDb credits (cast & crew)
    async function fetchTmdbCredits(tmdbId, type = "movie") {
        try {
            const encodedKey =
                typeof btoa !== "undefined"
                    ? btoa(CONFIG.TMDB_API_KEY)
                    : CONFIG.TMDB_API_KEY;
            const apiKey =
                typeof atob !== "undefined" ? atob(encodedKey) : encodedKey;

            const endpoint = type === "tv" ? "tv" : "movie";
            const response = await fetch(
                `${CONFIG.TMDB_BASE_URL}/${endpoint}/${tmdbId}/credits?api_key=${apiKey}&language=vi-VN`,
            );
            if (response.ok) {
                const data = await response.json();
                setTmdbCredits(data);
            }
        } catch (err) {
            console.warn("Failed to fetch TMDb credits:", err);
        }
    }

    // Fetch TMDb images
    async function fetchTmdbImages(tmdbId, type = "movie") {
        try {
            const encodedKey =
                typeof btoa !== "undefined"
                    ? btoa(CONFIG.TMDB_API_KEY)
                    : CONFIG.TMDB_API_KEY;
            const apiKey =
                typeof atob !== "undefined" ? atob(encodedKey) : encodedKey;

            const endpoint = type === "tv" ? "tv" : "movie";
            const response = await fetch(
                `${CONFIG.TMDB_BASE_URL}/${endpoint}/${tmdbId}/images?api_key=${apiKey}`,
            );
            if (response.ok) {
                const data = await response.json();
                setTmdbImages(data);
            }
        } catch (err) {
            console.warn("Failed to fetch TMDb images:", err);
        }
    }

    // Initialize from URL parameters - ưu tiên URL parameter, sau đó last watched
    function initializeFromUrl(episodesList) {
        // Skip nếu đã initialize rồi
        if (hasInitializedRef.current) {
            return;
        }

        if (episodeParam) {
            // Tìm episode và server từ URL parameter
            const matchingEpisode = episodesList.find((episode) =>
                episode.server_data?.some(
                    (server) => server.slug === episodeParam,
                ),
            );

            if (matchingEpisode) {
                const matchingServer = matchingEpisode.server_data.find(
                    (server) => server.slug === episodeParam,
                );
                if (matchingServer) {
                    hasInitializedRef.current = true;
                    setActiveEpisode(matchingEpisode);
                    openEpisode(matchingServer);
                    return;
                }
            }
        }

        // Fallback: tìm last watched episode
        const lastWatchedList = getLastWatchedList();
        const movieData = lastWatchedList.find(
            (item) => item.movieSlug === slug,
        );

        if (movieData?.currentEpisode && episodesList.length > 0) {
            const matchingEpisode = episodesList.find((episode) =>
                episode.server_data?.some(
                    (server) => server.slug === movieData.currentEpisode,
                ),
            );
            if (matchingEpisode) {
                const matchingServer = matchingEpisode.server_data.find(
                    (server) => server.slug === movieData.currentEpisode,
                );
                if (matchingServer) {
                    hasInitializedRef.current = true;
                    setActiveEpisode(matchingEpisode);
                    openEpisode(matchingServer);
                    return;
                }
            }
        }

        // Default: tập đầu tiên
        if (episodesList.length > 0) {
            const firstEpisode = episodesList[0];
            hasInitializedRef.current = true;
            setActiveEpisode(firstEpisode);
            if (firstEpisode.server_data?.length > 0) {
                openEpisode(firstEpisode.server_data[0]);
            }
        }
    }

    // Add to watch history
    function addToHistory(movieData) {
        try {
            const history =
                JSON.parse(localStorage.getItem("viewHistory")) || [];
            const existingIndex = history.findIndex((h) => h.slug === slug);
            const entry = {
                slug: movieData.slug,
                name: movieData.name,
                poster: movieData.poster_url,
                timestamp: new Date().toISOString(),
                lastWatchedEpisode: {
                    key: activeEpisode?.server_name || "N/A",
                    value: currentEpisodeId || "N/A",
                },
            };
            if (existingIndex >= 0) {
                history[existingIndex] = entry;
            } else {
                history.unshift(entry);
            }
            setHistory(history.slice(0, 20));
        } catch (e) {
            console.error("Error adding to history:", e);
        }
    }

    // Save watch history position
    function saveWatchHistory(episodeSlug) {
        try {
            const history =
                JSON.parse(localStorage.getItem("viewHistory")) || [];
            const existingIndex = history.findIndex((h) => h.slug === slug);
            if (existingIndex !== -1 && movie) {
                history[existingIndex].lastWatchedEpisode = {
                    key: episodeSlug,
                    value: `Tập ${episodeSlug.split("-").pop()}`,
                };
                localStorage.setItem("viewHistory", JSON.stringify(history));
            }
        } catch (e) {
            console.error("Error saving watch history:", e);
        }
    }

    // Set watchlist - save current episode & position
    function setWatchlist(episodeSlug, position = null) {
        try {
            const list = [...lastWatchedEpisodes];
            let movieData = list.find((item) => item.movieSlug === slug);
            if (!movieData) {
                movieData = {
                    movieSlug: slug,
                    currentEpisode: episodeSlug,
                    episodes: {},
                };
                list.push(movieData);
            }

            const lastPosition =
                movieData.episodes?.[currentEpisodeId]?.position || 0;
            movieData.currentEpisode = episodeSlug;
            movieData.episodes[episodeSlug] = {
                position: position || lastPosition,
                timestamp: new Date().toISOString(),
            };

            setLastWatchedEpisodes(list);

            // Update URL
            const params = new URLSearchParams(window.location.search);
            params.set("episode", episodeSlug);
            window.history.replaceState({}, "", `?${params.toString()}`);

            saveWatchHistory(episodeSlug);
        } catch (e) {
            console.error("Error setting watchlist:", e);
        }
    }

    async function initializePlayer(masterUrl, episodeSlug) {
        if (!masterUrl) {
            return;
        }

        const isMobile = isMobileDevice(debugMobile);

        // Skip nếu URL này đã đang play
        if (currentUrlRef.current === masterUrl) {
            return;
        }

        // Trên mobile, prefer HLS.js thay vì JWPlayer
        if (isMobile) {
            await setupHlsPlayer(masterUrl, episodeSlug);
            return;
        }

        try {
            // Load JWPlayer library nếu chưa có
            if (!window.jwplayer) {
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error("JWPlayer script load timeout"));
                    }, 5000);

                    const s = document.createElement("script");
                    s.src =
                        "https://content.jwplatform.com/libraries/Z79JsmAO.js";
                    s.onload = () => {
                        clearTimeout(timeout);
                        resolve();
                    };
                    s.onerror = () => {
                        clearTimeout(timeout);
                        reject(new Error("Failed to load JWPlayer"));
                    };
                    document.head.appendChild(s);
                });
            }
            // Wait for player container
            const playerDiv = await new Promise((resolve) => {
                const div = document.getElementById("player-container");
                if (div) {
                    resolve(div);
                } else {
                    setTimeout(
                        () =>
                            resolve(
                                document.getElementById("player-container"),
                            ),
                        100,
                    );
                }
            });

            if (!playerDiv) {
                throw new Error("Player container not found");
            }

            // Destroy old player instance completely
            if (playerRef.current?.player) {
                try {
                    const oldPlayer = playerRef.current.player;
                    // Remove all event listeners
                    oldPlayer.off();
                    // Remove player from DOM
                    oldPlayer.remove();
                    // Clear reference
                    playerRef.current = null;
                } catch (e) {
                    console.warn("Failed to remove old player:", e);
                }
            }

            // Clear container completely
            playerDiv.innerHTML = "";

            // Reset currentUrlRef để force re-init
            currentUrlRef.current = null;

            if (typeof window.jwplayer === "function") {
                const player = window.jwplayer("player-container").setup({
                    file: masterUrl,
                    type: "hls",
                    image: movie?.poster_url || "",
                    title: movie?.name || "Video",
                    width: "100%",
                    aspectratio: "16:9",
                    controls: true,
                    autostart: true,
                    mute: false,
                    playsinline: true,
                    primary: "html5",
                    // Loại bỏ preload metadata vì nó trigger range requests quá nhiều lần
                    // preload: "metadata",
                });

                // Save watchlist on ready
                player.on("ready", () => {
                    setCurrentEpisodeId(episodeSlug);
                    setWatchlist(episodeSlug);

                    // Restore playback position
                    const lastWatchedList = getLastWatchedList();
                    const movieData = lastWatchedList.find(
                        (item) => item.movieSlug === slug,
                    );
                    const lastPosition =
                        movieData?.episodes?.[episodeSlug]?.position || 0;

                    if (lastPosition > 0) {
                        player.seek(lastPosition);
                    }
                });

                let lastSavedTime = 0;
                // Save playback position periodically
                player.on("time", (event) => {
                    const currentTime = Math.floor(event.position);
                    if (currentTime - lastSavedTime >= 5) {
                        lastSavedTime = currentTime;
                        setWatchlist(episodeSlug, currentTime);
                    }
                });

                // Auto-play next episode when finished
                player.on("complete", () => {
                    playNextEpisode();
                });

                player.on("error", (event) => {
                    console.error("JWPlayer error:", event.message);
                    setErrorMessage(`Playback error: ${event.message}`);
                });

                playerRef.current = { player };
                currentUrlRef.current = masterUrl; // Track URL đang play
            } else {
                throw new Error("JWPlayer not loaded");
            }
        } catch (err) {
            // Fallback to HLS.js player
            await setupHlsPlayer(masterUrl, episodeSlug);
        }
    }

    // Fallback HLS.js player for mobile/CORS issues
    async function setupHlsPlayer(masterUrl, episodeSlug) {
        try {
            // Load HLS.js library
            if (!Hls) {
                const script = document.createElement("script");
                script.src =
                    "https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js";
                await new Promise((resolve, reject) => {
                    script.onload = () => {
                        Hls = window.Hls;
                        resolve();
                    };
                    script.onerror = () =>
                        reject(new Error("Failed to load HLS.js"));
                    document.head.appendChild(script);
                });
            }

            const playerDiv = document.getElementById("player-container");
            if (!playerDiv) throw new Error("Player container not found");

            // Clear container
            playerDiv.innerHTML = "";

            // Create video element
            const video = document.createElement("video");
            video.id = "hls-video";
            video.className = "w-full h-full";
            video.style.cssText = "width:100%;height:100%;";
            video.controls = true;
            video.autoplay = true;
            playerDiv.appendChild(video);

            if (Hls && Hls.isSupported()) {
                const hls = new Hls({
                    debug: false,
                    // CORS fix
                    xhrSetup: function (xhr, url) {
                        xhr.withCredentials = false;
                    },
                });

                hls.loadSource(masterUrl);
                hls.attachMedia(video);

                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    setCurrentEpisodeId(episodeSlug);
                    setWatchlist(episodeSlug);
                });

                hls.on(Hls.Events.ERROR, (event, data) => {
                    if (data.fatal) {
                    }
                });

                // Track playback position
                video.addEventListener("timeupdate", () => {
                    const currentTime = Math.floor(video.currentTime);
                    const lastSavedTime = Math.floor(
                        video.dataset.lastSavedTime || 0,
                    );
                    if (currentTime - lastSavedTime >= 5) {
                        video.dataset.lastSavedTime = currentTime;
                        setWatchlist(episodeSlug, currentTime);
                    }
                });

                // Auto-play next episode
                video.addEventListener("ended", () => {
                    playNextEpisode();
                });

                playerRef.current = { player: video, hls };
                currentUrlRef.current = masterUrl;
            } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
                // Safari native HLS support
                video.src = masterUrl;
                video.addEventListener("loadedmetadata", () => {
                    setCurrentEpisodeId(episodeSlug);
                    setWatchlist(episodeSlug);
                });
                playerRef.current = { player: video };
                currentUrlRef.current = masterUrl;
            } else {
                throw new Error("HLS not supported on this browser");
            }
        } catch (err) {
            setErrorMessage(
                `Video player setup failed: ${err.message}. Please try another server.`,
            );
        }
    }

    function openEpisode(server) {
        // Update document title
        document.title = `[${server.name}] - ${movie?.name}`;

        // Initialize player with URL - sẽ tự set currentEpisodeId khi ready
        initializePlayer(server.link_m3u8, server.slug);
    }

    // Play next episode
    function playNextEpisode() {
        if (!activeEpisode) return;

        const currentServerIndex =
            activeEpisode.server_data?.findIndex(
                (server) => server.slug === currentEpisodeId,
            ) || -1;

        if (currentServerIndex !== -1) {
            // Check if there's another server in current episode
            if (currentServerIndex + 1 < activeEpisode.server_data.length) {
                openEpisode(activeEpisode.server_data[currentServerIndex + 1]);
                return;
            }
        }

        // Move to next episode if available
        if (!episodes || episodes.length === 0) return;
        const currentEpisodeIndex = episodes.findIndex(
            (ep) => ep === activeEpisode,
        );

        if (
            currentEpisodeIndex !== -1 &&
            currentEpisodeIndex + 1 < episodes.length
        ) {
            const nextEpisode = episodes[currentEpisodeIndex + 1];
            switchTab(nextEpisode);
        } else {
            setErrorMessage("No more episodes available.");
        }
    }

    // Switch to different episode (tab) - try to keep same server, fallback to first
    function switchTab(episode) {
        const currentSlug = currentEpisodeId;
        setActiveEpisode(episode);

        // Try to find server with same slug in new episode
        const matchingServer = episode.server_data?.find(
            (server) => server.slug === currentSlug,
        );

        if (matchingServer) {
            openEpisode(matchingServer);
        } else if (episode.server_data?.length > 0) {
            // Fallback to first server
            openEpisode(episode.server_data[0]);
        } else {
            setErrorMessage("No servers available for this episode.");
        }
    }

    return (
        <div>
            <LoadingSpinner isLoading={isLoading} />
            {errorMessage && (
                <div className="container mx-auto p-4">
                    <div className="rounded-md bg-red-100 p-4 text-red-500">
                        {errorMessage}
                    </div>
                </div>
            )}
            {/* Image Modal */}
            {showImageModal && modalImages.length > 0 && (
                <div
                    ref={modalRef}
                    tabIndex={0}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4 outline-none"
                    onClick={() => setShowImageModal(false)}
                >
                    <div
                        className="relative flex h-full max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-black shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setShowImageModal(false)}
                            className="absolute right-6 top-6 z-20 cursor-pointer rounded-full bg-black/60 p-2 text-white transition-all hover:scale-110 hover:bg-black/80"
                        >
                            <svg
                                className="h-8 w-8 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>

                        {/* Image */}
                        <div className="flex flex-1 items-center justify-center overflow-hidden">
                            <img
                                src={`https://image.tmdb.org/t/p/original${modalImages[currentImageIndex]?.file_path}`}
                                alt={`Image ${currentImageIndex + 1}`}
                                className="max-h-full max-w-full object-contain"
                            />
                        </div>

                        {/* Navigation */}
                        <div className="flex items-center justify-center gap-8 bg-black/50 px-6 py-4 backdrop-blur-sm">
                            <button
                                onClick={() =>
                                    setCurrentImageIndex((prev) =>
                                        prev > 0
                                            ? prev - 1
                                            : modalImages.length - 1,
                                    )
                                }
                                className="cursor-pointer rounded-full bg-blue-600 p-3 text-white transition-colors hover:bg-blue-700"
                            >
                                <svg
                                    className="h-6 w-6"
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
                            <span className="text-lg font-semibold text-white">
                                {currentImageIndex + 1} / {modalImages.length}
                            </span>
                            <button
                                onClick={() =>
                                    setCurrentImageIndex((prev) =>
                                        prev < modalImages.length - 1
                                            ? prev + 1
                                            : 0,
                                    )
                                }
                                className="cursor-pointer rounded-full bg-blue-600 p-3 text-white transition-colors hover:bg-blue-700"
                            >
                                <svg
                                    className="h-6 w-6"
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
            )}{" "}
            {movie && (
                <>
                    <main className="container mx-auto flex h-full flex-col gap-4 p-4">
                        {/* Breadcrumb Navigation */}
                        <nav className="text-sm text-gray-600">
                            <ul className="flex items-center gap-2">
                                <li className="flex items-center">
                                    <button
                                        onClick={() => navigate("/vods")}
                                        className="flex items-center gap-1 text-blue-500 hover:underline"
                                    >
                                        Trang chủ
                                    </button>
                                </li>
                                <li>/</li>
                                <li className="font-semibold text-gray-800">
                                    {movie.name}
                                </li>
                            </ul>
                        </nav>

                        <div className="flex h-full w-full flex-col justify-start gap-4 lg:h-auto lg:flex-row lg:justify-center">
                            {/* Player + Server Tabs */}
                            <div className="flex w-full flex-col overflow-hidden rounded-md border-gray-50 bg-white shadow lg:w-8/12">
                                {/* Player */}
                                <div
                                    id="player-container"
                                    className="w-full overflow-hidden"
                                    style={{ aspectRatio: "16/9" }}
                                ></div>
                            </div>

                            {/* Episode List */}
                            <div className="flex w-full flex-col rounded-md border-gray-50 bg-white shadow lg:w-4/12">
                                {/* Episode Tabs */}
                                <div className="relative">
                                    <ul
                                        className="flex list-none gap-2 overflow-x-auto rounded-t-md bg-gray-200 px-2 py-2"
                                        role="tablist"
                                    >
                                        {episodes.map((episode) => (
                                            <li
                                                key={episode.server_name}
                                                onClick={() =>
                                                    switchTab(episode)
                                                }
                                                className={`cursor-pointer whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                                                    activeEpisode === episode
                                                        ? "bg-blue-500 text-white"
                                                        : "hover:bg-blue-600 hover:text-white hover:opacity-80"
                                                }`}
                                            >
                                                {episode.server_name}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Server Data Grid */}
                                {activeEpisode &&
                                    activeEpisode.server_data?.length > 0 && (
                                        <div className="grid h-fit max-h-96 auto-rows-max grid-cols-3 items-start gap-4 overflow-y-auto p-4 sm:grid-cols-6 lg:h-0 lg:max-h-none lg:grow lg:grid-cols-4">
                                            {activeEpisode.server_data.map(
                                                (server) => (
                                                    <div
                                                        key={server.slug}
                                                        onClick={() =>
                                                            openEpisode(server)
                                                        }
                                                        className={`cursor-pointer rounded-md border-2 border-transparent px-3 py-2 text-center shadow transition-all ${
                                                            server.slug ===
                                                            currentEpisodeId
                                                                ? "border-blue-500 bg-blue-500 text-white"
                                                                : "bg-gray-200 hover:border-blue-400"
                                                        }`}
                                                    >
                                                        <p className="text-sm font-semibold">
                                                            {server.name}
                                                        </p>
                                                    </div>
                                                ),
                                            )}
                                        </div>
                                    )}
                            </div>
                        </div>

                        {/* Movie Details */}
                        <div className="rounded-md border border-gray-200 bg-white p-4 shadow-md">
                            <div className="flex flex-col gap-4 lg:flex-row">
                                {/* Poster */}
                                <div
                                    className="hidden h-56 shrink-0 lg:block"
                                    style={{ aspectRatio: "2/3" }}
                                >
                                    <img
                                        src={movie.poster_url}
                                        alt={movie.name}
                                        className="h-full w-full rounded-md object-cover shadow-md"
                                    />
                                </div>
                                <div
                                    className="w-full shrink-0 lg:hidden"
                                    style={{ aspectRatio: "16/9" }}
                                >
                                    <img
                                        src={movie.thumb_url}
                                        alt={movie.name}
                                        className="h-full w-full rounded-md object-cover shadow-md"
                                    />
                                </div>

                                {/* Movie Details */}
                                <div className="flex grow flex-col gap-3">
                                    <div>
                                        <div className="text-xl font-bold text-gray-800">
                                            {movie.name}
                                        </div>
                                        <div
                                            className="text-sm italic text-gray-500"
                                            title={movie.origin_name}
                                        >
                                            {movie.origin_name}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="inline-block rounded-md bg-blue-100 px-2 py-1 text-sm text-blue-800">
                                            <strong>Thời lượng:</strong>{" "}
                                            {movie.time}
                                        </span>
                                        <span className="inline-block rounded-md bg-green-100 px-2 py-1 text-sm text-green-800">
                                            <strong>Chất lượng:</strong>{" "}
                                            {movie.quality}
                                        </span>
                                        <span className="inline-block rounded-md bg-purple-100 px-2 py-1 text-sm text-purple-800">
                                            <strong>Năm:</strong> {movie.year}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {movie.category?.map((cat, idx) => (
                                            <span
                                                key={idx}
                                                className="inline-block rounded-md bg-yellow-100 px-2 py-1 text-sm text-yellow-800"
                                            >
                                                {cat.name}
                                            </span>
                                        ))}
                                    </div>
                                    {/* <div className="flex flex-wrap gap-2">
                                        {movie.actor?.map((act, idx) => (
                                            <span
                                                key={idx}
                                                className="inline-block rounded-md bg-red-100 px-2 py-1 text-sm text-red-800"
                                            >
                                                {act}
                                            </span>
                                        ))}
                                    </div> */}

                                    <div
                                        className="line-clamp-3 text-sm text-gray-600"
                                        title={movie.content}
                                    >
                                        {movie.content}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* TMDb Cast (top 6) - Trước Thư viện hình ảnh */}
                        {tmdbCredits?.cast && tmdbCredits.cast.length > 0 && (
                            <>
                                <h3 className="text-lg font-semibold text-gray-800">
                                    Diễn viên chính
                                </h3>
                                <div className="rounded-md border border-gray-200 bg-white p-6 shadow-md">
                                    <div className="flex flex-wrap items-start justify-start gap-6">
                                        {tmdbCredits.cast.map((c) => (
                                            <div
                                                key={c.cast_id || c.id}
                                                className="flex flex-col items-center gap-2 text-center"
                                            >
                                                {c.profile_path ? (
                                                    <img
                                                        src={`https://image.tmdb.org/t/p/w92${c.profile_path}`}
                                                        alt={c.name}
                                                        className="h-24 w-24 rounded-lg object-cover shadow-md"
                                                        onError={(e) =>
                                                            (e.target.style.display =
                                                                "none")
                                                        }
                                                    />
                                                ) : (
                                                    <div className="h-24 w-24 rounded-lg bg-gray-200" />
                                                )}
                                                <div className="w-24">
                                                    <div className="truncate text-sm font-semibold text-gray-800">
                                                        {c.name}
                                                    </div>
                                                    <div className="truncate text-xs text-gray-500">
                                                        {c.character}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Hình ảnh từ TMDb: poster & backdrop (grid - all square) */}
                        {tmdbImages &&
                            (tmdbImages.posters?.length > 0 ||
                                tmdbImages.backdrops?.length > 0) && (
                                <>
                                    <h3 className="text-lg font-semibold text-gray-800">
                                        Thư viện hình ảnh
                                    </h3>
                                    <div className="rounded-md border border-gray-200 bg-white p-6 shadow-md">
                                        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
                                            {/* Poster + Backdrop combined */}
                                            {(() => {
                                                const allImages = [
                                                    ...(tmdbImages.posters ||
                                                        []),
                                                    ...(tmdbImages.backdrops ||
                                                        []),
                                                ];
                                                const totalCount =
                                                    allImages.length;
                                                const remainingCount = Math.max(
                                                    0,
                                                    totalCount - 12,
                                                );
                                                // Luôn show 12 hình
                                                const displayImages =
                                                    allImages.slice(0, 12);

                                                return (
                                                    <>
                                                        {displayImages.map(
                                                            (img, idx) => (
                                                                <div
                                                                    key={
                                                                        img.file_path ||
                                                                        idx
                                                                    }
                                                                    className="relative aspect-square cursor-pointer overflow-hidden rounded-lg shadow-md transition-shadow hover:shadow-lg"
                                                                    onClick={() => {
                                                                        setModalImages(
                                                                            allImages,
                                                                        );
                                                                        setCurrentImageIndex(
                                                                            idx,
                                                                        );
                                                                        setShowImageModal(
                                                                            true,
                                                                        );
                                                                    }}
                                                                >
                                                                    <img
                                                                        src={`https://image.tmdb.org/t/p/w342${img.file_path}`}
                                                                        alt="TMDb"
                                                                        className="h-full w-full object-cover transition-transform hover:scale-105"
                                                                        loading="lazy"
                                                                    />
                                                                    {/* "+X" overlay trên hình thứ 12 nếu có hình thừa */}
                                                                    {remainingCount >
                                                                        0 &&
                                                                        idx ===
                                                                            11 && (
                                                                            <div
                                                                                className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-lg bg-black/60 transition-all hover:bg-black/40"
                                                                                onClick={() => {
                                                                                    setModalImages(
                                                                                        allImages,
                                                                                    );
                                                                                    setCurrentImageIndex(
                                                                                        12,
                                                                                    );
                                                                                    setShowImageModal(
                                                                                        true,
                                                                                    );
                                                                                }}
                                                                            >
                                                                                <div className="text-center">
                                                                                    <div className="text-4xl font-bold text-white">
                                                                                        +
                                                                                        {
                                                                                            remainingCount
                                                                                        }
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                </div>
                                                            ),
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </>
                            )}
                    </main>
                </>
            )}
        </div>
    );
}
