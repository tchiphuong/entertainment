import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    useParams,
    useSearchParams,
    Link,
    useLocation,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FALLBACK_IMAGE } from "../../hooks/useImageFallback";
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
const isAdBlockStart = (line, nextLine) => {
    return line === "#EXT-X-DISCONTINUITY" && nextLine?.startsWith("#EXT-X-KEY:METHOD=NONE");
};

const isSegmentLine = (line) => {
    return /\.(ts|png|jpg|jpeg|gif|m4s|mp4)(\?|$)/i.test(line) && !line.startsWith("#");
};

const isAdSegment = (line) => {
    return line.includes("/adjump/") || /ads|telecom|static/i.test(line);
};

const normalizeSegmentLine = (line, baseURL) => {
    let normalized = line;
    if (normalized.includes("convertv7/")) {
        normalized = normalized.replace("convertv7/", "");
    }
    if (baseURL && !normalized.startsWith("http") && !normalized.startsWith("/")) {
        normalized = baseURL + normalized;
    }
    return normalized;
};

// Helper function: Xử lý các dòng M3U8 hợp lệ (không nằm trong block quảng cáo)
function processValidM3U8Line(line, cleaned, baseURL) {
    if (!isSegmentLine(line)) {
        cleaned.push(line);
        return;
    }

    if (isAdSegment(line)) {
        if (cleaned.length > 0 && cleaned.at(-1).startsWith("#EXTINF")) {
            cleaned.pop(); // Xóa cả tag thời lượng #EXTINF kề trên
        }
        return;
    }

    cleaned.push(normalizeSegmentLine(line, baseURL));
}

function cleanM3U8Content(text, baseURL = "") {
    const lines = text.split("\n");
    const cleaned = [];

    let skipBlock = false; // Cờ dùng để bỏ qua khối chứa quảng cáo (#EXT-X-KEY)

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (!skipBlock && isAdBlockStart(line, lines[i + 1])) {
            skipBlock = true;
            i++; // Bỏ qua dòng #EXT-X-KEY
            continue;
        }

        if (skipBlock) {
            if (line === "#EXT-X-DISCONTINUITY") {
                skipBlock = false; // Kết thúc khối quảng cáo
            }
            continue; // Bỏ qua tất cả các dòng bên trong khối
        }

        // Loại bỏ các tag #EXT-X-DISCONTINUITY thừa để đảm bảo timeline mượt mà trên Shaka Player
        if (line === "#EXT-X-DISCONTINUITY") continue;

        processValidM3U8Line(line, cleaned, baseURL);
    }

    return cleaned.join("\n");
}

export const registerShakaNetworkFilter = (player) => {
    if (!player.getNetworkingEngine) return;
    
    player.getNetworkingEngine().registerResponseFilter((type, response) => {
        const uris = response.uris || (response.uri ? [response.uri] : []);
        const uri = uris[0] || "";

        if (uri?.includes(".m3u8")) {
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
                        urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf("/") + 1);

                    const cleanedText = cleanM3U8Content(text, baseURL);
                    response.data = new TextEncoder().encode(cleanedText);
                }
            } catch (e) {
                console.warn("Clean M3U8 failed", e);
            }
        }
    });
};

// Intercept fetch để bypass JWPlayer CORS + clean M3U8
const originalFetch = window.fetch;
window.fetch = function (...args) {
    const url = typeof args[0] === "string" ? args[0] : args[0]?.url;

    // Mock JWPlayer entitlements
    if (url?.includes("entitlements.jwplayer.com")) {
        return Promise.resolve(
            new Response(JSON.stringify(JWPLAYER_LICENSE_MOCK), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }),
        );
    }

    // Chặn các yêu cầu M3U8 để loại bỏ quảng cáo và tag ngắt quãng
    const fetchPromise = originalFetch.apply(this, args);

    if (url?.includes(".m3u8")) {
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
    if (this._url?.includes(".m3u8")) {
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
                } catch {
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

// Các hàm Helper để xử lý hình ảnh cho hàm getMovieImage
const getPlaceholderUrl = () => {
    return FALLBACK_IMAGE;
};

const getProxyDomain = (source) => {
    return source === "source_k" ? CONFIG.APP_DOMAIN_SOURCE_K : CONFIG.APP_DOMAIN_SOURCE_O_FRONTEND;
};

const getCdnBaseUrl = (source) => {
    return source === "source_k" ? CONFIG.APP_DOMAIN_SOURCE_K_CDN_IMAGE : CONFIG.APP_DOMAIN_SOURCE_O_CDN_IMAGE;
};

const isKnownCdnHostname = (hostname) => {
    return hostname.includes("phimimg.com") || hostname.includes("phimapi.com") || hostname.includes("img.ophim.live");
};

const buildProxiedImageUrl = (imagePath, source) => {
    if (source === "source_o") return imagePath; // Không cần proxy cho OPhim
    const domain = getProxyDomain(source);
    return `${domain}/image.php?url=${encodeURIComponent(imagePath)}`;
};

const handleAbsoluteImageUrl = (imagePath, source) => {
    if (source !== "source_k" && source !== "source_o") {
        return imagePath;
    }

    let hostname = "";
    try {
        hostname = new URL(imagePath).hostname || "";
    } catch (error) {
        console.warn(`Invalid URL provided for imagePath: ${imagePath}`, error);
    }

    if (isKnownCdnHostname(hostname)) {
        return buildProxiedImageUrl(imagePath, source);
    }
    
    return imagePath;
};

const handleRelativeImageUrl = (imagePath, source) => {
    const cdnUrl = `${getCdnBaseUrl(source)}/${imagePath}`;
    
    if (source === "source_k" || source === "source_o") {
        return buildProxiedImageUrl(cdnUrl, source);
    }
    
    return cdnUrl;
};

// Helper để load hình ảnh theo source (Đã Refactored để giảm Cognitive Complexity)
function getMovieImage(imagePath, source) {
    if (!imagePath) {
        return getPlaceholderUrl();
    }

    const isAbsolute = imagePath.startsWith("http://") || imagePath.startsWith("https://");
    
    if (isAbsolute) {
        return handleAbsoluteImageUrl(imagePath, source);
    }
    
    return handleRelativeImageUrl(imagePath, source);
}

// --- Pure Helper Functions Extracted to Reduce Complexity ---
export function getEpisodeKey(episodeSlug, episodeName = "") {
    let slugStr = typeof episodeSlug === "string" ? episodeSlug : String(episodeSlug || "");
    if (!slugStr && episodeName) {
        slugStr = typeof episodeName === "string" ? episodeName : String(episodeName);
    }
    if (!slugStr) return null;
    if (slugStr.toLowerCase() === "full") return "full";
    const numberMatch = new RegExp(/\d+/).exec(slugStr);
    if (numberMatch) return Number.parseInt(numberMatch[0], 10);
    return slugStr;
}

export function normalizeKey(key) {
    if (key === null || key === undefined) return key;
    if (typeof key === "number") return key;
    const s = String(key).trim();
    if (/^\d+$/.test(s)) return Number.parseInt(s, 10);
    return s;
}

export function compareEpisodeKeys(key1, key2) {
    const normalized1 = normalizeKey(key1);
    const normalized2 = normalizeKey(key2);
    return normalized1 === normalized2;
}

export function extractServerType(serverName) {
    if (!serverName) return "";
    
    if (serverName.endsWith(")")) {
        const lastOpenParen = serverName.lastIndexOf("(");
        if (lastOpenParen !== -1 && lastOpenParen < serverName.length - 2) {
            return serverName.slice(lastOpenParen + 1, -1);
        }
    }

    if (serverName.toLowerCase().includes("vietsub")) return "Vietsub";
    if (serverName.toLowerCase().includes("thuyết minh") || serverName.toLowerCase().includes("thuyet minh")) return "Thuyết Minh";
    if (serverName.toLowerCase().includes("lồng tiếng") || serverName.toLowerCase().includes("long tieng")) return "Lồng Tiếng";
    return serverName;
}

export function serverNameToSlug(serverName) {
    if (!serverName) return "";
    return serverName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function slugToServerName(slug) {
    const mapping = {
        vietsub: "Vietsub",
        "thuyet-minh": "Thuyết Minh",
        "long-tieng": "Lồng Tiếng",
    };
    return mapping[slug] || slug;
}
// -------------------------------------------------------------

const useMediaSession = (movie, currentEpisodeId, memoizedBackgrounds) => {
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
                } catch (error) {
                    console.warn("Failed to update mediaSession playbackState:", error);
                }
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
                    } catch (e) {
                        console.warn(`Failed to clear MediaSession action ${action}:`, e);
                    }
                });
            };
        }
    }, [movie, currentEpisodeId, memoizedBackgrounds]);
};

const useSeasonDetection = (movie) => {
    const [detectedSeason, setDetectedSeason] = useState(1);

    useEffect(() => {
        if (movie) {
            const seasonFromApi =
                movie.tmdb?.season ||
                movie.season ||
                (movie._rawItem &&
                    (movie._rawItem.season || movie._rawItem.season_number));
            if (seasonFromApi) {
                setDetectedSeason(Number.parseInt(seasonFromApi));
            } else if (movie.name) {
                // Regex to find "Phần X" or "Season X" or "P2", "S2", "Part 2"
                const seasonMatch = new RegExp(/(?:Phần|Season|P|S|Part)\s*(\d+)/i).exec(String(movie.name || ""));
                if (seasonMatch?.[1]) {
                    setDetectedSeason(Number.parseInt(seasonMatch[1]));
                }
            }
        }
    }, [movie]);

    return detectedSeason;
};

// --- Video Features Helpers ---
export const togglePiP = async () => {
    const video = document.getElementById("shaka-video") || document.getElementById("hls-video");
    if (!video) return;
    
    try {
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
        } else if (document.pictureInPictureEnabled) {
            await video.requestPictureInPicture();
        }
    } catch (error) {
        console.error("PiP error:", error);
    }
};

export const handleCastTV = (url) => {
    if (!url) return;
    const isAndroid = /android/i.test(navigator.userAgent);
    
    if (isAndroid) {
        let intentUrl = url;
        let scheme = "https";
        if (url.startsWith('https://')) {
             intentUrl = url.replace('https://', 'intent://');
        } else if (url.startsWith('http://')) {
             intentUrl = url.replace('http://', 'intent://');
             scheme = "http";
        }
        window.location.href = `${intentUrl}#Intent;package=com.instantbits.cast.webvideo;action=android.intent.action.VIEW;scheme=${scheme};type=video/*;end;`;
    } else {
        // iOS cast or fallback
        window.open(url, "_blank");
    }
};

export const formatRuntime = (runtime) => {
    if (!runtime) return "";
    if (runtime >= 60) {
        const hours = Math.floor(runtime / 60);
        const minutes = Math.round(runtime % 60);
        if (minutes > 0) {
            return `${hours}g ${minutes}p`;
        }
        return `${hours} Giờ`;
    }
    return `${Math.round(runtime)} Phút`;
};

