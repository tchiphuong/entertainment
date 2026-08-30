/**
 * VodPlay Helpers - Các hàm tiện ích thuần túy cho trang xem phim VOD
 * Đảm bảo độ phức tạp mỗi hàm <= 15 và tuân thủ DRY
 */

import {
    SOURCES,
    JWPLAYER_LICENSE_MOCK,
    FALLBACK_IMAGE,
    TMDB_IMAGE_BASE_URL,
    TMDB_IMAGE_SIZES,
} from "../constants";

const CONFIG = {
    APP_DOMAIN_SOURCE_K: import.meta.env.VITE_SOURCE_K_API,
    APP_DOMAIN_SOURCE_K_CDN_IMAGE: import.meta.env.VITE_SOURCE_K_CDN_IMAGE,
    APP_DOMAIN_SOURCE_C: import.meta.env.VITE_SOURCE_C_API,
    APP_DOMAIN_SOURCE_O_CDN_IMAGE: import.meta.env.VITE_SOURCE_O_CDN_IMAGE,
};

// ==========================================
// 1. M3U8 PARSER & CLEANER HELPERS
// ==========================================
export const isAdBlockStart = (line, nextLine) => {
    return line === "#EXT-X-DISCONTINUITY" && nextLine?.startsWith("#EXT-X-KEY:METHOD=NONE");
};

export const isSegmentLine = (line) => {
    return /\.(ts|png|jpg|jpeg|gif|m4s|mp4)(\?|$)/i.test(line) && !line.startsWith("#");
};

export const isAdSegment = (line) => {
    return line.includes("/adjump/") || /ads|telecom|static/i.test(line);
};

export const normalizeSegmentLine = (line, baseURL) => {
    let normalized = line;
    if (normalized.includes("convertv7/")) {
        normalized = normalized.replace("convertv7/", "");
    }
    if (baseURL && !normalized.startsWith("http") && !normalized.startsWith("/")) {
        normalized = baseURL + normalized;
    }
    return normalized;
};

export function processValidM3U8Line(line, cleaned, baseURL) {
    if (!isSegmentLine(line)) {
        cleaned.push(line);
        return;
    }

    if (isAdSegment(line)) {
        if (cleaned.length > 0 && cleaned.at(-1).startsWith("#EXTINF")) {
            cleaned.pop();
        }
        return;
    }

    cleaned.push(normalizeSegmentLine(line, baseURL));
}

