import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LoadingSpinner from "../components/LoadingSpinner";
import { useAuth } from "../contexts/AuthContext";
import {
    addHistoryToFirestore,
    fetchHistoryFromFirestore,
} from "../services/firebaseHelpers";
// Dynamic import HLS.js khi cần
let Hls = null;

const CONFIG = {
    API_ENDPOINT: import.meta.env.VITE_SOURCE_K_API + "/phim",
    APP_DOMAIN_SOURCE_K: import.meta.env.VITE_SOURCE_K_API,
    APP_DOMAIN_SOURCE_K_CDN_IMAGE: import.meta.env.VITE_SOURCE_K_CDN_IMAGE,
    APP_DOMAIN_SOURCE_C: import.meta.env.VITE_SOURCE_C_API,
    APP_DOMAIN_SOURCE_O: import.meta.env.VITE_SOURCE_O_API,
    APP_DOMAIN_SOURCE_O_FRONTEND: import.meta.env.VITE_SOURCE_O_FRONTEND,
    APP_DOMAIN_SOURCE_O_CDN_IMAGE: import.meta.env.VITE_SOURCE_O_CDN_IMAGE,
    TMDB_API_KEY: import.meta.env.VITE_TMDB_API_KEY,
    TMDB_BASE_URL: import.meta.env.VITE_TMDB_BASE_URL,
};