export const findTargetEpisodeAndServer = (episodesList, episodeParam, serverParam, movieSlug, lastWatchedList) => {
    let targetEpisode = null;
    let targetServer = null;

    if (serverParam) {
        targetEpisode = episodesList.find((episode) => {
            const currentServerSlug = serverNameToSlug(episode.server_name);
            const isServerMatch =
                currentServerSlug === serverParam ||
                currentServerSlug.includes(serverParam) || 
                serverParam.includes(currentServerSlug);
            
            if (!isServerMatch) return false;
            
            return episode.server_data?.some((server) =>
                compareEpisodeKeys(getEpisodeKey(server.slug, server.name), episodeParam)
            );
        });

        if (targetEpisode) {
            targetServer = targetEpisode.server_data.find((server) =>
                compareEpisodeKeys(getEpisodeKey(server.slug, server.name), episodeParam)
            );
        }
    }

    if (!targetEpisode) {
        targetEpisode = episodesList.find((episode) =>
            episode.server_data?.some((server) => {
                const serverEpisodeKey = getEpisodeKey(server.slug, server.name);
                return (
                    compareEpisodeKeys(serverEpisodeKey, episodeParam) ||
                    compareEpisodeKeys(serverEpisodeKey, episodeParam.replace(/^0+/, "")) ||
                    server.slug.includes(`tap-${episodeParam}`) ||
                    server.slug.includes(`episode-${episodeParam}`)
                );
            })
        );

        if (targetEpisode) {
            const movieData = lastWatchedList.find((item) => item.slug === movieSlug);
            const savedServerSlug = movieData?.server;

            if (savedServerSlug) {
                const savedServerName = slugToServerName(savedServerSlug);
                targetServer = targetEpisode.server_data.find((server) =>
                    server.server_name === savedServerName ||
                    server.server_name?.endsWith(` - ${savedServerName}`)
                );
            }

            if (!targetServer) {
                targetServer = targetEpisode.server_data.find((server) => {
                    const serverEpisodeKey = getEpisodeKey(server.slug, server.name);
                    return (
                        serverEpisodeKey === episodeParam ||
                        serverEpisodeKey === episodeParam.replace(/^0+/, "") ||
                        server.slug.includes(`tap-${episodeParam}`) ||
                        server.slug.includes(`episode-${episodeParam}`)
                    );
                });
            }
        }
    }

    return { targetEpisode, targetServer };
};

export const matchEpisodeByCurrentKey = (episodesList, episodeKey, savedServerSlug) => {
    const groupsWithEpisode = episodesList.filter((episode) =>
        episode.server_data?.some((server) => {
            const serverKey = getEpisodeKey(server.slug, server.name);
            return compareEpisodeKeys(serverKey, episodeKey);
        })
    );

    let matchingEpisode = null;
    if (groupsWithEpisode.length > 0) {
        if (savedServerSlug) {
            matchingEpisode = groupsWithEpisode.find((group) => {
                const currentSlug = serverNameToSlug(group.server_name);
                return (
                    currentSlug === savedServerSlug ||
                    currentSlug.includes(savedServerSlug) ||
                    savedServerSlug.includes(currentSlug) ||
                    (savedServerSlug === "vietsub" && currentSlug.includes("vietsub"))
                );
            });
        }
        if (!matchingEpisode) matchingEpisode = groupsWithEpisode[0];
    }

    if (matchingEpisode) {
        let targetServer = null;
        if (savedServerSlug) {
            targetServer = matchingEpisode.server_data.find((server) => {
                if (!server) return false;
                const currentSlug = serverNameToSlug(matchingEpisode.server_name);
                const serverKey = getEpisodeKey(server.slug, server.name);
                return (
                    compareEpisodeKeys(serverKey, episodeKey) &&
                    (currentSlug === savedServerSlug ||
                        currentSlug.includes(savedServerSlug) ||
                        savedServerSlug.includes(currentSlug))
                );
            });
        }
        if (!targetServer) {
            targetServer = matchingEpisode.server_data.find((server) => {
                if (!server) return false;
                const serverKey = getEpisodeKey(server.slug, server.name);
                return compareEpisodeKeys(serverKey, episodeKey);
            });
        }
        if (targetServer) {
            return { targetEpisode: matchingEpisode, targetServer, episodeKey };
        }
    }
    return null;
};

export const matchEpisodeBySavedSlug = (episodesList, savedEpisodeSlug) => {
    let savedGroup = episodesList.find((group) =>
        group.server_data?.some((s) => s.slug === savedEpisodeSlug)
    );

    if (!savedGroup) {
        const match = savedEpisodeSlug.match(/(\d+)/);
        if (match) {
            const num = Number.parseInt(match[1]);
            savedGroup = episodesList.find((group) =>
                group.server_data?.some((s) => compareEpisodeKeys(getEpisodeKey(s.slug, s.name), num))
            );
        }
    }

    if (savedGroup) {
        let targetServerData = savedGroup.server_data.find(
            (s) =>
                s.slug === savedEpisodeSlug ||
                (savedEpisodeSlug.match(/(\d+)/) &&
                    compareEpisodeKeys(
                        getEpisodeKey(s.slug, s.name),
                        Number.parseInt(savedEpisodeSlug.match(/(\d+)/)[1])
                    ))
        );
        if (targetServerData) return { targetEpisode: savedGroup, targetServer: targetServerData };
    }
    return null;
};

export const findTargetEpisodeFromHistory = (episodesList, slug, lastWatchedList) => {
    const cleanSlug = slug.split("?")[0];
    const historyItem = lastWatchedList.find((item) => item.slug === cleanSlug);

    if (historyItem?.current_episode?.key !== undefined && episodesList.length > 0) {
        const result = matchEpisodeByCurrentKey(episodesList, historyItem.current_episode.key, historyItem.server);
        if (result) return result;
    }

    if (episodesList.length > 0 && historyItem?.episode) {
        const result = matchEpisodeBySavedSlug(episodesList, historyItem.episode);
        if (result) return result;
    }

    if (episodesList.length > 0) {
        const firstEpisode = episodesList[0];
        if (firstEpisode.server_data?.length > 0) {
            return { targetEpisode: firstEpisode, targetServer: firstEpisode.server_data[0] };
        }
    }

    return { targetEpisode: null, targetServer: null };
};

export const getTrailerEpisode = (movie, tmdbVideos) => {
    let trailerUrl = movie?.trailer_url;
    if (!trailerUrl && tmdbVideos) {
        const trailer = tmdbVideos.find(
            (v) => (v.type === "Trailer" || v.type === "Teaser") && v.site === "YouTube",
        );
        if (trailer?.key) trailerUrl = `https://www.youtube.com/watch?v=${trailer.key}`;
    }
    if (trailerUrl) {
        return {
            server_name: "Trailer",
            server_data: [
                {
                    name: "Trailer",
                    slug: "trailer",
                    link_embed: ensureYoutubeEmbedUrl(trailerUrl),
                    link_m3u8: null,
                },
            ],
        };
    }
    return null;
};

export const formatEpisodeValue = (episodeTotal, episodeName, episodeKey, episodeSlug) => {
    const totalMatch = new RegExp(/(\d+)/).exec(String(episodeTotal || ""));
    const total = totalMatch ? totalMatch[1] : "";
    const baseName = episodeName || String(episodeKey);
    const keyStr = String(episodeKey).toLowerCase();

    if (keyStr === "full") return "Full";
    if (keyStr === "trailer") return "Trailer";

    if (typeof episodeKey === "number" || /^\d+$/.test(keyStr)) {
        return `Tập ${episodeKey}${total && total !== "1" ? "/" + total : ""}`;
    }
    return baseName || episodeSlug;
};

