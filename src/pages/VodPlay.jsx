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

export default function VodPlay() {
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
    const slug = query.get("slug");
    const episodeParam = query.get("episode");
    const serverParam = query.get("server"); // Thêm server param
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
    const [viewHistory, setViewHistory] = useLocalStorage("viewHistory", []);
    const [bookmarks, setBookmarks] = useLocalStorage("bookmarks", []);
    const [showImageModal, setShowImageModal] = useState(false);
    const [modalImages, setModalImages] = useState([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isTheaterMode, setIsTheaterMode] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareMessage, setShareMessage] = useState("");
    const modalRef = useRef(null);

    // Interceptors đã setup từ đầu file

    useEffect(() => {
        // Set tiêu đề mặc định khi load
        document.title = slug ? "Đang tải..." : "VOD Player";
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
        };

        window.addEventListener("keydown", handleVideoKeyDown);
        return () => window.removeEventListener("keydown", handleVideoKeyDown);
    }, [showImageModal, showShareModal]);

    // Get last watched episodes list
    const getLastWatchedList = useCallback(() => {
        return viewHistory || [];
    }, [viewHistory]);

    // Fetch movie details
    async function fetchMovieDetails() {
        setIsLoading(true);
        try {
            const res = await fetch(`${CONFIG.API_ENDPOINT}/${slug}`);
            const json = await res.json();
            const data = json;
            if (data.status && data.movie) {
                setMovie(data.movie);

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

                setEpisodes(filteredEpisodes);

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

                if (filteredEpisodes.length > 0) {
                    initializeFromUrl(filteredEpisodes);
                }
            } else {
                setErrorMessage("Failed to load movie details 1.");
            }
        } catch (err) {
            console.log(err);
            setErrorMessage("Failed to load movie details 2.");
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
    function initializeFromUrl(episodesList) {
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
                targetEpisode = episodesList.find(
                    (episode) =>
                        episode.server_name === serverName &&
                        episode.server_data?.some(
                            (server) =>
                                getEpisodeKey(server.slug) === episodeNum,
                        ),
                );

                if (targetEpisode) {
                    targetServer = targetEpisode.server_data.find(
                        (server) => getEpisodeKey(server.slug) === episodeNum,
                    );
                }
            }

            // Nếu không tìm thấy bằng server param, fallback về tìm theo episode number
            if (!targetEpisode) {
                // Tìm episode có chứa tập với số episode này (vd: episode=01 → tìm "tap-01", "tap-1", etc.)
                targetEpisode = episodesList.find((episode) =>
                    episode.server_data?.some((server) => {
                        const serverEpisodeKey = getEpisodeKey(server.slug);
                        return (
                            serverEpisodeKey === episodeParam ||
                            serverEpisodeKey ===
                                episodeParam.replace(/^0+/, "") || // "01" → "1"
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
                            (server) => server.server_name === savedServerName,
                        );
                    }

                    // Fallback: server đầu tiên có tập này
                    if (!targetServer) {
                        targetServer = targetEpisode.server_data.find(
                            (server) => {
                                const serverEpisodeKey = getEpisodeKey(
                                    server.slug,
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
                openEpisode(targetServer, targetEpisode);
                return;
            }
        }

        // Ưu tiên 2: Tìm tập đang xem từ lịch sử (khi reload không có URL param)
        const lastWatchedList = getLastWatchedList();
        const cleanSlug = slug.split("?")[0]; // Dùng slug hiện tại
        const historyItem = lastWatchedList.find(
            (item) => item.slug === cleanSlug,
        );

        if (historyItem?.current_episode?.key && episodesList.length > 0) {
            // Tìm episode có chứa tập đang xem
            const episodeKey = historyItem.current_episode.key;
            const matchingEpisode = episodesList.find((episode) =>
                episode.server_data?.some((server) => {
                    const serverKey = getEpisodeKey(server.slug);
                    return serverKey === episodeKey;
                }),
            );

            if (matchingEpisode) {
                // Ưu tiên 1: Tìm server cùng type đã lưu (từ slug server)
                const savedServerSlug = historyItem.server; // "thuyet-minh", "vietsub", etc.
                let targetServer = null;

                if (savedServerSlug) {
                    // Convert slug về server name để tìm
                    const savedServerName = slugToServerName(savedServerSlug);
                    targetServer = matchingEpisode.server_data.find(
                        (server) => server.server_name === savedServerName,
                    );
                }

                // Ưu tiên 2: Nếu không tìm thấy server cùng type, dùng server đầu tiên khớp episode
                if (!targetServer) {
                    targetServer = matchingEpisode.server_data.find(
                        (server) => {
                            const serverKey = getEpisodeKey(server.slug);
                            return serverKey === episodeKey;
                        },
                    );
                }

                if (targetServer) {
                    hasInitializedRef.current = true;
                    setActiveEpisode(matchingEpisode);
                    // Truyền episode để lưu server_name đúng
                    openEpisode(targetServer, matchingEpisode);

                    // Cập nhật URL với đầy đủ thông tin
                    const params = new URLSearchParams();
                    params.set("slug", dataSlug);
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
            const firstEpisode = episodesList[0];
            hasInitializedRef.current = true;
            setActiveEpisode(firstEpisode);
            if (firstEpisode.server_data?.length > 0) {
                // Truyền episode để lưu server_name đúng
                openEpisode(firstEpisode.server_data[0], firstEpisode);
            }
        }
    }

    // Add to watch history
    // Helper function: Extract episode number từ slug (linh hoạt với nhiều format)
    function getEpisodeKey(episodeSlug) {
        // Tìm số đầu tiên trong slug (vd: "tap-3-vietsub" → "3", "episode-5" → "5", "3-long-tieng" → "3")
        const numberMatch = episodeSlug.match(/\d+/);
        const episodeNumber = numberMatch ? numberMatch[0] : episodeSlug;

        // Tìm phần server (phần sau số, vd: "vietsub", "long-tieng")
        // Remove số và dấu - ở đầu để lấy server suffix
        const serverPart = episodeSlug.replace(/^[^a-z]*\d+[^a-z]*/i, "");

        // Key = "số" (để share position giữa các server)
        return episodeNumber;
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
        // Server name đã được chuẩn hóa trong fetchMovieDetails() rồi
        const mapping = {
            Vietsub: "vietsub",
            "Thuyết Minh": "thuyet-minh",
            "Lồng Tiếng": "long-tieng",
        };
        return (
            mapping[serverName] || serverName.toLowerCase().replace(/\s+/g, "-")
        );
    }

    // Helper function: Chuẩn hóa URL slug thành server name
    function slugToServerName(slug) {
        const mapping = {
            vietsub: "Vietsub",
            "thuyet-minh": "Thuyết Minh",
            "long-tieng": "Lồng Tiếng",
        };
        return mapping[slug] || slug;
    }

    // Helper function: Lấy position đã xem của episode từ lịch sử
    function getLastWatchedPosition(episodeSlug) {
        // Tìm movieData trong history bằng slug hiện tại
        const movieData = viewHistory.find((item) => item.slug === slug);
        if (!movieData || !movieData.episodes) return 0;
        const episodeKey = getEpisodeKey(episodeSlug);
        const episodeData = movieData.episodes.find(
            (ep) => ep.key === episodeKey,
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
        // Lấy key tập phim
        const episodeKey = getEpisodeKey(episodeSlug);
        // Lấy lịch sử hiện tại
        let history = Array.isArray(viewHistory) ? [...viewHistory] : [];
        // Tìm index của phim trong lịch sử
        const cleanSlug = slug.split("?")[0];
        let movieIndex = history.findIndex((item) => item.slug === cleanSlug);

        // Lấy thông tin phim hiện tại từ state
        const currentMovie = movie && movie.name ? movie : movie || {};
        // Đảm bảo luôn có name và poster
        const movieName = currentMovie.name || "Không rõ tên";
        const moviePoster =
            currentMovie.poster_url ||
            currentMovie.poster ||
            currentMovie.thumb_url ||
            "https://placehold.co/200x300?text=No+Poster";
        const movieServer =
            currentMovie.server || episode?.server_name || serverParam || "";

        // Nếu chưa có trong lịch sử thì thêm mới
        if (movieIndex === -1) {
            history.unshift({
                slug: cleanSlug,
                name: movieName,
                poster: moviePoster,
                server: movieServer,
                current_episode: {
                    key: episodeKey,
                    value: episode?.name || episodeSlug,
                },
                time: new Date().toISOString(),
                episodes: [
                    {
                        key: episodeKey,
                        position: position || 0,
                        timestamp: new Date().toISOString(),
                    },
                ],
            });
        } else {
            // Đã có trong lịch sử, cập nhật
            const movieData = history[movieIndex];
            movieData.name = movieName;
            movieData.poster = moviePoster;
            movieData.server = movieServer;
            movieData.current_episode = {
                key: episodeKey,
                value: episode?.name || episodeSlug,
            };
            movieData.time = new Date().toISOString();
            // Kiểm tra nếu tập đã có thì cập nhật position, ngược lại thêm mới
            const epIndex = movieData.episodes.findIndex(
                (ep) => ep.key === episodeKey,
            );
            if (epIndex === -1) {
                movieData.episodes.push({
                    key: episodeKey,
                    position: position || 0,
                    timestamp: new Date().toISOString(),
                });
            } else {
                movieData.episodes[epIndex].position = position || 0;
                movieData.episodes[epIndex].timestamp =
                    new Date().toISOString();
            }
            // Đưa lên đầu danh sách
            history.splice(movieIndex, 1);
            history.unshift(movieData);
        }
        setViewHistory(history);
    };

    // Add custom rewind/forward buttons to JWPlayer
    function addCustomControls(player) {
        const controlbar = player
            .getContainer()
            .querySelector(".jw-controlbar");
        if (!controlbar) return;

        // Nút tua lùi 10s - tạo riêng biệt để khớp với structure JWPlayer
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

        // Nút tua tiến 10s - tạo riêng biệt để khớp với structure JWPlayer
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

        // Thêm nút Theater Mode vào góc phải của controlbar
        const theaterBtn = document.createElement("div");
        theaterBtn.className =
            "jw-icon jw-icon-inline jw-button-color jw-reset jw-icon-theater";
        theaterBtn.setAttribute("role", "button");
        theaterBtn.setAttribute("tabindex", "0");
        theaterBtn.setAttribute("aria-label", "Chế độ nhà hát");
        theaterBtn.title = "Chế độ nhà hát";
        theaterBtn.style.cssText = "cursor: pointer;";

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
                    setCurrentEpisodeId(episodeSlug);

                    // Restore playback position (dùng episodeKey để share giữa các server)
                    const lastWatchedList = getLastWatchedList();
                    const movieData = lastWatchedList.find(
                        (item) => item.movieSlug === slug,
                    );

                    // Lấy position đã xem từ lịch sử mới
                    const lastPosition = getLastWatchedPosition(episodeSlug);

                    if (lastPosition > 0) {
                        player.seek(lastPosition);
                    }

                    // Thêm custom controls: nút tua trước/sau 10 giây trên desktop
                    if (!isMobileDevice()) {
                        addCustomControls(player);
                    }

                    // Ẩn nút seek mặc định của JWPlayer (nếu có)
                    const container = player.getContainer();
                    if (container) {
                        // Ẩn các nút rewind/forward mặc định của JWPlayer
                        const style = document.createElement("style");
                        style.textContent = `
                            .jw-icon-rewind:not(.jw-icon-forward):not([aria-label="Tua lùi 10 giây"]),
                            .jw-icon-next:not([aria-label="Tua tiến 10 giây"]) {
                                display: none !important;
                            }
                        `;
                        container.appendChild(style);
                    }
                });

                let lastSavedTime = 0;
                // Save playback position periodically
                player.on("time", (event) => {
                    const currentTime = Math.floor(event.position);
                    if (currentTime - lastSavedTime >= 5) {
                        lastSavedTime = currentTime;
                        setWatchlist(
                            episodeSlug,
                            currentTime,
                            episodes.find((ep) => ep.slug === episodeSlug),
                            movie,
                        );
                    }
                });

                // Auto-play next episode when finished
                player.on("complete", () => {
                    playNextEpisode();
                });

                player.on("error", (event) => {
                    setErrorMessage(`Playback error: ${event.message}`);
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
                    setCurrentEpisodeId(episodeSlug);
                    setWatchlist(episodeSlug, null, null, movie);

                    // Restore playback position từ lịch sử mới
                    const lastPosition = getLastWatchedPosition(episodeSlug);

                    if (lastPosition > 0) {
                        video.currentTime = lastPosition;
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
                        setWatchlist(episodeSlug, currentTime, null, movie);
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
                    setWatchlist(episodeSlug, null, null, movie);

                    // Restore playback position từ lịch sử mới
                    const lastPosition = getLastWatchedPosition(episodeSlug);

                    if (lastPosition > 0) {
                        video.currentTime = lastPosition;
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
                        setWatchlist(episodeSlug, currentTime, null, movie);
                    }
                });

                // Auto-play next episode
                video.addEventListener("ended", () => {
                    playNextEpisode();
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

    function openEpisode(server, episode = null) {
        // Update document title - chỉ update khi có đầy đủ thông tin
        if (server?.name && movie?.name) {
            document.title = `[${server.name}] - ${movie.name}`;
        }

        // Lưu server ngay (không delay) - truyền episode để lấy server_name
        setWatchlist(server.slug, null, episode, movie);

        // Initialize player with URL - sẽ tự set currentEpisodeId khi ready
        initializePlayer(server.link_m3u8, server.slug);
    }

    // Play next episode
    function playNextEpisode() {
        if (!episodes || episodes.length === 0) return;

        // Lấy thông tin từ lịch sử
        const lastWatchedList = getLastWatchedList();
        const dataSlug = movieData?.slug || slug.split("?")[0];
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
                    const serverKey = getEpisodeKey(server.slug);
                    return serverKey === currentEpisodeKey;
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
                openEpisode(nextServer, currentEpisode);
                return;
            }
        }

        // Không có tập tiếp theo trong cùng episode, tìm episode khác với cùng server type
        const savedServerSlug = historyItem.server; // "thuyet-minh", "vietsub", etc.

        console.log("🔍 Auto-play debug:", {
            savedServerSlug: savedServerSlug,
            availableEpisodes: episodes.map((ep) => ({
                name: ep.server_name,
                serverData: ep.server_data?.length || 0,
            })),
        });

        if (savedServerSlug) {
            const savedServerName = slugToServerName(savedServerSlug); // Convert "thuyet-minh" → "Thuyết Minh"
            console.log("🔍 Converting server:", {
                savedServerSlug: savedServerSlug,
                savedServerName: savedServerName,
            });

            // Tìm episode tiếp theo có cùng server type
            const currentEpisodeIndex = episodes.findIndex(
                (ep) => ep === currentEpisode,
            );

            for (let i = currentEpisodeIndex + 1; i < episodes.length; i++) {
                const nextEpisode = episodes[i];

                console.log("🔍 Checking episode:", {
                    nextEpisodeName: nextEpisode.server_name,
                    savedServerName: savedServerName,
                    match: nextEpisode.server_name === savedServerName,
                });

                // Tìm server đầu tiên trong episode này có cùng server type
                // So sánh với episode.server_name (đã chuẩn hóa) thay vì server.server_name
                if (nextEpisode.server_name === savedServerName) {
                    // Lấy server đầu tiên trong episode này
                    const firstServer = nextEpisode.server_data?.[0];
                    if (firstServer) {
                        console.log(
                            "✅ Found matching episode, auto-playing:",
                            nextEpisode.server_name,
                        );
                        setActiveEpisode(nextEpisode);
                        openEpisode(firstServer, nextEpisode);
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
                openEpisode(firstServer, nextEpisode);
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
        setActiveEpisode(episode);

        // Ưu tiên 1: Giữ nguyên server type của tập hiện tại (dùng activeEpisode.server_name)
        if (activeEpisode?.server_name) {
            const currentServerType = extractServerType(
                activeEpisode.server_name,
            );
            const matchingServer = episode.server_data?.find((server) => {
                return (
                    extractServerType(server.server_name) === currentServerType
                );
            });

            if (matchingServer) {
                openEpisode(matchingServer, episode);
                return;
            }
        }

        // Ưu tiên 2: Sử dụng server đã lưu từ lịch sử
        const lastWatchedList = getLastWatchedList();
        const movieData = lastWatchedList.find((item) => item.slug === slug);
        const savedServerSlug = movieData?.server; // "thuyet-minh", "vietsub", etc.

        const params = new URLSearchParams();
        params.set("server", serverNameToSlug(movieData?.server)); // Server type
        console.log(
            "🔍 Switching tab, saved server slug:",
            serverNameToSlug(movieData?.server),
        );
        if (savedServerSlug && savedServerSlug.trim() !== "") {
            const savedServerName = slugToServerName(savedServerSlug);
            const matchingServer = episode.server_data?.find((server) => {
                return (
                    extractServerType(server.server_name) === savedServerName
                );
            });
            if (matchingServer) {
                openEpisode(matchingServer, episode);
                return;
            }
        }

        // Ưu tiên 3: Sử dụng server tương tự như tập hiện tại (so sánh slug pattern)
        const currentSlug = currentEpisodeId;
        const matchingServer = episode.server_data?.find(
            (server) => server.slug === currentSlug,
        );

        if (matchingServer) {
            openEpisode(matchingServer, episode);
        } else if (episode.server_data?.length > 0) {
            // Fallback: server đầu tiên
            openEpisode(episode.server_data[0], episode);
        } else {
            setErrorMessage("No servers available for this episode.");
        }
    }

    // Bookmark functions
    function isBookmarked(slug) {
        return bookmarks.some((bookmark) => bookmark.slug === slug);
    }

    function toggleBookmark(movie) {
        const isCurrentlyBookmarked = isBookmarked(movie.slug);

        if (isCurrentlyBookmarked) {
            // Remove bookmark
            const newBookmarks = bookmarks.filter(
                (bookmark) => bookmark.slug !== movie.slug,
            );
            setBookmarks(newBookmarks);
            setErrorMessage("Đã bỏ thích phim này!");
        } else {
            // Add bookmark
            const bookmark = {
                slug: movie.slug,
                name: movie.name,
                poster: movie.poster_url || movie.thumb_url || "",
                year: movie.year,
                quality: movie.quality,
                time: new Date().toISOString(),
            };
            setBookmarks([bookmark, ...bookmarks]);
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
                    setShareMessage("✓ Đã sao chép link!");
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
                setErrorMessage("Đã sao chép link vào clipboard!");
                setTimeout(() => {
                    setErrorMessage(null);
                }, 2000);
            }
        } catch (err) {
            setErrorMessage("Không thể sao chép link!");
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
                    <div className="rounded-md bg-red-100 p-4 text-red-500">
                        {errorMessage}
                    </div>
                </div>
            )}
            {/* Skeleton Loading cho toàn bộ trang */}
            {isLoading && !movie && (
                <main className="container mx-auto flex h-full flex-col gap-4 p-4">
                    {/* Skeleton Breadcrumb */}
                    <nav className="text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-20 animate-pulse rounded bg-gray-300"></div>
                            <div>/</div>
                            <div className="h-4 w-40 animate-pulse rounded bg-gray-300"></div>
                        </div>
                    </nav>

                    <div className="flex h-full w-full flex-col justify-start gap-4 lg:h-auto lg:flex-row lg:justify-center">
                        {/* Skeleton Player */}
                        <div className="flex w-full flex-col overflow-hidden rounded-md border-gray-50 bg-white shadow lg:w-8/12">
                            <div
                                className="w-full animate-pulse bg-gray-300"
                                style={{ aspectRatio: "16/9" }}
                            ></div>
                        </div>

                        {/* Skeleton Episode List */}
                        <div className="flex w-full flex-col overflow-hidden rounded-md border border-gray-200 bg-white shadow lg:w-4/12">
                            {/* Skeleton Tabs */}
                            <div className="border-b-2 border-gray-300 bg-gray-100">
                                <ul className="flex list-none overflow-x-auto">
                                    {Array.from({ length: 3 }).map((_, i) => (
                                        <li key={i} className="px-6 py-3.5">
                                            <div className="h-5 w-20 animate-pulse rounded bg-gray-300"></div>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Skeleton Episode Grid */}
                            <div className="grid h-fit max-h-96 auto-rows-max grid-cols-3 items-start gap-4 overflow-y-auto p-4 lg:h-0 lg:max-h-none lg:grow lg:grid-cols-4">
                                {Array.from({ length: 12 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="animate-pulse rounded-md border-2 border-transparent bg-gray-200 px-3 py-2 text-center"
                                    >
                                        <div className="h-4 rounded bg-gray-300"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Skeleton Movie Info */}
                    <div className="rounded-md border border-gray-200 bg-white p-4 shadow-md">
                        <div className="flex flex-col gap-4 lg:flex-row">
                            {/* Skeleton Poster */}
                            <div
                                className="hidden h-56 shrink-0 lg:block"
                                style={{ aspectRatio: "2/3" }}
                            >
                                <div className="h-full w-full animate-pulse rounded-md bg-gray-300"></div>
                            </div>
                            <div
                                className="w-full shrink-0 lg:hidden"
                                style={{ aspectRatio: "16/9" }}
                            >
                                <div className="h-full w-full animate-pulse rounded-md bg-gray-300"></div>
                            </div>

                            {/* Skeleton Content */}
                            <div className="flex grow flex-col gap-3">
                                {/* Skeleton Title */}
                                <div>
                                    <div className="mb-2 h-6 w-3/4 animate-pulse rounded bg-gray-300"></div>
                                    <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200"></div>
                                </div>

                                {/* Skeleton Tags */}
                                <div className="flex flex-wrap gap-2">
                                    {Array.from({ length: 4 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className="h-6 w-20 animate-pulse rounded-md bg-gray-300"
                                        ></div>
                                    ))}
                                </div>

                                {/* Skeleton Categories */}
                                <div className="flex flex-wrap gap-2">
                                    {Array.from({ length: 4 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className="h-6 w-16 animate-pulse rounded-md bg-gray-300"
                                        ></div>
                                    ))}
                                </div>

                                {/* Skeleton Actors */}
                                <div className="flex flex-wrap gap-2">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className="h-6 w-24 animate-pulse rounded-md bg-gray-300"
                                        ></div>
                                    ))}
                                </div>

                                {/* Skeleton Description */}
                                <div className="space-y-2">
                                    <div className="h-4 animate-pulse rounded bg-gray-300"></div>
                                    <div className="h-4 w-5/6 animate-pulse rounded bg-gray-300"></div>
                                    <div className="h-4 w-4/6 animate-pulse rounded bg-gray-300"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Skeleton Cast Section */}
                    <div>
                        <div className="mb-4 h-6 w-32 animate-pulse rounded bg-gray-300"></div>
                        <div className="rounded-md border border-gray-200 bg-white p-6 shadow-md">
                            <div className="grid grid-cols-4 gap-4 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
                                {Array.from({ length: 10 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="flex flex-col items-center gap-2 text-center"
                                    >
                                        <div className="bg-linear-to-br h-16 w-16 animate-pulse rounded-full from-gray-300 via-gray-400 to-gray-500"></div>
                                        <div className="w-32">
                                            <div className="mb-1 h-4 animate-pulse rounded bg-gray-300"></div>
                                            <div className="h-3 w-3/4 animate-pulse rounded bg-gray-200"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Skeleton Images Section */}
                    <div>
                        <div className="mb-4 h-6 w-36 animate-pulse rounded bg-gray-300"></div>
                        <div className="rounded-md border border-gray-200 bg-white p-6 shadow-md">
                            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="animate-pulse overflow-hidden rounded-lg bg-gray-300"
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
                        className="w-full max-w-md rounded-xl bg-white shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                            <h3 className="text-lg font-bold text-gray-900">
                                Chia sẻ phim
                            </h3>
                            <button
                                onClick={() => setShowShareModal(false)}
                                className="cursor-pointer rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
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
                                    <h4 className="font-semibold text-gray-900">
                                        {movie.name}
                                    </h4>
                                    <p className="text-sm text-gray-500">
                                        {movie.origin_name}
                                    </p>
                                </div>
                            </div>

                            {/* Copy Link */}
                            <div className="">
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                    Link phim
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        readOnly
                                        value={window.location.href}
                                        className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700"
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
                                    <p className="mt-2 text-sm text-green-600">
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
                    <main className="container mx-auto flex h-full flex-col gap-4 p-4">
                        {/* Breadcrumb Navigation with Actions */}
                        <div className="flex items-center justify-between">
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

                            {/* Quick Actions */}
                            <div className="flex items-center gap-2">
                                {/* Bookmark Button */}
                                <button
                                    onClick={() => toggleBookmark(movie)}
                                    className={`flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                                        isBookmarked(movie.slug)
                                            ? "bg-red-100 text-red-700 hover:bg-red-200"
                                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                    }`}
                                >
                                    <svg
                                        className="h-4 w-4"
                                        fill={
                                            isBookmarked(movie.slug)
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
                                    {isBookmarked(movie.slug)
                                        ? "Đã thích"
                                        : "Thích"}
                                </button>

                                {/* Share Button */}
                                <button
                                    onClick={() => shareMovie(movie)}
                                    className="flex cursor-pointer items-center gap-1 rounded-lg bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-700 transition-all hover:bg-blue-200"
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
                                    Chia sẻ
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
                                className={`flex w-full flex-col overflow-hidden rounded-md border-gray-50 bg-white shadow transition-all duration-300 ${
                                    isTheaterMode ? "lg:w-full" : "lg:w-8/12"
                                }`}
                            >
                                {/* Player */}
                                <div
                                    id="player-container"
                                    className="w-full overflow-hidden"
                                    style={{ aspectRatio: "16/9" }}
                                ></div>
                            </div>

                            {/* Episode List */}
                            <div
                                className={`flex w-full flex-col overflow-hidden rounded-md border border-gray-200 bg-white shadow transition-all duration-300 ${
                                    isTheaterMode ? "lg:w-full" : "lg:w-4/12"
                                }`}
                            >
                                {/* Episode Tabs */}
                                <div className="border-b-2 border-gray-300 bg-gray-100">
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
                                                        ? "border-b-4 border-blue-600 bg-white text-blue-600 shadow-sm"
                                                        : "border-transparent bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900"
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
                                            className={`grid h-fit auto-rows-max grid-cols-3 items-start gap-4 overflow-y-auto p-4 transition-all sm:grid-cols-6 ${
                                                isTheaterMode
                                                    ? "max-h-96 lg:grid-cols-12"
                                                    : "max-h-96 lg:h-0 lg:max-h-none lg:grow lg:grid-cols-4"
                                            }`}
                                        >
                                            {activeEpisode.server_data.map(
                                                (server) => (
                                                    <div
                                                        key={server.slug}
                                                        onClick={() =>
                                                            openEpisode(
                                                                server,
                                                                activeEpisode,
                                                            )
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
                                        {tmdbData?.vote_average && (
                                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-sm text-amber-800">
                                                <svg
                                                    className="h-4 w-4 fill-current"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                                </svg>
                                                <strong>
                                                    {tmdbData.vote_average.toFixed(
                                                        1,
                                                    )}
                                                    /10
                                                </strong>
                                                <span className="text-xs">
                                                    (
                                                    {tmdbData.vote_count?.toLocaleString()}
                                                    )
                                                </span>
                                            </span>
                                        )}
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
                                        className="line-clamp-4 text-sm text-gray-600"
                                        title={movie.content}
                                    >
                                        {movie.content}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Diễn viên - TMDb hoặc movie.actor */}
                        {((tmdbCredits?.cast && tmdbCredits.cast.length > 0) ||
                            (movie.actor && movie.actor.length > 0)) && (
                            <>
                                <h3 className="text-lg font-semibold text-gray-800">
                                    Diễn viên chính
                                </h3>
                                <div className="rounded-md border border-gray-200 bg-white p-6 shadow-md">
                                    <div className="grid grid-cols-4 gap-4 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
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
                                                    <div className="bg-linear-to-br flex h-16 w-16 items-center justify-center rounded-full from-gray-400 via-gray-500 to-gray-600 shadow-md transition-all duration-300 group-hover:shadow-lg">
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
                                                    <div className="line-clamp-2 text-sm font-semibold text-gray-800 transition-colors duration-300 group-hover:text-blue-600">
                                                        {c.name}
                                                    </div>
                                                    {c.character && (
                                                        <div className="line-clamp-2 text-xs text-gray-500 transition-colors duration-300 group-hover:text-gray-700">
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