// Source constants
const SOURCES = {
    SOURCE_C: "source_c",
    SOURCE_K: "source_k",
    SOURCE_O: "source_o",
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
function cleanM3U8Content(text, baseURL = "") {
    const lines = text.split("\n");
    const cleaned = [];

    let skipBlock = false; // Dùng để bỏ nguyên block có #EXT-X-KEY

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();

        // Kiểm tra block bắt đầu bằng #EXT-X-DISCONTINUITY + #EXT-X-KEY:METHOD=NONE
        if (
            !skipBlock &&
            line === "#EXT-X-DISCONTINUITY" &&
            lines[i + 1]?.startsWith("#EXT-X-KEY:METHOD=NONE")
        ) {
            skipBlock = true;
            i++; // bỏ luôn dòng #EXT-X-KEY
            continue;
        }

        // Nếu đang skip block
        if (skipBlock) {
            if (line === "#EXT-X-DISCONTINUITY") {
                skipBlock = false; // kết thúc block
            }
            continue; // bỏ tất cả các dòng trong block
        }

        // Bỏ các #EXT-X-DISCONTINUITY thừa
        if (line === "#EXT-X-DISCONTINUITY") continue;

        // Nếu là dòng ts có "convertv7/", loại bỏ "convertv7/"
        if (line.endsWith(".ts") && line.includes("convertv7/")) {
            line = line.replace("convertv7/", "");
        }

        // Nếu có baseURL, ghép luôn full link
        if (baseURL && line.endsWith(".ts")) {
            line = baseURL + line;
        }

        cleaned.push(line);
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
                    // Failed to clean M3U8 via XHR
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

// Helper để load hình ảnh theo source
function getMovieImage(imagePath, source) {
    if (!imagePath) {
        // Temporary debug log to identify which movies miss images
        try {
            console.warn(
                "getMovieImage: missing imagePath, returning local placeholder",
            );
        } catch (e) {}
        const base =
            typeof import.meta !== "undefined" &&
            import.meta.env &&
            import.meta.env.BASE_URL
                ? import.meta.env.BASE_URL
                : "/";
        return `${base}no-poster.svg`;
    }

    // Nếu là URL tuyệt đối
    if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
        // Nếu source là source_k hoặc source_o thì proxy những domain của CDN/primary
        if (source === "source_k" || source === "source_o") {
            const hostname = (() => {
                try {
                    return new URL(imagePath).hostname || "";
                } catch (e) {
                    return "";
                }
            })();

            if (
                hostname.indexOf("phimimg.com") !== -1 ||
                hostname.indexOf("phimapi.com") !== -1 ||
                hostname.indexOf("img.ophim.live") !== -1
            ) {
                const domain =
                    source === "source_k"
                        ? CONFIG.APP_DOMAIN_SOURCE_K
                        : CONFIG.APP_DOMAIN_SOURCE_O_FRONTEND;
                if (source === "source_o") {
                    return `${domain}/_next/image?url=${encodeURIComponent(imagePath)}&w=1080&q=75`;
                } else {
                    return `${domain}/image.php?url=${encodeURIComponent(imagePath)}`;
                }
            }

            // Domain khác (ví dụ source_c) — vẫn trả nguyên URL
            return imagePath;
        }

        // Nếu không phải source_k hoặc source_o: giữ nguyên URL gốc
        return imagePath;
    }

    // Nếu là đường dẫn relative hoặc chỉ filename => gán CDN chính
    const cdnUrl = `${source === "source_k" ? CONFIG.APP_DOMAIN_SOURCE_K_CDN_IMAGE : CONFIG.APP_DOMAIN_SOURCE_O_CDN_IMAGE}/${imagePath}`;
    if (source === "source_k" || source === "source_o") {
        // Proxy khi source là source_k hoặc source_o
        const domain =
            source === "source_k"
                ? CONFIG.APP_DOMAIN_SOURCE_K
                : CONFIG.APP_DOMAIN_SOURCE_O_FRONTEND;
        if (source === "source_o") {
            return `${domain}/_next/image?url=${encodeURIComponent(cdnUrl)}&w=1080&q=75`;
        } else {
            return `${domain}/image.php?url=${encodeURIComponent(cdnUrl)}`;
        }
    }

    // Nguồn khác: trả URL CDN gốc (không proxy)
    return cdnUrl;
}

export default function VodPlay() {
    const { t, i18n } = useTranslation();
    // Lưu và lấy âm lượng từ localStorage
    const VOLUME_KEY = "vodPlayerVolume";
    const getSavedVolume = () => {
        try {
            const v = localStorage.getItem(VOLUME_KEY);
            if (v !== null) {
                const num = parseFloat(v);
                if (!isNaN(num) && num >= 0 && num <= 1) return num;
            }
        } catch {}
        return 0.8; // mặc định 80%
    };
    const saveVolume = (vol) => {
        try {
            localStorage.setItem(VOLUME_KEY, String(vol));
        } catch {}
    };
    const query = useQuery();
    const params = useParams();
    const slug = params.slug || query.get("slug") || "";
    const [searchParams, setSearchParams] = useSearchParams();
    const episodeParam = searchParams.get("episode");
    const serverParam = searchParams.get("server"); // Thêm server param
    const source = SOURCES.SOURCE_O; // Không cần param source nữa vì fetch tất cả
    const debugTmdb = query.get("debugTmdb") === "true"; // toggle to show raw TMDb JSON for debugging
    const debugMobile = query.get("debugMobile") === "true"; // Debug mode để test mobile behavior
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const playerRef = useRef(null);
    const currentUrlRef = useRef(null); // Track URL hiện tại đang play để tránh duplicate init
    const hasInitializedRef = useRef(false); // Track xem đã initialize player hay chưa
    const isFetchingRef = useRef(false); // Prevent concurrent duplicate fetches
    const lastFirestoreSyncRef = useRef(0); // Track thời điểm sync Firestore cuối cùng (throttle 30s)
    const positionRestoredRef = useRef(null); // Track episode đã restore position (tránh restore lại)
    const [movie, setMovie] = useState(null);
    const [episodes, setEpisodes] = useState([]);
    const [activeEpisode, setActiveEpisode] = useState(null);
    const [currentEpisodeId, setCurrentEpisodeId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState(null);
    const [tmdbData, setTmdbData] = useState(null); // Store TMDb data
    const [tmdbCredits, setTmdbCredits] = useState(null); // Store TMDb credits (cast/crew)
    const [tmdbImages, setTmdbImages] = useState(null); // Store TMDb images
    const [tmdbVideos, setTmdbVideos] = useState(null); // Store TMDb videos
    const [viewHistory, setViewHistory] = useLocalStorage("viewHistory", []);
    const [favorites, setFavorites] = useLocalStorage("favorites", []);
    const [showImageModal, setShowImageModal] = useState(false);
    const [modalImages, setModalImages] = useState([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isTheaterMode, setIsTheaterMode] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareMessage, setShareMessage] = useState("");
    const [autoplayEnabled, setAutoplayEnabled] = useLocalStorage(
        "autoplayEnabled",
        true,
    ); // Tự động chuyển tập
    const autoplayEnabledRef = useRef(autoplayEnabled); // Ref để track giá trị mới nhất trong event handlers
    const [skipIntroEnabled, setSkipIntroEnabled] = useLocalStorage(
        "skipIntroEnabled",
        false,
    ); // Tự động bỏ qua intro
    const skipIntroEnabledRef = useRef(skipIntroEnabled);
    const DEFAULT_INTRO_DURATION = 0; // Thời gian intro mặc định (giây)
    const [introDurations, setIntroDurations] = useLocalStorage(
        "introDurations",
        {},
    ); // Lưu thời gian intro theo từng phim {slug: duration}
    const [introDuration, setIntroDuration] = useState(DEFAULT_INTRO_DURATION);
    const introDurationRef = useRef(introDuration);
    const modalRef = useRef(null);

    // Sync ref với state
    useEffect(() => {
        autoplayEnabledRef.current = autoplayEnabled;
    }, [autoplayEnabled]);

    useEffect(() => {
        skipIntroEnabledRef.current = skipIntroEnabled;
    }, [skipIntroEnabled]);

    useEffect(() => {
        introDurationRef.current = introDuration;
    }, [introDuration]);

    // Load intro duration cho phim hiện tại khi slug thay đổi
    useEffect(() => {
        if (slug) {
            const cleanSlug = slug.split("?")[0];
            const savedDuration = introDurations[cleanSlug];
            setIntroDuration(savedDuration || DEFAULT_INTRO_DURATION);
        }
    }, [slug, introDurations]);

    const maxDigits = useMemo(() => {
        const allEpisodeNumbers = episodes.flatMap((ep) =>
            ep.server_data.map((s) => {
                const match = s.name.match(/^\d+/);
                return match ? parseInt(match[0]) : 0;
            }),
        );
        const maxEpisode = Math.max(...allEpisodeNumbers, 0);
        let digits = 1;
        if (maxEpisode >= 10000) digits = 4;
        else if (maxEpisode >= 1000) digits = 3;
        else if (maxEpisode >= 100) digits = 2;
        else digits = 1;
        return digits;
    }, [episodes]);

    // Interceptors đã setup từ đầu file

    // Sync history từ Firestore khi user đăng nhập
    useEffect(() => {
        if (currentUser) {
            const loadFirestoreHistory = async () => {
                try {
                    const firestoreHistory = await fetchHistoryFromFirestore(
                        currentUser.uid,
                    );
                    if (firestoreHistory && firestoreHistory.length > 0) {
                        // Merge với localStorage history (ưu tiên Firestore)
                        setViewHistory(firestoreHistory);
                    }
                } catch (error) {
                    console.warn(
                        "Failed to fetch history from Firestore:",
                        error,
                    );
                }
            };
            loadFirestoreHistory();
        }
    }, [currentUser]);

    useEffect(() => {
        // Set tiêu đề mặc định khi load
        document.title = slug ? t("vodPlay.loading") : "VOD Player";
        if (slug) {
            // Reset flags khi load video khác
            hasInitializedRef.current = false;
            currentUrlRef.current = null;
            fetchMovieDetails();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug]);

    // Cập nhật tiêu đề khi có dữ liệu movie
    useEffect(() => {
        if (movie?.name) {
            document.title = movie.name;
        }
    }, [movie]);

    // Initialize player after movie and episodes are loaded
    useEffect(() => {
        if (movie && !hasInitializedRef.current) {
            if (episodes.length > 0) {
                initializeFromUrl(episodes, movie);
            } else {
                // Check for trailer if no episodes

                let trailerUrl = null;
                if (movie.trailer_url) {
                    trailerUrl = movie.trailer_url;
                    if (trailerUrl.includes("youtube.com/watch?v=")) {
                        const videoId = trailerUrl.split("v=")[1].split("&")[0];
                        trailerUrl = `https://www.youtube.com/embed/${videoId}`;
                    }
                } else if (tmdbVideos) {
                    const trailer = tmdbVideos.find(
                        (v) => v.type === "Trailer" && v.site === "YouTube",
                    );
                    if (trailer && trailer.key) {
                        trailerUrl = `https://www.youtube.com/embed/${trailer.key}`;
                    }
                }
                if (trailerUrl) {
                    const trailerEpisode = {
                        server_name: "Trailer",
                        server_data: [
                            {
                                name: "Trailer",
                                slug: "trailer",
                                link_embed: trailerUrl,
                                link_m3u8: null,
                            },
                        ],
                    };
                    setEpisodes([trailerEpisode]);
                    setActiveEpisode(trailerEpisode);
                    initializeFromUrl([trailerEpisode], movie);
                } else if (!movie.tmdb || tmdbVideos !== null) {
                    // No trailer available, set error
                    setErrorMessage(t("vodPlay.noPlayableLink"));
                }
            }
        }
    }, [movie, episodes, tmdbVideos, viewHistory]); // Thêm viewHistory để re-init khi history sync từ Firestore

    // Check for trailer when TMDB videos load
    useEffect(() => {
        if (
            movie &&
            episodes.length === 0 &&
            tmdbVideos &&
            !hasInitializedRef.current
        ) {
            // Check for trailer
            let trailerUrl = null;
            if (movie.trailer_url) {
                trailerUrl = movie.trailer_url;
                if (trailerUrl.includes("youtube.com/watch?v=")) {
                    const videoId = trailerUrl.split("v=")[1].split("&")[0];
                    trailerUrl = `https://www.youtube.com/embed/${videoId}`;
                }
            } else if (tmdbVideos) {
                const trailer = tmdbVideos.find(
                    (v) => v.type === "Trailer" && v.site === "YouTube",
                );
                if (trailer && trailer.key) {
                    trailerUrl = `https://www.youtube.com/embed/${trailer.key}`;
                }
            }
            if (trailerUrl) {
                const trailerEpisode = {
                    server_name: "Trailer",
                    server_data: [
                        {
                            name: "Trailer",
                            slug: "trailer",
                            link_embed: trailerUrl,
                            link_m3u8: null,
                        },
                    ],
                };
                setEpisodes([trailerEpisode]);
                setActiveEpisode(trailerEpisode);
                initializeFromUrl([trailerEpisode], movie);
            }
        }
    }, [tmdbVideos, movie, episodes]);

    // Restore position khi viewHistory thay đổi (sau khi sync từ Firestore) và player đã ready
    useEffect(() => {
        // Chỉ restore nếu có player, có episode đang xem, và chưa restore cho episode này
        if (!playerRef.current || !currentEpisodeId) return;
        if (positionRestoredRef.current === currentEpisodeId) return;

        const lastPosition = getLastWatchedPosition(currentEpisodeId);
        if (lastPosition > 0) {
            // Đánh dấu đã restore position cho episode này
            positionRestoredRef.current = currentEpisodeId;

            // Seek đến position đã lưu
            const player = playerRef.current.player;
            if (player) {
                if (typeof player.seek === "function") {
                    // JWPlayer
                    player.seek(lastPosition);
                } else if (typeof player.currentTime !== "undefined") {
                    // HTML5 video
                    player.currentTime = lastPosition;
                }
            }
        }
    }, [viewHistory, currentEpisodeId]);

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

    // Keyboard shortcuts cho video player (j/l hoặc arrow keys để tua 10s)
    useEffect(() => {
        const handleVideoKeyDown = (e) => {
            // Chỉ xử lý khi không có modal nào đang mở
            if (showImageModal || showShareModal) return;

            // Bỏ qua nếu đang typing trong input/textarea
            if (
                e.target.tagName === "INPUT" ||
                e.target.tagName === "TEXTAREA"
            ) {
                return;
            }

            // Lấy video element (JWPlayer hoặc HLS)
            const jwplayer = window.jwplayer && window.jwplayer();
            const hlsVideo = document.getElementById("hls-video");

            // Tua lùi 10s (j hoặc ArrowLeft)
            if (e.key === "j" || e.key === "ArrowLeft") {
                e.preventDefault();
                if (jwplayer && typeof jwplayer.seek === "function") {
                    const currentTime = jwplayer.getPosition();
                    jwplayer.seek(Math.max(0, currentTime - 10));
                } else if (hlsVideo) {
                    hlsVideo.currentTime = Math.max(
                        0,
                        hlsVideo.currentTime - 10,
                    );
                }
            }

            // Tua tiến 10s (l hoặc ArrowRight)
            if (e.key === "l" || e.key === "ArrowRight") {
                e.preventDefault();
                if (jwplayer && typeof jwplayer.seek === "function") {
                    const currentTime = jwplayer.getPosition();
                    const duration = jwplayer.getDuration();
                    jwplayer.seek(Math.min(duration, currentTime + 10));
                } else if (hlsVideo) {
                    hlsVideo.currentTime = Math.min(
                        hlsVideo.duration,
                        hlsVideo.currentTime + 10,
                    );
                }
            }

            // Space để play/pause
            if (e.key === " " || e.code === "Space") {
                e.preventDefault();
                if (jwplayer && typeof jwplayer.getState === "function") {
                    if (jwplayer.getState() === "playing") {
                        jwplayer.pause();
                    } else {
                        jwplayer.play();
                    }
                } else if (hlsVideo) {
                    if (hlsVideo.paused) {
                        hlsVideo.play();
                    } else {
                        hlsVideo.pause();
                    }
                }
            }

            // K để play/pause (giống YouTube)
            if (e.key === "k" || e.key === "K") {
                e.preventDefault();
                if (jwplayer && typeof jwplayer.getState === "function") {
                    if (jwplayer.getState() === "playing") {
                        jwplayer.pause();
                    } else {
                        jwplayer.play();
                    }
                } else if (hlsVideo) {
                    if (hlsVideo.paused) {
                        hlsVideo.play();
                    } else {
                        hlsVideo.pause();
                    }
                }
            }

            // F để fullscreen
            if (e.key === "f" || e.key === "F") {
                e.preventDefault();
                if (jwplayer && typeof jwplayer.setFullscreen === "function") {
                    jwplayer.setFullscreen(!jwplayer.getFullscreen());
                } else if (hlsVideo) {
                    if (!document.fullscreenElement) {
                        hlsVideo.requestFullscreen();
                    } else {
                        document.exitFullscreen();
                    }
                }
            }

            // M để mute/unmute
            if (e.key === "m" || e.key === "M") {
                e.preventDefault();
                if (jwplayer && typeof jwplayer.getMute === "function") {
                    jwplayer.setMute(!jwplayer.getMute());
                } else if (hlsVideo) {
                    hlsVideo.muted = !hlsVideo.muted;
                }
            }

            // T để toggle chế độ nhà hát (theater mode)
            if (e.key === "t" || e.key === "T") {
                e.preventDefault();
                setIsTheaterMode((prev) => !prev);
            }

            // N để chuyển sang tập tiếp theo
            if (e.key === "n" || e.key === "N") {
                e.preventDefault();
                playNextEpisode();
            }
        };

        window.addEventListener("keydown", handleVideoKeyDown);
        return () => window.removeEventListener("keydown", handleVideoKeyDown);
    }, [showImageModal, showShareModal]);

    // Get last watched episodes list
    const getLastWatchedList = useCallback(() => {
        return viewHistory || [];
    }, [viewHistory]);

    // Helper function to format episode name
    const formatEpisodeName = useCallback(
        (name) => {
            if (name && /^Tập \d+/.test(name)) {
                const num = parseInt(name.match(/\d+/)[0]);
                return `Tập ${num.toString().padStart(maxDigits, "0")}`;
            } else if (name && /^\d+/.test(name)) {
                const num = parseInt(name);
                return `Tập ${num.toString().padStart(maxDigits, "0")}`;
            }
            return name;
        },
        [maxDigits],
    );

    // Normalize movie fields depending on source
    function normalizeMovieForSource(item, source) {
        if (!item) return item;
        // Ensure we don't mutate unexpected prototypes
        const m = { ...item };

        // source_c: use thumb_url as poster_url for display
        if (source === SOURCES.SOURCE_C) {
            // Swap: poster_url <- thumb_url, thumbnail <- poster_url
            m.poster_url = getMovieImage(
                item.thumb_url || item.poster_url,
                source,
            );
            m.thumb_url = getMovieImage(
                item.poster_url || item.thumb_url,
                source,
            );

            // Additional mappings for source_c
            m.episode_current = m.current_episode;
            m.lang = m.language;
            m.content = m.description;
            m.actor = m.casts ? m.casts.split(", ") : [];
            m.director = m.director;

            // Flatten category from object to array
            if (m.category && typeof m.category === "object") {
                m.category = Object.values(m.category).flatMap(
                    (group) => group.list || [],
                );
            }
        } else if (source === SOURCES.SOURCE_O) {
            // Source O: use thumb_url as poster_url, thêm prefix uploads/movies/ nếu cần
            // IMPORTANT: read from original item values to avoid double-proxy
            let posterPath = item.thumb_url || item.poster_url;
            if (posterPath && !posterPath.startsWith("uploads/movies/")) {
                posterPath = `uploads/movies/${posterPath}`;
            }
            m.poster_url = getMovieImage(posterPath, source);

            let thumbPath = item.poster_url || item.thumb_url;
            if (thumbPath && !thumbPath.startsWith("uploads/movies/")) {
                thumbPath = `uploads/movies/${thumbPath}`;
            }
            m.thumb_url = getMovieImage(thumbPath, source);

            // Additional mappings for source_o
            m.trailer_url = m.trailer_url;
        } else {
            // primary: ensure poster_url exists
            if (!m.poster_url)
                m.poster_url = getMovieImage(
                    m.poster_url || m.thumb_url || m.image || "",
                    source,
                );
        }

        // Ensure poster field exists for history/list usage
        if (!m.poster_url) m.poster_url = m.thumb_url || "";
        if (!m.thumb_url) m.thumb_url = m.poster_url || "";

        return m;
    }

    // Fetch movie data from primary source (returns data instead of setting state)
    async function fetchPrimaryMovieData() {
        try {
            const res = await fetch(`${CONFIG.API_ENDPOINT}/${slug}`);
            const json = await res.json();
            const data = json || {};
            if (data.status && data.movie) {
                const normalizedMovie = normalizeMovieForSource(
                    data.movie,
                    "primary",
                );

                // Lọc episodes: chỉ giữ lại Vietsub, Thuyết Minh, Lồng Tiếng
                const allowedTypes = ["Vietsub", "Thuyết Minh", "Lồng Tiếng"];
                const filteredEpisodes = (data.episodes || [])
                    .filter((episode) => {
                        const serverName = episode.server_name || "";
                        return allowedTypes.some((type) =>
                            serverName
                                .toLowerCase()
                                .includes(type.toLowerCase()),
                        );
                    })
                    .map((episode) => {
                        // Chuẩn hóa tên tab: chỉ giữ lại loại phụ đề
                        let displayName = episode.server_name;
                        allowedTypes.forEach((type) => {
                            if (
                                displayName
                                    .toLowerCase()
                                    .includes(type.toLowerCase())
                            ) {
                                displayName = type;
                            }
                        });
                        return {
                            ...episode,
                            original_server_name: episode.server_name, // Lưu lại tên gốc
                            server_name: displayName, // Tên hiển thị đã chuẩn hóa
                        };
                    });

                return { movie: normalizedMovie, episodes: filteredEpisodes };
            }
        } catch (err) {
            console.error("Error fetching primary movie data:", err);
        }
        return null;
    }

    // Fetch movie details for primary source
    async function fetchPrimaryMovieDetails() {
        setIsLoading(true);
        try {
            const data = await fetchPrimaryMovieData();
            if (data) {
                setMovie(data.movie);
                setEpisodes(data.episodes);

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

                if (data.episodes.length > 0) {
                    setActiveEpisode(data.episodes[0]);
                    initializeFromUrl(data.episodes);
                }
            } else {
                setErrorMessage(
                    "Failed to load movie details from primary source.",
                );
            }
        } catch (err) {
            console.error("Error fetching primary movie details:", err);
            setErrorMessage(
                "Failed to load movie details from primary source.",
            );
        } finally {
            setIsLoading(false);
        }
    }

    // Fetch movie data from source_c (returns data instead of setting state)
    async function fetchSourceCMovieData() {
        try {
            const res = await fetch(
                `${CONFIG.APP_DOMAIN_SOURCE_C}/api/film/${slug}`,
            );
            const json = await res.json();
            const data = json || {};
            if (data.status === "success" && data.movie) {
                const normalizedMovie = normalizeMovieForSource(
                    data.movie,
                    "source_c",
                );

                // Normalize episodes for source_c
                let episodesData = [];
                if (data.movie.episodes && Array.isArray(data.movie.episodes)) {
                    episodesData = data.movie.episodes.map((ep) => ({
                        server_name: ep.server_name,
                        server_data: ep.items.map((item) => ({
                            name: item.name,
                            slug: item.slug,
                            link_embed: item.embed,
                            link_m3u8: item.m3u8,
                        })),
                    }));
                } else {
                    console.error(
                        "Episodes data is not an array or undefined:",
                        data.movie.episodes,
                    );
                }

                // Lọc episodes: chỉ giữ lại Vietsub, Thuyết Minh, Lồng Tiếng
                const allowedTypes = ["Vietsub", "Thuyết Minh", "Lồng Tiếng"];
                const filteredEpisodes = (episodesData || [])
                    .filter((episode) => {
                        const serverName = episode.server_name || "";
                        return allowedTypes.some((type) =>
                            serverName
                                .toLowerCase()
                                .includes(type.toLowerCase()),
                        );
                    })
                    .map((episode) => {
                        // Chuẩn hóa tên tab: chỉ giữ lại loại phụ đề
                        let displayName = episode.server_name;
                        allowedTypes.forEach((type) => {
                            if (
                                displayName
                                    .toLowerCase()
                                    .includes(type.toLowerCase())
                            ) {
                                displayName = type;
                            }
                        });
                        return {
                            ...episode,
                            original_server_name: episode.server_name, // Lưu lại tên gốc
                            server_name: displayName, // Tên hiển thị đã chuẩn hóa
                        };
                    });

                return { movie: normalizedMovie, episodes: filteredEpisodes };
            }
        } catch (err) {
            console.error("Error fetching source_c movie data:", err);
        }
        return null;
    }

    // Fetch movie details for source_c
    async function fetchSourceCMovieDetails() {
        setIsLoading(true);
        try {
            const data = await fetchSourceCMovieData();
            if (data) {
                setMovie(data.movie);
                setEpisodes(data.episodes);

                // Source C không có TMDb data, skip

                if (data.episodes.length > 0) {
                    setActiveEpisode(data.episodes[0]);
                    initializeFromUrl(data.episodes);
                }
            } else {
                setErrorMessage("Failed to load movie details from source_c.");
            }
        } catch (err) {
            console.error("Error fetching source_c movie details:", err);
            setErrorMessage("Failed to load movie details from source_c.");
        } finally {
            setIsLoading(false);
        }
    }

    // Fetch movie data from source_o (returns data instead of setting state)
    async function fetchSourceOMovieData() {
        try {
            const response = await fetch(
                `${CONFIG.APP_DOMAIN_SOURCE_O}/v1/api/phim/${slug || ""}`,
            );
            if (response.ok) {
                const data = await response.json();
                if (data && data.data && data.data.item) {
                    const movieData = normalizeMovieForSource(
                        data.data.item,
                        "source_o",
                    );
                    const episodesData = data.data.item.episodes || [];
                    return { movie: movieData, episodes: episodesData };
                }
            }
        } catch (err) {
            console.error("Error fetching source_o movie data:", err);
        }
        return null;
    }

    // Fetch movie details for source_o
    async function fetchSourceOMovieDetails() {
        setIsLoading(true);
        try {
            const data = await fetchSourceOMovieData();
            if (data) {
                setMovie(data.movie);
                setEpisodes(data.episodes);
                setActiveEpisode(
                    data.episodes && data.episodes.length > 0
                        ? data.episodes[0]
                        : null,
                );

                // Fetch TMDb data if available
                if (data.movie.tmdb && data.movie.tmdb.id) {
                    fetchTmdbMovieData(data.movie.tmdb.id);
                    fetchTmdbCredits(data.movie.tmdb.id);
                    fetchTmdbImages(data.movie.tmdb.id);
                }
            } else {
                setErrorMessage("Failed to load movie details from source_o.");
            }
        } catch (err) {
            console.error("Error fetching source_o movie details:", err);
            setErrorMessage("Failed to load movie details from source_o.");
        } finally {
            setIsLoading(false);
        }
    }

    // Fetch movie details from all sources
    async function fetchAllMovieDetails() {
        // Guard: nếu đang fetch thì không gọi lại
        if (isFetchingRef.current) {
            return;
        }
        isFetchingRef.current = true;
        setIsLoading(true || false);
        setEpisodes([]); // Clear previous episodes to avoid duplicates
        setActiveEpisode(null); // Reset active episode
        setCurrentEpisodeId(null); // Reset current episode ID
        try {
            const sources = [
                SOURCES.SOURCE_O,
                SOURCES.SOURCE_K,
                SOURCES.SOURCE_C,
            ];
            const results = await Promise.allSettled(
                sources.map(async (src) => {
                    try {
                        if (src === SOURCES.SOURCE_C) {
                            return await fetchSourceCMovieData();
                        } else if (src === SOURCES.SOURCE_O) {
                            return await fetchSourceOMovieData();
                        } else {
                            return await fetchPrimaryMovieData();
                        }
                    } catch (error) {
                        console.warn(`Failed to fetch from ${src}:`, error);
                        return null;
                    }
                }),
            );

            // Set movie from the first successful source
            let movieData = null;
            for (const result of results) {
                if (
                    result.status === "fulfilled" &&
                    result.value &&
                    result.value.movie
                ) {
                    movieData = result.value.movie;
                    setMovie(movieData);
                    break;
                }
            }

            // Merge episodes from all sources
            const allEpisodes = [];
            results.forEach((result, index) => {
                if (
                    result.status === "fulfilled" &&
                    result.value &&
                    result.value.episodes
                ) {
                    const src = sources[index];
                    // Add source prefix to server_name to avoid conflicts
                    const prefixedEpisodes = result.value.episodes.map(
                        (ep) => ({
                            ...ep,
                            server_name: `${src.toUpperCase()} - ${ep.server_name}`,
                        }),
                    );
                    allEpisodes.push(...prefixedEpisodes);
                }
            });

            // Filter out episodes with no server_data
            const filteredEpisodes = allEpisodes.filter(
                (ep) => ep.server_data && ep.server_data.length > 0,
            );

            // Remove duplicate episodes based on server_name
            const uniqueEpisodes = filteredEpisodes.filter(
                (ep, index, self) =>
                    index ===
                    self.findIndex((e) => e.server_name === ep.server_name),
            );

            setEpisodes(uniqueEpisodes);

            // Fetch TMDb data if movie has tmdb info
            if (movieData && movieData.tmdb && movieData.tmdb.id) {
                const tmdbId = movieData.tmdb.id;
                const tmdbType = movieData.tmdb.type || "movie";

                if (tmdbType === "movie") {
                    fetchTmdbMovieData(tmdbId);
                } else if (tmdbType === "tv") {
                    fetchTmdbTvData(tmdbId);
                }

                fetchTmdbCredits(tmdbId, tmdbType);
                fetchTmdbImages(tmdbId, tmdbType);
            } else {
            }

            // Nếu có episode sau khi lọc/unique, set active từ `uniqueEpisodes`
            // để tránh trường hợp `activeEpisode` không tồn tại trong `episodes`
            if (uniqueEpisodes.length > 0) {
                setActiveEpisode(uniqueEpisodes[0]);
            }
        } catch (err) {
            console.error("Error fetching all movie details:", err);
            setErrorMessage("Failed to load movie details from all sources.");
        } finally {
            isFetchingRef.current = false;
            setIsLoading(false);
        }
    }

    // Fetch movie details
    async function fetchMovieDetails() {
        await fetchAllMovieDetails();
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

                // Fetch videos
                const videosResponse = await fetch(
                    `${CONFIG.TMDB_BASE_URL}/movie/${tmdbId}/videos?api_key=${apiKey}&language=vi`,
                );
                if (videosResponse.ok) {
                    const videosData = await videosResponse.json();
                    setTmdbVideos(videosData.results || []);
                }
            }
        } catch (err) {
            // Failed to fetch TMDb data
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

                // Fetch videos
                const videosResponse = await fetch(
                    `${CONFIG.TMDB_BASE_URL}/tv/${tmdbId}/videos?api_key=${apiKey}&language=vi`,
                );
                if (videosResponse.ok) {
                    const videosData = await videosResponse.json();
                    setTmdbVideos(videosData.results || []);
                }
            }
        } catch (err) {
            // Failed to fetch TMDb TV data
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
            // Failed to fetch TMDb credits
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
            // Failed to fetch TMDb images
        }
    }

    // Initialize from URL parameters - ưu tiên: URL param → last watched → tập đầu
    function initializeFromUrl(episodesList, movie) {
        // Skip nếu đã initialize rồi
        if (hasInitializedRef.current) {
            return;
        }

        // Ưu tiên 1: Nếu có URL parameter ?episode=xxx&server=xxx
        if (episodeParam) {
            let targetEpisode = null;
            let targetServer = null;

            // Nếu có cả episode và server param
            if (serverParam) {
                const serverName = slugToServerName(serverParam); // Convert "thuyet-minh" → "Thuyết Minh"
                const episodeNum = episodeParam; // Số tập

                // Tìm episode có server type này với số tập này
                // Tìm episode có server type này với số tập này
                // Use robust slug matching
                targetEpisode = episodesList.find((episode) => {
                    const currentServerSlug = serverNameToSlug(
                        episode.server_name,
                    );
                    // Check fast match or slug match
                    // serverParam is already slugified (mostly) or we received it as is
                    // serverName is from slugToServerName() which might be raw slug if no mapping
                    const isServerMatch =
                        currentServerSlug === serverParam ||
                        (serverParam &&
                            (currentServerSlug.includes(serverParam) ||
                                serverParam.includes(currentServerSlug)));

                    if (!isServerMatch) return false;

                    return episode.server_data?.some((server) =>
                        compareEpisodeKeys(
                            getEpisodeKey(server.slug, server.name),
                            episodeNum,
                        ),
                    );
                });

                if (targetEpisode) {
                    targetServer = targetEpisode.server_data.find((server) =>
                        compareEpisodeKeys(
                            getEpisodeKey(server.slug, server.name),
                            episodeNum,
                        ),
                    );
                }
            }

            // Nếu không tìm thấy bằng server param, fallback về tìm theo episode number
            if (!targetEpisode) {
                // Tìm episode có chứa tập với số episode này (vd: episode=01 → tìm "tap-01", "tap-1", etc.)
                targetEpisode = episodesList.find((episode) =>
                    episode.server_data?.some((server) => {
                        const serverEpisodeKey = getEpisodeKey(
                            server.slug,
                            server.name,
                        );
                        return (
                            compareEpisodeKeys(
                                serverEpisodeKey,
                                episodeParam,
                            ) ||
                            compareEpisodeKeys(
                                serverEpisodeKey,
                                episodeParam.replace(/^0+/, ""),
                            ) || // "01" → "1"
                            server.slug.includes(`tap-${episodeParam}`) ||
                            server.slug.includes(`episode-${episodeParam}`)
                        );
                    }),
                );

                if (targetEpisode) {
                    // Kiểm tra lịch sử để ưu tiên server type đã lưu
                    const lastWatchedList = getLastWatchedList();
                    const movieData = lastWatchedList.find(
                        (item) => item.slug === slug, // Sửa lỗi: movieSlug → slug
                    );

                    const savedServerSlug = movieData?.server; // "thuyet-minh", "vietsub", etc.

                    // Ưu tiên server cùng type đã lưu
                    if (savedServerSlug) {
                        const savedServerName =
                            slugToServerName(savedServerSlug);
                        targetServer = targetEpisode.server_data.find(
                            (server) =>
                                server.server_name === savedServerName ||
                                server.server_name?.endsWith(
                                    ` - ${savedServerName}`,
                                ),
                        );
                    }

                    // Fallback: server đầu tiên có tập này
                    if (!targetServer) {
                        targetServer = targetEpisode.server_data.find(
                            (server) => {
                                const serverEpisodeKey = getEpisodeKey(
                                    server.slug,
                                    server.name,
                                );
                                return (
                                    serverEpisodeKey === episodeParam ||
                                    serverEpisodeKey ===
                                        episodeParam.replace(/^0+/, "") ||
                                    server.slug.includes(
                                        `tap-${episodeParam}`,
                                    ) ||
                                    server.slug.includes(
                                        `episode-${episodeParam}`,
                                    )
                                );
                            },
                        );
                    }
                }
            }

            if (targetEpisode && targetServer) {
                hasInitializedRef.current = true;
                setActiveEpisode(targetEpisode);
                openEpisode(targetServer, targetEpisode, movie);
                return;
            }
        }

        // Ưu tiên 2: Tìm tập đang xem từ lịch sử (khi reload không có URL param)
        const lastWatchedList = getLastWatchedList();
        const cleanSlug = slug.split("?")[0]; // Dùng slug hiện tại
        const historyItem = lastWatchedList.find(
            (item) => item.slug === cleanSlug,
        );

        if (
            historyItem?.current_episode?.key !== undefined &&
            episodesList.length > 0
        ) {
            // Tìm episode có chứa tập đang xem
            // Tìm episode có chứa tập đang xem
            const episodeKey = historyItem.current_episode.key;
            const savedServerSlug = historyItem.server; // "thuyet-minh", "vietsub", etc.

            // Filter all groups containing this episode
            const groupsWithEpisode = episodesList.filter((episode) =>
                episode.server_data?.some((server) => {
                    const serverKey = getEpisodeKey(server.slug, server.name);
                    return compareEpisodeKeys(serverKey, episodeKey);
                }),
            );

            let matchingEpisode = null;
            if (groupsWithEpisode.length > 0) {
                if (savedServerSlug) {
                    // Try to find matching group
                    matchingEpisode = groupsWithEpisode.find((group) => {
                        const currentSlug = serverNameToSlug(group.server_name);
                        return (
                            currentSlug === savedServerSlug ||
                            currentSlug.includes(savedServerSlug) ||
                            savedServerSlug.includes(currentSlug) ||
                            (savedServerSlug === "vietsub" &&
                                currentSlug.includes("vietsub"))
                        );
                    });
                }
                // Fallback to first group if no preferred server found
                if (!matchingEpisode) {
                    matchingEpisode = groupsWithEpisode[0];
                }
            }

            if (matchingEpisode) {
                // Ưu tiên 1: Tìm server cùng type đã lưu (từ slug server)
                // savedServerSlug was extracted above
                let targetServer = null;

                if (savedServerSlug) {
                    // Normalize saved slug and current server slugs for robust comparison
                    targetServer = matchingEpisode.server_data.find(
                        (server) => {
                            if (!server || !server.server_name) return false;
                            const currentSlug = serverNameToSlug(
                                server.server_name,
                            );
                            // 1. Exact match (new format: source_o-vietsub)
                            // 2. Fuzzy match (legacy format: vietsub)
                            // 3. Reverse fuzzy (legacy saved as "Vietsub" capitalized?) - no, standard is lowercase slug
                            return (
                                currentSlug === savedServerSlug ||
                                currentSlug.includes(savedServerSlug) ||
                                savedServerSlug.includes(currentSlug) ||
                                (savedServerSlug === "vietsub" &&
                                    currentSlug.includes("vietsub"))
                            );
                        },
                    );
                }

                // Ưu tiên 2: Nếu không tìm thấy server cùng type, dùng server đầu tiên khớp episode
                if (!targetServer) {
                    targetServer = matchingEpisode.server_data.find(
                        (server) => {
                            if (!server) return false;
                            const serverKey = getEpisodeKey(
                                server.slug,
                                server.name,
                            );
                            return compareEpisodeKeys(serverKey, episodeKey);
                        },
                    );
                }

                if (targetServer) {
                    hasInitializedRef.current = true;
                    setActiveEpisode(matchingEpisode);
                    // Truyền episode để lưu server_name đúng
                    openEpisode(targetServer, matchingEpisode, movie);

                    // Cập nhật URL với đầy đủ thông tin
                    const params = new URLSearchParams();
                    // Slug is already in the path, do not add it as query param
                    params.set("episode", episodeKey); // Số tập
                    params.set(
                        "server",
                        serverNameToSlug(matchingEpisode.server_name),
                    ); // Server type
                    window.history.replaceState(
                        {},
                        "",
                        `?${params.toString()}`,
                    );
                    return;
                }
            }
        }

        // Ưu tiên 3 (fallback): Tập đầu tiên
        if (episodesList.length > 0) {
            // Check history for saved state before falling back to absolute default
            const lastWatchedList = getLastWatchedList();
            const movieData = lastWatchedList.find(
                (item) => item.slug === slug,
            );

            if (movieData) {
                const savedServerSlug = movieData.server;
                const savedEpisodeSlug = movieData.episode; // stored as slug e.g. "tap-1"

                if (savedEpisodeSlug) {
                    // Try to find the episode group that contains this episode
                    // Logic: Iterate all server groups, check if any server data item matches savedEpisodeSlug
                    // Note: episodesList is array of server groups (e.g. Vietsub, Thuyet Minh)
                    // savedEpisodeSlug is specific episode (e.g. tap-1)

                    // Find valid server group (episode group)
                    let savedGroup = episodesList.find((group) =>
                        group.server_data?.some(
                            (s) => s.slug === savedEpisodeSlug,
                        ),
                    );

                    // Fallback: match by number if slug doesn't match
                    // e.g. saved "tap-1", group has "Tap 1" with different slug format
                    if (!savedGroup) {
                        const match = savedEpisodeSlug.match(/(\d+)/);
                        if (match) {
                            const num = parseInt(match[1]);
                            savedGroup = episodesList.find((group) =>
                                group.server_data?.some((s) =>
                                    compareEpisodeKeys(
                                        getEpisodeKey(s.slug, s.name),
                                        num,
                                    ),
                                ),
                            );
                        }
                    }

                    if (savedGroup) {
                        let targetServerData = null;

                        // If we have a saved server preference, try to find that specific server in the group
                        if (savedServerSlug) {
                            // Normalize for comparison
                            targetServerData = savedGroup.server_data.find(
                                (s) => {
                                    // We need to compare specific server item's type/source against savedServerSlug?
                                    // savedServerSlug is like "source_o-vietsub" or "vietsub"
                                    // s.slug is episode slug (tap-1).
                                    // Wait, savedServerSlug refers to the SERVER GROUP TYPE usually?
                                    // No, in setWatchlist: `setWatchlist(server.slug...` and `server` is `server.slug`?
                                    // Let's check setWatchlist: `setWatchlist(server.slug, ...)` -> line 2326: `setWatchlist(server.slug...`
                                    // server here is `server_data[i]`. So `server.slug` is "tap-1".
                                    // WRONG. `setWatchlist` signature: `(episodeSlug, position, ...)`
                                    // line 2326: `setWatchlist(server.slug, null, server, movie)`
                                    // So savedEpisodeSlug = server.slug ("tap-1").
                                    // savedServerSlug = movieData.server (from `server` object passed to setWatchlist).
                                    // But setWatchlist implementation: `server: episode ? extractServerType(episode.server_name) : ...`?
                                    // Let's check `setWatchlist` implementation if possible.
                                    // Assuming `movieData.server` is the server group slug (e.g. "vietsub").
                                    return false; // Complex logic, fallback to simple find
                                },
                            );
                        }

                        // Simpler approach: If we found the group containing the episode, just use that group
                        // And find the specific server item that matches the episode slug
                        targetServerData = savedGroup.server_data.find(
                            (s) =>
                                s.slug === savedEpisodeSlug ||
                                (savedEpisodeSlug.match(/(\d+)/) &&
                                    compareEpisodeKeys(
                                        getEpisodeKey(s.slug, s.name),
                                        parseInt(
                                            savedEpisodeSlug.match(/(\d+)/)[1],
                                        ),
                                    )),
                        );

                        if (targetServerData) {
                            hasInitializedRef.current = true;
                            setActiveEpisode(savedGroup);
                            openEpisode(targetServerData, savedGroup, movie);
                            return;
                        }
                    }
                }
            }

            const firstEpisode = episodesList[0];
            hasInitializedRef.current = true;
            setActiveEpisode(firstEpisode);
            if (firstEpisode.server_data?.length > 0) {
                // Truyền episode để lưu server_name đúng
                openEpisode(firstEpisode.server_data[0], firstEpisode, movie);
            }
        }
    }

    // Add to watch history
    // Helper function: Extract episode number từ slug (linh hoạt với nhiều format)
    function getEpisodeKey(episodeSlug, episodeName = "") {
        // Defensive: coerce to string so callers can pass undefined/null safely
        let slugStr =
            typeof episodeSlug === "string"
                ? episodeSlug
                : String(episodeSlug || "");

        // Nếu slug rỗng, fallback sang episodeName
        if (!slugStr && episodeName) {
            slugStr =
                typeof episodeName === "string"
                    ? episodeName
                    : String(episodeName);
        }

        // Nếu vẫn rỗng, trả về null để biết không có key hợp lệ
        if (!slugStr) {
            return null;
        }

        // Chỉ trả về "full" nếu name thực sự là "full"/"Full" (phim lẻ)
        if (slugStr.toLowerCase() === "full") {
            return "full";
        }

        // Tìm số đầu tiên trong slug (vd: "tap-3-vietsub" → 3, "episode-5" → 5, "3-long-tieng" → 3, "01" → 1, "28-End" → 28)
        const numberMatch = slugStr.match(/\d+/);
        if (numberMatch) {
            return parseInt(numberMatch[0], 10);
        }

        // Không tìm thấy số, trả về chuỗi gốc
        return slugStr;
    }

    // Normalize a saved key for consistent storage and comparison
    // If the key is purely numeric (string like "01" or number 1) -> return Number
    // Otherwise return the original string form
    function normalizeKey(key) {
        if (key === null || key === undefined) return key;
        if (typeof key === "number") return key;
        const s = String(key).trim();
        if (/^\d+$/.test(s)) return parseInt(s, 10);
        return s;
    }

    // Helper function: So sánh 2 key episode (hỗ trợ cả string và number)
    function compareEpisodeKeys(key1, key2) {
        const normalized1 = normalizeKey(key1);
        const normalized2 = normalizeKey(key2);
        return normalized1 === normalized2;
    }

    // Helper function: Extract server type từ server name (vd: "#Hà Nội (Vietsub)" → "Vietsub")
    function extractServerType(serverName) {
        if (!serverName) return "";

        // Tìm text trong ngoặc đơn cuối cùng
        const match = serverName.match(/\(([^)]+)\)$/);
        if (match) {
            return match[1]; // "Vietsub", "Thuyết Minh", "Lồng Tiếng"
        }

        // Fallback: tìm các keywords trong string
        if (serverName.toLowerCase().includes("vietsub")) return "Vietsub";
        if (
            serverName.toLowerCase().includes("thuyết minh") ||
            serverName.toLowerCase().includes("thuyet minh")
        )
            return "Thuyết Minh";
        if (
            serverName.toLowerCase().includes("lồng tiếng") ||
            serverName.toLowerCase().includes("long tieng")
        )
            return "Lồng Tiếng";

        return serverName;
    }

    // Helper function: Chuẩn hóa server name thành URL slug
    function serverNameToSlug(serverName) {
        if (!serverName) return "";
        // Handle "SOURCE - Type" format
        // VD: "SOURCE_O - Vietsub" -> "source_o-vietsub"
        return serverName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
    }

    // Helper function: Chuẩn hóa URL slug thành server name
    function slugToServerName(slug) {
        // Basic mapping for legacy/simple slugs, but for complex ones we rely on slug matching
        const mapping = {
            vietsub: "Vietsub",
            "thuyet-minh": "Thuyết Minh",
            "long-tieng": "Lồng Tiếng",
        };
        return mapping[slug] || slug; // Return strict slug if not found, logic elsewhere handles regex/fuzzy match
    }

    // Helper function: Lấy position đã xem của episode từ lịch sử
    function getLastWatchedPosition(episodeSlug, episodeName = "") {
        // Tìm movieData trong history bằng slug hiện tại
        const cleanSlug = slug.split("?")[0];
        const movieData = viewHistory.find((item) => item.slug === cleanSlug);

        if (!movieData || !movieData.episodes) {
            return 0;
        }

        const episodeKey = normalizeKey(
            getEpisodeKey(episodeSlug, episodeName),
        );

        const episodeData = movieData.episodes.find((ep) =>
            compareEpisodeKeys(ep.key, episodeKey),
        );

        return episodeData?.position || 0;
    }

    // Set watchlist - save current episode & position
    // Arrow function chuẩn, luôn lưu đầy đủ name và poster
    const setWatchlist = (
        episodeSlug,
        position = null,
        episode = null,
        movie = {},
    ) => {
        // Lấy tên episode để fallback khi slug rỗng
        const episodeName = episode?.name || episode?.server_name || "";
        // Lấy key tập phim (raw) rồi normalize để lưu/so sánh nhất quán
        const episodeKeyRaw = getEpisodeKey(episodeSlug, episodeName);
        const episodeKey = normalizeKey(episodeKeyRaw);

        // Không lưu nếu không có key hợp lệ
        if (episodeKey === null || episodeKey === undefined) {
            console.warn(
                "Không lưu history: không tìm được episode key từ slug/name",
                { episodeSlug, episodeName },
            );
            return;
        }

        // Format episode value để hiển thị đẹp (vd: "Tập 3", "full", etc.)
        const formatEpisodeValue = () => {
            // Ưu tiên 1: Dùng episode.name nếu có
            if (episode?.name) return episode.name;
            // Ưu tiên 2: Nếu key là "full" hoặc "trailer"
            const keyStr = String(episodeKey).toLowerCase();
            if (keyStr === "full") return "Full";
            if (keyStr === "trailer") return "Trailer";
            // Ưu tiên 3: Nếu key là số, format thành "Tập X"
            if (typeof episodeKey === "number" || /^\d+$/.test(keyStr)) {
                return `Tập ${episodeKey}`;
            }
            // Fallback: trả về episodeSlug
            return episodeSlug;
        };
        const episodeValue = formatEpisodeValue();

        // Lấy lịch sử hiện tại (copy)
        let history = Array.isArray(viewHistory) ? [...viewHistory] : [];
        // Tìm index của phim trong lịch sử theo slug (cleaned)
        const cleanSlug = slug.split("?")[0];
        let movieIndex = history.findIndex((item) => item.slug === cleanSlug);

        // Lấy thông tin phim hiện tại từ state
        const currentMovie = movie && movie.name ? movie : movie || {};
        // Đảm bảo luôn có name và poster
        const movieName = currentMovie.name || "Không rõ tên";
        const moviePoster = getMovieImage(
            currentMovie.poster_url ||
                currentMovie.poster ||
                currentMovie.thumb_url,
        );
        const movieServer =
            currentMovie.server || episode?.server_name || serverParam || "";

        // Nếu chưa có trong lịch sử thì thêm mới (với key đã normalize)
        if (movieIndex === -1) {
            history.unshift({
                slug: cleanSlug,
                name: movieName,
                poster: moviePoster,
                server: movieServer,
                current_episode: {
                    key: episodeKey,
                    value: episodeValue,
                },
                time: new Date().toISOString(),
                episodes: [
                    {
                        key: episodeKey,
                        position: typeof position === "number" ? position : 0,
                        timestamp: new Date().toISOString(),
                    },
                ],
            });
        } else {
            // Đã có trong lịch sử, cập nhật
            const movieData = history[movieIndex];
            // Ensure episodes array exists to avoid calling findIndex on undefined
            if (!Array.isArray(movieData.episodes)) {
                movieData.episodes = [];
            }

            // Normalize existing episode keys for this movie to avoid duplicates
            const dedupeMap = new Map();
            movieData.episodes.forEach((ep) => {
                const nk = normalizeKey(ep.key);
                const existing = dedupeMap.get(nk);
                if (!existing) {
                    dedupeMap.set(nk, { ...ep, key: nk });
                } else {
                    // Luôn giữ entry với position cao hơn
                    const existingPos = existing.position || 0;
                    const epPos = ep.position || 0;
                    if (epPos > existingPos) {
                        dedupeMap.set(nk, { ...ep, key: nk });
                    } else if (epPos === existingPos) {
                        // Position bằng nhau, giữ timestamp mới hơn
                        const existingTime = new Date(
                            existing.timestamp || 0,
                        ).getTime();
                        const epTime = new Date(ep.timestamp || 0).getTime();
                        if (epTime > existingTime) {
                            dedupeMap.set(nk, { ...ep, key: nk });
                        }
                    }
                }
            });
            movieData.episodes = Array.from(dedupeMap.values());

            movieData.name = movieName;
            movieData.poster = moviePoster;
            movieData.server = movieServer;
            movieData.current_episode = {
                key: episodeKey,
                value: episodeValue,
            };
            movieData.time = new Date().toISOString();

            // Kiểm tra nếu tập đã có (so sánh sau khi normalize) thì cập nhật position, ngược lại thêm mới
            const epIndex = movieData.episodes.findIndex(
                (ep) => normalizeKey(ep.key) === episodeKey,
            );
            if (epIndex === -1) {
                // Tập mới, chỉ lưu position nếu có giá trị (không ghi đè 0)
                movieData.episodes.push({
                    key: episodeKey,
                    position: typeof position === "number" ? position : 0,
                    timestamp: new Date().toISOString(),
                });
            } else {
                // Tập đã có, chỉ update position khi có giá trị cụ thể (không phải null/undefined)
                if (typeof position === "number") {
                    movieData.episodes[epIndex].position = position;
                }
                movieData.episodes[epIndex].timestamp =
                    new Date().toISOString();
                movieData.episodes[epIndex].key = normalizeKey(
                    movieData.episodes[epIndex].key,
                );
            }

            // Đưa lên đầu danh sách
            history.splice(movieIndex, 1);
            history.unshift(movieData);
        }

        setViewHistory(history);

        // Đồng bộ với Firestore nếu user đã đăng nhập (throttle 30 giây)
        if (currentUser && history.length > 0) {
            const now = Date.now();
            const THROTTLE_MS = 30000; // 30 giây

            if (now - lastFirestoreSyncRef.current >= THROTTLE_MS) {
                lastFirestoreSyncRef.current = now;
                const latestHistoryItem = history[0]; // Lấy mục vừa thêm/cập nhật (ở đầu list)
                addHistoryToFirestore(currentUser.uid, latestHistoryItem).catch(
                    (error) => {
                        console.error(
                            "Failed to sync history to Firestore:",
                            error,
                        );
                    },
                );
            }
        }
    };

    // Add custom rewind/forward buttons to JWPlayer
    function addCustomControls(player) {
        const controlbar = player
            .getContainer()
            .querySelector(".jw-controlbar");
        if (!controlbar) return;

        // Prevent duplicates
        if (controlbar.querySelector('[aria-label="Tua lùi 10 giây"]')) return;

        // Hide default rewind/forward buttons
        const defaults = controlbar.querySelectorAll(
            ".jw-icon-rewind, .jw-icon-forward, .jw-icon-next",
        );
        defaults.forEach((btn) => {
            btn.style.setProperty("display", "none", "important");
        });

        // Nút tua lùi 10s - tạo riêng biệt để khớp với structure JWPlayer
        const rewindBtn = document.createElement("div");
        rewindBtn.className =
            "jw-icon jw-icon-inline jw-button-color jw-reset jw-icon-rewind jw-custom-rewind";
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

        // Nút tua tiến 10s - tạo riêng biệt để khớp với structure JWPlayer
        const forwardBtn = document.createElement("div");
        forwardBtn.className =
            "jw-icon jw-icon-inline jw-button-color jw-reset jw-icon-forward jw-custom-forward";
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

        // Inject CSS to hide default buttons
        // Use a unique ID for the style tag to avoid duplication if function runs multiple times
        const styleId = "jw-custom-controls-style";
        if (!document.getElementById(styleId)) {
            const style = document.createElement("style");
            style.id = styleId;
            style.textContent = `
                .jw-icon-rewind:not(.jw-custom-rewind),
                .jw-icon-forward:not(.jw-custom-forward) {
                    display: none !important;
                }
            `;
            document.head.appendChild(style);
        }

        // Tìm vị trí để insert (sau nút play/pause)
        const playButton = controlbar.querySelector(".jw-icon-playback");
        if (playButton && playButton.parentElement) {
            // Insert mỗi button riêng biệt để giữ structure giống JWPlayer
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

        // // Thêm nút Theater Mode vào góc phải của controlbar
        // const theaterBtn = document.createElement("div");
        // theaterBtn.className =
        //     "jw-icon jw-icon-inline jw-button-color jw-reset jw-icon-theater";
        // theaterBtn.setAttribute("role", "button");
        // theaterBtn.setAttribute("tabindex", "0");
        // theaterBtn.setAttribute("aria-label", "Chế độ nhà hát");
        // theaterBtn.title = "Chế độ nhà hát";
        // theaterBtn.style.cssText = "cursor: pointer;";

        // Function để update icon theo state - dùng currentColor để khớp với theme
        const updateTheaterIcon = (isTheater) => {
            if (isTheater) {
                theaterBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                        <path fill="currentColor" d="M19 6H5c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/>
                    </svg>
                `;
            } else {
                theaterBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                        <path fill="currentColor" d="M19 4H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H5V6h14v12z"/>
                    </svg>
                `;
            }
            theaterBtn.title = isTheater
                ? "Thoát chế độ nhà hát"
                : "Chế độ nhà hát";
        };

        updateTheaterIcon(false);

        theaterBtn.onclick = () => {
            setIsTheaterMode((prev) => {
                const newValue = !prev;
                updateTheaterIcon(newValue);
                return newValue;
            });
        };

        // Insert theater button ở cuối controlbar (bên trái fullscreen button)
        const settingsButton =
            controlbar.querySelector(".jw-icon-settings") ||
            controlbar.querySelector(".jw-icon-fullscreen");
        if (settingsButton && settingsButton.parentElement) {
            settingsButton.parentElement.insertBefore(
                theaterBtn,
                settingsButton,
            );
        } else {
            controlbar.appendChild(theaterBtn);
        }
    }

    async function initializePlayer(server, episodeSlug, movie) {
        // Clear previous errors
        setErrorMessage(null);

        // Ưu tiên m3u8 cho Source O để autoplay
        let masterUrl = server.link_m3u8 || server.link_embed;

        if (!masterUrl) {
            // Fallback to trailer if available
            if (movie?.trailer_url) {
                let embedUrl = movie.trailer_url;
                if (embedUrl.includes("youtube.com/watch?v=")) {
                    const videoId = embedUrl.split("v=")[1].split("&")[0];
                    embedUrl = `https://www.youtube.com/embed/${videoId}`;
                }
                await setupEmbedPlayer(embedUrl, episodeSlug);
                return;
            }
            const trailer = tmdbVideos?.find(
                (v) => v.type === "Trailer" && v.site === "YouTube",
            );
            if (trailer) {
                await setupEmbedPlayer(
                    `https://www.youtube.com/embed/${trailer.key}`,
                    episodeSlug,
                );
                return;
            }
            setErrorMessage(
                "Không có link phát phim và trailer cho tập này. Vui lòng thử tập khác hoặc liên hệ admin.",
            );
            return;
        }

        const isMobile = isMobileDevice(debugMobile);

        // Skip nếu URL này đã đang play
        if (currentUrlRef.current === masterUrl) {
            return;
        }

        // Trên mobile, prefer HLS.js thay vì JWPlayer
        if (isMobile) {
            await setupHlsPlayer(masterUrl, episodeSlug, server.name);
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
                    // Failed to remove old player
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
                    image: movie?.thumb_url || movie?.poster_url || "",
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
                    const episodeKey = String(
                        getEpisodeKey(episodeSlug, server.name),
                    );
                    setCurrentEpisodeId(episodeKey);

                    // Lấy position đã xem từ lịch sử mới
                    const lastPosition = getLastWatchedPosition(
                        episodeSlug,
                        server.name,
                    );

                    if (lastPosition > 0) {
                        player.seek(lastPosition);
                        // Đánh dấu đã restore position cho episode này
                        positionRestoredRef.current = episodeKey;
                    } else if (skipIntroEnabledRef.current) {
                        // Tự động bỏ qua intro nếu không có position được lưu
                        player.seek(introDurationRef.current);
                    }

                    // Thêm custom controls: nút tua trước/sau 10 giây trên desktop
                    if (!isMobileDevice()) {
                        addCustomControls(player);
                    }

                    // Ẩn nút seek mặc định của JWPlayer (nếu có)
                });

                let lastSavedTime = 0;
                // Save playback position periodically
                player.on("time", (event) => {
                    const currentTime = Math.floor(event.position);
                    if (currentTime - lastSavedTime >= 5) {
                        lastSavedTime = currentTime;
                        // Truyền server object thay vì find() vì slug có thể rỗng
                        setWatchlist(episodeSlug, currentTime, server, movie);
                    }
                });

                // Auto-play next episode when finished
                player.on("complete", () => {
                    if (autoplayEnabledRef.current) {
                        playNextEpisode();
                    }
                });

                player.on("error", (event) => {
                    // Fallback to embed if available and different from current URL
                    if (server.link_embed && server.link_embed !== masterUrl) {
                        setupEmbedPlayer(
                            server.link_embed,
                            episodeSlug,
                            server.name,
                        );
                    } else {
                        setErrorMessage(`Playback error: ${event.message}`);
                    }
                });

                // Set lại âm lượng đã lưu khi player sẵn sàng
                try {
                    const savedVolume = getSavedVolume();
                    player.setVolume(Math.round(savedVolume * 100));
                } catch {}

                // Lưu lại âm lượng khi thay đổi
                player.on("volume", (evt) => {
                    if (evt && typeof evt.volume === "number") {
                        saveVolume(evt.volume / 100);
                    }
                });

                playerRef.current = { player };
                currentUrlRef.current = masterUrl; // Track URL đang play
            } else {
                throw new Error("JWPlayer not loaded");
            }
        } catch (err) {
            // Fallback to HLS.js player
            await setupHlsPlayer(masterUrl, episodeSlug, server.name);
        }
    }

    // Fallback embed player using iframe
    async function setupEmbedPlayer(embedUrl, episodeSlug, serverName = "") {
        try {
            const playerDiv = document.getElementById("player-container");
            if (!playerDiv) throw new Error("Player container not found");

            // Clear container
            playerDiv.innerHTML = "";

            // Create iframe with 16:9 aspect ratio
            const iframe = document.createElement("iframe");
            iframe.src = embedUrl;
            iframe.className = "w-full aspect-video";
            iframe.style.cssText = "border:none;";
            iframe.allowFullscreen = true;
            iframe.allow = "autoplay; encrypted-media";

            playerDiv.appendChild(iframe);

            // Set current episode - lưu key thay vì slug
            const episodeKey = String(getEpisodeKey(episodeSlug, serverName));
            setCurrentEpisodeId(episodeKey);
            currentUrlRef.current = embedUrl;
        } catch (err) {
            setErrorMessage(`Embed player setup failed: ${err.message}`);
        }
    }

    // Fallback HLS.js player for mobile/CORS issues
    async function setupHlsPlayer(masterUrl, episodeSlug, serverName = "") {
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
            video.volume = getSavedVolume();
            // Lưu lại âm lượng khi thay đổi
            video.addEventListener("volumechange", () => {
                saveVolume(video.volume);
            });
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
                    const episodeKey = String(
                        getEpisodeKey(episodeSlug, serverName),
                    );
                    setCurrentEpisodeId(episodeKey);
                    // Truyền object với name để fallback khi slug rỗng
                    setWatchlist(
                        episodeSlug,
                        null,
                        { name: serverName },
                        movie,
                    );

                    // Restore playback position từ lịch sử mới
                    const lastPosition = getLastWatchedPosition(
                        episodeSlug,
                        serverName,
                    );

                    if (lastPosition > 0) {
                        video.currentTime = lastPosition;
                        // Đánh dấu đã restore position cho episode này
                        positionRestoredRef.current = episodeKey;
                    } else if (skipIntroEnabledRef.current) {
                        // Tự động bỏ qua giới thiệu nếu không có position được lưu
                        video.currentTime = introDurationRef.current;
                    }
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
                        // Truyền object với name để fallback khi slug rỗng
                        setWatchlist(
                            episodeSlug,
                            currentTime,
                            { name: serverName },
                            movie,
                        );
                    }
                });

                // Auto-play next episode
                video.addEventListener("ended", () => {
                    if (autoplayEnabledRef.current) {
                        playNextEpisode();
                    }
                });

                playerRef.current = { player: video, hls };
                currentUrlRef.current = masterUrl;
            } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
                // Safari native HLS support
                video.src = masterUrl;
                video.addEventListener("loadedmetadata", () => {
                    setCurrentEpisodeId(episodeSlug);
                    // Truyền object với name để fallback khi slug rỗng
                    setWatchlist(
                        episodeSlug,
                        null,
                        { name: serverName },
                        movie,
                    );

                    // Restore playback position từ lịch sử mới
                    const lastPosition = getLastWatchedPosition(episodeSlug);

                    if (lastPosition > 0) {
                        video.currentTime = lastPosition;
                        // Đánh dấu đã restore position cho episode này
                        positionRestoredRef.current = episodeSlug;
                    } else if (skipIntroEnabledRef.current) {
                        // Tự động bỏ qua giới thiệu nếu không có position được lưu
                        video.currentTime = introDurationRef.current;
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
                        // Truyền object với name để fallback khi slug rỗng
                        setWatchlist(
                            episodeSlug,
                            currentTime,
                            { name: serverName },
                            movie,
                        );
                    }
                });

                // Auto-play next episode
                video.addEventListener("ended", () => {
                    if (autoplayEnabledRef.current) {
                        playNextEpisode();
                    }
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

    function openEpisode(server, episode = null, movie) {
        // Update document title - chỉ update khi có đầy đủ thông tin
        if (movie?.name) {
            const episodeName = server.name || "Trailer";
            document.title = `[${formatEpisodeName(episodeName)}] - ${movie.name}`;
        }

        // Reset position restored ref để cho phép restore position cho episode mới
        positionRestoredRef.current = null;

        // Lưu server ngay (không delay) - truyền server vì nó có .name để fallback khi slug rỗng
        setWatchlist(server.slug, null, server, movie);

        // Set current episode id immediately so UI highlights selection
        // Lưu key thay vì slug để đồng bộ với history
        try {
            const episodeKey = getEpisodeKey(server.slug, server.name);
            setCurrentEpisodeId(String(episodeKey));
        } catch (e) {
            // ignore
        }

        // Initialize player with server - ưu tiên m3u8, fallback embed nếu lỗi
        initializePlayer(server, server.slug, movie);

        // Update URL params
        const serverSlug = serverNameToSlug(episode.server_name);
        try {
            const episodeKey = getEpisodeKey(server.slug, server.name);
            setSearchParams(
                (prev) => {
                    const newParams = new URLSearchParams(prev);
                    newParams.delete("slug"); // Remove redundant slug if present
                    newParams.set("server", serverSlug);
                    newParams.set("episode", String(episodeKey));
                    return newParams;
                },
                { replace: true },
            );
        } catch (e) {
            // ignore
        }
    }

    // Play next episode
    function playNextEpisode() {
        if (!episodes || episodes.length === 0) return;

        // Lấy thông tin từ lịch sử
        const lastWatchedList = getLastWatchedList();
        const dataSlug = movie?.slug || slug.split("?")[0];
        const historyItem = lastWatchedList.find(
            (item) => item.slug === dataSlug,
        );

        if (!historyItem?.current_episode?.key) return;

        const currentEpisodeKey = historyItem.current_episode.key;

        // Xử lý trường hợp đặc biệt: phim lẻ (key = "full")
        if (currentEpisodeKey === "full") {
            setErrorMessage("Đây là phim lẻ, không có tập tiếp theo.");
            setTimeout(() => {
                setErrorMessage(null);
            }, 3000);
            return;
        }

        // Tìm tập hiện tại và tập tiếp theo dựa vào episode key
        let currentEpisode = null;
        let currentServerIndex = -1;
        let nextServer = null;

        // Tìm episode và server hiện tại
        for (const episode of episodes) {
            if (episode.server_data) {
                const serverIndex = episode.server_data.findIndex((server) => {
                    const serverKey = getEpisodeKey(server.slug, server.name);
                    return compareEpisodeKeys(serverKey, currentEpisodeKey);
                });
                if (serverIndex !== -1) {
                    currentEpisode = episode;
                    currentServerIndex = serverIndex;
                    break;
                }
            }
        }

        if (!currentEpisode || currentServerIndex === -1) {
            setErrorMessage("Không tìm thấy tập hiện tại.");
            setTimeout(() => {
                setErrorMessage(null);
            }, 3000);
            return;
        }

        // Tìm tập tiếp theo: ưu tiên tập tiếp theo trong cùng episode, sau đó tìm episode khác với cùng server type
        if (currentServerIndex + 1 < currentEpisode.server_data.length) {
            // Có tập tiếp theo trong cùng episode type
            nextServer = currentEpisode.server_data[currentServerIndex + 1];

            if (nextServer) {
                setActiveEpisode(currentEpisode);
                openEpisode(nextServer, currentEpisode, movie);
                return;
            }
        }

        // Không có tập tiếp theo trong cùng episode, tìm episode khác với cùng server type
        const savedServerSlug = historyItem.server; // "thuyet-minh", "vietsub", etc.

        if (savedServerSlug) {
            const savedServerName = slugToServerName(savedServerSlug); // Convert "thuyet-minh" → "Thuyết Minh"

            // Tìm episode tiếp theo có cùng server type
            const currentEpisodeIndex = episodes.findIndex(
                (ep) => ep === currentEpisode,
            );

            for (let i = currentEpisodeIndex + 1; i < episodes.length; i++) {
                const nextEpisode = episodes[i];

                // Tìm server đầu tiên trong episode này có cùng server type
                // So sánh với episode.server_name (đã chuẩn hóa) thay vì server.server_name
                if (
                    nextEpisode.server_name === savedServerName ||
                    nextEpisode.server_name.endsWith(` - ${savedServerName}`)
                ) {
                    // Lấy server đầu tiên trong episode này
                    const firstServer = nextEpisode.server_data?.[0];
                    if (firstServer) {
                        setActiveEpisode(nextEpisode);
                        openEpisode(firstServer, nextEpisode, movie);
                        return;
                    }
                }
            }
        }

        // Fallback: Tìm episode tiếp theo với server đầu tiên (nếu không tìm thấy cùng server type)
        const currentEpisodeIndex = episodes.findIndex(
            (ep) => ep === currentEpisode,
        );

        for (let i = currentEpisodeIndex + 1; i < episodes.length; i++) {
            const nextEpisode = episodes[i];

            if (nextEpisode.server_data?.length > 0) {
                const firstServer = nextEpisode.server_data[0];
                setActiveEpisode(nextEpisode);
                openEpisode(firstServer, nextEpisode, movie);
                return;
            }
        }

        // Không tìm thấy tập tiếp theo
        setErrorMessage("Đã xem hết tất cả các tập.");
        setTimeout(() => {
            setErrorMessage(null);
        }, 3000);
    }

    // Switch to different episode (tab) - try to keep same server, fallback to first
    function switchTab(episode) {
        // Lưu giá trị hiện tại (trước khi set state mới) vào biến cục bộ
        const prevActive = activeEpisode;
        const prevEpisodeId = currentEpisodeId;

        // Determine desired episode key: prefer currently playing episode, then URL param
        const desiredEpisodeKey = prevEpisodeId
            ? getEpisodeKey(prevEpisodeId)
            : episodeParam
              ? getEpisodeKey(episodeParam)
              : null;

        // 1) Try to find server in this tab that matches the desired episode key
        if (desiredEpisodeKey !== null && desiredEpisodeKey !== undefined) {
            // Match by slug-extracted key first
            let matchByKey = episode.server_data?.find((server) =>
                compareEpisodeKeys(
                    getEpisodeKey(server.slug, server.name),
                    desiredEpisodeKey,
                ),
            );

            // If not found, try parsing server.name (e.g. "Tập 5" or "5")
            if (!matchByKey) {
                matchByKey = episode.server_data?.find((server) => {
                    if (!server) return false;
                    const name = server.name || server.server_name || "";
                    const m = (name || "").toString().match(/\d+/);
                    const num = m ? parseInt(m[0], 10) : NaN;
                    if (!Number.isNaN(num)) {
                        return compareEpisodeKeys(num, desiredEpisodeKey);
                    }
                    return false;
                });
            }

            // If still not found, try server.slug pattern contains 'tap-X' or 'episode-X'
            if (!matchByKey) {
                const normalizedKey = normalizeKey(desiredEpisodeKey);
                matchByKey = episode.server_data?.find(
                    (server) =>
                        (server.slug || "").includes(
                            `tap-${String(normalizedKey)}`,
                        ) ||
                        (server.slug || "").includes(
                            `episode-${String(normalizedKey)}`,
                        ),
                );
            }

            if (matchByKey) {
                setActiveEpisode(episode);
                openEpisode(matchByKey, episode, movie);

                // Update URL params
                const serverSlug = serverNameToSlug(episode.server_name);
                try {
                    const episodeKey = getEpisodeKey(
                        matchByKey.slug,
                        matchByKey.name,
                    );
                    setSearchParams(
                        (prev) => {
                            const newParams = new URLSearchParams(prev);
                            newParams.delete("slug");
                            newParams.set("server", serverSlug);
                            newParams.set("episode", String(episodeKey));
                            return newParams;
                        },
                        { replace: true },
                    );
                } catch (e) {}
                return;
            }
        }

        // 2) Try to keep same server type as currently active (if any)
        if (prevActive?.server_name) {
            const currentServerType = extractServerType(prevActive.server_name);
            const matchingServer = episode.server_data?.find(
                (server) =>
                    extractServerType(server.server_name) === currentServerType,
            );
            if (matchingServer) {
                setActiveEpisode(episode);
                openEpisode(matchingServer, episode, movie);

                // Update URL params
                const serverSlug = serverNameToSlug(episode.server_name);
                try {
                    const episodeKey = getEpisodeKey(
                        matchingServer.slug,
                        matchingServer.name,
                    );
                    setSearchParams(
                        (prev) => {
                            const newParams = new URLSearchParams(prev);
                            newParams.delete("slug");
                            newParams.set("server", serverSlug);
                            newParams.set("episode", String(episodeKey));
                            return newParams;
                        },
                        { replace: true },
                    );
                } catch (e) {}
                return;
            }
        }

        // 3) Use saved server from history (if available)
        const lastWatchedList = getLastWatchedList();
        const movieData = lastWatchedList.find((item) => item.slug === slug);
        const savedServerSlug = movieData?.server; // "thuyet-minh", "vietsub", etc.

        if (savedServerSlug && savedServerSlug.trim() !== "") {
            const savedServerName = slugToServerName(savedServerSlug);
            const matchingServer = episode.server_data?.find(
                (server) =>
                    extractServerType(server.server_name) === savedServerName,
            );
            if (matchingServer) {
                setActiveEpisode(episode);
                openEpisode(matchingServer, episode, movie);

                // Update URL params
                const serverSlug = serverNameToSlug(episode.server_name);
                try {
                    const episodeKey = getEpisodeKey(
                        matchingServer.slug,
                        matchingServer.name,
                    );
                    setSearchParams(
                        (prev) => {
                            const newParams = new URLSearchParams(prev);
                            newParams.delete("slug");
                            newParams.set("server", serverSlug);
                            newParams.set("episode", String(episodeKey));
                            return newParams;
                        },
                        { replace: true },
                    );
                } catch (e) {}
                return;
            }
        }

        // 4) Try matching by exact slug (fallback)
        const matchingBySlug = episode.server_data?.find(
            (server) => server.slug === prevEpisodeId,
        );

        if (matchingBySlug) {
            setActiveEpisode(episode);
            openEpisode(matchingBySlug, episode, movie);

            // Update URL params
            const serverSlug = serverNameToSlug(episode.server_name);
            try {
                const episodeKey = getEpisodeKey(
                    matchingBySlug.slug,
                    matchingBySlug.name,
                );
                setSearchParams(
                    (prev) => {
                        const newParams = new URLSearchParams(prev);
                        newParams.delete("slug");
                        newParams.set("server", serverSlug);
                        newParams.set("episode", String(episodeKey));
                        return newParams;
                    },
                    { replace: true },
                );
            } catch (e) {}
            return;
        }

        // Final fallback: first available server
        if (episode.server_data?.length > 0) {
            setActiveEpisode(episode);
            openEpisode(episode.server_data[0], episode, movie);

            // Update URL params
            const serverSlug = serverNameToSlug(episode.server_name);
            try {
                const firstServer = episode.server_data[0];
                const episodeKey = getEpisodeKey(
                    firstServer.slug,
                    firstServer.name,
                );
                setSearchParams(
                    (prev) => {
                        const newParams = new URLSearchParams(prev);
                        newParams.set("server", serverSlug);
                        newParams.set("episode", String(episodeKey));
                        return newParams;
                    },
                    { replace: true },
                );
            } catch (e) {}
            return;
        }

        setErrorMessage("No servers available for this episode.");
    }

    // Favorite functions
    function isFavorited(slug) {
        return favorites.some((favorite) => favorite.slug === slug);
    }

    function toggleFavorite(movie) {
        const isCurrentlyFavorited = isFavorited(movie.slug);

        if (isCurrentlyFavorited) {
            // Remove favorite
            const newFavorites = favorites.filter(
                (favorite) => favorite.slug !== movie.slug,
            );
            setFavorites(newFavorites);
            setErrorMessage("Đã bỏ thích phim này!");
        } else {
            // Add favorite
            const favorite = {
                slug: movie.slug,
                name: movie.name,
                poster: getMovieImage(movie.poster_url || movie.thumb_url),
                year: movie.year,
                quality: movie.quality,
                time: new Date().toISOString(),
            };
            setFavorites([favorite, ...favorites]);
            setErrorMessage("Đã thêm vào danh sách yêu thích!");
        }

        // Auto hide message after 2 seconds
        setTimeout(() => {
            setErrorMessage(null);
        }, 2000);
    }

    // Share function - mở modal
    function shareMovie(movie) {
        setShowShareModal(true);
    }

    function copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard
                .writeText(text)
                .then(() => {
                    setShareMessage(t("vodPlay.copied"));
                    setTimeout(() => {
                        setShareMessage("");
                    }, 2000);
                })
                .catch(() => {
                    fallbackCopyTextToClipboard(text);
                });
        } else {
            fallbackCopyTextToClipboard(text);
        }
    }

    function fallbackCopyTextToClipboard(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            const successful = document.execCommand("copy");
            if (successful) {
                setErrorMessage(t("vodPlay.copied"));
                setTimeout(() => {
                    setErrorMessage(null);
                }, 2000);
            }
        } catch (err) {
            setErrorMessage(t("vodPlay.copyFailed"));
            setTimeout(() => {
                setErrorMessage(null);
            }, 2000);
        }

        document.body.removeChild(textArea);
    }

    return (
        <div>
            <LoadingSpinner isLoading={isLoading} />
            {errorMessage && (
                <div className="container mx-auto p-4">
                    <div className="rounded-md bg-red-900/50 p-4 text-red-300">
                        {errorMessage}
                    </div>
                </div>
            )}
            {/* Skeleton Loading cho toàn bộ trang */}
            {isLoading && !movie && (
                <main className="container mx-auto flex h-full flex-col gap-4 p-4">
                    {/* Skeleton Breadcrumb */}
                    <nav className="text-sm text-zinc-400">
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-20 animate-pulse rounded bg-zinc-600"></div>
                            <div>/</div>
                            <div className="h-4 w-40 animate-pulse rounded bg-zinc-600"></div>
                        </div>
                    </nav>

                    <div className="flex h-full w-full flex-col justify-start gap-4 lg:h-auto lg:flex-row lg:justify-center">
                        {/* Skeleton Player */}
                        <div className="flex w-full flex-col overflow-hidden rounded-md border-zinc-700 bg-zinc-800 shadow lg:w-8/12">
                            <div
                                className="w-full animate-pulse bg-zinc-600"
                                style={{ aspectRatio: "16/9" }}
                            ></div>
                        </div>

                        {/* Skeleton Episode List */}
                        <div className="flex w-full flex-col overflow-hidden rounded-md border border-zinc-700 bg-zinc-800 shadow lg:w-4/12">
                            {/* Skeleton Tabs */}
                            <div className="border-b-2 border-zinc-600 bg-zinc-700">
                                <ul className="flex list-none overflow-x-auto">
                                    {Array.from({ length: 3 }).map((_, i) => (
                                        <li key={i} className="px-6 py-3.5">
                                            <div className="h-5 w-20 animate-pulse rounded bg-zinc-600"></div>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Skeleton Episode Grid */}
                            <div className="grid h-fit max-h-96 auto-rows-max grid-cols-3 items-start gap-4 overflow-y-auto p-4 lg:h-0 lg:max-h-none lg:grow lg:grid-cols-4">
                                {Array.from({ length: 12 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="animate-pulse rounded-md border-2 border-transparent bg-zinc-700 px-3 py-2 text-center"
                                    >
                                        <div className="h-4 rounded bg-zinc-600"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Skeleton Movie Info */}
                    <div className="rounded-md border border-zinc-700 bg-zinc-800 p-4 shadow-md">
                        <div className="flex flex-col gap-4 lg:flex-row">
                            {/* Skeleton Poster */}
                            <div
                                className="hidden h-56 shrink-0 lg:block"
                                style={{ aspectRatio: "2/3" }}
                            >
                                <div className="h-full w-full animate-pulse rounded-md bg-zinc-600"></div>
                            </div>
                            <div
                                className="w-full shrink-0 lg:hidden"
                                style={{ aspectRatio: "16/9" }}
                            >
                                <div className="h-full w-full animate-pulse rounded-md bg-zinc-600"></div>
                            </div>

                            {/* Skeleton Content */}
                            <div className="flex grow flex-col gap-3">
                                {/* Skeleton Title */}
                                <div>
                                    <div className="mb-2 h-6 w-3/4 animate-pulse rounded bg-zinc-600"></div>
                                    <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-700"></div>
                                </div>

                                {/* Skeleton Tags */}
                                <div className="flex flex-wrap gap-2">
                                    {Array.from({ length: 4 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className="h-6 w-20 animate-pulse rounded-md bg-zinc-600"
                                        ></div>
                                    ))}
                                </div>

                                {/* Skeleton Categories */}
                                <div className="flex flex-wrap gap-2">
                                    {Array.from({ length: 4 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className="h-6 w-16 animate-pulse rounded-md bg-zinc-600"
                                        ></div>
                                    ))}
                                </div>

                                {/* Skeleton Actors */}
                                <div className="flex flex-wrap gap-2">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className="h-6 w-24 animate-pulse rounded-md bg-zinc-600"
                                        ></div>
                                    ))}
                                </div>

                                {/* Skeleton Description */}
                                <div className="space-y-2">
                                    <div className="h-4 animate-pulse rounded bg-zinc-600"></div>
                                    <div className="h-4 w-5/6 animate-pulse rounded bg-zinc-600"></div>
                                    <div className="h-4 w-4/6 animate-pulse rounded bg-zinc-600"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Skeleton Cast Section */}
                    <div>
                        <div className="mb-4 h-6 w-32 animate-pulse rounded bg-zinc-600"></div>
                        <div className="rounded-md border border-zinc-700 bg-zinc-800 p-6 shadow-md">
                            <div className="grid grid-cols-4 gap-4 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
                                {Array.from({ length: 10 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="flex flex-col items-center gap-2 text-center"
                                    >
                                        <div className="bg-linear-to-br h-16 w-16 animate-pulse rounded-full from-zinc-500 via-zinc-600 to-zinc-700"></div>
                                        <div className="w-32">
                                            <div className="mb-1 h-4 animate-pulse rounded bg-zinc-600"></div>
                                            <div className="h-3 w-3/4 animate-pulse rounded bg-zinc-700"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Skeleton Images Section */}
                    <div>
                        <div className="mb-4 h-6 w-36 animate-pulse rounded bg-zinc-600"></div>
                        <div className="rounded-md border border-zinc-700 bg-zinc-800 p-6 shadow-md">
                            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="animate-pulse overflow-hidden rounded-lg bg-zinc-600"
                                        style={{ aspectRatio: "16/9" }}
                                    ></div>
                                ))}
                            </div>
                        </div>
                    </div>
                </main>
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
            {/* Share Modal */}
            {showShareModal && movie && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    onClick={() => setShowShareModal(false)}
                >
                    <div
                        className="w-full max-w-md rounded-xl bg-zinc-800 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-zinc-700 px-6 py-4">
                            <h3 className="text-lg font-bold text-zinc-100">
                                {t("vodPlay.shareMovie")}
                            </h3>
                            <button
                                onClick={() => setShowShareModal(false)}
                                className="cursor-pointer rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
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
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            {/* Movie Info */}
                            <div className="mb-6 flex items-center gap-4">
                                <img
                                    src={movie.poster_url}
                                    alt={movie.name}
                                    className="h-20 w-14 rounded-md object-cover shadow-md"
                                />
                                <div className="flex-1">
                                    <h4 className="font-semibold text-zinc-100">
                                        {movie.name}
                                    </h4>
                                    <p className="text-sm text-zinc-400">
                                        {movie.origin_name}
                                    </p>
                                </div>
                            </div>

                            {/* Copy Link */}
                            <div className="">
                                <label className="mb-2 block text-sm font-medium text-zinc-300">
                                    {t("vodPlay.movieLink")}
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        readOnly
                                        value={window.location.href}
                                        className="flex-1 rounded-lg border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-200"
                                    />
                                    <button
                                        onClick={() =>
                                            copyToClipboard(
                                                window.location.href,
                                            )
                                        }
                                        className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                                    >
                                        Copy
                                    </button>
                                </div>
                                {shareMessage && (
                                    <p className="mt-2 text-sm text-green-400">
                                        {shareMessage}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {movie && (
                <>
                    <main className="container mx-auto flex h-full flex-col gap-4 p-4 lg:px-24">
                        {/* Breadcrumb Navigation with Actions */}
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <nav className="text-sm text-zinc-400">
                                <ul className="flex items-center gap-2">
                                    <li className="flex items-center">
                                        <a
                                            href="/entertainment/vods"
                                            className="flex items-center gap-1 text-blue-400 hover:underline"
                                        >
                                            {t("common.home")}
                                        </a>
                                    </li>
                                    <li>/</li>
                                    <li className="font-semibold text-zinc-100">
                                        {movie.name}
                                    </li>
                                </ul>
                            </nav>

                            {/* Quick Actions */}
                            <div className="flex items-center justify-end gap-2">
                                {/* Favorite Button */}
                                <button
                                    onClick={() => toggleFavorite(movie)}
                                    className={`flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                                        isFavorited(movie.slug)
                                            ? "bg-red-900/50 text-red-300 hover:bg-red-900/70"
                                            : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                                    }`}
                                >
                                    <svg
                                        className="h-4 w-4"
                                        fill={
                                            isFavorited(movie.slug)
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
                                    {isFavorited(movie.slug)
                                        ? t("vodPlay.liked")
                                        : t("vodPlay.like")}
                                </button>

                                {/* Share Button */}
                                <button
                                    onClick={() => shareMovie(movie)}
                                    className="flex cursor-pointer items-center gap-1 rounded-lg bg-blue-900/50 px-3 py-1.5 text-sm font-medium text-blue-300 transition-all hover:bg-blue-900/70"
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
                                            strokeWidth={2}
                                            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                                        />
                                    </svg>
                                    {t("common.share")}
                                </button>
                            </div>
                        </div>

                        <div
                            className={`flex h-full w-full flex-col justify-start gap-4 transition-all duration-300 ${
                                isTheaterMode
                                    ? "lg:flex-col"
                                    : "lg:h-auto lg:flex-row lg:justify-center"
                            }`}
                        >
                            {/* Player + Server Tabs */}
                            <div
                                className={`flex w-full flex-col overflow-hidden rounded-md border border-zinc-700 bg-zinc-800 shadow transition-all duration-300 ${
                                    isTheaterMode ? "lg:w-full" : "lg:w-8/12"
                                }`}
                            >
                                {/* Player */}
                                <div
                                    id="player-container"
                                    className="w-full overflow-hidden rounded-b-md"
                                    style={{ aspectRatio: "16/9" }}
                                ></div>
                                {/* Control Bar - Responsive */}
                                <div className="flex flex-col gap-2 border-zinc-700 bg-zinc-900/80 px-3 py-2 sm:px-4">
                                    {/* Hàng 1: Thông tin tập + Các nút action */}
                                    <div className="flex items-center justify-between gap-2">
                                        {/* Thông tin tập hiện tại */}
                                        <div className="flex items-center gap-2 text-sm text-zinc-400">
                                            {currentEpisodeId && (
                                                <span className="rounded bg-blue-600/20 px-2 py-0.5 uppercase text-blue-400">
                                                    {/^\d+$/.test(
                                                        currentEpisodeId,
                                                    )
                                                        ? `Tập ${currentEpisodeId}`
                                                        : currentEpisodeId}
                                                </span>
                                            )}
                                        </div>

                                        {/* Các nút action */}
                                        <div className="flex items-center gap-2">
                                            {/* Nút chế độ nhà hát - chỉ hiện trên desktop */}
                                            <button
                                                onClick={() =>
                                                    setIsTheaterMode(
                                                        !isTheaterMode,
                                                    )
                                                }
                                                className={`hidden cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all lg:flex ${
                                                    isTheaterMode
                                                        ? "bg-blue-500 text-white hover:opacity-90"
                                                        : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600 hover:text-white"
                                                }`}
                                                title={
                                                    isTheaterMode
                                                        ? "Thoát chế độ nhà hát (T)"
                                                        : "Bật chế độ nhà hát (T)"
                                                }
                                            >
                                                <svg
                                                    className="h-4 w-4"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    {isTheaterMode ? (
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
                                                        />
                                                    ) : (
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
                                                        />
                                                    )}
                                                </svg>
                                                <span className="hidden xl:inline">
                                                    {isTheaterMode
                                                        ? "Thu nhỏ"
                                                        : "Mở rộng"}
                                                </span>
                                            </button>

                                            {/* Nút tập tiếp theo */}
                                            <button
                                                onClick={playNextEpisode}
                                                className="flex cursor-pointer items-center gap-1 rounded-md bg-zinc-700 px-2 py-1.5 text-xs font-medium text-zinc-300 transition-all hover:bg-zinc-600 hover:text-white sm:gap-1.5 sm:px-3 sm:text-sm"
                                                title="Tập tiếp theo (N)"
                                            >
                                                <span>Tập tiếp</span>
                                                <svg
                                                    className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M13 5l7 7-7 7M5 5l7 7-7 7"
                                                    />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Hàng 2: Các switch settings */}
                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                        {/* Switch bỏ qua intro + input */}
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="flex cursor-pointer items-center gap-1.5 sm:gap-2"
                                                onClick={() =>
                                                    setSkipIntroEnabled(
                                                        !skipIntroEnabled,
                                                    )
                                                }
                                                title={
                                                    skipIntroEnabled
                                                        ? "Tắt tự động bỏ qua giới thiệu"
                                                        : "Bật tự động bỏ qua giới thiệu"
                                                }
                                            >
                                                <span className="text-xs text-zinc-400 sm:text-sm">
                                                    <span className="inline">
                                                        Bỏ qua giới thiệu
                                                    </span>
                                                </span>
                                                <div
                                                    className={`relative h-4 w-7 rounded-full transition-colors sm:h-5 sm:w-9 ${
                                                        skipIntroEnabled
                                                            ? "bg-blue-500"
                                                            : "bg-zinc-600"
                                                    }`}
                                                >
                                                    <div
                                                        className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform sm:h-4 sm:w-4 ${
                                                            skipIntroEnabled
                                                                ? "translate-x-3 sm:translate-x-4"
                                                                : "translate-x-0.5"
                                                        }`}
                                                    ></div>
                                                </div>
                                            </div>
                                            {/* Input thời gian intro */}
                                            {skipIntroEnabled && (
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="300"
                                                        value={introDuration}
                                                        onChange={(e) => {
                                                            const value =
                                                                Math.max(
                                                                    0,
                                                                    Math.min(
                                                                        300,
                                                                        parseInt(
                                                                            e
                                                                                .target
                                                                                .value,
                                                                        ) || 0,
                                                                    ),
                                                                );
                                                            setIntroDuration(
                                                                value,
                                                            );
                                                            const cleanSlug =
                                                                slug.split(
                                                                    "?",
                                                                )[0];
                                                            setIntroDurations(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    [cleanSlug]:
                                                                        value,
                                                                }),
                                                            );
                                                        }}
                                                        className="w-12 rounded bg-zinc-700 px-1.5 py-0.5 text-center text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-14 sm:px-2 sm:text-sm"
                                                        title="Thời gian intro (giây)"
                                                    />
                                                    <span className="text-[10px] text-zinc-500 sm:text-xs">
                                                        giây
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Switch tự động chuyển tập */}
                                        <div
                                            className="flex cursor-pointer items-center gap-1.5 sm:gap-2"
                                            onClick={() =>
                                                setAutoplayEnabled(
                                                    !autoplayEnabled,
                                                )
                                            }
                                            title={
                                                autoplayEnabled
                                                    ? "Tắt tự động chuyển tập"
                                                    : "Bật tự động chuyển tập"
                                            }
                                        >
                                            <span className="text-xs text-zinc-400 sm:text-sm">
                                                <span className="inline">
                                                    Tự động chuyển tập
                                                </span>
                                            </span>
                                            <div
                                                className={`relative h-4 w-7 rounded-full transition-colors sm:h-5 sm:w-9 ${
                                                    autoplayEnabled
                                                        ? "bg-blue-500"
                                                        : "bg-zinc-600"
                                                }`}
                                            >
                                                <div
                                                    className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform sm:h-4 sm:w-4 ${
                                                        autoplayEnabled
                                                            ? "translate-x-3 sm:translate-x-4"
                                                            : "translate-x-0.5"
                                                    }`}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Episode List */}
                            <div
                                className={`flex w-full flex-col overflow-hidden rounded-md border border-zinc-700 bg-zinc-800 shadow transition-all duration-300 ${
                                    isTheaterMode ? "lg:w-full" : "lg:w-4/12"
                                }`}
                            >
                                {/* Episode Tabs */}
                                <div className="border-b-2 border-zinc-600 bg-zinc-700">
                                    <ul
                                        className="flex list-none overflow-x-auto"
                                        role="tablist"
                                    >
                                        {episodes.map((episode) => (
                                            <li
                                                key={episode.server_name}
                                                onClick={() =>
                                                    switchTab(episode)
                                                }
                                                className={`border-b-3 relative cursor-pointer whitespace-nowrap px-6 py-3.5 text-base font-bold transition-all ${
                                                    activeEpisode?.server_name ===
                                                    episode.server_name
                                                        ? "border-b-4 border-blue-500 bg-zinc-800 text-blue-400 shadow-sm"
                                                        : "border-transparent bg-zinc-700 text-zinc-300 hover:bg-zinc-600 hover:text-zinc-100"
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
                                        <div
                                            className={`grid h-fit auto-rows-max grid-cols-4 items-start gap-4 overflow-y-auto p-4 transition-all sm:grid-cols-6 ${
                                                isTheaterMode
                                                    ? "max-h-116 lg:grid-cols-8 xl:grid-cols-12"
                                                    : "max-h-116 lg:h-0 lg:max-h-none lg:grow lg:grid-cols-3 xl:grid-cols-4"
                                            }`}
                                        >
                                            {(() => {
                                                // Nhóm server theo episode key để tránh buttons trùng
                                                // Dùng Map để giữ thứ tự và fallback khi key không phải số
                                                const map = new Map();
                                                (
                                                    activeEpisode.server_data ||
                                                    []
                                                ).forEach((s, i) => {
                                                    const raw = getEpisodeKey(
                                                        s.slug,
                                                        s.name,
                                                    );
                                                    const k = /^\d+$/.test(
                                                        String(raw),
                                                    )
                                                        ? String(raw)
                                                        : s.slug ||
                                                          s.name ||
                                                          `idx-${i}`;
                                                    if (!map.has(k))
                                                        map.set(k, s);
                                                });
                                                // currentEpisodeId giờ đã là key (số tập) thay vì slug
                                                const currentKey =
                                                    currentEpisodeId || "";
                                                return Array.from(
                                                    map.entries(),
                                                ).map(([k, server]) => {
                                                    return (
                                                        <div
                                                            key={`${activeEpisode.server_name}-${k}`}
                                                            onClick={() =>
                                                                openEpisode(
                                                                    server,
                                                                    activeEpisode,
                                                                    movie,
                                                                )
                                                            }
                                                            className={`cursor-pointer rounded-md border-2 border-transparent px-3 py-2 text-center shadow transition-all ${
                                                                k === currentKey
                                                                    ? "border-blue-500 bg-blue-500 text-white"
                                                                    : "bg-zinc-700 hover:border-blue-400"
                                                            }`}
                                                        >
                                                            <p className="text-sm font-semibold">
                                                                {formatEpisodeName(
                                                                    server.name ||
                                                                        (/^\d+$/.test(
                                                                            String(
                                                                                k,
                                                                            ),
                                                                        )
                                                                            ? `Tập ${k}`
                                                                            : "Trailer"),
                                                                )}
                                                            </p>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    )}
                            </div>
                        </div>

                        {/* Movie Details */}
                        <div className="rounded-md border border-zinc-700 bg-zinc-800 p-4 shadow-md">
                            <div className="flex flex-col gap-4 lg:flex-row">
                                {/* Poster */}
                                <div
                                    className="hidden h-56 shrink-0 lg:block"
                                    style={{ aspectRatio: "2/3" }}
                                >
                                    <img
                                        src={getMovieImage(
                                            movie.poster_url || movie.thumb_url,
                                            movie.source,
                                        )}
                                        alt={movie.name}
                                        className="h-full w-full rounded-md object-cover shadow-md"
                                        onError={(e) => {
                                            e.target.onerror = null;
                                            e.target.src = getMovieImage(null);
                                        }}
                                    />
                                </div>
                                <div
                                    className="w-full shrink-0 lg:hidden"
                                    style={{ aspectRatio: "16/9" }}
                                >
                                    <img
                                        src={getMovieImage(
                                            movie.thumb_url || movie.poster_url,
                                            movie.source,
                                        )}
                                        alt={movie.name}
                                        className="h-full w-full rounded-md object-cover shadow-md"
                                        onError={(e) => {
                                            e.target.onerror = null;
                                            e.target.src = getMovieImage(null);
                                        }}
                                    />
                                </div>

                                {/* Movie Details */}
                                <div className="flex grow flex-col gap-3">
                                    <div>
                                        <div className="text-xl font-bold text-zinc-100">
                                            {movie.name}
                                        </div>
                                        <div
                                            className="text-sm italic text-zinc-400"
                                            title={movie.origin_name}
                                        >
                                            {movie.origin_name}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {movie.time && movie.time !== "0" && (
                                            <span className="inline-block rounded-md bg-blue-900/50 px-2 py-1 text-sm text-blue-300">
                                                <strong>
                                                    {t("vodPlay.duration")}:
                                                </strong>{" "}
                                                {movie.time}
                                            </span>
                                        )}
                                        {movie.quality &&
                                            movie.quality !== "0" && (
                                                <span className="inline-block rounded-md bg-green-900/50 px-2 py-1 text-sm text-green-300">
                                                    <strong>
                                                        {t("vodPlay.quality")}:
                                                    </strong>{" "}
                                                    {movie.quality}
                                                </span>
                                            )}
                                        {movie.year &&
                                            movie.year !== 0 &&
                                            movie.year !== "0" && (
                                                <span className="inline-block rounded-md bg-purple-900/50 px-2 py-1 text-sm text-purple-300">
                                                    <strong>
                                                        {t("vodPlay.year")}:
                                                    </strong>{" "}
                                                    {movie.year || "N/A"}
                                                </span>
                                            )}
                                        {tmdbData && (
                                            <>
                                                <span className="inline-flex items-center gap-1 rounded-md bg-amber-900/50 px-2 py-1 text-sm text-amber-300">
                                                    <svg
                                                        className="h-4 w-4 fill-current"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                                    </svg>
                                                    <strong>
                                                        {tmdbData.vote_average >
                                                        0
                                                            ? `${tmdbData.vote_average.toFixed(1)}/10`
                                                            : "N/A"}
                                                    </strong>
                                                    {tmdbData.vote_count >
                                                        0 && (
                                                        <span className="text-xs">
                                                            (
                                                            {tmdbData.vote_count.toLocaleString()}
                                                            )
                                                        </span>
                                                    )}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {movie.category?.map((cat, idx) => (
                                            <span
                                                key={idx}
                                                className="inline-block rounded-md bg-teal-900/50 px-2 py-1 text-sm text-teal-300"
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
                                        className="line-clamp-4 text-sm text-zinc-300"
                                        title={movie.content?.replace(
                                            /<[^>]*>/g,
                                            "",
                                        )}
                                        dangerouslySetInnerHTML={{
                                            __html: movie.content,
                                        }}
                                    ></div>
                                </div>
                            </div>
                        </div>

                        {/* Diễn viên - TMDb hoặc movie.actor */}
                        {((tmdbCredits?.cast && tmdbCredits.cast.length > 0) ||
                            (movie.actor && movie.actor.length > 0)) && (
                            <>
                                <h3 className="text-lg font-semibold text-zinc-100">
                                    {t("vodPlay.cast")}
                                </h3>
                                <div className="rounded-md border border-zinc-700 bg-zinc-800 p-6 shadow-md">
                                    <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-10">
                                        {/* Ưu tiên TMDb, fallback về movie.actor */}
                                        {(tmdbCredits?.cast &&
                                        tmdbCredits.cast.length > 0
                                            ? tmdbCredits.cast
                                            : movie.actor?.map((name, idx) => ({
                                                  cast_id: idx,
                                                  id: idx,
                                                  name: name,
                                                  character: "",
                                                  profile_path: null,
                                              })) || []
                                        ).map((c) => (
                                            <div
                                                key={c.cast_id || c.id}
                                                className="group flex cursor-pointer flex-col items-center gap-2 text-center"
                                            >
                                                {c.profile_path ? (
                                                    <img
                                                        src={`https://image.tmdb.org/t/p/w92${c.profile_path}`}
                                                        alt={c.name}
                                                        className="h-16 w-16 rounded-full object-cover shadow-md transition-all duration-300 group-hover:shadow-lg "
                                                        onError={(e) =>
                                                            (e.target.style.display =
                                                                "none")
                                                        }
                                                    />
                                                ) : (
                                                    <div className="bg-linear-to-br flex h-16 w-16 items-center justify-center rounded-full from-zinc-500 via-zinc-600 to-zinc-700 shadow-md transition-all duration-300 group-hover:shadow-lg">
                                                        <span className="text-lg font-bold text-white">
                                                            {c.name
                                                                ? c.name
                                                                      .split(
                                                                          " ",
                                                                      )
                                                                      .map(
                                                                          (
                                                                              word,
                                                                          ) =>
                                                                              word[0],
                                                                      )
                                                                      .join("")
                                                                      .slice(
                                                                          0,
                                                                          2,
                                                                      )
                                                                      .toUpperCase()
                                                                : "?"}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="w-32">
                                                    <div className="line-clamp-2 text-balance text-sm font-semibold text-zinc-100 transition-colors duration-300 group-hover:text-blue-400">
                                                        {c.name}
                                                    </div>
                                                    {c.character && (
                                                        <div className="line-clamp-2 text-balance text-xs text-zinc-400 transition-colors duration-300 group-hover:text-zinc-300">
                                                            {c.character}
                                                        </div>
                                                    )}
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
                                    <h3 className="text-lg font-semibold text-zinc-100">
                                        {t("vodPlay.gallery")}
                                    </h3>
                                    <div className="rounded-md border border-zinc-700 bg-zinc-800 p-6 shadow-md">
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