export const updateWatchHistory = (
    history,
    movieIndex,
    { cleanSlug, movieName, moviePoster, movieServer, movieOriginName, currentMovie, episodeKey, episodeValue, position }
) => {
    if (movieIndex === -1) {
        history.unshift({
            slug: cleanSlug,
            name: movieName,
            poster: moviePoster,
            server: movieServer,
            episode_total: currentMovie.episode_total || "",
            current_episode: { key: episodeKey, value: episodeValue },
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
        const movieData = history[movieIndex];
        if (!Array.isArray(movieData.episodes)) movieData.episodes = [];

        const dedupeMap = new Map();
        movieData.episodes.forEach((ep) => {
            const nk = normalizeKey(ep.key);
            const existing = dedupeMap.get(nk);
            if (!existing) {
                dedupeMap.set(nk, { ...ep, key: nk });
            } else {
                const existingPos = existing.position || 0;
                const epPos = ep.position || 0;
                if (epPos > existingPos) {
                    dedupeMap.set(nk, { ...ep, key: nk });
                } else if (epPos === existingPos) {
                    const existingTime = new Date(existing.timestamp || 0).getTime();
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
        movieData.episode_total = currentMovie.episode_total || movieData.episode_total || "";
        movieData.current_episode = { key: episodeKey, value: episodeValue };
        movieData.time = new Date().toISOString();

        const epIndex = movieData.episodes.findIndex((ep) => normalizeKey(ep.key) === episodeKey);
        if (epIndex === -1) {
            movieData.episodes.push({
                key: episodeKey,
                position: typeof position === "number" ? position : 0,
                timestamp: new Date().toISOString(),
            });
        } else {
            if (typeof position === "number") movieData.episodes[epIndex].position = position;
            movieData.episodes[epIndex].timestamp = new Date().toISOString();
            movieData.episodes[epIndex].key = normalizeKey(movieData.episodes[epIndex].key);
        }

        history.splice(movieIndex, 1);
        history.unshift(movieData);
    }
    return history;
};

export const findCurrentEpisodeInGroup = (group, currentKey) => {
    return (group?.server_data || []).findIndex(
        (s) => compareEpisodeKeys(getEpisodeKey(s.slug, s.name), currentKey)
    );
};

export const findCurrentGroupAndIndex = (episodesList, currentKey, currentGroup) => {
    let index = findCurrentEpisodeInGroup(currentGroup, currentKey);
    if (index !== -1) return { group: currentGroup, index };

    for (const ep of episodesList) {
        index = findCurrentEpisodeInGroup(ep, currentKey);
        if (index !== -1) return { group: ep, index };
    }
    return { group: null, index: -1 };
};

export const findNextServerGroup = (episodesList, currentGroupIdx, savedServerName, currentGroup) => {
    if (currentGroupIdx === -1 || currentGroupIdx + 1 >= episodesList.length) return null;
    
    const currentType = extractServerType(currentGroup.server_name);
    for (let i = currentGroupIdx + 1; i < episodesList.length; i++) {
        const nextGroup = episodesList[i];
        const nextType = extractServerType(nextGroup.server_name);
        
        const isSavedMatch = savedServerName && (nextGroup.server_name === savedServerName || nextGroup.server_name.includes(savedServerName));
        const isTypeMatch = currentType && nextType === currentType;

        if ((isSavedMatch || isTypeMatch) && nextGroup.server_data?.length > 0) {
            return nextGroup;
        }
    }

    const fallbackGroup = episodesList[currentGroupIdx + 1];
    if (fallbackGroup.server_data?.length > 0) return fallbackGroup;
    return null;
};

export const getNextEpisodeData = (episodesList, currentKey, savedServerName, currentGroup) => {
    const { group, index } = findCurrentGroupAndIndex(episodesList, currentKey, currentGroup);
    if (index === -1 || !group) return null;

    const data = group.server_data;
    if (index + 1 < data.length) {
        return { targetServer: data[index + 1], targetGroup: group, setActive: false };
    }

    const currentGroupIdx = episodesList.findIndex((ep) => ep.server_name === group.server_name);
    const nextGroup = findNextServerGroup(episodesList, currentGroupIdx, savedServerName, group);
    
    if (nextGroup) {
        return { targetServer: nextGroup.server_data[0], targetGroup: nextGroup, setActive: true };
    }
    return null;
};

export const findPrevServerGroup = (episodesList, currentGroupIdx, savedServerName, currentGroup) => {
    if (currentGroupIdx <= 0) return null;
    
    const currentType = extractServerType(currentGroup.server_name);
    for (let i = currentGroupIdx - 1; i >= 0; i--) {
        const prevGroup = episodesList[i];
        const prevType = extractServerType(prevGroup.server_name);
        
        const isSavedMatch = savedServerName && (prevGroup.server_name === savedServerName || prevGroup.server_name.includes(savedServerName));
        const isTypeMatch = currentType && prevType === currentType;

        if ((isSavedMatch || isTypeMatch) && prevGroup.server_data?.length > 0) {
            return prevGroup;
        }
    }

    const fallbackGroup = episodesList[currentGroupIdx - 1];
    if (fallbackGroup.server_data?.length > 0) return fallbackGroup;
    return null;
};

export const getPrevEpisodeData = (episodesList, currentKey, savedServerName, currentGroup) => {
    const { group, index } = findCurrentGroupAndIndex(episodesList, currentKey, currentGroup);
    if (index === -1 || !group) return null;

    const data = group.server_data;
    if (index - 1 >= 0) {
        return { targetServer: data[index - 1], targetGroup: group, setActive: false };
    }

    const currentGroupIdx = episodesList.findIndex((ep) => ep.server_name === group.server_name);
    const prevGroup = findPrevServerGroup(episodesList, currentGroupIdx, savedServerName, group);
    
    if (prevGroup) {
        return { targetServer: prevGroup.server_data[prevGroup.server_data.length - 1], targetGroup: prevGroup, setActive: true };
    }
    return null;
};

export const findMatchingServerTab = (episode, prevEpisodeId, episodeParam) => {
    let desiredEpisodeKey = null;
    if (prevEpisodeId) desiredEpisodeKey = getEpisodeKey(prevEpisodeId);
    else if (episodeParam) desiredEpisodeKey = getEpisodeKey(episodeParam);

    if (desiredEpisodeKey !== null && desiredEpisodeKey !== undefined) {
        let matchByKey = episode.server_data?.find((server) =>
            compareEpisodeKeys(getEpisodeKey(server.slug, server.name), desiredEpisodeKey)
        );

        if (!matchByKey) {
            matchByKey = episode.server_data?.find((server) => {
                if (!server) return false;
                const name = server.name || server.server_name || "";
                const m = (name || "").toString().match(/\d+/);
                const num = m ? Number.parseInt(m[0], 10) : Number.NaN;
                if (!Number.isNaN(num)) return compareEpisodeKeys(num, desiredEpisodeKey);
                return false;
            });
        }

        if (!matchByKey) {
            const normalizedKey = normalizeKey(desiredEpisodeKey);
            matchByKey = episode.server_data?.find((server) =>
                (server.slug || "").includes(`tap-${String(normalizedKey)}`) ||
                (server.slug || "").includes(`episode-${String(normalizedKey)}`)
            );
        }
        return matchByKey;
    }
    return null;
};

export const findBestServerTab = (episode, prevActive, slug, getLastWatchedList, currentEpisodeId, episodeParam) => {
    // 1) Match by desired key
    let target = findMatchingServerTab(episode, currentEpisodeId, episodeParam);
    if (target) return target;

    // 2) Keep same server type
    if (prevActive?.server_name) {
        const currentServerType = extractServerType(prevActive.server_name);
        target = episode.server_data?.find(
            (server) => extractServerType(server.server_name) === currentServerType
        );
        if (target) return target;
    }

    // 3) Match saved history server
    const movieData = getLastWatchedList().find((item) => item.slug === slug);
    const savedServerSlug = movieData?.server;
    if (savedServerSlug && savedServerSlug.trim() !== "") {
        const savedServerName = slugToServerName(savedServerSlug);
        target = episode.server_data?.find(
            (server) => extractServerType(server.server_name) === savedServerName
        );
        if (target) return target;
    }

    // 4) Match by exact slug
    target = episode.server_data?.find((server) => server.slug === currentEpisodeId);
    if (target) return target;

    // 5) First available
    if (episode.server_data?.length > 0) {
        return episode.server_data[0];
    }

    return null;
};

export const updateEpisodeUrlParams = (setSearchParams, serverSlug, targetServer) => {
    try {
        const episodeKey = getEpisodeKey(targetServer.slug, targetServer.name);
        setSearchParams((prev) => {
            const newParams = new URLSearchParams(prev);
            newParams.delete("slug");
            newParams.set("server", serverSlug);
            newParams.set("episode", String(episodeKey));
            return newParams;
        }, { replace: true });
    } catch (e) {
        console.warn("Failed to update URL parameters:", e);
    }
};

const useVideoKeyboardShortcuts = ({
    showImageModal,
    showShareModal,
    playerRef,
    playNextEpisode,
    playPrevEpisode,
}) => {
    useEffect(() => {
        const handleVideoKeyDown = (e) => {
            // Chỉ xử lý khi không có modal nào đang mở
            if (showImageModal || showShareModal) return;

            // Bỏ qua nếu đang typing trong input/textarea
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
                return;
            }

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

            // Ưu tiên e.code cho phím Space, nếu không dùng e.key chữ thường
            const key = e.code === "Space" ? " " : e.key.toLowerCase();
            const action = actions[key];

            if (action) {
                e.preventDefault();
                action();
            }
        };

        window.addEventListener("keydown", handleVideoKeyDown);
        return () => window.removeEventListener("keydown", handleVideoKeyDown);
    }, [
        showImageModal,
        showShareModal,
        playerRef,
        playNextEpisode,
        playPrevEpisode,
    ]);
};

// --- Player Settings Storage Helpers ---
const VOLUME_KEY = "vodPlayerVolume";
const MUTE_KEY = "vodPlayerMuted";

export const getSavedVolume = () => {
    try {
        const v = localStorage.getItem(VOLUME_KEY);
        if (v !== null) {
            const num = Number.parseFloat(v);
            if (!Number.isNaN(num) && num >= 0 && num <= 1) return num;
        }
    } catch {}
    return 0.8; // mặc định 80%
};

export const getSavedMute = () => {
    try {
        return localStorage.getItem(MUTE_KEY) === "true";
    } catch {}
    return false;
};

export const saveVolume = (vol) => {
    try {
        localStorage.setItem(VOLUME_KEY, String(vol));
    } catch {}
};

export const saveMute = (isMuted) => {
    try {
        localStorage.setItem(MUTE_KEY, String(isMuted));
    } catch {}
};

export const createShakaPlayerVideo = (playerDiv, movie, memoizedBackgrounds) => {
    playerDiv.innerHTML = "";
    const themeWrapper = document.createElement("div");
    themeWrapper.className = "youtube-theme h-full w-full overflow-hidden shadow-2xl";
    const uiContainer = document.createElement("div");
    uiContainer.className = "shaka-video-container h-full w-full";
    const video = document.createElement("video");
    video.id = "shaka-video";
    video.className = "h-full w-full object-contain";
    video.autoplay = true;
    video.playsInline = true;

    const posterUrl = getMovieImage(
        memoizedBackgrounds?.thumb_url || memoizedBackgrounds?.poster_url || movie?.thumb_url || movie?.poster_url,
        movie?.source
    );
    if (posterUrl) {
        video.setAttribute("poster", posterUrl);
        video.poster = posterUrl;
    }

    video.volume = getSavedVolume();
    video.muted = getSavedMute();
    video.addEventListener("volumechange", () => {
        saveVolume(video.volume);
        saveMute(video.muted);
    });

    uiContainer.appendChild(video);
    themeWrapper.appendChild(uiContainer);
    playerDiv.appendChild(themeWrapper);

    return { video, uiContainer };
};

export const configureShakaUi = (player, uiContainer, video) => {
    const uiOverlay = new shaka.ui.Overlay(player, uiContainer, video);
    uiOverlay.configure({
        controlPanelElements: ["play_pause", "mute", "volume", "time_and_duration", "spacer", "overflow_menu", "fullscreen"],
        overflowMenuButtons: ["quality", "language", "captions", "playback_rate", "cast"],
        addSeekBar: true,
    });
    return uiOverlay;
};

export const restoreVideoPosition = (video, lastPosition, episodeKey, positionRestoredRef) => {
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
};

export const setupVideoTracking = ({
    video, 
    episodeSlug, 
    serverName, 
    movie, 
    setWatchlist, 
    introDurationRef, 
    skipIntroEnabledRef, 
    autoplayEnabledRef, 
    setShowNextCountdown, 
    setCountdownSeconds, 
    COUNTDOWN_DURATION
}) => {
    let lastSavedTime = 0;
    let introSkipped = false;
    video.ontimeupdate = () => {
        const currentTime = Math.floor(video.currentTime);
        if (skipIntroEnabledRef.current && !introSkipped && video.currentTime < introDurationRef.current) {
            video.currentTime = introDurationRef.current;
            introSkipped = true;
        }
        if (currentTime - lastSavedTime >= 5) {
            lastSavedTime = currentTime;
            setWatchlist(episodeSlug, currentTime, { name: serverName }, movie);
        }
    };
    video.onended = () => {
        if (autoplayEnabledRef.current) {
            setShowNextCountdown(true);
            setCountdownSeconds(COUNTDOWN_DURATION);
        }
    };
};

export const computeEpisodeListData = (activeEpisode, imdbEpisodes, movie) => {
    const map = new Map();
    (activeEpisode?.server_data || []).forEach((s, i) => {
        const raw = getEpisodeKey(s.slug, s.name);
        const k = /^\d+$/.test(String(raw)) ? String(raw) : s.slug || s.name || `idx-${i}`;
        if (!map.has(k)) {
            const epNum = Number.parseInt(k);
            const imdbEp = (!Number.isNaN(epNum) && epNum > 0)
                ? imdbEpisodes.find((e) => (e.episode_number || e.episodeNumber) === epNum)
                : undefined;
            const thumb = (imdbEp?.still_path
                ? `${TMDB_IMAGE_BASE_URL}/${TMDB_IMAGE_SIZES.STILL || "w300"}${imdbEp.still_path}`
                : imdbEp?.primaryImage?.url) || getMovieImage(movie?.thumb_url, movie?.source);
            map.set(k, { ...s, key: k, imdbEp, thumb });
        }
    });
    return Array.from(map.entries());
};

export const computeMaxDigits = (episodes) => {
    const allEpisodeNumbers = episodes.flatMap((ep) =>
        ep.server_data.map((s) => {
            const match = new RegExp(/^\d+/).exec(String(s.name || ""));
            return match ? Number.parseInt(match[0]) : 0;
        }),
    );
    const maxEpisode = Math.max(...allEpisodeNumbers, 0);
    if (maxEpisode >= 10000) return 4;
    if (maxEpisode >= 1000) return 3;
    if (maxEpisode >= 100) return 2;
    return 1;
};

export const ensureYoutubeEmbedUrl = (url) => {
    if (!url || typeof url !== "string") return url;
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

export const formatEpisodeNameHelper = (name, maxDigits, episodeLabel) => {
    if (!name) return name;
    const match = name.match(/\d+/);
    if (!match) return name;
    const num = Number.parseInt(match[0], 10);
    if (/^tập\s*\d+/i.test(name) || /^\d+/.test(name)) {
        return `${episodeLabel} ${num.toString().padStart(maxDigits, "0")}`;
    }
    return name;
};

export const processWatchlistUpdate = ({
    episodeSlug, position, episode, movie,
    serverParam, slug, viewHistory, viewHistoryRef, setViewHistory,
    lastHistorySyncRef, currentUser, lastFirestoreSyncRef,
    getMovieImage, formatEpisodeValue, updateWatchHistory, addHistoryToFirestore
}) => {
    const episodeName = episode?.name || episode?.server_name || "";
    const episodeKeyRaw = getEpisodeKey(episodeSlug, episodeName);
    const episodeKey = normalizeKey(episodeKeyRaw);

    if (episodeKey === null || episodeKey === undefined) {
        console.warn("Không lưu history: không tìm được episode key", { episodeSlug, episodeName });
        return;
    }

    const currentMovie = movie?.name ? movie : movie || {};
    const movieName = currentMovie.name || "Không rõ tên";
    const moviePoster = getMovieImage(
        currentMovie.poster_url || currentMovie.poster || currentMovie.thumb_url,
    );
    const movieServer = currentMovie.server || episode?.server_name || serverParam || "";
    const movieOriginName = currentMovie.origin_name || currentMovie.originName || "";
    const episodeValue = formatEpisodeValue(currentMovie.episode_total, episode?.name, episodeKey, episodeSlug);

    let history = Array.isArray(viewHistory) ? [...viewHistory] : [];
    const cleanSlug = slug.split("?")[0];
    const movieIndex = history.findIndex((item) => item.slug === cleanSlug);

    history = updateWatchHistory(history, movieIndex, {
        cleanSlug, movieName, moviePoster, movieServer, movieOriginName,
        currentMovie, episodeKey, episodeValue, position
    });

    viewHistoryRef.current = history;
    try {
        localStorage.setItem("viewHistory", JSON.stringify(history));
    } catch {}

    const syncNow = Date.now();
    if (syncNow - lastHistorySyncRef.current >= 30000) {
        lastHistorySyncRef.current = syncNow;
        setViewHistory(history);
    }

    if (currentUser && history.length > 0) {
        const now = Date.now();
        const THROTTLE_MS = 30000;

        if (now - lastFirestoreSyncRef.current >= THROTTLE_MS) {
            lastFirestoreSyncRef.current = now;
            const latestHistoryItem = history[0];
            addHistoryToFirestore(currentUser.uid, latestHistoryItem).catch(
                (error) => {
                    console.error("Failed to sync history to Firestore:", error);
                },
            );
        }
    }
};

export const useImageModalKeyboard = (showImageModal, modalImages, setCurrentImageIndex, modalRef, setShowImageModal) => {
    useEffect(() => {
        if (!showImageModal) return;

        if (modalRef.current) {
            modalRef.current.focus();
        }

        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                setShowImageModal(false);
            }
            if (e.key === "ArrowLeft") {
                setCurrentImageIndex((prev) => prev > 0 ? prev - 1 : modalImages.length - 1);
            }
            if (e.key === "ArrowRight") {
                setCurrentImageIndex((prev) => prev < modalImages.length - 1 ? prev + 1 : 0);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [showImageModal, modalImages.length, setCurrentImageIndex, modalRef, setShowImageModal]);
};

export const handleInitializeFromUrl = ({
    episodesList, movie, episodeParam, serverParam, slug, getLastWatchedList,
    hasInitializedRef, setActiveEpisode, openEpisode, findTargetEpisodeAndServer,
    findTargetEpisodeFromHistory, serverNameToSlug
}) => {
    if (hasInitializedRef.current) return;

    if (episodeParam) {
        const { targetEpisode, targetServer } = findTargetEpisodeAndServer(
            episodesList, episodeParam, serverParam, slug, getLastWatchedList()
        );

        if (targetEpisode && targetServer) {
            hasInitializedRef.current = true;
            setActiveEpisode(targetEpisode);
            openEpisode(targetServer, targetEpisode, movie);
            return;
        }
    }

    const { targetEpisode, targetServer, episodeKey } = findTargetEpisodeFromHistory(
        episodesList, slug, getLastWatchedList()
    );

    if (targetEpisode && targetServer) {
        hasInitializedRef.current = true;
        setActiveEpisode(targetEpisode);
        openEpisode(targetServer, targetEpisode, movie);

        if (episodeKey !== undefined) {
            const params = new URLSearchParams();
            params.set("episode", episodeKey);
            params.set("server", serverNameToSlug(targetEpisode.server_name));
            window.history.replaceState({}, "", `?${params.toString()}`);
        }
    }
};

export const useCountdownTimer = (showNextCountdown, setShowNextCountdown, setCountdownSeconds, COUNTDOWN_DURATION, playNextEpisode) => {
    const countdownTimerRef = useRef(null);

    useEffect(() => {
        if (!showNextCountdown) {
            if (countdownTimerRef.current) {
                clearInterval(countdownTimerRef.current);
                countdownTimerRef.current = null;
            }
            return;
        }

        const onTimerEnd = () => {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
            setShowNextCountdown(false);
            setTimeout(playNextEpisode, 0);
            return COUNTDOWN_DURATION;
        };

        const tick = (prev) => (prev <= 1 ? onTimerEnd() : prev - 1);

        countdownTimerRef.current = setInterval(() => {
            setCountdownSeconds(tick);
        }, 1000);

        return () => {
            if (countdownTimerRef.current) {
                clearInterval(countdownTimerRef.current);
                countdownTimerRef.current = null;
            }
        };
    }, [showNextCountdown, setShowNextCountdown, setCountdownSeconds, COUNTDOWN_DURATION, playNextEpisode]);
};

export const useFetchSeasonEpisodes = (tmdbData, movie, detectedSeason, setImdbEpisodes) => {
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
                const data = await vodService.fetchTMDBSeason(tmdbId, detectedSeason);
                if (data?.episodes) {
                    setImdbEpisodes(data.episodes);
                }
            } catch (err) {
                console.error("Fetch TMDB season episodes error:", err);
            }
        };

        fetchSeasonEpisodes();
    }, [tmdbData, movie, detectedSeason, setImdbEpisodes]);
};

export const useFirestoreHistorySync = (currentUser, setViewHistory, fetchHistoryFromFirestore) => {
    useEffect(() => {
        if (currentUser) {
            const loadFirestoreHistory = async () => {
                try {
                    const firestoreHistory = await fetchHistoryFromFirestore(currentUser.uid);
                    if (firestoreHistory && firestoreHistory.length > 0) {
                        setViewHistory(firestoreHistory);
                    }
                } catch (error) {
                    console.warn("Failed to fetch history from Firestore:", error);
                }
            };
            loadFirestoreHistory();
        }
    }, [currentUser, setViewHistory, fetchHistoryFromFirestore]);
};

export const usePlayerInitialization = ({
    movie, episodes, tmdbVideos, viewHistory, hasInitializedRef,
    initializeFromUrl, getTrailerEpisode, setEpisodes, setActiveEpisode,
    setErrorMessage, t
}) => {
    useEffect(() => {
        if (movie && !hasInitializedRef.current) {
            if (episodes.length > 0) {
                initializeFromUrl(episodes, movie);
            } else {
                const trailerEp = getTrailerEpisode(movie, tmdbVideos);
                if (trailerEp) {
                    setEpisodes([trailerEp]);
                    setActiveEpisode(trailerEp);
                    initializeFromUrl([trailerEp], movie);
                } else if (!movie.tmdb || tmdbVideos !== null) {
                    setErrorMessage(t("vodPlay.noPlayableLink"));
                }
            }
        }
    }, [movie, episodes, tmdbVideos, viewHistory, initializeFromUrl, getTrailerEpisode, setEpisodes, setActiveEpisode, setErrorMessage, t, hasInitializedRef]);
};

export const destroyAllPlayersHelper = async (activeVideoElementRef, shakaUiOverlayRef, shakaPlayerRef, currentUrlRef) => {
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

    if (currentUrlRef) currentUrlRef.current = null;
};

export const computeLastWatchedPosition = (episodeSlug, episodeName, viewHistory, slug) => {
    const cleanSlug = slug.split("?")[0];
    const movieData = (viewHistory || []).find((item) => item.slug === cleanSlug);

    if (!movieData?.episodes) return 0;

    const episodeKey = normalizeKey(getEpisodeKey(episodeSlug, episodeName));
    const episodeData = movieData.episodes.find((ep) => compareEpisodeKeys(ep.key, episodeKey));
    return episodeData?.position || 0;
};

export const handleSetupShakaPlayer = async ({
    masterUrl, episodeSlug, serverName, movie, fallbackUrl, backups,
    playerRef, activeVideoElementRef, shakaPlayerRef, shakaUiOverlayRef, currentUrlRef,
    memoizedBackgrounds, setCurrentEpisodeId, positionRestoredRef,
    setWatchlist, introDurationRef, skipIntroEnabledRef, autoplayEnabledRef,
    setShowNextCountdown, setCountdownSeconds, COUNTDOWN_DURATION,
    destroyAllPlayers, setupEmbedPlayer, setErrorMessage, getLastWatchedPosition,
    setupShakaPlayer
}) => {
    const playerDiv = playerRef.current;
    if (!playerDiv) return;

    await destroyAllPlayers();
    const { video, uiContainer } = createShakaPlayerVideo(playerDiv, movie, memoizedBackgrounds);
    activeVideoElementRef.current = video;

    const player = new shaka.Player();
    await player.attach(video);
    shakaPlayerRef.current = player;
    registerShakaNetworkFilter(player);

    shakaUiOverlayRef.current = configureShakaUi(player, uiContainer, video);

    try {
        await player.load(masterUrl);
        currentUrlRef.current = masterUrl;

        const episodeKey = String(getEpisodeKey(episodeSlug, serverName));
        setCurrentEpisodeId(episodeKey);

        const lastPosition = getLastWatchedPosition(episodeSlug, serverName);
        restoreVideoPosition(video, lastPosition, episodeKey, positionRestoredRef);

        setupVideoTracking({
            video, episodeSlug, serverName, movie, setWatchlist,
            introDurationRef, skipIntroEnabledRef, autoplayEnabledRef,
            setShowNextCountdown, setCountdownSeconds, COUNTDOWN_DURATION
        });
    } catch (error) {
        console.error("Shaka Player load error:", error);
        if (backups && backups.length > 1) {
            const currentIdx = backups.findIndex((b) => b.link_m3u8 === masterUrl);
            if (currentIdx !== -1 && currentIdx + 1 < backups.length) {
                const nextBackup = backups[currentIdx + 1];
                if (nextBackup.link_m3u8) {
                    return setupShakaPlayer(nextBackup.link_m3u8, episodeSlug, serverName, movie, fallbackUrl, backups);
                }
            }
        }
        if (fallbackUrl) {
            await setupEmbedPlayer(fallbackUrl, episodeSlug, serverName);
            return;
        }
        setErrorMessage("Không thể phát video này. Vui lòng thử lại sau hoặc đổi nguồn khác.");
    }
};

export const handleInitializePlayer = async ({
    server, episodeSlug, movie, currentUrlRef, setErrorMessage,
    fetchedTmdbVideos, ensureYoutubeEmbedUrl, setupEmbedPlayer, setupShakaPlayer
}) => {
    setErrorMessage(null);
    const masterUrl = server.link_m3u8 || server.link_embed;
    const embedFallback = server.link_embed;

    if (!masterUrl) {
        let trailerUrl = movie?.trailer_url;
        if (!trailerUrl && fetchedTmdbVideos?.length > 0) {
            const trailer = fetchedTmdbVideos.find(
                (v) => (v.type === "Trailer" || v.type === "Teaser") && v.site === "YouTube",
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

    if (masterUrl.includes(".m3u8") || masterUrl.includes(".mpd") || masterUrl.includes(".m3u9")) {
        await setupShakaPlayer(masterUrl, episodeSlug, server.name, movie, embedFallback, server.backups || []);
    } else {
        const embedUrl = ensureYoutubeEmbedUrl(masterUrl);
        await setupEmbedPlayer(embedUrl, episodeSlug, server.name);
    }
};

export const handlePlayEpisodeSequence = ({
    direction, episodesRef, currentEpisodeIdRef, episodeParam,
    getLastWatchedList, slug, movie, activeEpisode, activeEpisodeRef, movieRef,
    slugToServerName, getEpisodeKey, getNextEpisodeData, getPrevEpisodeData,
    setActiveEpisode, openEpisode, setErrorMessage
}) => {
    const episodesList = episodesRef.current || [];
    if (episodesList.length === 0) return;

    let currentKey = currentEpisodeIdRef.current || episodeParam;
    const lastWatchedList = getLastWatchedList();
    const cleanSlug = slug.split("?")[0];
    const dataSlug = movie?.slug || cleanSlug;
    const historyItem = lastWatchedList.find(
        (item) => item.slug === dataSlug || item.slug?.startsWith(cleanSlug),
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
    const savedServerName = savedServerSlug ? slugToServerName(savedServerSlug) : null;

    let targetData;
    if (direction === "next") {
        targetData = getNextEpisodeData(episodesList, currentKey, savedServerName, activeEpisodeRef.current);
    } else {
        targetData = getPrevEpisodeData(episodesList, currentKey, savedServerName, activeEpisodeRef.current);
    }

    if (targetData) {
        if (targetData.setActive) setActiveEpisode(targetData.targetGroup);
        openEpisode(targetData.targetServer, targetData.targetGroup, movieRef.current);
    } else {
        setErrorMessage(direction === "next" ? "Đã hết tập phim!" : "Đây là tập đầu tiên!");
        setTimeout(() => setErrorMessage(null), 3000);
    }
};

export const handleToggleFavorite = (movie, favorites, setFavorites, setErrorMessage, getMovieImage, isFavorited) => {
    const isCurrentlyFavorited = isFavorited(movie.slug);

    if (isCurrentlyFavorited) {
        const newFavorites = favorites.filter((favorite) => favorite.slug !== movie.slug);
        setFavorites(newFavorites);
        setErrorMessage("Đã bỏ thích phim này!");
    } else {
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

    setTimeout(() => {
        setErrorMessage(null);
    }, 2000);
};

export const handleCopyToClipboard = (text, setShareMessage, t) => {
    if (navigator.clipboard) {
        navigator.clipboard
            .writeText(text)
            .then(() => {
                setShareMessage(t("vodPlay.copied"));
                setTimeout(() => {
                    setShareMessage("");
                }, 2000);
            })
            .catch((err) => {
                console.error("Clipboard API failed:", err);
                setShareMessage(t("vodPlay.copyFailed"));
                setTimeout(() => {
                    setShareMessage("");
                }, 2000);
            });
    } else {
        setShareMessage(t("vodPlay.copyFailed"));
        setTimeout(() => {
            setShareMessage("");
        }, 2000);
    }
};

export const NotFoundState = () => (
    <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 px-4 text-center">
        <div className="rounded-full bg-zinc-900 p-8 ring-1 ring-white/10">
            <svg className="h-16 w-16 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
        </div>
        <div className="space-y-2">
            <h2 className="text-2xl font-black tracking-tighter text-white">Không tìm thấy nội dung</h2>
            <p className="mx-auto max-w-md text-zinc-500">Dữ liệu phim không khả dụng hoặc đã bị gỡ bỏ. Vui lòng thử lại sau hoặc chọn phim khác.</p>
        </div>
        <Link to="/vod" className="rounded-full bg-red-600 px-8 py-3 text-sm font-black uppercase tracking-widest text-white shadow-[0_0_20px_rgba(220,38,38,0.4)] transition-all hover:scale-105 active:scale-95">Quay lại danh sách</Link>
    </div>
);

export const ImageModal = ({ showImageModal, setShowImageModal, modalImages, currentImageIndex, setCurrentImageIndex }) => {
    if (!showImageModal || modalImages.length === 0) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 outline-none">
            <button
                type="button"
                className="absolute inset-0 h-full w-full cursor-default border-none bg-black/90 outline-none backdrop-blur-md"
                aria-label="Đóng modal"
                onClick={() => setShowImageModal(false)}
                tabIndex={-1}
            />
            <div className="relative flex h-full max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-zinc-950 shadow-2xl ring-1 ring-white/10">
                <button onClick={() => setShowImageModal(false)} className="absolute right-6 top-6 z-20 cursor-pointer rounded-full bg-black/40 p-2 text-white backdrop-blur-md transition-all hover:scale-110 hover:bg-red-600">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <div className="flex flex-1 items-center justify-center overflow-hidden border-b border-white/5">
                    <img loading="lazy" src={`https://image.tmdb.org/t/p/original${modalImages[currentImageIndex]?.file_path}`} alt={`Gallery item ${currentImageIndex + 1}`} className="max-h-full max-w-full object-contain" />
                </div>
                <div className="flex items-center justify-center gap-8 bg-zinc-900/50 px-6 py-6 backdrop-blur-xl">
                    <button onClick={() => setCurrentImageIndex((prev) => prev > 0 ? prev - 1 : modalImages.length - 1)} className="group cursor-pointer rounded-full bg-zinc-800 p-4 text-white transition-all hover:bg-red-600 active:scale-95">
                        <svg className="h-6 w-6 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div className="flex flex-col items-center">
                        <span className="text-xl font-black tracking-tighter text-white">{currentImageIndex + 1}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">của {modalImages.length}</span>
                    </div>
                    <button onClick={() => setCurrentImageIndex((prev) => prev < modalImages.length - 1 ? prev + 1 : 0)} className="group cursor-pointer rounded-full bg-zinc-800 p-4 text-white transition-all hover:bg-red-600 active:scale-95">
                        <svg className="h-6 w-6 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export const ShareModal = ({ showShareModal, setShowShareModal, movie, shareMessage, copyToClipboard, t }) => {
    if (!showShareModal || !movie) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
                type="button"
                className="absolute inset-0 h-full w-full cursor-default border-none bg-black/80 outline-none backdrop-blur-sm"
                aria-label="Đóng modal"
                onClick={() => setShowShareModal(false)}
                tabIndex={-1}
            />
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-zinc-900 shadow-2xl ring-1 ring-white/10">
                <div className="flex items-center justify-between border-b border-white/5 px-8 py-6">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">{t("vodPlay.shareMovie")}</h3>
                    <button onClick={() => setShowShareModal(false)} className="cursor-pointer rounded-full p-2 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-white">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-8">
                    <div className="mb-8 flex items-center gap-6">
                        <div className="aspect-2/3 h-24 overflow-hidden rounded-lg shadow-2xl ring-1 ring-white/10">
                            <img loading="lazy" src={movie.poster_url} alt={movie.name} className="h-full w-full object-cover" />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-lg font-black tracking-tighter text-white">{movie.name}</h4>
                            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">{movie.origin_name}</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">{t("vodPlay.movieLink")}</p>
                        <div className="group relative flex items-center">
                            <input type="text" readOnly value={window.location.href} className="w-full rounded-xl border border-white/5 bg-zinc-950/50 py-4 pl-4 pr-24 text-sm font-bold text-zinc-400 focus:outline-none focus:ring-1 focus:ring-red-600" />
                            <button onClick={() => copyToClipboard(window.location.href)} className="absolute right-1.5 rounded-lg bg-white px-4 py-2 text-[10px] font-black uppercase tracking-wider text-black transition-all hover:bg-red-600 hover:text-white active:scale-95">Sao chép</button>
                        </div>
                        {shareMessage && (
                            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-green-500">
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                {shareMessage}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const CountdownOverlay = ({ showNextCountdown, countdownSeconds, COUNTDOWN_DURATION, cancelCountdown, skipCountdown }) => {
    if (!showNextCountdown) return null;
    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm transition-all duration-500">
            <div className="flex flex-col items-center gap-6 text-center">
                <div className="relative flex h-28 w-28 items-center justify-center">
                    <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                        <circle cx="50" cy="50" r="42" fill="none" stroke="#dc2626" strokeWidth="4" strokeLinecap="round" strokeDasharray={2 * Math.PI * 42} strokeDashoffset={2 * Math.PI * 42 * (1 - countdownSeconds / COUNTDOWN_DURATION)} className="transition-all duration-1000 ease-linear" />
                    </svg>
                    <span className="text-4xl font-black text-white drop-shadow-lg">{countdownSeconds}</span>
                </div>
                <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">Tự động chuyển tập</p>
                    <p className="text-sm font-bold text-zinc-400">Tập tiếp theo sẽ phát sau {countdownSeconds} giây</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={cancelCountdown} className="rounded-full border border-zinc-700 bg-zinc-900/80 px-6 py-2.5 text-xs font-black uppercase tracking-wider text-zinc-400 transition-all hover:border-zinc-500 hover:text-white active:scale-95">Hủy</button>
                    <button onClick={skipCountdown} className="rounded-full bg-red-600 px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-red-600/30 transition-all hover:bg-red-500 active:scale-95">Phát ngay</button>
                </div>
            </div>
        </div>
    );
};

export const PlayerControlBar = ({ currentEpisodeId, handleCastTV, togglePiP, episodeListData, playPrevEpisode, playNextEpisode }) => {
    return (
        <div className="border-t border-white/5 bg-zinc-950 p-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex h-10 w-1 rounded-full bg-red-600"></div>
                    <div>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Đang xem tập</h3>
                        <p className="text-lg font-black uppercase tracking-tighter text-white">
                            {currentEpisodeId && (/^\d+$/.test(currentEpisodeId) ? `Tập ${currentEpisodeId}` : currentEpisodeId)}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 md:justify-end">
                    <div className="flex items-center gap-2">
                        <button onClick={handleCastTV} className="flex md:hidden h-11 items-center justify-center gap-2 rounded-full bg-blue-600/20 px-4 text-blue-500 ring-1 ring-blue-500/50 transition-all hover:bg-blue-600/30 active:scale-95" title="Cast TV">
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2h-6M4 16c0-2.21 1.79-4 4-4m-4 8c0-4.42 3.58-8 8-8m-8 12a12 12 0 0112-12" /></svg>
                            <span className="text-[11px] font-black uppercase tracking-wider">Cast</span>
                        </button>
                        <button onClick={togglePiP} className="flex h-11 items-center justify-center gap-2 rounded-full bg-zinc-900/50 px-4 text-white/70 ring-1 ring-white/10 transition-all hover:bg-zinc-800 hover:text-white active:scale-95" title="Picture-in-Picture">
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm0 2v12h16V6H4zm7 3h7v5h-7V9z" /></svg>
                            <span className="hidden sm:block text-[11px] font-black uppercase tracking-wider">PiP</span>
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        {episodeListData.length > 1 && (
                            <div className="flex items-center gap-3">
                                <button onClick={playPrevEpisode} className="group flex h-11 cursor-pointer items-center gap-2 rounded-full bg-zinc-900/50 px-5 text-white/70 ring-1 ring-white/10 transition-all hover:bg-zinc-800 hover:text-white active:scale-95 sm:px-6" title="Tập trước (P)">
                                    <svg className="h-4 w-4 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                                    <span className="hidden text-[11px] font-black uppercase tracking-wider sm:block">Tập trước</span>
                                </button>
                                <button onClick={playNextEpisode} className="group flex h-11 cursor-pointer items-center gap-2 rounded-full bg-red-600 px-5 text-white shadow-lg shadow-red-600/30 ring-1 ring-red-500/50 transition-all hover:bg-red-500 hover:shadow-red-500/40 active:scale-95 sm:px-6" title="Tập tiếp theo (N)">
                                    <span className="hidden text-[11px] font-black uppercase tracking-wider sm:block">Tập tiếp</span>
                                    <span className="text-[11px] font-black uppercase tracking-wider sm:hidden">Tiếp</span>
                                    <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const ServerTabs = ({ episodes, activeEpisode, switchTab }) => (
    <div className="relative border-b border-white/5 bg-zinc-900/50">
        <button
            onClick={() => {
                const container = document.getElementById("server-tabs-container");
                if (container) container.scrollBy({ left: -200, behavior: "smooth" });
            }}
            className="bg-linear-to-r absolute left-0 top-0 z-10 hidden h-full w-10 items-center justify-center from-zinc-900 to-transparent text-white transition-opacity hover:opacity-100 md:flex"
        >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
        </button>
        <div id="server-tabs-container" className="no-scrollbar flex overflow-x-auto scroll-smooth">
            {episodes.map((episode) => (
                <button
                    key={episode.server_name}
                    onClick={() => switchTab(episode)}
                    className={`relative flex h-16 shrink-0 items-center gap-2 px-8 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                        activeEpisode?.server_name === episode.server_name
                            ? "text-red-600"
                            : "text-zinc-600 hover:text-zinc-400"
                    }`}
                >
                    {episode.type_id === "sub" && (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 012 2h-3l-4 4z" />
                        </svg>
                    )}
                    {episode.type_id === "tm" && (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                    )}
                    {episode.type_id === "lt" && (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                    )}
                    {episode.server_name}
                    {activeEpisode?.server_name === episode.server_name && (
                        <div className="absolute bottom-0 left-0 h-1 w-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]"></div>
                    )}
                </button>
            ))}
        </div>
        <button
            onClick={() => {
                const container = document.getElementById("server-tabs-container");
                if (container) container.scrollBy({ left: 200, behavior: "smooth" });
            }}
            className="bg-linear-to-l absolute right-0 top-0 z-10 hidden h-full w-10 items-center justify-center from-zinc-900 to-transparent text-white transition-opacity hover:opacity-100 md:flex"
        >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
        </button>
    </div>
);

export const EpisodeGridItem = ({ k, server, isActive, isCompactView, openEpisode, getMovieImage, formatEpisodeName }) => {
    const imdbEp = server.imdbEp;
    const episodeThumb = server.thumb;

    return (
        <button
            onClick={openEpisode}
            className={`group relative flex flex-col overflow-hidden rounded-xl border transition-all duration-300 active:scale-[0.98] ${
                isActive
                    ? "border-red-600 bg-red-600/10 ring-1 ring-red-600/50"
                    : "border-white/5 bg-zinc-900/40 hover:border-white/20 hover:bg-zinc-900/60"
            } ${isCompactView ? "items-center justify-center p-2 text-center" : ""}`}
            title={imdbEp?.overview}
        >
            {!isCompactView && (
                <>
                    <div className="relative aspect-video w-full overflow-hidden">
                        <img
                            loading="lazy"
                            src={episodeThumb}
                            alt={`Tập ${k}`}
                            className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-110 ${isActive ? "" : "opacity-60 group-hover:opacity-100"}`}
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = FALLBACK_IMAGE;
                            }}
                        />
                        <div className="bg-linear-to-t absolute inset-0 from-black/80 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
                        <div className={`absolute left-2 top-2 rounded-md px-2 py-1 text-[9px] font-black uppercase tracking-wider backdrop-blur-md ${isActive ? "bg-red-600 text-white" : "bg-black/60 text-zinc-300"}`}>
                            Tập {k}
                        </div>
                        <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                            <div className={`flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md transition-transform duration-300 ${isActive ? "scale-100 bg-red-600" : "scale-75 bg-white/20 group-hover:scale-100"}`}>
                                <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                            </div>
                        </div>
                        {imdbEp?.runtime && (
                            <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[9px] font-bold text-zinc-200 backdrop-blur-sm">
                                {formatRuntime(imdbEp.runtime)}
                            </span>
                        )}
                    </div>
                    <div className="flex flex-1 flex-col p-3">
                        {imdbEp?.name && (
                            <div className="flex items-center justify-between gap-2">
                                <span className={`truncate text-[11px] font-black uppercase tracking-wider ${isActive ? "text-red-500" : "text-zinc-400 group-hover:text-white"}`}>
                                    {imdbEp?.name || formatEpisodeName(server.name || (/^\d+$/.test(String(k)) ? `Tập ${k}` : "Extra"))}
                                </span>
                                {isActive && <span className="flex h-1.5 w-1.5 animate-pulse rounded-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.8)]"></span>}
                            </div>
                        )}
                    </div>
                </>
            )}
            {isCompactView && (
                <div className="flex flex-col items-center">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? "text-white" : "text-zinc-500 group-hover:text-white"}`}>
                        Tập {k}
                    </span>
                </div>
            )}
        </button>
    );
};

export const MovieTitle = ({ movie, tmdbImages }) => {
    const titleLogo = (() => {
        if (tmdbImages?.logos?.length > 0) {
            const viLogo = tmdbImages.logos.find((l) => l.iso_639_1 === "vi");
            const enLogo = tmdbImages.logos.find((l) => l.iso_639_1 === "en");
            return viLogo || enLogo || tmdbImages.logos[0];
        }
        return null;
    })();

    const logoUrl = titleLogo ? `${TMDB_IMAGE_BASE_URL}/${TMDB_IMAGE_SIZES.POSTER}${titleLogo.file_path}` : null;

    if (logoUrl) {
        return (
            <div className="space-y-4">
                <div className="h-[60px] w-full max-w-[280px] drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] md:h-[100px] md:max-w-[350px] lg:h-[120px] lg:max-w-[450px]">
                    <img loading="lazy" src={logoUrl} alt={movie.name} className="h-full w-full object-contain object-left" />
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
};

export const MovieMetaTags = ({ movie, tmdbData }) => {
    const year = movie.year || (tmdbData?.release_date && new Date(tmdbData.release_date).getFullYear()) || (() => {
        if (!Array.isArray(movie.category) && movie.category && typeof movie.category === "object") {
            const yearGroup = Object.values(movie.category).find((g) => g.group?.name === "Năm");
            return yearGroup?.list?.[0]?.name;
        }
        return null;
    })();

    return (
        <div className="flex flex-wrap items-center gap-4 pt-2">
            {year && (
                <>
                    <span className="text-sm font-black text-white">{year}</span>
                    <span className="h-1 w-1 rounded-full bg-zinc-800"></span>
                </>
            )}
            {movie.time && (
                <>
                    <span className="text-sm font-bold text-zinc-400">{movie.time}</span>
                    <span className="h-1 w-1 rounded-full bg-zinc-800"></span>
                </>
            )}
            <span className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-black uppercase text-white">
                {movie.quality || "HD"}
            </span>
            {tmdbData?.vote_average > 0 && (
                <span className="flex items-center gap-1.5 text-sm font-black text-amber-500">
                    <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    {tmdbData.vote_average.toFixed(1)}
                </span>
            )}
        </div>
    );
};

export const MovieCategories = ({ movie }) => {
    let categories = [];
    if (Array.isArray(movie.category)) {
        categories = movie.category;
    } else if (movie.category && typeof movie.category === "object") {
        categories = Object.values(movie.category).flatMap((group) => group.list || []);
    }

    if (categories.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-2">
            {categories.map((cat, idx) => {
                const uniqueKey = `${cat.id || ''}-${cat.slug || ''}-${cat.name || ''}-${idx}`;
                return (
                    <span key={uniqueKey} className="rounded-full border border-zinc-800 bg-zinc-900/50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 transition-all hover:border-red-600 hover:text-white">
                        {cat.name}
                    </span>
                );
            })}
        </div>
    );
};

export const MovieDescription = ({ content }) => {
    const [showDescription, setShowDescription] = useState(false);
    if (!content) return null;
    return (
        <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-red-600">Tóm tắt nội dung</h3>
            <div className="group/desc relative">
                <div className={`overflow-hidden text-justify text-lg font-medium leading-relaxed text-zinc-400 transition-all duration-500 ${!showDescription ? "mask-linear-b max-h-32" : "max-h-[2000px]"}`} dangerouslySetInnerHTML={{ __html: content }}></div>
                {!showDescription && <div className="bg-linear-to-t pointer-events-none absolute inset-x-0 bottom-0 h-24 from-zinc-950/80 to-transparent transition-opacity duration-500"></div>}
                <button onClick={() => setShowDescription(!showDescription)} className="group/btn mt-6 flex cursor-pointer items-center gap-2 text-xs font-black uppercase tracking-widest text-white transition-all hover:text-red-600 active:scale-95">
                    <span className="relative">
                        {showDescription ? "Thu gọn" : "Đọc thêm"}
                        <div className="absolute -bottom-1 left-0 h-0.5 w-full scale-x-0 bg-red-600 transition-transform duration-300 group-hover/btn:scale-x-100"></div>
                    </span>
                    <svg className={`h-4 w-4 transition-transform duration-300 ${showDescription ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                </button>
            </div>
        </div>
    );
};

export const MovieCast = ({ tmdbCredits, movie }) => {
    const scrollRef = useRef(null);
    
    const hasCast = (tmdbCredits?.cast && tmdbCredits.cast.length > 0) || (movie.actor && movie.actor.length > 0);
    if (!hasCast) return null;

    const castList = tmdbCredits?.cast?.length > 0 ? tmdbCredits.cast : (movie.actor || []).map((name, idx) => ({ id: idx, name, character: "", profile_path: null }));

    const scroll = (direction) => {
        if (scrollRef.current) {
            const { current } = scrollRef;
            const scrollAmount = current.clientWidth * 0.8;
            current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
        }
    };

    return (
        <section className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-[0.3em] text-red-600">Dàn diễn viên</h3>
                <div className="flex gap-2">
                    <button onClick={() => scroll('left')} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-zinc-900 text-white transition-colors hover:border-red-600 hover:text-red-600 active:scale-95">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <button onClick={() => scroll('right')} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-zinc-900 text-white transition-colors hover:border-red-600 hover:text-red-600 active:scale-95">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>
            </div>
            
            <div 
                ref={scrollRef}
                className="no-scrollbar flex gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory py-4 px-1"
            >
                {castList.map((c) => (
                    <div key={c.id} className="group shrink-0 space-y-4 snap-start w-[96px] md:w-[112px]">
                        <div className="mx-auto h-24 w-24 overflow-hidden rounded-full ring-2 ring-transparent transition-all duration-300 group-hover:ring-red-600 md:h-28 md:w-28">
                            {c.profile_path ? (
                                <img loading="lazy" src={`${TMDB_IMAGE_BASE_URL}/${TMDB_IMAGE_SIZES.SMALL}${c.profile_path}`} alt={c.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-2xl font-black text-zinc-700">{c.name?.charAt(0).toUpperCase()}</div>
                            )}
                        </div>
                        <div className="text-center">
                            <p className="line-clamp-1 text-xs font-black text-zinc-200 transition-colors group-hover:text-red-600">{c.name}</p>
                            <p className="line-clamp-1 text-[9px] font-bold uppercase tracking-widest text-zinc-600">{c.character}</p>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

export const MovieGallery = ({ tmdbImages, setModalImages, setCurrentImageIndex, setShowImageModal }) => {
    const hasImages = tmdbImages && (tmdbImages.posters?.length > 0 || tmdbImages.backdrops?.length > 0);
    if (!hasImages) return null;

    const allImages = [...(tmdbImages.backdrops || []), ...(tmdbImages.posters || [])];

    return (
        <section className="space-y-4">
            <div className="flex items-center gap-4">
                <h3 className="text-sm font-black uppercase tracking-[0.3em] text-red-600">Bộ sưu tập ảnh</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {allImages.slice(0, 12).map((img, idx) => (
                    <button
                        type="button"
                        key={img.file_path}
                        className="block w-full text-left group relative aspect-video cursor-pointer overflow-hidden rounded-xl border border-white/5 bg-zinc-900 transition-all hover:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600"
                        onClick={() => {
                            setModalImages(allImages);
                            setCurrentImageIndex(idx);
                            setShowImageModal(true);
                        }}
                    >
                        <img
                            src={`${TMDB_IMAGE_BASE_URL}/${TMDB_IMAGE_SIZES.SMALL}${img.file_path}`}
                            alt="Gallery"
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                            loading="lazy"
                        />
                        {allImages.length > 12 && idx === 11 && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 font-black text-white">
                                +{allImages.length - 12}
                            </div>
                        )}
                    </button>
                ))}
            </div>
        </section>
    );
};

export default function VodPlay() {
    const location = useLocation();
    const backgrounds = location.state?.backgrounds;
    const { t } = useTranslation();

    const query = useQuery();
    const params = useParams();
    const slug = params.slug || query.get("slug") || "";
    const [searchParams, setSearchParams] = useSearchParams();
    const episodeParam = searchParams.get("episode");
    const serverParam = searchParams.get("server"); // Thêm server param
    const sourceParam = searchParams.get("source") || SOURCES.SOURCE_K; // Mặc định SOURCE_K
    const { currentUser } = useAuth();
    const playerRef = useRef(null);
    const currentUrlRef = useRef(null); // Track URL hiện tại đang play để tránh duplicate init
    const hasInitializedRef = useRef(false); // Track xem đã initialize player hay chưa
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
    const [imdbEpisodes, setImdbEpisodes] = useState([]); // Danh sách tập phim từ IMDb (cho hình ảnh)
    const [viewHistory, setViewHistory] = useLocalStorage("viewHistory", []);
    const viewHistoryRef = useRef(viewHistory); // Ref tránh re-render thường xuyên
    const lastHistorySyncRef = useRef(0); // Throttle sync state
    const [favorites, setFavorites] = useLocalStorage("favorites", []);
    const [showImageModal, setShowImageModal] = useState(false);
    const [modalImages, setModalImages] = useState([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    const [showShareModal, setShowShareModal] = useState(false);
    const [shareMessage, setShareMessage] = useState("");
    const [autoplayEnabled, setAutoplayEnabled] = useLocalStorage(
        "autoplayEnabled",
        true,
    ); // Tự động chuyển tập
    const autoplayEnabledRef = useRef(autoplayEnabled); // Ref để track giá trị mới nhất trong event handlers
    // Refs để tránh stale closure trong video.onended và keyboard shortcuts
    const episodesRef = useRef(episodes);
    const activeEpisodeRef = useRef(activeEpisode);
    const currentEpisodeIdRef = useRef(currentEpisodeId);
    const movieRef = useRef(movie);
    // Countdown state cho tự động chuyển tập
    const [showNextCountdown, setShowNextCountdown] = useState(false);
    const [countdownSeconds, setCountdownSeconds] = useState(5);
    const COUNTDOWN_DURATION = 5; // Số giây đếm ngược
    const [isCompactView, setIsCompactView] = useLocalStorage(
        "isCompactView",
        null, // Mặc định là null để detect lần đầu
    );

    // Memo hoá danh sách tập phim để tránh tính toán lại mỗi lần render
    const episodeListData = useMemo(() => {
        return computeEpisodeListData(activeEpisode, imdbEpisodes, movie);
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
        // Detect mobile để set mặc định cho Compact View
        if (isCompactView === null) {
            const isMobile = window.innerWidth < 768;
            setIsCompactView(isMobile);
        }
    }, [isCompactView, setIsCompactView]);
    const [skipIntroEnabled, setSkipIntroEnabled] = useLocalStorage(
        "skipIntroEnabled",
        false,
    ); // Tự động bỏ qua intro
    const skipIntroEnabledRef = useRef(skipIntroEnabled);

    // Season Detection
    const detectedSeason = useSeasonDetection(movie);

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

    // Đồng bộ refs với state để tránh stale closure
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

    useCountdownTimer(showNextCountdown, setShowNextCountdown, setCountdownSeconds, COUNTDOWN_DURATION, playNextEpisode);

    // Hủy countdown
    const cancelCountdown = useCallback(() => {
        setShowNextCountdown(false);
        setCountdownSeconds(COUNTDOWN_DURATION);
    }, []);

    // Bỏ qua countdown, phát ngay
    const skipCountdown = useCallback(() => {
        setShowNextCountdown(false);
        setCountdownSeconds(COUNTDOWN_DURATION);
        playNextEpisode();
    }, []);

    // Media Session API (Browser/OS Media Control)
    useMediaSession(movie, currentEpisodeId, memoizedBackgrounds);

    // Sync data from useMovieDetail hook
    const {
        movie: fetchedMovie,
        episodes: fetchedEpisodes,
        loading: movieLoading,
        tmdbData: fetchedTmdbData,
        tmdbCredits: fetchedTmdbCredits,
        tmdbImages: fetchedTmdbImages,
        tmdbVideos: fetchedTmdbVideos,
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
    }, [
        fetchedTmdbData,
        fetchedTmdbCredits,
        fetchedTmdbImages,
        fetchedTmdbVideos,
    ]);

    // Fetch danh sách tập phim từ TMDB để lấy hình ảnh từng tập
    useFetchSeasonEpisodes(tmdbData, movie, detectedSeason, setImdbEpisodes);

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

    const maxDigits = useMemo(() => computeMaxDigits(episodes), [episodes]);

    // Interceptors đã setup từ đầu file

    // Sync history từ Firestore khi user đăng nhập
    useFirestoreHistorySync(currentUser, setViewHistory, fetchHistoryFromFirestore);

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
    usePlayerInitialization({
        movie, episodes, tmdbVideos, viewHistory, hasInitializedRef,
        initializeFromUrl, getTrailerEpisode, setEpisodes, setActiveEpisode,
        setErrorMessage, t
    });

    useImageModalKeyboard(showImageModal, modalImages, setCurrentImageIndex, modalRef, setShowImageModal);

    // Keyboard shortcuts cho video player (j/l hoặc arrow keys để tua 10s)
    useVideoKeyboardShortcuts({
        showImageModal,
        showShareModal,
        episodes,
        activeEpisode,
        currentEpisodeId,
        playerRef,
        playNextEpisode,
        playPrevEpisode,
    });

    // Get last watched episodes list
    const getLastWatchedList = useCallback(() => {
        return viewHistory || [];
    }, [viewHistory]);

    // Helper function to format episode name
    const formatEpisodeName = useCallback((name) => {
        return formatEpisodeNameHelper(name, maxDigits, t("vodPlay.episode"));
    }, [maxDigits, t]);

    // Initialize from URL parameters - ưu tiên: URL param → last watched → tập đầu
    function initializeFromUrl(episodesList, movie) {
        handleInitializeFromUrl({
            episodesList, movie, episodeParam, serverParam, slug, getLastWatchedList,
            hasInitializedRef, setActiveEpisode, openEpisode, findTargetEpisodeAndServer,
            findTargetEpisodeFromHistory, serverNameToSlug
        });
    }

    // Helper function: Lấy position đã xem của episode từ lịch sử
    const getLastWatchedPosition = useCallback((episodeSlug, episodeName = "") => {
        return computeLastWatchedPosition(episodeSlug, episodeName, viewHistory, slug);
    }, [viewHistory, slug]);

    // Set watchlist - save current episode & position
    const setWatchlist = (episodeSlug, position = null, episode = null, movie = {}) => {
        processWatchlistUpdate({
            episodeSlug, position, episode, movie,
            serverParam, slug, viewHistory, viewHistoryRef, setViewHistory,
            lastHistorySyncRef, currentUser, lastFirestoreSyncRef,
            getMovieImage, formatEpisodeValue, updateWatchHistory, addHistoryToFirestore
        });
    };

    // Đã chuyển ensureYoutubeEmbedUrl ra ngoài component

    const shakaPlayerRef = useRef(null);
    const shakaUiOverlayRef = useRef(null);
    const activeVideoElementRef = useRef(null);

    // Destroy Shaka Player instances
    const destroyAllPlayers = async () => {
        await destroyAllPlayersHelper(activeVideoElementRef, shakaUiOverlayRef, shakaPlayerRef, currentUrlRef);
    };

    // Setup Shaka Player
    const setupShakaPlayer = async (masterUrl, episodeSlug, serverName, movie, fallbackUrl = null, backups = []) => {
        return handleSetupShakaPlayer({
            masterUrl, episodeSlug, serverName, movie, fallbackUrl, backups,
            playerRef, activeVideoElementRef, shakaPlayerRef, shakaUiOverlayRef, currentUrlRef,
            memoizedBackgrounds, setCurrentEpisodeId, positionRestoredRef,
            setWatchlist, introDurationRef, skipIntroEnabledRef, autoplayEnabledRef,
            setShowNextCountdown, setCountdownSeconds, COUNTDOWN_DURATION,
            destroyAllPlayers, setupEmbedPlayer, setErrorMessage, getLastWatchedPosition,
            setupShakaPlayer
        });
    };

    // Fallback embed player
    async function setupEmbedPlayer(embedUrl, episodeSlug, serverName = "") {
        await destroyAllPlayers();
        const playerDiv = playerRef.current;
        if (!playerDiv) return;

        playerDiv.innerHTML = "";
        const iframe = document.createElement("iframe");
        iframe.src = embedUrl;
        iframe.className = "w-full h-full rounded-xl shadow-2xl object-contain";
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
        return handleInitializePlayer({
            server, episodeSlug, movie, currentUrlRef, setErrorMessage,
            fetchedTmdbVideos, ensureYoutubeEmbedUrl, setupEmbedPlayer, setupShakaPlayer
        });
    }

    function openEpisode(server, episode, movie) {
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
            console.warn("Failed to update URL parameters:", e);
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
            console.warn("Failed to update URL parameters:", e);
        }
    }

    // Play next episode (đọc từ refs để tránh stale closure)
    function playNextEpisode() {
        handlePlayEpisodeSequence({
            direction: "next", episodesRef, currentEpisodeIdRef, episodeParam,
            getLastWatchedList, slug, movie, activeEpisode, activeEpisodeRef, movieRef,
            slugToServerName, getEpisodeKey, getNextEpisodeData, getPrevEpisodeData,
            setActiveEpisode, openEpisode, setErrorMessage
        });
    }

    // Play previous episode (đọc từ refs để tránh stale closure)
    function playPrevEpisode() {
        handlePlayEpisodeSequence({
            direction: "prev", episodesRef, currentEpisodeIdRef, episodeParam,
            getLastWatchedList, slug, movie, activeEpisode, activeEpisodeRef, movieRef,
            slugToServerName, getEpisodeKey, getNextEpisodeData, getPrevEpisodeData,
            setActiveEpisode, openEpisode, setErrorMessage
        });
    }

    // Switch to different episode (tab) - try to keep same server, fallback to first
    function switchTab(episode) {
        const targetServer = findBestServerTab(
            episode, 
            activeEpisode, 
            slug, 
            getLastWatchedList, 
            currentEpisodeId, 
            episodeParam
        );

        if (targetServer) {
            setActiveEpisode(episode);
            openEpisode(targetServer, episode, movie);
            
            const serverSlug = serverNameToSlug(episode.server_name);
            updateEpisodeUrlParams(setSearchParams, serverSlug, targetServer);
        } else {
            setErrorMessage("No servers available for this episode.");
        }
    }

    // Favorite functions
    function isFavorited(slug) {
        return favorites.some((favorite) => favorite.slug === slug);
    }

    function toggleFavorite(movie) {
        handleToggleFavorite(
            movie, favorites, setFavorites, setErrorMessage, getMovieImage, isFavorited
        );
    }

    // Share function - mở modal
    function shareMovie(movie) {
        setShowShareModal(true);
    }

    function copyToClipboard(text) {
        handleCopyToClipboard(text, setShareMessage, t);
    }

    return (
        <VodLayout>
            {errorMessage && (
                <div className="fixed bottom-6 right-6 z-50 flex animate-bounce items-center gap-2 rounded-xl bg-red-600 px-6 py-3 font-semibold text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {errorMessage}
                </div>
            )}
            
            {isLoading && <PlaySkeleton backgrounds={memoizedBackgrounds || backgrounds} />}
            
            {!isLoading && !movie && <NotFoundState />}
            
            <ImageModal
                showImageModal={showImageModal}
                setShowImageModal={setShowImageModal}
                modalImages={modalImages}
                currentImageIndex={currentImageIndex}
                setCurrentImageIndex={setCurrentImageIndex}
            />
            
            <ShareModal
                showShareModal={showShareModal}
                setShowShareModal={setShowShareModal}
                movie={movie}
                shareMessage={shareMessage}
                copyToClipboard={copyToClipboard}
                t={t}
            />
            {!isLoading && movie && (
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
                                <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-black md:max-h-[80vh]">
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

                                    {/* Countdown Overlay - Tự động chuyển tập */}
                                    <CountdownOverlay
                                        showNextCountdown={showNextCountdown}
                                        countdownSeconds={countdownSeconds}
                                        COUNTDOWN_DURATION={COUNTDOWN_DURATION}
                                        cancelCountdown={cancelCountdown}
                                        skipCountdown={skipCountdown}
                                    />
                                </div>

                                <PlayerControlBar
                                    currentEpisodeId={currentEpisodeId}
                                    handleCastTV={handleCastTV}
                                    togglePiP={togglePiP}
                                    episodeListData={episodeListData}
                                    playPrevEpisode={playPrevEpisode}
                                    playNextEpisode={playNextEpisode}
                                />

                                    {/* Settings Switches */}
                                    <div className="mt-8 flex flex-wrap gap-8 border-t border-white/5 pt-6">
                                        <div className="flex items-center gap-4">
                                            <button
                                                type="button"
                                                className="flex cursor-pointer items-center gap-3 rounded-lg p-1 focus:outline-none focus:ring-2 focus:ring-red-600"
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
                                            </button>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-4">
                                            <button
                                                type="button"
                                                className="flex cursor-pointer items-center gap-3 rounded-lg p-1 focus:outline-none focus:ring-2 focus:ring-red-600"
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
                                            </button>
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
                                                                        Number.parseInt(
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
                                            <button
                                                type="button"
                                                className="flex cursor-pointer items-center gap-3 rounded-lg p-1 focus:outline-none focus:ring-2 focus:ring-red-600"
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
                                            </button>
                                        </div>
                                    </div>
                            </div>

                            {/* Episode List Column */}
                            <div className="flex w-full flex-col overflow-hidden rounded-2xl bg-zinc-950 shadow-2xl ring-1 ring-white/5">
                                {/* Server Select Tabs */}
                                <ServerTabs 
                                    episodes={episodes} 
                                    activeEpisode={activeEpisode} 
                                    switchTab={switchTab} 
                                />

                                {/* Server Data Grid - Responsive Episode Cards with Images */}
                                <div className="no-scrollbar max-h-[35rem] overflow-y-auto p-6">
                                    <div
                                        className={`grid gap-2 ${
                                            isCompactView
                                                ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10"
                                                : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                                        }`}
                                    >
                                        {episodeListData.map(([k, server]) => (
                                            <EpisodeGridItem
                                                key={`${activeEpisode?.server_name}-${k}`}
                                                k={k}
                                                server={server}
                                                isActive={k === (currentEpisodeId || "")}
                                                isCompactView={isCompactView}
                                                openEpisode={() => openEpisode(server, activeEpisode, movie)}
                                                getMovieImage={getMovieImage}
                                                formatEpisodeName={formatEpisodeName}
                                            />
                                        ))}
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
                                                e.target.src = FALLBACK_IMAGE;
                                            }}
                                        />
                                        <div className="bg-linear-to-t absolute inset-0 from-zinc-950 via-transparent to-transparent opacity-60"></div>
                                    </div>
                                </div>

                                {/* Text Info Side */}
                                <div className="flex-1 space-y-10">
                                    <header className="space-y-6">
                                        <div className="space-y-2">
                                            <MovieTitle movie={movie} tmdbImages={tmdbImages} />
                                            <p className="text-lg font-bold uppercase tracking-[0.2em] text-zinc-600 md:text-xl">
                                                {movie.origin_name}
                                            </p>
                                        </div>
                                        <MovieMetaTags movie={movie} tmdbData={tmdbData} />
                                    </header>

                                    <MovieCategories movie={movie} />
                                    <MovieDescription content={movie.content} />
                                </div>
                            </section>

                            {/* Cast Section */}
                            <MovieCast tmdbCredits={tmdbCredits} movie={movie} />

                            {/* Gallery Section */}
                            <MovieGallery 
                                tmdbImages={tmdbImages} 
                                setModalImages={setModalImages} 
                                setCurrentImageIndex={setCurrentImageIndex} 
                                setShowImageModal={setShowImageModal} 
                            />
                        </div>
                    </div>
                </div>
            )}
        </VodLayout>
    );
}
