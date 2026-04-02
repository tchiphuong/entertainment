import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    useNavigate,
    useParams,
    useSearchParams,
    Link,
    useLocation,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMovieDetail } from "../../hooks/useMovieDetail";
import {
    TMDB_IMAGE_BASE_URL,
    TMDB_IMAGE_SIZES,
} from "../../constants/vodConstants";
import { vodService } from "../../services/vod/vodService";
import VodLayout from "../../components/layout/VodLayout";
import { PlaySkeleton } from "../../components/vod/VodSkeletons";
import { useAuth } from "../../contexts/AuthContext";
import {
    addHistoryToFirestore,
    fetchHistoryFromFirestore,
} from "../../services/firebaseHelpers";
import shaka from "shaka-player/dist/shaka-player.ui.js";
import "shaka-player/dist/controls.css";
import "../../styles/shaka-player.css";

// Dynamic import HLS.js khi cần (giữ lại để tương thích nếu cần)
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

// Mock JWPlayer license response để bypass CORS
const JWPLAYER_LICENSE_MOCK = {
    canPlayAds: true,
    canPlayOutstreamAds: false,
    canUseIdentityScript: false,
    canUseVPB: false,
    overrideAdConfig: false,
};

// Hàm hỗ trợ làm sạch nội dung M3U8 (loại bỏ quảng cáo, chuẩn hóa đường dẫn)
function cleanM3U8Content(text, baseURL = "") {
    const lines = text.split("\n");
    const cleaned = [];

    let skipBlock = false; // Cờ dùng để bỏ qua khối chứa quảng cáo (#EXT-X-KEY)

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();

        // Kiểm tra khối bắt đầu bằng #EXT-X-DISCONTINUITY + #EXT-X-KEY:METHOD=NONE
        // Đây là cấu trúc quảng cáo phổ biến trên một số server phim
        if (
            !skipBlock &&
            line === "#EXT-X-DISCONTINUITY" &&
            lines[i + 1]?.startsWith("#EXT-X-KEY:METHOD=NONE")
        ) {
            skipBlock = true;
            i++; // Bỏ qua dòng #EXT-X-KEY
            continue;
        }

        // Nếu đang trong trạng thái bỏ qua khối quảng cáo
        if (skipBlock) {
            if (line === "#EXT-X-DISCONTINUITY") {
                skipBlock = false; // Kết thúc khối quảng cáo
            }
            continue; // Bỏ qua tất cả các dòng bên trong khối
        }

        // Loại bỏ các tag #EXT-X-DISCONTINUITY thừa để đảm bảo timeline mượt mà trên Shaka Player
        if (line === "#EXT-X-DISCONTINUITY") continue;

        // Kiểm tra xem dòng hiện tại có phải là một segment video không
        const isSegment =
            /\.(ts|png|jpg|jpeg|gif|m4s|mp4)(\?|$)/i.test(line) &&
            !line.startsWith("#");

        if (isSegment) {
            // Loại bỏ quảng cáo chủ động dựa trên các mẫu đường dẫn đặc trưng (/adjump/)
            if (line.includes("/adjump/") || /ads|telecom|static/i.test(line)) {
                if (
                    cleaned.length > 0 &&
                    cleaned[cleaned.length - 1].startsWith("#EXTINF")
                ) {
                    cleaned.pop(); // Xóa cả tag thời lượng #EXTINF kề trên
                }
                continue;
            }

            // Loại bỏ tiền tố convertv7/ nếu có (đảm bảo đường dẫn segment chuẩn)
            if (line.includes("convertv7/")) {
                line = line.replace("convertv7/", "");
            }

            // Chuẩn hóa thành đường dẫn tuyệt đối cho Shaka Player
            if (baseURL && !line.startsWith("http") && !line.startsWith("/")) {
                line = baseURL + line;
            }
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

    // Chặn các yêu cầu M3U8 để loại bỏ quảng cáo và tag ngắt quãng
    const fetchPromise = originalFetch.apply(this, args);

    if (url && url.includes(".m3u8")) {
        return fetchPromise.then((response) => {
            if (!response.ok) return response;

            return response
                .clone()
                .text()
                .then((text) => {
                    const baseURL = url
                        .split("?")[0]
                        .substring(0, url.split("?")[0].lastIndexOf("/") + 1);
                    const cleanedText = cleanM3U8Content(text, baseURL);

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

                    const baseURL = this._url
                        .split("?")[0]
                        .substring(
                            0,
                            this._url.split("?")[0].lastIndexOf("/") + 1,
                        );
                    const cleanedText = cleanM3U8Content(originalText, baseURL);

                    // Override responseText
                    Object.defineProperty(this, "responseText", {
                        writable: true,
                        value: cleanedText,
                    });
                    Object.defineProperty(this, "response", {
                        writable: true,
                        value: cleanedText,
                    });
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
                    return imagePath;
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
            return cdnUrl;
        } else {
            return `${domain}/image.php?url=${encodeURIComponent(cdnUrl)}`;
        }
    }

    // Nguồn khác: trả URL CDN gốc (không proxy)
    return cdnUrl;
}

// Redundant cache helpers removed - handled by useMovieDetail hook and vodCache utility

export default function VodPlay() {
    const location = useLocation();
    const backgrounds = location.state?.backgrounds;
    const { t, i18n } = useTranslation();
    // Lưu và lấy âm lượng từ localStorage
    const VOLUME_KEY = "vodPlayerVolume";
    const MUTE_KEY = "vodPlayerMuted";
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
    const getSavedMute = () => {
        try {
            return localStorage.getItem(MUTE_KEY) === "true";
        } catch {}
        return false;
    };
    const saveVolume = (vol) => {
        try {
            localStorage.setItem(VOLUME_KEY, String(vol));
        } catch {}
    };
    const saveMute = (isMuted) => {
        try {
            localStorage.setItem(MUTE_KEY, String(isMuted));
        } catch {}
    };
    const query = useQuery();
    const params = useParams();
    const slug = params.slug || query.get("slug") || "";
    const [searchParams, setSearchParams] = useSearchParams();
    const episodeParam = searchParams.get("episode");
    const serverParam = searchParams.get("server"); // Thêm server param
    const sourceParam = searchParams.get("source") || SOURCES.SOURCE_K; // Mặc định SOURCE_K
    const source = sourceParam;
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
    const [tmdbData, setTmdbData] = useState(null);
    const [tmdbCredits, setTmdbCredits] = useState(null);
    const [tmdbImages, setTmdbImages] = useState(null);
    const [tmdbVideos, setTmdbVideos] = useState(null);
    const [fanartLogo, setFanartLogo] = useState(null); // Logo từ Fanart.tv hoặc hook
    const [imdbEpisodes, setImdbEpisodes] = useState([]); // Danh sách tập phim từ IMDb (cho hình ảnh)
    const [viewHistory, setViewHistory] = useLocalStorage("viewHistory", []);
    const viewHistoryRef = useRef(viewHistory); // Ref tránh re-render thường xuyên
    const lastHistorySyncRef = useRef(0); // Throttle sync state
    const [favorites, setFavorites] = useLocalStorage("favorites", []);
    const [showImageModal, setShowImageModal] = useState(false);
    const [modalImages, setModalImages] = useState([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isTheaterMode, setIsTheaterMode] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareMessage, setShareMessage] = useState("");
    const [showDescription, setShowDescription] = useState(false);
    const [showCast, setShowCast] = useState(false);
    const [scrollY, setScrollY] = useState(0);
    const [autoplayEnabled, setAutoplayEnabled] = useLocalStorage(
        "autoplayEnabled",
        true,
    ); // Tự động chuyển tập
    const autoplayEnabledRef = useRef(autoplayEnabled); // Ref để track giá trị mới nhất trong event handlers
    const [isCompactView, setIsCompactView] = useLocalStorage(
        "isCompactView",
        null, // Mặc định là null để detect lần đầu
    );

    // Memo hoá danh sách tập phim để tránh tính toán lại mỗi lần render
    const episodeListData = useMemo(() => {
        const map = new Map();
        (activeEpisode?.server_data || []).forEach((s, i) => {
            const raw = getEpisodeKey(s.slug, s.name);
            const k = /^\d+$/.test(String(raw))
                ? String(raw)
                : s.slug || s.name || `idx-${i}`;
            if (!map.has(k)) {
                const epNum = parseInt(k);
                const imdbEp =
                    !isNaN(epNum) && epNum > 0
                        ? imdbEpisodes.find(
                              (e) =>
                                  (e.episode_number || e.episodeNumber) ===
                                  epNum,
                          )
                        : undefined;
                const thumb =
                    (imdbEp?.still_path
                        ? `${TMDB_IMAGE_BASE_URL}/${TMDB_IMAGE_SIZES.STILL || "w300"}${imdbEp.still_path}`
                        : imdbEp?.primaryImage?.url) ||
                    getMovieImage(movie?.thumb_url, movie?.source);
                map.set(k, { ...s, key: k, imdbEp, thumb });
            }
        });
        return Array.from(map.entries());
    }, [activeEpisode, imdbEpisodes, movie?.thumb_url, movie?.source]);

    // Lưu trữ ảnh nền cố định để tránh load lại khi fetch movie details
    const [memoizedBackgrounds, setMemoizedBackgrounds] = useState(() => {
        if (backgrounds) {
            return {
                poster_url: backgrounds.poster_url || "",
                thumb_url: backgrounds.thumb_url || "",
            };
        }
        return null;
    });

    useEffect(() => {
        const handleScroll = () => setScrollY(window.scrollY);
        window.addEventListener("scroll", handleScroll);

        // Detect mobile để set mặc định cho Compact View
        if (isCompactView === null) {
            const isMobile = window.innerWidth < 768;
            setIsCompactView(isMobile);
        }

        return () => window.removeEventListener("scroll", handleScroll);
    }, [isCompactView, setIsCompactView]);
    const [skipIntroEnabled, setSkipIntroEnabled] = useLocalStorage(
        "skipIntroEnabled",
        false,
    ); // Tự động bỏ qua intro
    const skipIntroEnabledRef = useRef(skipIntroEnabled);

    // Season Detection & IMDB Offset logic
    const [detectedSeason, setDetectedSeason] = useState(1);

    useEffect(() => {
        if (movie) {
            const seasonFromApi =
                movie.tmdb?.season ||
                movie.season ||
                (movie._rawItem &&
                    (movie._rawItem.season || movie._rawItem.season_number));
            if (seasonFromApi) {
                setDetectedSeason(parseInt(seasonFromApi));
            } else if (movie.name) {
                // Regex to find "Phần X" or "Season X" or "P2", "S2", "Part 2"
                const seasonMatch = movie.name.match(
                    /(?:Phần|Season|P|S|Part)\s*(\d+)/i,
                );
                if (seasonMatch && seasonMatch[1]) {
                    setDetectedSeason(parseInt(seasonMatch[1]));
                }
            }
        }
    }, [movie]);

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

    // Media Session API (Browser/OS Media Control)
    useEffect(() => {
        if (!movie || !("mediaSession" in navigator)) return;

        const posterUrl = getMovieImage(
            memoizedBackgrounds?.poster_url ||
                memoizedBackgrounds?.thumb_url ||
                movie.thumb_url ||
                movie.poster_url,
            movie.source,
        );

        const albumTitle = movie.origin_name || movie.name;
        const mainTitle =
            movie.name + (currentEpisodeId ? ` - Tập ${currentEpisodeId}` : "");

        navigator.mediaSession.metadata = new MediaMetadata({
            title: mainTitle,
            artist: "Entertainment VOD",
            album: albumTitle,
            artwork: [
                { src: posterUrl, sizes: "96x96", type: "image/jpeg" },
                { src: posterUrl, sizes: "128x128", type: "image/jpeg" },
                { src: posterUrl, sizes: "192x192", type: "image/jpeg" },
                { src: posterUrl, sizes: "256x256", type: "image/jpeg" },
                { src: posterUrl, sizes: "384x384", type: "image/jpeg" },
                { src: posterUrl, sizes: "512x512", type: "image/jpeg" },
            ],
        });

        const hlsVideo = document.getElementById("hls-video");
        const shakaVideo = document.getElementById("shaka-video");
        const activeVideo = hlsVideo || shakaVideo;

        if (activeVideo) {
            const handlers = {
                play: () => activeVideo.play(),
                pause: () => activeVideo.pause(),
                seekbackward: () => {
                    activeVideo.currentTime = Math.max(
                        0,
                        activeVideo.currentTime - 10,
                    );
                },
                seekforward: () => {
                    activeVideo.currentTime = Math.min(
                        activeVideo.duration,
                        activeVideo.currentTime + 10,
                    );
                },
            };

            Object.entries(handlers).forEach(([action, handler]) => {
                try {
                    navigator.mediaSession.setActionHandler(action, handler);
                } catch (error) {
                    console.warn(`MediaSession action ${action} error:`, error);
                }
            });

            const updatePlaybackState = () => {
                try {
                    navigator.mediaSession.playbackState = activeVideo.paused
                        ? "paused"
                        : "playing";
                } catch (e) {}
            };

            activeVideo.addEventListener("play", updatePlaybackState);
            activeVideo.addEventListener("pause", updatePlaybackState);
            activeVideo.addEventListener("playing", updatePlaybackState);

            updatePlaybackState();

            return () => {
                activeVideo.removeEventListener("play", updatePlaybackState);
                activeVideo.removeEventListener("pause", updatePlaybackState);
                activeVideo.removeEventListener("playing", updatePlaybackState);
                Object.keys(handlers).forEach((action) => {
                    try {
                        navigator.mediaSession.setActionHandler(action, null);
                    } catch (e) {}
                });
            };
        }
    }, [movie, currentEpisodeId, memoizedBackgrounds]);

    // Sync data from useMovieDetail hook
    const {
        movie: fetchedMovie,
        episodes: fetchedEpisodes,
        loading: movieLoading,
        tmdbData: fetchedTmdbData,
        tmdbCredits: fetchedTmdbCredits,
        tmdbImages: fetchedTmdbImages,
        tmdbVideos: fetchedTmdbVideos,
        fanartLogo: fetchedFanartLogo,
    } = useMovieDetail(slug, sourceParam); // Truyền sourceParam vào hook

    useEffect(() => {
        setIsLoading(movieLoading);
    }, [movieLoading]);

    useEffect(() => {
        if (fetchedMovie) {
            setMovie(fetchedMovie);

            // Cập nhật memoizedBackgrounds nếu chưa có
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
            // Nếu chưa có active episode, set cái đầu tiên
            if (!activeEpisode) {
                setActiveEpisode(fetchedEpisodes[0]);
            }
        }
    }, [fetchedMovie, fetchedEpisodes, activeEpisode]);

    // Sync TMDB data from hook
    useEffect(() => {
        setTmdbData(fetchedTmdbData);
        setTmdbCredits(fetchedTmdbCredits);
        setTmdbImages(fetchedTmdbImages);
        setTmdbVideos(fetchedTmdbVideos);
        setFanartLogo(fetchedFanartLogo);
    }, [
        fetchedTmdbData,
        fetchedTmdbCredits,
        fetchedTmdbImages,
        fetchedTmdbVideos,
        fetchedFanartLogo,
    ]);

    // Fetch danh sách tập phim từ TMDB để lấy hình ảnh từng tập
    useEffect(() => {
        const fetchSeasonEpisodes = async () => {
            const tmdbId = tmdbData?.id;
            const isSeries =
                movie?.type === "series" ||
                movie?.type === "tvshows" ||
                movie?.type === "tv" ||
                tmdbData?.number_of_episodes > 0 ||
                (movie?.episodes && movie.episodes[0]?.server_data?.length > 1);

            if (!tmdbId || !isSeries) return;

            try {
                const data = await vodService.fetchTMDBSeason(
                    tmdbId,
                    detectedSeason,
                );
                if (data && data.episodes) {
                    setImdbEpisodes(data.episodes);
                }
            } catch (err) {
                console.error("Fetch TMDB season episodes error:", err);
            }
        };

        fetchSeasonEpisodes();
    }, [tmdbData, movie, detectedSeason]);

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
            // fetchMovieDetails(); // Old fetch method, now handled by useMovieDetail

            // Reset backgrounds khi chuyển phim
            setMemoizedBackgrounds(
                location.state?.backgrounds
                    ? {
                          poster_url:
                              location.state.backgrounds.poster_url || "",
                          thumb_url: location.state.backgrounds.thumb_url || "",
                      }
                    : null,
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug, location.state]);

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

                let trailerUrl = movie.trailer_url;
                if (!trailerUrl && tmdbVideos) {
                    const trailer = tmdbVideos.find(
                        (v) =>
                            (v.type === "Trailer" || v.type === "Teaser") &&
                            v.site === "YouTube",
                    );
                    if (trailer && trailer.key) {
                        trailerUrl = `https://www.youtube.com/watch?v=${trailer.key}`;
                    }
                }
                if (trailerUrl) {
                    const embedUrl = ensureYoutubeEmbedUrl(trailerUrl);
                    const trailerEpisode = {
                        server_name: "Trailer",
                        server_data: [
                            {
                                name: "Trailer",
                                slug: "trailer",
                                link_embed: embedUrl,
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
            let trailerUrl = movie.trailer_url;
            if (!trailerUrl && tmdbVideos) {
                const trailer = tmdbVideos.find(
                    (v) =>
                        (v.type === "Trailer" || v.type === "Teaser") &&
                        v.site === "YouTube",
                );
                if (trailer && trailer.key) {
                    trailerUrl = `https://www.youtube.com/watch?v=${trailer.key}`;
                }
            }
            if (trailerUrl) {
                const embedUrl = ensureYoutubeEmbedUrl(trailerUrl);
                const trailerEpisode = {
                    server_name: "Trailer",
                    server_data: [
                        {
                            name: "Trailer",
                            slug: "trailer",
                            link_embed: embedUrl,
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

            // Lấy video element (Shaka hoặc HLS)
            const hlsVideo = document.getElementById("hls-video");
            const shakaVideo = document.getElementById("shaka-video");
            const activeVideo = hlsVideo || shakaVideo;

            // Tua lùi 10s (j hoặc ArrowLeft)
            if (e.key === "j" || e.key === "J" || e.key === "ArrowLeft") {
                e.preventDefault();
                if (activeVideo) {
                    activeVideo.currentTime = Math.max(
                        0,
                        activeVideo.currentTime - 10,
                    );
                }
            }

            // Tua tiến 10s (l hoặc ArrowRight)
            if (e.key === "l" || e.key === "L" || e.key === "ArrowRight") {
                e.preventDefault();
                if (activeVideo) {
                    activeVideo.currentTime = Math.min(
                        activeVideo.duration,
                        activeVideo.currentTime + 10,
                    );
                }
            }

            // Space hoặc K để play/pause
            if (
                e.key === " " ||
                e.code === "Space" ||
                e.key === "k" ||
                e.key === "K"
            ) {
                e.preventDefault();
                if (activeVideo) {
                    if (activeVideo.paused) {
                        activeVideo.play();
                    } else {
                        activeVideo.pause();
                    }
                }
            }

            // F để fullscreen
            if (e.key === "f" || e.key === "F") {
                e.preventDefault();
                if (playerRef.current) {
                    if (!document.fullscreenElement) {
                        playerRef.current.requestFullscreen();
                    } else {
                        document.exitFullscreen();
                    }
                }
            }

            // M để mute/unmute
            if (e.key === "m" || e.key === "M") {
                e.preventDefault();
                if (activeVideo) {
                    activeVideo.muted = !activeVideo.muted;
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

            // P để quay lại tập trước
            if (e.key === "p" || e.key === "P") {
                e.preventDefault();
                playPrevEpisode();
            }
        };

        window.addEventListener("keydown", handleVideoKeyDown);
        return () => window.removeEventListener("keydown", handleVideoKeyDown);
    }, [
        showImageModal,
        showShareModal,
        episodes,
        activeEpisode,
        currentEpisodeId,
    ]);
    // Get last watched episodes list
    const getLastWatchedList = useCallback(() => {
        return viewHistory || [];
    }, [viewHistory]);

    // Helper function to format episode name
    const formatEpisodeName = useCallback(
        (name) => {
            if (!name) return name;

            // Lấy số đầu tiên trong string (nếu có)
            const match = name.match(/\d+/);
            if (!match) return name;

            const num = parseInt(match[0], 10);

            // Kiểm tra có phải dạng "Tập ..." hoặc bắt đầu bằng số
            if (/^tập\s*\d+/i.test(name) || /^\d+/.test(name)) {
                return `${t("vodPlay.episode")} ${num
                    .toString()
                    .padStart(maxDigits, "0")}`;
            }

            return name;
        },
        [maxDigits, t],
    );

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
                // Ưu tiên 1: Tìm server có key tập và server name khớp
                const episodeKey = historyItem.current_episode.key;
                const savedServerSlug = historyItem.server; // "source_o-vietsub", etc.

                let targetServer = null;

                if (savedServerSlug) {
                    targetServer = matchingEpisode.server_data.find(
                        (server) => {
                            if (!server) return false;
                            const currentSlug = serverNameToSlug(
                                matchingEpisode.server_name,
                            );
                            const serverKey = getEpisodeKey(
                                server.slug,
                                server.name,
                            );

                            // Phải khớp cả Episode Key VÀ Server Slug
                            return (
                                compareEpisodeKeys(serverKey, episodeKey) &&
                                (currentSlug === savedServerSlug ||
                                    currentSlug.includes(savedServerSlug) ||
                                    savedServerSlug.includes(currentSlug))
                            );
                        },
                    );
                }

                // Ưu tiên 2: Nếu không tìm thấy đúng server đã lưu, lấy tập khớp key đầu tiên trong group này
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

        // Lấy thông tin phim hiện tại từ state/argument
        const currentMovie = movie && movie.name ? movie : movie || {};
        const movieName = currentMovie.name || "Không rõ tên";
        const moviePoster = getMovieImage(
            currentMovie.poster_url ||
                currentMovie.poster ||
                currentMovie.thumb_url,
        );
        const movieServer =
            currentMovie.server || episode?.server_name || serverParam || "";
        const movieOriginName =
            currentMovie.origin_name || currentMovie.originName || "";

        // Format episode value để hiển thị đẹp (vd: "Tập 3", "3/13", etc.)
        const formatEpisodeValue = () => {
            const totalStr = currentMovie.episode_total || "";
            const totalMatch = totalStr?.match(/(\d+)/);
            const total = totalMatch ? totalMatch[1] : "";

            // Ưu tiên 1: Dùng episode.name nếu có
            const baseName = episode?.name || String(episodeKey);

            // Ưu tiên 2: Nếu key là "full" hoặc "trailer"
            const keyStr = String(episodeKey).toLowerCase();
            if (keyStr === "full") return "Full";
            if (keyStr === "trailer") return "Trailer";

            // Ưu tiên 3: Nếu là số, format thành "Tập X/Tổng" hoặc "Tập X"
            if (typeof episodeKey === "number" || /^\d+$/.test(keyStr)) {
                return `Tập ${episodeKey}${total && total !== "1" ? "/" + total : ""}`;
            }

            // Fallback: trả về baseName hoặc episodeSlug
            return baseName || episodeSlug;
        };
        const episodeValue = formatEpisodeValue();

        // Lấy lịch sử hiện tại (copy)
        let history = Array.isArray(viewHistory) ? [...viewHistory] : [];
        // Tìm index của phim trong lịch sử theo slug (cleaned)
        const cleanSlug = slug.split("?")[0];
        let movieIndex = history.findIndex((item) => item.slug === cleanSlug);

        // Nếu chưa có trong lịch sử thì thêm mới (với key đã normalize)
        if (movieIndex === -1) {
            history.unshift({
                slug: cleanSlug,
                name: movieName,
                poster: moviePoster,
                server: movieServer,
                episode_total: currentMovie.episode_total || "",
                current_episode: {
                    key: episodeKey,
                    value: episodeValue,
                },
                origin_name: movieOriginName,
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
            movieData.origin_name = movieOriginName;
            movieData.episode_total =
                currentMovie.episode_total || movieData.episode_total || "";
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

        // Cập nhật Ref và localStorage ngay lập tức (không gây re-render)
        viewHistoryRef.current = history;
        try {
            localStorage.setItem("viewHistory", JSON.stringify(history));
        } catch {}

        // Chỉ sync state React tối đa 1 lần/30 giây để tránh re-render liên tục
        const syncNow = Date.now();
        if (syncNow - lastHistorySyncRef.current >= 30000) {
            lastHistorySyncRef.current = syncNow;
            setViewHistory(history);
        }

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

    // Helper: Chuyển đổi link YouTube sang định dạng embed
    const ensureYoutubeEmbedUrl = (url) => {
        if (!url || typeof url !== "string") return url;

        // Nếu đã là link embed thì giữ nguyên
        if (url.includes("youtube.com/embed/")) return url;

        let videoId = "";
        if (url.includes("youtube.com/watch?v=")) {
            videoId = url.split("v=")[1].split("&")[0];
        } else if (url.includes("youtu.be/")) {
            videoId = url.split("youtu.be/")[1].split("?")[0];
        }

        if (videoId) {
            return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
        }

        return url;
    };

    const shakaPlayerRef = useRef(null);
    const shakaUiOverlayRef = useRef(null);
    const activeVideoElementRef = useRef(null);

    // Destroy Shaka Player instances
    const destroyAllPlayers = async () => {
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

        if (shakaUiOverlayRef.current) {
            try {
                shakaUiOverlayRef.current.destroy();
                shakaUiOverlayRef.current = null;
            } catch (e) {
                console.warn("Error destroying Shaka UI Overlay:", e);
            }
        }

        if (shakaPlayerRef.current) {
            try {
                await shakaPlayerRef.current.destroy();
                shakaPlayerRef.current = null;
            } catch (e) {
                console.warn("Error destroying Shaka Player:", e);
            }
        }

        currentUrlRef.current = null;
    };

    // Setup Shaka Player
    const setupShakaPlayer = async (
        masterUrl,
        episodeSlug,
        serverName,
        movie,
        fallbackUrl = null,
        backups = [], // Nhận backups array
    ) => {
        const playerDiv = playerRef.current;
        if (!playerDiv) return;

        await destroyAllPlayers();
        playerDiv.innerHTML = "";

        const themeWrapper = document.createElement("div");
        themeWrapper.className =
            "youtube-theme h-full w-full overflow-hidden shadow-2xl";

        const uiContainer = document.createElement("div");
        uiContainer.className = "shaka-video-container h-full w-full";

        const video = document.createElement("video");
        video.id = "shaka-video";
        video.className = "h-full w-full";
        video.autoplay = true;
        video.playsInline = true;

        const posterUrl = getMovieImage(
            memoizedBackgrounds?.thumb_url ||
                memoizedBackgrounds?.poster_url ||
                movie?.thumb_url ||
                movie?.poster_url,
            movie?.source,
        );
        if (posterUrl) {
            video.setAttribute("poster", posterUrl);
            video.poster = posterUrl;
        }

        activeVideoElementRef.current = video;

        // Restore Volume
        const savedVolume = getSavedVolume();
        const savedMuted = getSavedMute();
        video.volume = savedVolume;
        video.muted = savedMuted;

        video.addEventListener("volumechange", () => {
            saveVolume(video.volume);
            saveMute(video.muted);
        });

        uiContainer.appendChild(video);
        themeWrapper.appendChild(uiContainer);
        playerDiv.appendChild(themeWrapper);

        const player = new shaka.Player();
        await player.attach(video);
        shakaPlayerRef.current = player;

        // Thêm filter để dọn dẹp playlist m3u8 vì Shaka Player đôi khi bỏ qua các interceptor fetch/XHR toàn cục
        if (player.getNetworkingEngine) {
            player
                .getNetworkingEngine()
                .registerResponseFilter((type, response) => {
                    // Shaka Player v3+ dùng response.uris, v2 dùng response.uri
                    const uris =
                        response.uris || (response.uri ? [response.uri] : []);
                    const uri = uris[0] || "";

                    if (uri && uri.includes(".m3u8")) {
                        try {
                            const decoder = new TextDecoder("utf-8");
                            let text = decoder.decode(response.data);

                            if (
                                text.includes("#EXT-X-DISCONTINUITY") ||
                                text.includes("convertv7/") ||
                                text.includes("/adjump/") ||
                                text.includes("ads")
                            ) {
                                const urlObj = new URL(uri);
                                const baseURL =
                                    urlObj.origin +
                                    urlObj.pathname.substring(
                                        0,
                                        urlObj.pathname.lastIndexOf("/") + 1,
                                    );

                                const cleanedText = cleanM3U8Content(
                                    text,
                                    baseURL,
                                );
                                response.data = new TextEncoder().encode(
                                    cleanedText,
                                );
                            }
                        } catch (e) {
                            // Bỏ qua lỗi decode cho dữ liệu không phải text
                        }
                    }
                });
        }

        const uiOverlay = new shaka.ui.Overlay(player, uiContainer, video);
        shakaUiOverlayRef.current = uiOverlay;

        // Configure UI
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
            addSeekBar: true,
        });

        try {
            await player.load(masterUrl);
            currentUrlRef.current = masterUrl;

            const episodeKey = String(getEpisodeKey(episodeSlug, serverName));
            setCurrentEpisodeId(episodeKey);

            const lastPosition = getLastWatchedPosition(
                episodeSlug,
                serverName,
            );
            if (lastPosition > 0) {
                const onLoaded = () => {
                    video.currentTime = lastPosition;
                    positionRestoredRef.current = episodeKey;
                    video.removeEventListener("loadedmetadata", onLoaded);
                };
                if (video.readyState >= 1) {
                    video.currentTime = lastPosition;
                    positionRestoredRef.current = episodeKey;
                } else {
                    video.addEventListener("loadedmetadata", onLoaded);
                }
            }

            let lastSavedTime = 0;
            let introSkipped = false;
            video.ontimeupdate = () => {
                const currentTime = Math.floor(video.currentTime);
                if (
                    skipIntroEnabledRef.current &&
                    !introSkipped &&
                    video.currentTime < introDurationRef.current
                ) {
                    video.currentTime = introDurationRef.current;
                    introSkipped = true;
                }
                if (currentTime - lastSavedTime >= 5) {
                    lastSavedTime = currentTime;
                    setWatchlist(
                        episodeSlug,
                        currentTime,
                        { name: serverName },
                        movie,
                    );
                }
            };

            video.onended = () => {
                if (autoplayEnabledRef.current) {
                    playNextEpisode();
                }
            };
        } catch (error) {
            console.error("Shaka Player load error:", error);
            if (backups && backups.length > 1) {
                const currentIdx = backups.findIndex(
                    (b) => b.link_m3u8 === masterUrl,
                );
                if (currentIdx !== -1 && currentIdx + 1 < backups.length) {
                    const nextBackup = backups[currentIdx + 1];
                    if (nextBackup.link_m3u8) {
                        return setupShakaPlayer(
                            nextBackup.link_m3u8,
                            episodeSlug,
                            serverName,
                            movie,
                            fallbackUrl,
                            backups,
                        );
                    }
                }
            }
            if (fallbackUrl) {
                await setupEmbedPlayer(fallbackUrl, episodeSlug, serverName);
                return;
            }
            setErrorMessage(
                "Không thể phát video này. Vui lòng thử lại sau hoặc đổi nguồn khác.",
            );
        }
    };

    // Fallback embed player
    async function setupEmbedPlayer(embedUrl, episodeSlug, serverName = "") {
        await destroyAllPlayers();
        const playerDiv = playerRef.current;
        if (!playerDiv) return;

        playerDiv.innerHTML = "";
        const iframe = document.createElement("iframe");
        iframe.src = embedUrl;
        iframe.className = "w-full h-full rounded-xl shadow-2xl";
        iframe.style.cssText = "border:none;";
        iframe.allowFullscreen = true;
        iframe.allow = "autoplay; encrypted-media";

        playerDiv.appendChild(iframe);
        // Update Episode ID
        const episodeKey = String(getEpisodeKey(episodeSlug, serverName));
        setCurrentEpisodeId(episodeKey);
        currentUrlRef.current = embedUrl;
    }

    async function initializePlayer(server, episodeSlug, movie) {
        setErrorMessage(null);

        const masterUrl = server.link_m3u8 || server.link_embed;
        const embedFallback = server.link_embed;

        if (!masterUrl) {
            // Trailer logic
            let trailerUrl = movie?.trailer_url;

            // Nếu không có movie trailer, thử tìm trong tmdb videos
            if (!trailerUrl && fetchedTmdbVideos?.length > 0) {
                const trailer = fetchedTmdbVideos.find(
                    (v) =>
                        (v.type === "Trailer" || v.type === "Teaser") &&
                        v.site === "YouTube",
                );
                if (trailer?.key) {
                    trailerUrl = `https://www.youtube.com/watch?v=${trailer.key}`;
                }
            }

            if (trailerUrl) {
                const embedUrl = ensureYoutubeEmbedUrl(trailerUrl);
                await setupEmbedPlayer(embedUrl, episodeSlug, "Trailer");
                return;
            }

            setErrorMessage("Không có link phát.");
            return;
        }

        if (currentUrlRef.current === masterUrl) return;

        if (
            masterUrl.includes(".m3u8") ||
            masterUrl.includes(".mpd") ||
            masterUrl.includes(".m3u9")
        ) {
            await setupShakaPlayer(
                masterUrl,
                episodeSlug,
                server.name,
                movie,
                embedFallback,
                server.backups || [], // Truyền backups
            );
        } else {
            const embedUrl = ensureYoutubeEmbedUrl(masterUrl);
            await setupEmbedPlayer(embedUrl, episodeSlug, server.name);
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
        const episodesList = episodes || [];
        if (episodesList.length === 0) return;

        let currentKey = currentEpisodeId || episodeParam;
        const lastWatchedList = getLastWatchedList();
        const cleanSlug = slug.split("?")[0];
        const dataSlug = movie?.slug || cleanSlug;
        const historyItem = lastWatchedList.find(
            (item) =>
                item.slug === dataSlug ||
                (item.slug && item.slug.startsWith(cleanSlug)),
        );

        console.log(
            "playNextEpisode: currentKey =",
            currentKey,
            "dataSlug =",
            dataSlug,
        );

        if (!currentKey) {
            currentKey = historyItem?.current_episode?.key;
        }

        if (!currentKey) {
            // Nếu vẫn không có key, thử lấy từ URL hoặc tập đầu tiên
            const firstGroup = activeEpisode || episodesList[0];
            if (firstGroup?.server_data?.length > 0) {
                currentKey = getEpisodeKey(
                    firstGroup.server_data[0].slug,
                    firstGroup.server_data[0].name,
                );
            }
        }

        if (!currentKey) return;

        const savedServerSlug = historyItem?.server;
        const savedServerName = savedServerSlug
            ? slugToServerName(savedServerSlug)
            : null;

        // Tìm server group chứa tập hiện tại
        let currentGroup = activeEpisode;
        let currentIndexInGroup = -1;

        if (currentGroup) {
            currentIndexInGroup = (currentGroup.server_data || []).findIndex(
                (s) =>
                    compareEpisodeKeys(
                        getEpisodeKey(s.slug, s.name),
                        currentKey,
                    ),
            );
        }

        // Nếu không tìm thấy trong group hiện tại, tìm trong tất cả group
        if (currentIndexInGroup === -1) {
            for (const ep of episodesList) {
                const idx = (ep.server_data || []).findIndex((s) =>
                    compareEpisodeKeys(
                        getEpisodeKey(s.slug, s.name),
                        currentKey,
                    ),
                );
                if (idx !== -1) {
                    currentGroup = ep;
                    currentIndexInGroup = idx;
                    // Không gọi setActiveEpisode ở đây để tránh re-render loop, chỉ set cục bộ
                    break;
                }
            }
        }

        console.log(
            "playNextEpisode: currentIndexInGroup =",
            currentIndexInGroup,
            "in group =",
            currentGroup?.server_name,
        );

        if (currentIndexInGroup === -1 || !currentGroup) return;

        const data = currentGroup.server_data;
        const nextIndex = currentIndexInGroup + 1;

        if (nextIndex < data.length) {
            console.log("Playing next in same group:", data[nextIndex].name);
            openEpisode(data[nextIndex], currentGroup, movie);
        } else {
            // Chuyển sang group tiếp theo
            const currentGroupIdx = episodesList.findIndex(
                (ep) => ep.server_name === currentGroup.server_name,
            );

            console.log(
                "End of group. currentGroupIdx =",
                currentGroupIdx,
                "total groups =",
                episodesList.length,
            );

            if (
                currentGroupIdx !== -1 &&
                currentGroupIdx + 1 < episodesList.length
            ) {
                // Ưu tiên tìm group có cùng loại server
                for (
                    let i = currentGroupIdx + 1;
                    i < episodesList.length;
                    i++
                ) {
                    const nextGroup = episodesList[i];
                    const nextType = extractServerType(nextGroup.server_name);
                    const currentType = extractServerType(
                        currentGroup.server_name,
                    );

                    // So sánh loại server (VD: "Vietsub" === "Vietsub")
                    if (
                        (savedServerName &&
                            (nextGroup.server_name === savedServerName ||
                                nextGroup.server_name.includes(
                                    savedServerName,
                                ))) ||
                        (currentType && nextType === currentType)
                    ) {
                        if (nextGroup.server_data?.length > 0) {
                            console.log(
                                "Found matching server group:",
                                nextGroup.server_name,
                            );
                            setActiveEpisode(nextGroup);
                            openEpisode(
                                nextGroup.server_data[0],
                                nextGroup,
                                movie,
                            );
                            return;
                        }
                    }
                }

                // Nếu không tìm thấy loại tương ứng, lấy group kế tiếp bất kỳ
                const nextGroup = episodesList[currentGroupIdx + 1];
                if (nextGroup.server_data?.length > 0) {
                    console.log(
                        "Falling back to next available group:",
                        nextGroup.server_name,
                    );
                    setActiveEpisode(nextGroup);
                    openEpisode(nextGroup.server_data[0], nextGroup, movie);
                    return;
                }
            }

            setErrorMessage("Đã hết tập phim!");
            setTimeout(() => setErrorMessage(null), 3000);
        }
    }

    // Play previous episode
    function playPrevEpisode() {
        const episodesList = episodes || [];
        if (episodesList.length === 0) return;

        let currentKey = currentEpisodeId || episodeParam;
        const lastWatchedList = getLastWatchedList();
        const cleanSlug = slug.split("?")[0];
        const dataSlug = movie?.slug || cleanSlug;
        const historyItem = lastWatchedList.find(
            (item) =>
                item.slug === dataSlug ||
                (item.slug && item.slug.startsWith(cleanSlug)),
        );

        if (!currentKey) {
            currentKey = historyItem?.current_episode?.key;
        }

        if (!currentKey) {
            const firstGroup = activeEpisode || episodesList[0];
            if (firstGroup?.server_data?.length > 0) {
                currentKey = getEpisodeKey(
                    firstGroup.server_data[0].slug,
                    firstGroup.server_data[0].name,
                );
            }
        }

        if (!currentKey) return;

        const savedServerSlug = historyItem?.server;
        const savedServerName = savedServerSlug
            ? slugToServerName(savedServerSlug)
            : null;

        // Tìm server group chứa tập hiện tại
        let currentGroup = activeEpisode;
        let currentIndexInGroup = -1;

        if (currentGroup) {
            currentIndexInGroup = (currentGroup.server_data || []).findIndex(
                (s) =>
                    compareEpisodeKeys(
                        getEpisodeKey(s.slug, s.name),
                        currentKey,
                    ),
            );
        }

        if (currentIndexInGroup === -1) {
            for (const ep of episodesList) {
                const idx = (ep.server_data || []).findIndex((s) =>
                    compareEpisodeKeys(
                        getEpisodeKey(s.slug, s.name),
                        currentKey,
                    ),
                );
                if (idx !== -1) {
                    currentGroup = ep;
                    currentIndexInGroup = idx;
                    break;
                }
            }
        }

        if (currentIndexInGroup === -1 || !currentGroup) return;

        const data = currentGroup.server_data;
        const prevIndex = currentIndexInGroup - 1;

        if (prevIndex >= 0) {
            openEpisode(data[prevIndex], currentGroup, movie);
        } else {
            // Chuyển sang group trước đó
            const currentGroupIdx = episodesList.findIndex(
                (ep) => ep.server_name === currentGroup.server_name,
            );
            if (currentGroupIdx > 0) {
                // Ưu tiên tìm group trước đó có cùng loại server
                for (let i = currentGroupIdx - 1; i >= 0; i--) {
                    const prevGroup = episodesList[i];
                    const prevType = extractServerType(prevGroup.server_name);
                    const currentType = extractServerType(
                        currentGroup.server_name,
                    );

                    if (
                        (savedServerName &&
                            (prevGroup.server_name === savedServerName ||
                                prevGroup.server_name.includes(
                                    savedServerName,
                                ))) ||
                        (currentType && prevType === currentType)
                    ) {
                        if (prevGroup.server_data?.length > 0) {
                            setActiveEpisode(prevGroup);
                            openEpisode(
                                prevGroup.server_data[
                                    prevGroup.server_data.length - 1
                                ],
                                prevGroup,
                                movie,
                            );
                            return;
                        }
                    }
                }

                // Fallback về group liền trước
                const prevGroup = episodesList[currentGroupIdx - 1];
                if (prevGroup.server_data?.length > 0) {
                    setActiveEpisode(prevGroup);
                    openEpisode(
                        prevGroup.server_data[prevGroup.server_data.length - 1],
                        prevGroup,
                        movie,
                    );
                    return;
                }
            }

            setErrorMessage("Đây là tập đầu tiên!");
            setTimeout(() => setErrorMessage(null), 3000);
        }
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
        <VodLayout>
            {isLoading && !movie && <PlaySkeleton backgrounds={backgrounds} />}
            {!isLoading && !movie && (
                <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 px-4 text-center">
                    <div className="rounded-full bg-zinc-900 p-8 ring-1 ring-white/10">
                        <svg
                            className="h-16 w-16 text-zinc-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-black tracking-tighter text-white">
                            Không tìm thấy nội dung
                        </h2>
                        <p className="mx-auto max-w-md text-zinc-500">
                            Dữ liệu phim không khả dụng hoặc đã bị gỡ bỏ. Vui
                            lòng thử lại sau hoặc chọn phim khác.
                        </p>
                    </div>
                    <Link
                        to="/vod"
                        className="rounded-full bg-red-600 px-8 py-3 text-sm font-black uppercase tracking-widest text-white shadow-[0_0_20px_rgba(220,38,38,0.4)] transition-all hover:scale-105 active:scale-95"
                    >
                        Quay lại danh sách
                    </Link>
                </div>
            )}
            {/* Image Modal */}
            {showImageModal && modalImages.length > 0 && (
                <div
                    ref={modalRef}
                    tabIndex={0}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 outline-none backdrop-blur-md"
                    onClick={() => setShowImageModal(false)}
                >
                    <div
                        className="relative flex h-full max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-zinc-950 shadow-2xl ring-1 ring-white/10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setShowImageModal(false)}
                            className="absolute right-6 top-6 z-20 cursor-pointer rounded-full bg-black/40 p-2 text-white backdrop-blur-md transition-all hover:scale-110 hover:bg-red-600"
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
                                    strokeWidth={2.5}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>

                        {/* Image */}
                        <div className="flex flex-1 items-center justify-center overflow-hidden border-b border-white/5">
                            <img
                                loading="lazy"
                                src={`https://image.tmdb.org/t/p/original${modalImages[currentImageIndex]?.file_path}`}
                                alt={`Image ${currentImageIndex + 1}`}
                                className="max-h-full max-w-full object-contain"
                            />
                        </div>

                        {/* Navigation */}
                        <div className="flex items-center justify-center gap-8 bg-zinc-900/50 px-6 py-6 backdrop-blur-xl">
                            <button
                                onClick={() =>
                                    setCurrentImageIndex((prev) =>
                                        prev > 0
                                            ? prev - 1
                                            : modalImages.length - 1,
                                    )
                                }
                                className="group cursor-pointer rounded-full bg-zinc-800 p-4 text-white transition-all hover:bg-red-600 active:scale-95"
                            >
                                <svg
                                    className="h-6 w-6 transition-transform group-hover:-translate-x-1"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2.5}
                                        d="M15 19l-7-7 7-7"
                                    />
                                </svg>
                            </button>
                            <div className="flex flex-col items-center">
                                <span className="text-xl font-black tracking-tighter text-white">
                                    {currentImageIndex + 1}
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                    của {modalImages.length}
                                </span>
                            </div>
                            <button
                                onClick={() =>
                                    setCurrentImageIndex((prev) =>
                                        prev < modalImages.length - 1
                                            ? prev + 1
                                            : 0,
                                    )
                                }
                                className="group cursor-pointer rounded-full bg-zinc-800 p-4 text-white transition-all hover:bg-red-600 active:scale-95"
                            >
                                <svg
                                    className="h-6 w-6 transition-transform group-hover:translate-x-1"
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
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Share Modal */}
            {showShareModal && movie && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
                    onClick={() => setShowShareModal(false)}
                >
                    <div
                        className="w-full max-w-md overflow-hidden rounded-2xl bg-zinc-900 shadow-2xl ring-1 ring-white/10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-white/5 px-8 py-6">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
                                {t("vodPlay.shareMovie")}
                            </h3>
                            <button
                                onClick={() => setShowShareModal(false)}
                                className="cursor-pointer rounded-full p-2 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-white"
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
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-8">
                            {/* Movie Info */}
                            <div className="mb-8 flex items-center gap-6">
                                <div className="aspect-2/3 h-24 overflow-hidden rounded-lg shadow-2xl ring-1 ring-white/10">
                                    <img
                                        loading="lazy"
                                        src={movie.poster_url}
                                        alt={movie.name}
                                        className="h-full w-full object-cover"
                                    />
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-lg font-black tracking-tighter text-white">
                                        {movie.name}
                                    </h4>
                                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                                        {movie.origin_name}
                                    </p>
                                </div>
                            </div>

                            {/* Copy Link */}
                            <div className="space-y-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                                    {t("vodPlay.movieLink")}
                                </p>
                                <div className="group relative flex items-center">
                                    <input
                                        type="text"
                                        readOnly
                                        value={window.location.href}
                                        className="w-full rounded-xl border border-white/5 bg-zinc-950/50 py-4 pl-4 pr-24 text-sm font-bold text-zinc-400 focus:outline-none focus:ring-1 focus:ring-red-600"
                                    />
                                    <button
                                        onClick={() =>
                                            copyToClipboard(
                                                window.location.href,
                                            )
                                        }
                                        className="absolute right-1.5 rounded-lg bg-white px-4 py-2 text-[10px] font-black uppercase tracking-wider text-black transition-all hover:bg-red-600 hover:text-white active:scale-95"
                                    >
                                        Sao chép
                                    </button>
                                </div>
                                {shareMessage && (
                                    <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-green-500">
                                        <svg
                                            className="h-3 w-3"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={3}
                                                d="M5 13l4 4L19 7"
                                            />
                                        </svg>
                                        {shareMessage}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {isLoading ? (
                <PlaySkeleton
                    backgrounds={memoizedBackgrounds || backgrounds}
                />
            ) : !movie ? (
                <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 px-4 text-center">
                    <div className="rounded-full bg-zinc-900 p-8 ring-1 ring-white/10">
                        <svg
                            className="h-16 w-16 text-zinc-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-black tracking-tighter text-white">
                            Không tìm thấy nội dung
                        </h2>
                        <p className="mx-auto max-w-md text-zinc-500">
                            Dữ liệu phim không khả dụng hoặc đã bị gỡ bỏ. Vui
                            lòng thử lại sau hoặc chọn phim khác.
                        </p>
                    </div>
                    <Link
                        to="/vod"
                        className="rounded-full bg-red-600 px-8 py-3 text-sm font-black uppercase tracking-widest text-white shadow-[0_0_20px_rgba(220,38,38,0.4)] transition-all hover:scale-105 active:scale-95"
                    >
                        Quay lại danh sách
                    </Link>
                </div>
            ) : (
                <div className="relative min-h-screen">
                    {/* Background Hero Section */}
                    <div className="absolute inset-x-0 top-0 z-0 mx-auto h-[85vh] w-full max-w-[1920px] overflow-hidden md:h-screen lg:min-h-[850px]">
                        {/* Mobile: Poster (dọc) */}
                        <div
                            className="bg-no-state absolute inset-0 bg-cover bg-top opacity-40 blur-[2px] transition-all duration-1000 md:hidden"
                            style={{
                                backgroundImage: `url(${getMovieImage(memoizedBackgrounds?.poster_url || memoizedBackgrounds?.thumb_url || movie?.poster_url || movie?.thumb_url)})`,
                            }}
                        ></div>
                        {/* Desktop: Thumbnail (ngang) */}
                        <div
                            className="bg-no-state absolute inset-0 hidden bg-cover bg-center opacity-35 blur-[2px] transition-all duration-1000 md:block"
                            style={{
                                backgroundImage: `url(${getMovieImage(memoizedBackgrounds?.thumb_url || memoizedBackgrounds?.poster_url || movie?.thumb_url || movie?.poster_url)})`,
                            }}
                        ></div>
                        <div className="bg-linear-to-b absolute inset-0 from-zinc-950/20 via-zinc-950/60 to-zinc-950"></div>
                        <div className="absolute inset-0 border-b border-white/5"></div>
                    </div>

                    <div className="container relative z-10 mx-auto flex-col gap-8 px-4 pb-12 pt-20">
                        {/* Breadcrumb Navigation with Actions */}
                        <div className="mb-2 flex flex-col gap-6 border-b border-zinc-900 py-2 md:flex-row md:items-center md:justify-between">
                            <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">
                                <Link
                                    to="/vod"
                                    className="transition-colors hover:text-white"
                                >
                                    Phim
                                </Link>
                                <span className="text-zinc-800">/</span>
                                <span className="font-black text-white">
                                    {movie.name}
                                </span>
                            </nav>

                            {/* Quick Actions */}
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => toggleFavorite(movie)}
                                    className={`flex cursor-pointer items-center gap-2 rounded-full px-6 py-2.5 text-xs font-black uppercase tracking-wider transition-all active:scale-95 ${
                                        isFavorited(movie.slug)
                                            ? "bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]"
                                            : "border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-red-600 hover:text-white"
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

                                <button
                                    onClick={() => shareMovie(movie)}
                                    className="flex cursor-pointer items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-6 py-2.5 text-xs font-black uppercase tracking-wider text-zinc-400 transition-all hover:border-white hover:text-white active:scale-95"
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

                        <div className="flex flex-col gap-8">
                            {/* Player Column */}
                            <div className="flex w-full flex-col overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/5">
                                <div
                                    className="relative flex max-h-[80vh] w-full items-center justify-center overflow-hidden bg-black"
                                    style={{ aspectRatio: "16/9" }}
                                >
                                    {/* Lớp nền mờ - React quản lý */}
                                    {!currentUrlRef.current &&
                                        memoizedBackgrounds && (
                                            <div
                                                className="absolute inset-0 scale-110 bg-cover bg-center opacity-50 blur-2xl transition-opacity duration-700"
                                                style={{
                                                    backgroundImage: `url(${getMovieImage(memoizedBackgrounds.thumb_url || memoizedBackgrounds.poster_url)})`,
                                                }}
                                            ></div>
                                        )}

                                    {/* Vùng gắn Player - Shaka quản lý */}
                                    <div
                                        ref={playerRef}
                                        className="relative z-10 h-full w-full"
                                    ></div>
                                </div>

                                {/* Control Bar */}
                                <div className="border-t border-white/5 bg-zinc-950 p-6">
                                    <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                                        {/* Left Side: Episode Info */}
                                        <div className="flex items-center gap-4">
                                            <div className="flex h-10 w-1 rounded-full bg-red-600"></div>
                                            <div>
                                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                                                    Đang xem tập
                                                </h3>
                                                <p className="text-lg font-black uppercase tracking-tighter text-white">
                                                    {currentEpisodeId &&
                                                        (/^\d+$/.test(
                                                            currentEpisodeId,
                                                        )
                                                            ? `Tập ${currentEpisodeId}`
                                                            : currentEpisodeId)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Right Side: Player Settings */}
                                        <div className="flex flex-wrap items-center gap-4 md:justify-end">
                                            {/* Previous/Next Episode Buttons */}
                                            <div className="flex items-center gap-3">
                                                {/* Previous Episode */}
                                                <button
                                                    onClick={playPrevEpisode}
                                                    className="group flex h-11 cursor-pointer items-center gap-2 rounded-full bg-zinc-900/50 px-5 text-white/70 ring-1 ring-white/10 transition-all hover:bg-zinc-800 hover:text-white active:scale-95 sm:px-6"
                                                    title="Tập trước (P)"
                                                >
                                                    <svg
                                                        className="h-4 w-4 transition-transform group-hover:-translate-x-1"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2.5}
                                                            d="M15 19l-7-7 7-7"
                                                        />
                                                    </svg>
                                                    <span className="hidden text-[11px] font-black uppercase tracking-wider sm:block">
                                                        Tập trước
                                                    </span>
                                                </button>

                                                {/* Next Episode */}
                                                <button
                                                    onClick={playNextEpisode}
                                                    className="group flex h-11 cursor-pointer items-center gap-2 rounded-full bg-red-600 px-5 text-white shadow-lg shadow-red-600/20 transition-all hover:bg-red-500 active:scale-95 sm:px-7"
                                                >
                                                    <span className="hidden text-[11px] font-black uppercase tracking-wider sm:block">
                                                        Tập tiếp theo
                                                    </span>
                                                    <span className="text-[11px] font-black uppercase tracking-wider sm:hidden">
                                                        Tiếp
                                                    </span>
                                                    <svg
                                                        className="h-4 w-4 transition-transform group-hover:translate-x-1"
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
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Settings Switches */}
                                    <div className="mt-8 flex flex-wrap gap-8 border-t border-white/5 pt-6">
                                        <div className="flex items-center gap-4">
                                            <div
                                                className="flex cursor-pointer items-center gap-3"
                                                onClick={() =>
                                                    setAutoplayEnabled(
                                                        !autoplayEnabled,
                                                    )
                                                }
                                            >
                                                <div
                                                    className={`relative h-5 w-10 rounded-full transition-all duration-300 ${
                                                        autoplayEnabled
                                                            ? "bg-red-600"
                                                            : "bg-zinc-800"
                                                    }`}
                                                >
                                                    <div
                                                        className={`absolute top-1 h-3 w-3 rounded-full bg-white shadow-lg transition-transform duration-300 ${
                                                            autoplayEnabled
                                                                ? "translate-x-6"
                                                                : "translate-x-1"
                                                        }`}
                                                    ></div>
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                                    Tự động chuyển tập
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-4">
                                            <div
                                                className="flex cursor-pointer items-center gap-3"
                                                onClick={() =>
                                                    setSkipIntroEnabled(
                                                        !skipIntroEnabled,
                                                    )
                                                }
                                            >
                                                <div
                                                    className={`relative h-5 w-10 rounded-full transition-all duration-300 ${
                                                        skipIntroEnabled
                                                            ? "bg-red-600"
                                                            : "bg-zinc-800"
                                                    }`}
                                                >
                                                    <div
                                                        className={`absolute top-1 h-3 w-3 rounded-full bg-white shadow-lg transition-transform duration-300 ${
                                                            skipIntroEnabled
                                                                ? "translate-x-6"
                                                                : "translate-x-1"
                                                        }`}
                                                    ></div>
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                                    Tự động bỏ qua Intro
                                                </span>
                                            </div>
                                            {skipIntroEnabled && (
                                                <div className="flex items-center gap-2 overflow-hidden rounded-full border border-white/5 bg-zinc-900 p-1">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="3000"
                                                        value={introDuration}
                                                        onChange={(e) => {
                                                            const value =
                                                                Math.max(
                                                                    0,
                                                                    Math.min(
                                                                        3000,
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
                                                            setIntroDurations(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    [slug.split(
                                                                        "?",
                                                                    )[0]]:
                                                                        value,
                                                                }),
                                                            );
                                                        }}
                                                        className="w-12 bg-transparent text-center text-xs font-black text-white outline-none"
                                                    />
                                                    <span className="pr-2 text-[10px] font-black uppercase tracking-widest text-zinc-600">
                                                        Giây
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div
                                                className="flex cursor-pointer items-center gap-3"
                                                onClick={() =>
                                                    setIsCompactView(
                                                        !isCompactView,
                                                    )
                                                }
                                            >
                                                <div
                                                    className={`relative h-5 w-10 rounded-full transition-all duration-300 ${
                                                        isCompactView
                                                            ? "bg-red-600"
                                                            : "bg-zinc-800"
                                                    }`}
                                                >
                                                    <div
                                                        className={`absolute top-1 h-3 w-3 rounded-full bg-white shadow-lg transition-transform duration-300 ${
                                                            isCompactView
                                                                ? "translate-x-6"
                                                                : "translate-x-1"
                                                        }`}
                                                    ></div>
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                                    Tập phim giản lược
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Episode List Column */}
                            <div className="flex w-full flex-col overflow-hidden rounded-2xl bg-zinc-950 shadow-2xl ring-1 ring-white/5">
                                {/* Server Select Tabs */}
                                <div className="relative border-b border-white/5 bg-zinc-900/50">
                                    <button
                                        onClick={() => {
                                            const container =
                                                document.getElementById(
                                                    "server-tabs-container",
                                                );
                                            if (container)
                                                container.scrollBy({
                                                    left: -200,
                                                    behavior: "smooth",
                                                });
                                        }}
                                        className="bg-linear-to-r absolute left-0 top-0 z-10 hidden h-full w-10 items-center justify-center from-zinc-900 to-transparent text-white transition-opacity hover:opacity-100 md:flex"
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
                                                strokeWidth={2.5}
                                                d="M15 19l-7-7 7-7"
                                            />
                                        </svg>
                                    </button>

                                    <div
                                        id="server-tabs-container"
                                        className="no-scrollbar flex overflow-x-auto scroll-smooth"
                                    >
                                        {episodes.map((episode) => (
                                            <button
                                                key={episode.server_name}
                                                onClick={() =>
                                                    switchTab(episode)
                                                }
                                                className={`relative flex h-16 shrink-0 items-center gap-2 px-8 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                                                    activeEpisode?.server_name ===
                                                    episode.server_name
                                                        ? "text-red-600"
                                                        : "text-zinc-600 hover:text-zinc-400"
                                                }`}
                                            >
                                                {/* Icon theo type */}
                                                {episode.type_id === "sub" && (
                                                    <svg
                                                        className="h-4 w-4"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 012 2h-3l-4 4z"
                                                        />
                                                    </svg>
                                                )}
                                                {episode.type_id === "tm" && (
                                                    <svg
                                                        className="h-4 w-4"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                                                        />
                                                    </svg>
                                                )}
                                                {episode.type_id === "lt" && (
                                                    <svg
                                                        className="h-4 w-4"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                                                        />
                                                    </svg>
                                                )}

                                                {episode.server_name}
                                                {activeEpisode?.server_name ===
                                                    episode.server_name && (
                                                    <div className="absolute bottom-0 left-0 h-1 w-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]"></div>
                                                )}
                                            </button>
                                        ))}
                                    </div>

                                    <button
                                        onClick={() => {
                                            const container =
                                                document.getElementById(
                                                    "server-tabs-container",
                                                );
                                            if (container)
                                                container.scrollBy({
                                                    left: 200,
                                                    behavior: "smooth",
                                                });
                                        }}
                                        className="bg-linear-to-l absolute right-0 top-0 z-10 hidden h-full w-10 items-center justify-center from-zinc-900 to-transparent text-white transition-opacity hover:opacity-100 md:flex"
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
                                                strokeWidth={2.5}
                                                d="M9 5l7 7-7 7"
                                            />
                                        </svg>
                                    </button>
                                </div>

                                {/* Server Data Grid - Responsive Episode Cards with Images */}
                                <div className="no-scrollbar max-h-[35rem] overflow-y-auto p-6">
                                    <div
                                        className={`grid gap-2 ${
                                            isCompactView
                                                ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10"
                                                : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                                        }`}
                                    >
                                        {episodeListData.map(([k, server]) => {
                                            const isActive =
                                                k === (currentEpisodeId || "");
                                            const imdbEp = server.imdbEp;
                                            const episodeThumb = server.thumb;

                                            return (
                                                <button
                                                    key={`${activeEpisode?.server_name}-${k}`}
                                                    onClick={() =>
                                                        openEpisode(
                                                            server,
                                                            activeEpisode,
                                                            movie,
                                                        )
                                                    }
                                                    className={`group relative flex flex-col overflow-hidden rounded-xl border transition-all duration-300 active:scale-[0.98] ${
                                                        isActive
                                                            ? "border-red-600 bg-red-600/10 ring-1 ring-red-600/50"
                                                            : "border-white/5 bg-zinc-900/40 hover:border-white/20 hover:bg-zinc-900/60"
                                                    } ${isCompactView ? "items-center justify-center p-2 text-center" : ""}`}
                                                    title={imdbEp?.overview}
                                                >
                                                    {!isCompactView && (
                                                        <>
                                                            {/* Episode Thumbnail */}
                                                            <div className="relative aspect-video w-full overflow-hidden">
                                                                <img
                                                                    loading="lazy"
                                                                    src={
                                                                        episodeThumb
                                                                    }
                                                                    alt={`Tập ${k}`}
                                                                    className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-110 ${isActive ? "" : "opacity-60 group-hover:opacity-100"}`}
                                                                />
                                                                <div className="bg-linear-to-t absolute inset-0 from-black/80 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>

                                                                {/* Episode Badge */}
                                                                <div
                                                                    className={`absolute left-2 top-2 rounded-md px-2 py-1 text-[9px] font-black uppercase tracking-wider backdrop-blur-md ${isActive ? "bg-red-600 text-white" : "bg-black/60 text-zinc-300"}`}
                                                                >
                                                                    Tập {k}
                                                                </div>

                                                                {/* Play Overlay Icon */}
                                                                <div
                                                                    className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                                                                >
                                                                    <div
                                                                        className={`flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md transition-transform duration-300 ${isActive ? "scale-100 bg-red-600" : "scale-75 bg-white/20 group-hover:scale-100"}`}
                                                                    >
                                                                        <svg
                                                                            className="h-5 w-5 text-white"
                                                                            fill="currentColor"
                                                                            viewBox="0 0 24 24"
                                                                        >
                                                                            <path d="M8 5v14l11-7z" />
                                                                        </svg>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Episode Title/Info */}
                                                            <div className="flex flex-1 flex-col p-3">
                                                                {imdbEp?.name && (
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <span
                                                                            className={`truncate text-[11px] font-black uppercase tracking-wider ${isActive ? "text-red-500" : "text-zinc-400 group-hover:text-white"}`}
                                                                        >
                                                                            {imdbEp?.name ||
                                                                                formatEpisodeName(
                                                                                    server.name ||
                                                                                        (/^\d+$/.test(
                                                                                            String(
                                                                                                k,
                                                                                            ),
                                                                                        )
                                                                                            ? `Tập ${k}`
                                                                                            : "Extra"),
                                                                                )}
                                                                        </span>
                                                                        {isActive && (
                                                                            <span className="flex h-1.5 w-1.5 animate-pulse rounded-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.8)]"></span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {imdbEp?.runtime && (
                                                                    <span className="mt-1 text-[9px] font-medium text-zinc-600">
                                                                        {Math.round(
                                                                            imdbEp.runtime,
                                                                        )}{" "}
                                                                        Phút
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </>
                                                    )}

                                                    {isCompactView && (
                                                        <div className="flex flex-col items-center">
                                                            <span
                                                                className={`text-base uppercase tracking-tighter ${isActive ? "text-white" : "text-zinc-400 group-hover:text-white"}`}
                                                            >
                                                                {/^\d+$/.test(k)
                                                                    ? k
                                                                    : (
                                                                          imdbEp?.name ||
                                                                          k
                                                                      )
                                                                          .charAt(
                                                                              0,
                                                                          )
                                                                          .toUpperCase()}
                                                            </span>
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Movie Details Info Area */}
                        <div className="mt-12 space-y-20">
                            {/* Main Info */}
                            <section className="flex flex-col gap-12 lg:flex-row lg:items-start">
                                {/* Poster Side */}
                                <div className="hidden shrink-0 lg:block">
                                    <div className="aspect-2/3 relative w-[300px] overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10">
                                        <img
                                            loading="lazy"
                                            src={
                                                tmdbData?.poster_path
                                                    ? `${TMDB_IMAGE_BASE_URL}/${TMDB_IMAGE_SIZES.POSTER}${tmdbData.poster_path}`
                                                    : getMovieImage(
                                                          movie.poster_url ||
                                                              movie.thumb_url,
                                                          movie.source,
                                                      )
                                            }
                                            alt={movie.name}
                                            className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                e.target.src =
                                                    getMovieImage(null);
                                            }}
                                        />
                                        <div className="bg-linear-to-t absolute inset-0 from-zinc-950 via-transparent to-transparent opacity-60"></div>
                                    </div>
                                </div>

                                {/* Text Info Side */}
                                <div className="flex-1 space-y-10">
                                    <header className="space-y-6">
                                        <div className="space-y-2">
                                            {(() => {
                                                const titleLogo = (() => {
                                                    if (
                                                        tmdbImages?.logos
                                                            ?.length > 0
                                                    ) {
                                                        const viLogo =
                                                            tmdbImages.logos.find(
                                                                (l) =>
                                                                    l.iso_639_1 ===
                                                                    "vi",
                                                            );
                                                        const enLogo =
                                                            tmdbImages.logos.find(
                                                                (l) =>
                                                                    l.iso_639_1 ===
                                                                    "en",
                                                            );
                                                        return (
                                                            viLogo ||
                                                            enLogo ||
                                                            tmdbImages.logos[0]
                                                        );
                                                    }
                                                    return null;
                                                })();

                                                const logoUrl = titleLogo
                                                    ? `${TMDB_IMAGE_BASE_URL}/${TMDB_IMAGE_SIZES.POSTER}${titleLogo.file_path}`
                                                    : fanartLogo;

                                                if (logoUrl) {
                                                    return (
                                                        <div className="space-y-4">
                                                            <div className="h-[60px] w-full max-w-[280px] drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] md:h-[100px] md:max-w-[350px] lg:h-[120px] lg:max-w-[450px]">
                                                                <img
                                                                    loading="lazy"
                                                                    src={
                                                                        logoUrl
                                                                    }
                                                                    alt={
                                                                        movie.name
                                                                    }
                                                                    className="h-full w-full object-contain object-left"
                                                                />
                                                            </div>
                                                            <h1 className="text-xl font-black leading-tight tracking-tighter text-zinc-400 md:text-2xl lg:text-3xl">
                                                                {movie.name}
                                                            </h1>
                                                        </div>
                                                    );
                                                }
                                                return (
                                                    <h1 className="text-4xl font-black leading-tight tracking-tighter text-white md:text-6xl lg:text-7xl">
                                                        {movie.name}
                                                    </h1>
                                                );
                                            })()}
                                            <p className="text-lg font-bold uppercase tracking-[0.2em] text-zinc-600 md:text-xl">
                                                {movie.origin_name}
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-4 pt-2">
                                            {(() => {
                                                const year =
                                                    movie.year ||
                                                    (tmdbData?.release_date &&
                                                        new Date(
                                                            tmdbData.release_date,
                                                        ).getFullYear()) ||
                                                    (() => {
                                                        if (
                                                            !Array.isArray(
                                                                movie.category,
                                                            ) &&
                                                            movie.category &&
                                                            typeof movie.category ===
                                                                "object"
                                                        ) {
                                                            const yearGroup =
                                                                Object.values(
                                                                    movie.category,
                                                                ).find(
                                                                    (g) =>
                                                                        g.group
                                                                            ?.name ===
                                                                        "Năm",
                                                                );
                                                            return yearGroup
                                                                ?.list[0]?.name;
                                                        }
                                                        return null;
                                                    })();

                                                if (!year) return null;

                                                return (
                                                    <>
                                                        <span className="text-sm font-black text-white">
                                                            {year}
                                                        </span>
                                                        <span className="h-1 w-1 rounded-full bg-zinc-800"></span>
                                                    </>
                                                );
                                            })()}
                                            {movie.time && (
                                                <span className="text-sm font-bold text-zinc-400">
                                                    {movie.time}
                                                </span>
                                            )}
                                            {movie.time && (
                                                <span className="h-1 w-1 rounded-full bg-zinc-800"></span>
                                            )}
                                            <span className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-black uppercase text-white">
                                                {movie.quality || "HD"}
                                            </span>
                                            {tmdbData?.vote_average > 0 && (
                                                <span className="flex items-center gap-1.5 text-sm font-black text-amber-500">
                                                    <svg
                                                        className="h-4 w-4 fill-current"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                                    </svg>
                                                    {tmdbData.vote_average.toFixed(
                                                        1,
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    </header>

                                    <div className="flex flex-wrap gap-2">
                                        {(() => {
                                            let categories = [];
                                            if (Array.isArray(movie.category)) {
                                                categories = movie.category;
                                            } else if (
                                                movie.category &&
                                                typeof movie.category ===
                                                    "object"
                                            ) {
                                                // Xử lý cấu trúc đặc thù của Nguồn C
                                                categories = Object.values(
                                                    movie.category,
                                                ).flatMap(
                                                    (group) => group.list || [],
                                                );
                                            }

                                            return categories.map(
                                                (cat, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="rounded-full border border-zinc-800 bg-zinc-900/50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 transition-all hover:border-red-600 hover:text-white"
                                                    >
                                                        {cat.name}
                                                    </span>
                                                ),
                                            );
                                        })()}
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-sm font-black uppercase tracking-[0.3em] text-red-600">
                                            Tóm tắt nội dung
                                        </h3>
                                        <div className="group/desc relative">
                                            <div
                                                className={`overflow-hidden text-justify text-lg font-medium leading-relaxed text-zinc-400 transition-all duration-500 ${
                                                    !showDescription
                                                        ? "mask-linear-b max-h-32"
                                                        : "max-h-[2000px]"
                                                }`}
                                                dangerouslySetInnerHTML={{
                                                    __html: movie.content,
                                                }}
                                            ></div>
                                            {!showDescription && (
                                                <div className="bg-linear-to-t pointer-events-none absolute inset-x-0 bottom-0 h-24 from-zinc-950/80 to-transparent transition-opacity duration-500"></div>
                                            )}
                                            <button
                                                onClick={() =>
                                                    setShowDescription(
                                                        !showDescription,
                                                    )
                                                }
                                                className="group/btn mt-6 flex cursor-pointer items-center gap-2 text-xs font-black uppercase tracking-widest text-white transition-all hover:text-red-600 active:scale-95"
                                            >
                                                <span className="relative">
                                                    {showDescription
                                                        ? "Thu gọn"
                                                        : "Đọc thêm"}
                                                    <div className="absolute -bottom-1 left-0 h-0.5 w-full scale-x-0 bg-red-600 transition-transform duration-300 group-hover/btn:scale-x-100"></div>
                                                </span>
                                                <svg
                                                    className={`h-4 w-4 transition-transform duration-300 ${
                                                        showDescription
                                                            ? "rotate-180"
                                                            : ""
                                                    }`}
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2.5}
                                                        d="M19 9l-7 7-7-7"
                                                    />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Cast Section */}
                            {((tmdbCredits?.cast &&
                                tmdbCredits.cast.length > 0) ||
                                (movie.actor && movie.actor.length > 0)) && (
                                <section className="space-y-12">
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-black uppercase tracking-[0.3em] text-red-600">
                                            Dàn diễn viên
                                        </h3>
                                        <div className="group/cast relative">
                                            <div
                                                className={`overflow-hidden transition-all duration-500 ${
                                                    !showCast
                                                        ? "mask-linear-b max-h-56"
                                                        : "max-h-[5000px]"
                                                }`}
                                            >
                                                <div className="grid grid-cols-3 gap-6 p-1 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
                                                    {(tmdbCredits?.cast
                                                        ?.length > 0
                                                        ? tmdbCredits.cast
                                                        : (
                                                              movie.actor || []
                                                          ).map(
                                                              (name, idx) => ({
                                                                  id: idx,
                                                                  name,
                                                                  character: "",
                                                                  profile_path:
                                                                      null,
                                                              }),
                                                          )
                                                    ).map((c) => (
                                                        <div
                                                            key={c.id}
                                                            className="group shrink-0 space-y-4"
                                                        >
                                                            <div className="mx-auto h-24 w-24 overflow-hidden rounded-full ring-2 ring-transparent transition-all duration-300 group-hover:ring-red-600 md:h-28 md:w-28">
                                                                {c.profile_path ? (
                                                                    <img
                                                                        loading="lazy"
                                                                        src={`${TMDB_IMAGE_BASE_URL}/${TMDB_IMAGE_SIZES.SMALL}${c.profile_path}`}
                                                                        alt={
                                                                            c.name
                                                                        }
                                                                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                                    />
                                                                ) : (
                                                                    <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-2xl font-black text-zinc-700">
                                                                        {c.name
                                                                            ?.charAt(
                                                                                0,
                                                                            )
                                                                            .toUpperCase()}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="text-center">
                                                                <p className="line-clamp-1 text-xs font-black text-zinc-200 transition-colors group-hover:text-red-600">
                                                                    {c.name}
                                                                </p>
                                                                <p className="line-clamp-1 text-[9px] font-bold uppercase tracking-widest text-zinc-600">
                                                                    {
                                                                        c.character
                                                                    }
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            {!showCast && (
                                                <div className="bg-linear-to-t pointer-events-none absolute inset-x-0 bottom-0 h-24 from-zinc-950/80 to-transparent transition-opacity duration-500"></div>
                                            )}
                                            <button
                                                onClick={() =>
                                                    setShowCast(!showCast)
                                                }
                                                className="group/btn mt-6 flex cursor-pointer items-center gap-2 text-xs font-black uppercase tracking-widest text-white transition-all hover:text-red-600 active:scale-95"
                                            >
                                                <span className="relative">
                                                    {showCast
                                                        ? "Thu gọn"
                                                        : "Xem tất cả diễn viên"}
                                                    <div className="absolute -bottom-1 left-0 h-0.5 w-full scale-x-0 bg-red-600 transition-transform duration-300 group-hover/btn:scale-x-100"></div>
                                                </span>
                                                <svg
                                                    className={`h-4 w-4 transition-transform duration-300 ${
                                                        showCast
                                                            ? "rotate-180"
                                                            : ""
                                                    }`}
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2.5}
                                                        d="M19 9l-7 7-7-7"
                                                    />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* Gallery Section */}
                            {tmdbImages &&
                                (tmdbImages.posters?.length > 0 ||
                                    tmdbImages.backdrops?.length > 0) && (
                                    <section className="space-y-4">
                                        <div className="flex items-center gap-4">
                                            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-red-600">
                                                Bộ sưu tập ảnh
                                            </h3>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                                            {(() => {
                                                const allImages = [
                                                    ...(tmdbImages.backdrops ||
                                                        []),
                                                    ...(tmdbImages.posters ||
                                                        []),
                                                ];
                                                return allImages
                                                    .slice(0, 12)
                                                    .map((img, idx) => (
                                                        <div
                                                            key={img.file_path}
                                                            className="group relative aspect-video cursor-pointer overflow-hidden rounded-xl border border-white/5 bg-zinc-900 transition-all hover:border-red-600"
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
                                                                src={`${TMDB_IMAGE_BASE_URL}/${TMDB_IMAGE_SIZES.SMALL}${img.file_path}`}
                                                                alt="Gallery"
                                                                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                                loading="lazy"
                                                            />
                                                            {allImages.length >
                                                                12 &&
                                                                idx === 11 && (
                                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 font-black text-white">
                                                                        +
                                                                        {allImages.length -
                                                                            12}
                                                                    </div>
                                                                )}
                                                        </div>
                                                    ));
                                            })()}
                                        </div>
                                    </section>
                                )}
                        </div>
                    </div>
                </div>
            )}
        </VodLayout>
    );
}