export function cleanM3U8Content(text, baseURL = "") {
    const lines = text.split("\n");
    const cleaned = [];
    let skipBlock = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (!skipBlock && isAdBlockStart(line, lines[i + 1])) {
            skipBlock = true;
            i++;
            continue;
        }

        if (skipBlock) {
            if (line === "#EXT-X-DISCONTINUITY") {
                skipBlock = false;
            }
            continue;
        }

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
                const text = decoder.decode(response.data);

                if (["#EXT-X-DISCONTINUITY", "convertv7/", "/adjump/", "ads"].some((kw) => text.includes(kw))) {
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

// ==========================================
// 2. NETWORK INTERCEPTORS (JWPlayer + M3U8)
// ==========================================
let isInterceptorInitialized = false;

export const initNetworkInterceptors = () => {
    if (isInterceptorInitialized || typeof window === "undefined") return;
    isInterceptorInitialized = true;

    const originalFetch = window.fetch;
    window.fetch = function (...args) {
        const url = typeof args[0] === "string" ? args[0] : args[0]?.url;

        if (url?.includes("entitlements.jwplayer.com")) {
            return Promise.resolve(
                new Response(JSON.stringify(JWPLAYER_LICENSE_MOCK), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                })
            );
        }

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
};

// ==========================================
// 3. IMAGE & THUMBNAIL RESOLVERS
// ==========================================
export function getMovieImage(imagePath, source) {
    if (!imagePath) return FALLBACK_IMAGE;
    if (["http://", "https://"].some((proto) => imagePath.startsWith(proto))) {
        return imagePath;
    }
    if (source === SOURCES.SOURCE_C) {
        return `${CONFIG.APP_DOMAIN_SOURCE_C}/api/uploads/films/${imagePath}`;
    }
    if (source === SOURCES.SOURCE_O) {
        return `${CONFIG.APP_DOMAIN_SOURCE_O_CDN_IMAGE}/${imagePath}`;
    }
    return `${CONFIG.APP_DOMAIN_SOURCE_K_CDN_IMAGE}/${imagePath}`;
}

export const resolveEpisodeThumb = (imdbEp, tmdbData, movie) => {
    if (imdbEp?.still_path) {
        return `${TMDB_IMAGE_BASE_URL}/${TMDB_IMAGE_SIZES.STILL || "w300"}${imdbEp.still_path}`;
    }
    if (imdbEp?.primaryImage?.url) {
        return imdbEp.primaryImage.url;
    }
    if (tmdbData?.backdrop_path) {
        return `${TMDB_IMAGE_BASE_URL}/${TMDB_IMAGE_SIZES.THUMBNAIL || "w780"}${tmdbData.backdrop_path}`;
    }
    return getMovieImage(movie?.thumb_url || movie?.poster_url, movie?.source);
};

// ==========================================
// 4. EPISODE & SERVER KEY HELPERS
// ==========================================
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

    const lower = serverName.toLowerCase();
    if (["vietsub", "phụ đề", "phu de"].some((k) => lower.includes(k))) return "Phụ đề";
    if (["thuyết minh", "thuyet minh"].some((k) => lower.includes(k))) return "Thuyết Minh";
    if (["lồng tiếng", "long tieng"].some((k) => lower.includes(k))) return "Lồng Tiếng";
    return serverName;
}

export function serverNameToSlug(serverName) {
    if (!serverName) return "";
    return serverName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function slugToServerName(slug) {
    const mapping = {
        vietsub: "Phụ đề",
        "phu-de": "Phụ đề",
        "thuyet-minh": "Thuyết Minh",
        "long-tieng": "Lồng Tiếng",
    };
    return mapping[slug] || slug;
}

// Bảng phân loại bản dịch — dùng loop thay nhiều if để giảm complexity
const AUDIO_CLASSIFICATION_RULES = [
    { key: "tm", label: "Thuyết Minh", typeIds: ["tm"], regex: /\btm\b/, keywords: ["thuyết minh", "thuyet minh"] },
    { key: "lt", label: "Lồng Tiếng", typeIds: ["lt"], regex: /\blt\b/, keywords: ["lồng tiếng", "long tieng"] },
    { key: "sub", label: "Phụ đề", typeIds: ["sub"], regex: /\bsub\b/, keywords: ["vietsub", "phụ đề", "phu de"] },
    { key: "trailer", label: "Trailer", typeIds: ["trailer"], regex: null, keywords: ["trailer"] },
];

function classifyAudioVersion(ep, index) {
    const sName = ep?.server_name || "";
    const lower = sName.toLowerCase();
    const typeId = String(ep?.type_id || "").toLowerCase();

    for (const rule of AUDIO_CLASSIFICATION_RULES) {
        const matchTypeId = rule.typeIds.includes(typeId);
        const matchRegex = rule.regex?.test(lower);
        const matchKeyword = rule.keywords.some((k) => lower.includes(k));
        if (matchTypeId || matchRegex || matchKeyword) {
            return { key: rule.key, label: rule.label };
        }
    }
    return { key: `server_${index}`, label: sName };
}

export function extractAudioVersions(episodes = []) {
    if (!Array.isArray(episodes) || episodes.length === 0) return [];

    const versions = [];
    const seen = new Set();

    episodes.forEach((ep, index) => {
        if (!ep?.server_data?.length) return;
        const { key, label } = classifyAudioVersion(ep, index);

        if (!seen.has(key)) {
            seen.add(key);
            versions.push({
                key,
                label,
                server_name: ep.server_name || "",
                group: ep,
            });
        }
    });

    return versions;
}

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

export const computeEpisodeListData = (activeEpisode, imdbEpisodes, movie, tmdbData) => {
    const map = new Map();
    (activeEpisode?.server_data || []).forEach((s, i) => {
        if (!s) return;
        const raw = getEpisodeKey(s.slug, s.name);
        const k = /^\d+$/.test(String(raw)) ? String(raw) : s.slug || s.name || `idx-${i}`;
        if (!map.has(k)) {
            const epNum = Number.parseInt(k, 10);
            const imdbEp = (!Number.isNaN(epNum) && epNum > 0)
                ? (imdbEpisodes || []).find((e) => (e.episode_number || e.episodeNumber) === epNum)
                : undefined;
            const thumb = resolveEpisodeThumb(imdbEp, tmdbData, movie);
            map.set(k, { ...s, key: k, imdbEp, thumb });
        }
    });
    return Array.from(map.entries()).map(([k, server]) => ({ k, server }));
};

export const computeMaxDigits = (episodes) => {
    const allEpisodeNumbers = (episodes || []).flatMap((ep) =>
        (ep.server_data || []).map((s) => {
            const match = new RegExp(/^\d+/).exec(String(s.name || ""));
            return match ? Number.parseInt(match[0]) : 0;
        })
    );
    const maxEpisode = Math.max(...allEpisodeNumbers, 0);
    if (maxEpisode >= 10000) return 4;
    if (maxEpisode >= 1000) return 3;
    if (maxEpisode >= 100) return 2;
    return 1;
};

export const ensureYoutubeEmbedUrl = (url) => {
    if (!url || typeof url !== "string") return url;

    let videoId = "";
    if (url.includes("youtube.com/embed/")) {
        videoId = url.split("youtube.com/embed/")[1].split("?")[0];
    } else if (url.includes("youtube-nocookie.com/embed/")) {
        videoId = url.split("youtube-nocookie.com/embed/")[1].split("?")[0];
    } else if (url.includes("youtube.com/watch?v=")) {
        videoId = url.split("v=")[1].split("&")[0];
    } else if (url.includes("youtu.be/")) {
        videoId = url.split("youtu.be/")[1].split("?")[0];
    }

    if (videoId) {
        const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
        const originParam = origin ? `&origin=${encodeURIComponent(origin)}` : "";
        return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&enablejsapi=1&rel=0${originParam}`;
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

export const formatEpisodeValue = (episodeTotal, episodeName, episodeKey, episodeSlug) => {
    const totalMatch = new RegExp(/(\d+)/).exec(String(episodeTotal || ""));
    const total = totalMatch ? totalMatch[1] : "";
    const baseName = episodeName || String(episodeKey);
    const keyStr = String(episodeKey).toLowerCase();

    if (["full", "trailer"].includes(keyStr)) {
        return keyStr === "full" ? "Full" : "Trailer";
    }

    if (typeof episodeKey === "number" || /^\d+$/.test(keyStr)) {
        return `Tập ${episodeKey}${total && total !== "1" ? "/" + total : ""}`;
    }
    return baseName || episodeSlug;
};

// ==========================================
// 6. WATCH HISTORY & LOCAL STORAGE HELPERS
// ==========================================
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
    return 0.8;
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

export const extractTmdbIdFromObject = (obj, slugFallback = "") => {
    return String(
        obj?.tmdb?.id ||
        obj?.tmdb_id ||
        obj?.tmdbId ||
        (slugFallback.startsWith("tmdb-") ? slugFallback.replace("tmdb-", "") : "")
    );
};

export const isHistoryItemMatch = (item, cleanSlug, movie, targetTmdbId) => {
    if (!item) return false;
    if ([cleanSlug, movie?.slug].filter(Boolean).includes(item.slug)) return true;
    const itemTmdbId = extractTmdbIdFromObject(item, item.slug);
    if (targetTmdbId && itemTmdbId && targetTmdbId === itemTmdbId) return true;
    if (item.name && movie?.name && item.name.toLowerCase().trim() === movie.name.toLowerCase().trim()) return true;
    return false;
};

export const isWatchlistHistoryMatch = (item, routeSlug, canonicalSlug, targetTmdbId, movieName) => {
    if (!item) return false;
    if ([routeSlug, canonicalSlug].filter(Boolean).includes(item.slug)) return true;
    const itemTmdbId = extractTmdbIdFromObject(item, item.slug);
    if (targetTmdbId && itemTmdbId && targetTmdbId === itemTmdbId) return true;
    if (item.name && movieName && item.name.toLowerCase().trim() === movieName.toLowerCase().trim()) return true;
    return false;
};

export const syncWatchlistToFirestore = (currentUser, history, lastFirestoreSyncRef, addHistoryToFirestore) => {
    if (!currentUser || history.length === 0 || !addHistoryToFirestore) return;
    const now = Date.now();
    const THROTTLE_MS = 30000;
    if (now - (lastFirestoreSyncRef?.current || 0) >= THROTTLE_MS) {
        if (lastFirestoreSyncRef) lastFirestoreSyncRef.current = now;
        addHistoryToFirestore(currentUser.uid, history[0]).catch((error) => {
            console.error("Failed to sync history to Firestore:", error);
        });
    }
};

export const syncWatchlistLocalState = (history, viewHistoryRef, lastHistorySyncRef, setViewHistory) => {
    if (viewHistoryRef) viewHistoryRef.current = history;
    try {
        localStorage.setItem("viewHistory", JSON.stringify(history));
    } catch {}

    const syncNow = Date.now();
    if (syncNow - (lastHistorySyncRef?.current || 0) >= 30000) {
        if (lastHistorySyncRef) lastHistorySyncRef.current = syncNow;
        if (setViewHistory) setViewHistory(history);
    }
};

// Trích poster từ nhiều nguồn khác nhau
const extractMoviePoster = (movie, getMovieImage) => {
    if (!getMovieImage) return "";
    const rawUrl = movie?.poster_url || movie?.poster || movie?.thumb_url;
    return getMovieImage(rawUrl, movie?.source);
};

// Trích server name từ nhiều nguồn
const extractMovieServer = (movie, episode, serverParam) =>
    movie?.server || episode?.server_name || serverParam || "";

// Trích tên tập phim
const extractEpisodeValue = (movie, episode, formatFn, episodeKey, episodeSlug) => {
    if (!formatFn) return String(episodeKey || episodeSlug);
    return formatFn(movie?.episode_total, episode?.name, episodeKey, episodeSlug);
};

export const buildWatchlistPayload = ({
    movie, episode, serverParam, canonicalSlug, targetTmdbId,
    getMovieImage, formatEpisodeValue: formatFn, episodeKey, episodeSlug, position
}) => {
    const movieName = movie?.name || "Không rõ tên";
    const moviePoster = extractMoviePoster(movie, getMovieImage);
    const movieServer = extractMovieServer(movie, episode, serverParam);
    const movieOriginName = movie?.origin_name || movie?.originName || "";
    const episodeValue = extractEpisodeValue(movie, episode, formatFn, episodeKey, episodeSlug);
    const resolvedTmdbId = targetTmdbId || movie?.tmdb_id;
    const tmdbData = movie?.tmdb || (targetTmdbId ? { id: targetTmdbId } : undefined);

    return {
        movieName,
        payload: {
            cleanSlug: canonicalSlug,
            movieName,
            moviePoster,
            movieServer,
            movieOriginName,
            currentMovie: { ...movie, slug: canonicalSlug, tmdb_id: resolvedTmdbId, tmdb: tmdbData },
            episodeKey,
            episodeValue,
            position,
        },
    };
};

export const computeLastWatchedPosition = (episodeSlug, episodeName, viewHistory, slug, movie) => {
    const cleanSlug = slug.split("?")[0];
    const targetTmdbId = extractTmdbIdFromObject(movie, cleanSlug);
    const movieData = (viewHistory || []).find((item) =>
        isHistoryItemMatch(item, cleanSlug, movie, targetTmdbId)
    );

    if (!movieData?.episodes) return 0;

    const episodeKey = normalizeKey(getEpisodeKey(episodeSlug, episodeName));
    const episodeData = movieData.episodes.find((ep) => compareEpisodeKeys(ep.key, episodeKey));
    return episodeData?.position || 0;
};

function createNewWatchHistoryItem({
    cleanSlug, movieName, moviePoster, movieServer, movieOriginName,
    currentMovie, episodeKey, episodeValue, position,
}) {
    return {
        slug: cleanSlug,
        name: movieName,
        poster: moviePoster,
        server: movieServer,
        episode_total: currentMovie?.episode_total || "",
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
    };
}

function mergeEpisodeProgress(existingEpisodes, episodeKey, position) {
    const dedupeMap = new Map();
    (existingEpisodes || []).forEach((ep) => {
        const nk = normalizeKey(ep.key);
        const existing = dedupeMap.get(nk);
        if (!existing || (ep.position || 0) > (existing.position || 0)) {
            dedupeMap.set(nk, { ...ep, key: nk });
        }
    });

    const episodes = Array.from(dedupeMap.values());
    const epIndex = episodes.findIndex((ep) => normalizeKey(ep.key) === episodeKey);
    const now = new Date().toISOString();

    if (epIndex === -1) {
        episodes.push({
            key: episodeKey,
            position: typeof position === "number" ? position : 0,
            timestamp: now,
        });
    } else {
        if (typeof position === "number") episodes[epIndex].position = position;
        episodes[epIndex].timestamp = now;
        episodes[epIndex].key = normalizeKey(episodes[epIndex].key);
    }
    return episodes;
}

export const updateWatchHistory = (
    history,
    movieIndex,
    payload
) => {
    if (movieIndex === -1) {
        history.unshift(createNewWatchHistoryItem(payload));
        return history;
    }

    const { movieName, moviePoster, movieServer, movieOriginName, currentMovie, episodeKey, episodeValue, position } = payload;
    const movieData = history[movieIndex];
    movieData.name = movieName;
    movieData.poster = moviePoster;
    movieData.server = movieServer;
    movieData.origin_name = movieOriginName;
    movieData.episode_total = currentMovie?.episode_total || movieData.episode_total || "";
    movieData.current_episode = { key: episodeKey, value: episodeValue };
    movieData.time = new Date().toISOString();
    movieData.episodes = mergeEpisodeProgress(movieData.episodes, episodeKey, position);

    history.splice(movieIndex, 1);
    history.unshift(movieData);
    return history;
};

// ==========================================
// 7. EPISODE SEQUENCE NAVIGATION
// ==========================================
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

export const getNextEpisodeData = (episodesList, currentKey, savedServerName, currentGroup) => {
    const { group, index } = findCurrentGroupAndIndex(episodesList, currentKey, currentGroup);
    if (index === -1 || !group) return null;

    const data = group.server_data;
    if (index + 1 < data.length) {
        return { targetServer: data[index + 1], targetGroup: group, setActive: false };
    }

    const currentGroupIdx = episodesList.findIndex((ep) => ep.server_name === group.server_name);
    if (currentGroupIdx !== -1 && currentGroupIdx + 1 < episodesList.length) {
        const nextGroup = episodesList[currentGroupIdx + 1];
        if (nextGroup?.server_data?.length > 0) {
            return { targetServer: nextGroup.server_data[0], targetGroup: nextGroup, setActive: true };
        }
    }
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
    if (currentGroupIdx > 0) {
        const prevGroup = episodesList[currentGroupIdx - 1];
        if (prevGroup?.server_data?.length > 0) {
            return { targetServer: prevGroup.server_data[prevGroup.server_data.length - 1], targetGroup: prevGroup, setActive: true };
        }
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
        return matchByKey;
    }
    return null;
};

export const findBestServerTab = (episode, prevActive, slug, getLastWatchedList, currentEpisodeId, episodeParam) => {
    const target = findMatchingServerTab(episode, currentEpisodeId, episodeParam);
    if (target) return target;

    if (prevActive?.server_name) {
        const currentServerType = extractServerType(prevActive.server_name);
        const match = episode.server_data?.find(
            (server) => extractServerType(server.server_name) === currentServerType
        );
        if (match) return match;
    }

    if (episode.server_data?.length > 0) {
        return episode.server_data[0];
    }
    return null;
};

export const findTargetEpisodeAndServer = (episodesList, episodeParam, serverParam, _slug, _viewHistory) => {
    let targetEpisode = null;
    let targetServer = null;

    if (serverParam) {
        targetEpisode = episodesList.find((ep) => serverNameToSlug(ep.server_name) === serverParam);
    }
    if (!targetEpisode) {
        targetEpisode = episodesList[0];
    }

    if (targetEpisode?.server_data?.length > 0) {
        targetServer = targetEpisode.server_data.find((s) => {
            const key = getEpisodeKey(s.slug, s.name);
            return compareEpisodeKeys(key, episodeParam);
        });
        if (!targetServer) {
            targetServer = targetEpisode.server_data[0];
        }
    }

    return { targetEpisode, targetServer };
};

export const findTargetEpisodeFromHistory = (episodesList, slug, viewHistory, currentMovie) => {
    const cleanSlug = slug.split("?")[0];
    const targetTmdbId = extractTmdbIdFromObject(currentMovie, cleanSlug);
    const historyItem = (viewHistory || []).find((item) =>
        isHistoryItemMatch(item, cleanSlug, currentMovie, targetTmdbId)
    );

    let targetEpisode = null;
    let targetServer = null;
    let episodeKey;

    if (historyItem?.current_episode?.key !== undefined) {
        const savedKey = historyItem.current_episode.key;
        const savedServer = historyItem.server;

        if (savedServer) {
            targetEpisode = episodesList.find(
                (ep) =>
                    ep.server_name === savedServer ||
                    serverNameToSlug(ep.server_name) === serverNameToSlug(savedServer)
            );
        }
        if (!targetEpisode) targetEpisode = episodesList[0];

        if (targetEpisode?.server_data?.length > 0) {
            targetServer = targetEpisode.server_data.find((s) => {
                const k = getEpisodeKey(s.slug, s.name);
                return compareEpisodeKeys(k, savedKey);
            });
            if (!targetServer) targetServer = targetEpisode.server_data[0];
            episodeKey = savedKey;
        }
    } else {
        targetEpisode = episodesList[0];
        if (targetEpisode?.server_data?.length > 0) {
            targetServer = targetEpisode.server_data[0];
        }
    }

    return { targetEpisode, targetServer, episodeKey };
};

// ==========================================
// 8. SHAKA & PLAYER DOM HELPERS
// ==========================================
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
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.setAttribute("x5-playsinline", "true");

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

export const configureShakaUi = (player, uiContainer, video, shaka) => {
    const uiOverlay = new shaka.ui.Overlay(player, uiContainer, video);
    uiOverlay.configure({
        controlPanelElements: [
            "play_pause",
            "mute",
            "volume",
            "time_and_duration",
            "spacer",
            "language",
            "captions",
            "overflow_menu",
            "fullscreen",
        ],
        overflowMenuButtons: ["quality", "language", "captions", "playback_rate", "cast"],
        addSeekBar: true,
    });
    const controls = typeof uiOverlay.getControls === "function" ? uiOverlay.getControls() : null;
    const localization =
        (controls && typeof controls.getLocalization === "function" && controls.getLocalization()) ||
        (typeof uiOverlay.getLocalization === "function" && uiOverlay.getLocalization()) ||
        null;
    const viTranslations = {
        AD_CHIP: "Quảng cáo", AUDIO_TRACK: "Âm thanh", AUTO: "Tự động", BACK: "Quay lại",
        CAPTIONS: "Phụ đề", CAST: "Truyền", CLOSE: "Đóng", EXIT_FULL_SCREEN: "Thoát toàn màn hình",
        FULL_SCREEN: "Toàn màn hình", LANGUAGE: "Âm thanh", LIVE: "TRỰC TIẾP", MORE_SETTINGS: "Cài đặt",
        MUTE: "Tắt tiếng", OFF: "Tắt", PAUSE: "Tạm dừng", PICTURE_IN_PICTURE: "Hình trong hình",
        PLAY: "Phát", PLAYBACK_RATE: "Tốc độ phát", QUALITY: "Chất lượng", RESOLUTION: "Độ phân giải",
        REWIND: "Tua lại", SKIP_AD: "Bỏ qua quảng cáo", SUBTITLES_TRACK: "Phụ đề", UNMUTE: "Bật tiếng",
        VOLUME: "Âm lượng",
        "Phụ đề": "Phụ đề",
        "Thuyết Minh": "Thuyết Minh",
        "Thuyết minh": "Thuyết minh",
        "Lồng Tiếng": "Lồng Tiếng",
        "Lồng tiếng": "Lồng tiếng",
    };
    if (localization && typeof localization.insert === "function" && typeof localization.changeLocale === "function") {
        localization.insert("vi", new Map(Object.entries(viTranslations)));
        localization.changeLocale(["vi"]);
    }
    return uiOverlay;
};

export const injectShakaAudioVersionButton = ({
    uiContainer,
    episodes = [],
    activeEpisode,
    onSelectServer,
}) => {
    if (!uiContainer) return;

    const audioServers = (Array.isArray(episodes) ? episodes : []).filter(
        (ep) => ep?.type_id !== "trailer"
    );
    if (audioServers.length <= 1) return;

    const attachButton = () => {
        const buttonPanel = uiContainer.querySelector(".shaka-controls-button-panel");
        if (!buttonPanel) return;

        const existing = buttonPanel.querySelector(".shaka-custom-audio-btn-wrapper");
        if (existing) existing.remove();

        const overflowBtn = buttonPanel.querySelector(".shaka-overflow-menu-button");

        const wrapper = document.createElement("div");
        wrapper.className = "shaka-custom-audio-btn-wrapper relative flex items-center justify-center";
        wrapper.style.zIndex = "100";
        wrapper.style.touchAction = "manipulation";

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className =
            "shaka-custom-audio-btn flex h-9 w-9 items-center justify-center rounded-full text-white/90 hover:bg-white/20 hover:text-white transition-all cursor-pointer select-none";
        btn.style.touchAction = "manipulation";
        btn.style.webkitTapHighlightColor = "transparent";
        btn.title = "Bản dịch (Phụ đề / Thuyết minh / Lồng tiếng)";
        btn.innerHTML = `
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="m10.5 21 5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 0 1 6-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 0 1-3.827-5.802" />
            </svg>
        `;

        const menu = document.createElement("div");
        menu.className =
            "shaka-custom-audio-menu hidden absolute bottom-full mb-2 right-0 w-max min-w-[140px] rounded-xl border border-zinc-800 bg-zinc-950/98 p-1.5 shadow-2xl backdrop-blur-xl flex-col gap-1 z-50 animate-in fade-in zoom-in-95 duration-150";
        menu.style.touchAction = "manipulation";

        const menuHeader = document.createElement("div");
        menuHeader.className = "px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-zinc-400 border-b border-white/10 whitespace-nowrap";
        menuHeader.textContent = "Bản dịch";
        menu.appendChild(menuHeader);

        audioServers.forEach((serverGroup) => {
            const isSelected =
                activeEpisode?.server_name === serverGroup.server_name ||
                (!activeEpisode && serverGroup === audioServers[0]);
            const item = document.createElement("button");
            item.type = "button";
            item.className = `flex items-center justify-between gap-3 w-full px-2.5 py-1.5 text-left rounded-lg text-xs whitespace-nowrap transition-all cursor-pointer ${
                isSelected
                    ? "bg-red-600 text-white font-black shadow-sm shadow-red-600/30"
                    : "text-zinc-200 hover:bg-zinc-800 hover:text-white font-medium"
            }`;
            item.style.touchAction = "manipulation";
            item.style.webkitTapHighlightColor = "transparent";
            const displayName = extractServerType(serverGroup.server_name) || serverGroup.server_name;
            item.innerHTML = `
                <span class="whitespace-nowrap">${displayName}</span>
                ${isSelected ? '<span class="text-white font-black text-[10px] shrink-0 ml-2">✓</span>' : ""}
            `;

            const handleItemSelect = (e) => {
                e.preventDefault();
                e.stopPropagation();
                menu.classList.add("hidden");
                menu.classList.remove("flex");
                if (onSelectServer) onSelectServer(serverGroup);
            };

            item.addEventListener("click", handleItemSelect);
            item.addEventListener("touchend", handleItemSelect);

            menu.appendChild(item);
        });

        const toggleMenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isHidden = menu.classList.contains("hidden");
            document.querySelectorAll(".shaka-custom-audio-menu").forEach((m) => {
                m.classList.add("hidden");
                m.classList.remove("flex");
            });
            if (isHidden) {
                menu.classList.remove("hidden");
                menu.classList.add("flex");
            }
        };

        btn.addEventListener("click", toggleMenu);
        btn.addEventListener("touchend", toggleMenu);

        menu.addEventListener("touchstart", (e) => e.stopPropagation());
        menu.addEventListener("touchmove", (e) => e.stopPropagation());
        menu.addEventListener("touchend", (e) => e.stopPropagation());

        const closeHandler = (e) => {
            if (!wrapper.contains(e.target)) {
                menu.classList.add("hidden");
                menu.classList.remove("flex");
            }
        };
        document.addEventListener("click", closeHandler);
        document.addEventListener("touchend", closeHandler);

        wrapper.appendChild(btn);
        wrapper.appendChild(menu);

        if (overflowBtn) {
            overflowBtn.before(wrapper);
        } else {
            buttonPanel.appendChild(wrapper);
        }
    };

    attachButton();
    setTimeout(attachButton, 100);
    setTimeout(attachButton, 350);
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

// Dọn dẹp video element đang active
const destroyActiveVideo = (activeVideoElementRef) => {
    const activeVideo = activeVideoElementRef?.current;
    if (!activeVideo) return;
    try {
        activeVideo.pause();
        activeVideo.removeAttribute("src");
        activeVideo.load();
    } catch (e) {
        console.warn("Error hard-stopping active video:", e);
    } finally {
        if (activeVideoElementRef) activeVideoElementRef.current = null;
    }
};

// Dọn dẹp Shaka UI Overlay và Player
const destroyShakaInstances = async (shakaUiOverlayRef, shakaPlayerRef) => {
    if (shakaUiOverlayRef?.current) {
        try {
            shakaUiOverlayRef.current.destroy();
            shakaUiOverlayRef.current = null;
        } catch (e) {
            console.warn("Error destroying Shaka UI Overlay:", e);
        }
    }
    if (shakaPlayerRef?.current) {
        try {
            await shakaPlayerRef.current.destroy();
            shakaPlayerRef.current = null;
        } catch (e) {
            console.warn("Error destroying Shaka Player:", e);
        }
    }
};

// Thu hồi blob URL nếu có
const revokeBlobUrl = (currentUrlRef) => {
    if (!currentUrlRef?.current) return;
    const url = currentUrlRef.current;
    if (typeof url === "string" && url.startsWith("blob:")) {
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
    }
    currentUrlRef.current = null;
};

export const destroyAllPlayersHelper = async (activeVideoElementRef, shakaUiOverlayRef, shakaPlayerRef, currentUrlRef) => {
    destroyActiveVideo(activeVideoElementRef);
    await destroyShakaInstances(shakaUiOverlayRef, shakaPlayerRef);
    revokeBlobUrl(currentUrlRef);
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
    COUNTDOWN_DURATION,
}) => {
    if (!video) return;
    let lastSavedTime = 0;
    let introSkipped = false;

    video.ontimeupdate = () => {
        const currentTime = Math.floor(video.currentTime);
        if (skipIntroEnabledRef?.current && !introSkipped && video.currentTime < (introDurationRef?.current || 0)) {
            video.currentTime = introDurationRef.current;
            introSkipped = true;
        }
        if (currentTime - lastSavedTime >= 5) {
            lastSavedTime = currentTime;
            setWatchlist(episodeSlug, currentTime, { name: serverName }, movie);
        }
    };

    video.onended = () => {
        if (autoplayEnabledRef?.current) {
            setShowNextCountdown(true);
            setCountdownSeconds(COUNTDOWN_DURATION);
        }
    };
};

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
        if (url.startsWith("https://")) {
            intentUrl = url.replace("https://", "intent://");
        } else if (url.startsWith("http://")) {
            intentUrl = url.replace("http://", "intent://");
            scheme = "http";
        }
        window.location.href = `${intentUrl}#Intent;package=com.instantbits.cast.webvideo;action=android.intent.action.VIEW;scheme=${scheme};type=video/*;end;`;
    } else {
        window.open(url, "_blank");
    }
};

export const scrollHorizontalContainer = (containerRef, direction, ratio = 0.8) => {
    if (containerRef?.current) {
        const { current } = containerRef;
        const scrollAmount = current.clientWidth * ratio;
        current.scrollBy({
            left: direction === "left" ? -scrollAmount : scrollAmount,
            behavior: "smooth",
        });
    }
};
