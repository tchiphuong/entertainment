import { fetchSourceData } from "../services/vod/vodService";
import { SOURCES, getWatchPartyRoomPath } from "../constants";
import { slugify } from "./vodIdentifier";

/**
 * Thời gian tối đa giữ phòng trống trước khi tự động xoá: 1 giờ (3,600,000 ms)
 */
export const ROOM_EMPTY_EXPIRATION_MS = 60 * 60 * 1000;

/**
 * Thời gian tối đa xác định thành viên còn đang online trong phòng: 60 giây (60,000 ms)
 * Heartbeat định kỳ được gửi mỗi 15 - 20 giây. Quá 60 giây không có tín hiệu = đã offline.
 */
export const PARTICIPANT_ONLINE_TIMEOUT_MS = 60 * 1000;

/**
 * Kiểm tra xem một thành viên có đang thực sự online trong phòng không
 */
export const isParticipantOnline = (participant, now = Date.now()) => {
    if (!participant) return false;
    const lastActive = participant.lastActive || participant.joinedAt || 0;
    return (now - lastActive) <= PARTICIPANT_ONLINE_TIMEOUT_MS;
};

/**
 * Lọc danh sách thành viên đang thực sự online trong phòng
 */
export const getOnlineParticipants = (participants = {}, now = Date.now()) => {
    if (!participants || typeof participants !== "object") return {};
    const onlineMap = {};
    Object.entries(participants).forEach(([uid, p]) => {
        if (p && typeof p === "object" && isParticipantOnline(p, now)) {
            onlineMap[uid] = {
                ...p,
                uid: p.uid || uid,
            };
        }
    });
    return onlineMap;
};

/**
 * Đếm số lượng thành viên đang thực sự online trong phòng
 */
export const getOnlineParticipantCount = (participants = {}, now = Date.now()) => {
    return Object.keys(getOnlineParticipants(participants, now)).length;
};

const generateRandomLetters = (length) => {
    const alphabet = "abcdefghijklmnopqrstuvwxyz";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return result;
};

/**
 * Sinh mã phòng theo phong cách Google Meet (định dạng 3-4-3 chữ cái: ví dụ 'abc-defg-hij')
 */
export const generateRoomCode = () => {
    const part1 = generateRandomLetters(3);
    const part2 = generateRandomLetters(4);
    const part3 = generateRandomLetters(3);
    return `${part1}-${part2}-${part3}`;
};

/**
 * Phân tích và trích xuất mã phòng từ văn bản, liên kết URL hoặc mã QR
 * Hỗ trợ định dạng Google Meet (3-4-3: ví dụ 'abc-defg-hij') và tương thích ngược (WP-XXXXXX)
 */
export const parseRoomCodeFromText = (rawText) => {
    if (!rawText || typeof rawText !== "string") return "";
    const clean = rawText.trim();

    // 1. Nếu dán liên kết URL: /watch-party/abc-defg-hij hoặc /watch-party/WP-XXXXXX
    const matchUrl = clean.match(/watch-party\/([a-z0-9_-]+)/i);
    if (matchUrl?.[1]) {
        return matchUrl[1].toLowerCase();
    }

    // 2. Định dạng Google Meet: 3 chữ cái - 4 chữ cái - 3 chữ cái (ví dụ: abc-defg-hij)
    const matchMeet = clean.match(/\b([a-z]{3}-[a-z]{4}-[a-z]{3})\b/i);
    if (matchMeet?.[1]) {
        return matchMeet[1].toLowerCase();
    }

    // 3. Nếu người dùng nhập liền 10 chữ cái không có dấu gạch ngang (ví dụ: abcdefghij)
    const match10 = clean.match(/^[a-z]{10}$/i);
    if (match10) {
        const lower = clean.toLowerCase();
        return `${lower.slice(0, 3)}-${lower.slice(3, 7)}-${lower.slice(7, 10)}`;
    }

    // 4. Tương thích ngược với mã phòng cũ định dạng WP-XXXXXX
    const matchLegacy = clean.match(/\b(WP-[A-Z0-9]{4,8})\b/i);
    if (matchLegacy?.[1]) {
        return matchLegacy[1].toUpperCase();
    }

    return clean.toLowerCase();
};

/**
 * Băm mật khẩu phòng bằng chuẩn SHA-256 (Web Crypto API)
 */
export const hashWatchPartyPassword = async (rawPassword) => {
    if (!rawPassword || typeof rawPassword !== "string") return "";
    const clean = rawPassword.trim();
    if (!clean) return "";

    const msgUint8 = new TextEncoder().encode(`WP_VOD_SALT_${clean}`);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
};

/**
 * Kiểm tra tính hợp lệ của mật khẩu phòng (hỗ trợ hash SHA-256 và fallback)
 */
export const verifyWatchPartyPassword = async (roomData, inputPassword) => {
    if (!roomData?.hasPassword) return true;
    const roomHash = roomData.passwordHash || roomData.settings?.passwordHash;
    const legacyPass = roomData.password || roomData.settings?.password;

    if (roomHash) {
        const inputHash = inputPassword ? await hashWatchPartyPassword(inputPassword) : "";
        return inputHash === roomHash || inputPassword === roomHash;
    }

    if (legacyPass) {
        return inputPassword === legacyPass;
    }

    return true;
};

/**
 * Kiểm tra xem phòng có bị hết hạn tự động xoá do không có người sau 1 giờ không
 */
export const isRoomExpired = (roomData, now = Date.now()) => {
    if (!roomData) return false;
    const onlineCount = getOnlineParticipantCount(roomData.participants, now);

    if (onlineCount > 0) return false;

    const emptyAt = roomData.emptyAt;
    if (typeof emptyAt === "number") {
        return now - emptyAt >= ROOM_EMPTY_EXPIRATION_MS;
    }

    return false;
};

/**
 * Format thời lượng video từ giây sang mm:ss hoặc hh:mm:ss
 */
export const formatVideoSeconds = (sec) => {
    if (typeof sec !== "number" || Number.isNaN(sec) || sec < 0) return "";
    const totalSec = Math.floor(sec);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n) => String(n).padStart(2, "0");

    if (h > 0) {
        return `${h}:${pad(m)}:${pad(s)}`;
    }
    return `${m}:${pad(s)}`;
};

/**
 * Format thời gian hiển thị tin nhắn chat theo múi giờ GMT+7 (Việt Nam: HH:mm)
 */
export const formatChatTimeGMT7 = (timestamp) => {
    if (!timestamp) return "";
    let date = null;
    if (typeof timestamp === "number") {
        date = new Date(timestamp);
    } else if (timestamp?.toDate && typeof timestamp.toDate === "function") {
        date = timestamp.toDate();
    } else {
        date = new Date(timestamp);
    }

    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(date);
};

/**
 * Tính toán mốc thời gian phát chuẩn xác đến từng mili-giây
 * Chống trôi thời gian và chặn lỗi lệch đồng hồ hệ thống vượt quá độ dài phim
 */
export const calculateSynchronizedTime = (playback, now = Date.now(), maxDuration = Infinity) => {
    if (!playback) return 0;
    const currentTime = Number(playback.currentTime) || 0;
    const isPlaying = Boolean(playback.isPlaying);
    const lastUpdated = Number(playback.lastUpdated) || 0;

    const safeMax = maxDuration > 2 ? maxDuration - 2 : maxDuration;
    if (!isPlaying || !lastUpdated) {
        return Math.max(0, Math.min(safeMax, currentTime));
    }

    const rawDiff = (now - lastUpdated) / 1000;
    // Chặn độ lệch âm hoặc lệch bất thường > 6s (nhịp heartbeat 5s) để chống lệch đồng hồ hoặc lag mạng làm video tự tua dồn dập đến hết phim
    const safeElapsed = rawDiff > 0 && rawDiff <= 6 ? rawDiff : 0;
    const computedTime = currentTime + safeElapsed;

    return Math.max(0, Math.min(safeMax, computedTime));
};

const adjustVideoTimeAndRate = (video, targetTime, isTargetPlaying, diff, options) => {
    const hardSeek = options.hardSeekThreshold ?? 1.5;
    const rateAdjust = options.rateAdjustThreshold ?? 0.1;

    if (diff > hardSeek) {
        video.currentTime = targetTime;
        video.playbackRate = 1.0;
        return;
    }

    if (diff > rateAdjust && isTargetPlaying && !video.paused) {
        video.playbackRate = targetTime > video.currentTime ? 1.05 : 0.95;
        return;
    }

    video.playbackRate = 1.0;
};

const syncVideoPlayState = (video, isTargetPlaying) => {
    if (isTargetPlaying && video.paused) {
        video.play().catch(() => {});
    } else if (!isTargetPlaying && !video.paused) {
        video.pause();
    }
};

/**
 * Áp dụng đồng bộ mốc thời gian cho thẻ video với độ chính xác cao
 */
export const applyPreciseVideoSync = (video, targetTime, isTargetPlaying, options = {}) => {
    if (!video || typeof targetTime !== "number" || Number.isNaN(targetTime)) return;

    const maxDur = video.duration && !Number.isNaN(video.duration) ? video.duration : Infinity;
    const safeTargetTime = Math.max(0, Math.min(maxDur, targetTime));

    const diff = Math.abs(video.currentTime - safeTargetTime);
    adjustVideoTimeAndRate(video, safeTargetTime, isTargetPlaying, diff, options);
    syncVideoPlayState(video, isTargetPlaying);
};

/**
 * Mở khóa quyền tự động phát âm thanh trên trình duyệt người dùng
 */
export const unlockAudioElement = (audioEl) => {
    if (!audioEl) return;
    const handleUnlock = () => {
        audioEl.play().catch(() => {});
    };
    window.addEventListener("click", handleUnlock, { once: true });
    window.addEventListener("keydown", handleUnlock, { once: true });
};

export const sanitizeMovieInfo = (movie) => {
    if (!movie) {
        return { slug: "", name: "", origin_name: "", thumb_url: "", poster_url: "" };
    }
    const thumb = movie.thumb_url || movie.poster_url || "";
    return {
        slug: movie.slug || "",
        name: movie.name || "",
        origin_name: movie.origin_name || "",
        thumb_url: thumb,
        poster_url: movie.poster_url || "",
    };
};

const sanitizeEpisodeInfo = (episode) => {
    if (!episode) {
        return { name: "Tập 1", slug: "tap-1", server_name: "Vietsub", link_m3u8: "", link_embed: "" };
    }
    return {
        name: episode.name || "Tập 1",
        slug: episode.slug || "tap-1",
        server_name: episode.server_name || "Vietsub",
        link_m3u8: episode.link_m3u8 || "",
        link_embed: episode.link_embed || "",
    };
};

/**
 * Chuẩn hóa payload phim và tập phim được chọn trước từ trang chi tiết
 */
export const buildPrefillPayload = (prefillMovie, prefillEpisode) => ({
    movie: sanitizeMovieInfo(prefillMovie),
    episode: sanitizeEpisodeInfo(prefillEpisode),
});

/**
 * Trích xuất tập phim đầu tiên khả dụng từ danh sách server
 */
export const extractFirstEpisode = (episodes) => {
    if (!Array.isArray(episodes) || episodes.length === 0) return null;
    const server = episodes[0];
    const serverData = server?.server_data;
    if (!Array.isArray(serverData) || serverData.length === 0) return null;
    const ep = serverData[0];
    return {
        name: ep.name || "Tập 1",
        slug: ep.slug || "tap-1",
        server_name: server.server_name || "Vietsub",
        link_m3u8: ep.link_m3u8 || "",
        link_embed: ep.link_embed || "",
    };
};

/**
 * Chuẩn hóa và trích xuất slug phim hợp lệ từ tên phim, đường dẫn hoặc liên kết web
 */
export const extractCleanMovieSlug = (rawInput) => {
    if (!rawInput || typeof rawInput !== "string") return "";
    const clean = rawInput.trim();

    // Nếu người dùng dán link dạng /phim/truc-ngoc hoặc /play/truc-ngoc
    const urlMatch = clean.match(/\/(?:phim|play)\/([a-z0-9_-]+)/i);
    if (urlMatch?.[1]) {
        return urlMatch[1].toLowerCase();
    }

    // Nếu là tên tiếng Việt hoặc chuỗi có khoảng trắng -> slugify chuẩn
    return slugify(clean);
};

const fetchBestSourceData = async (slug) => {
    if (!slug) return null;
    try {
        const sourceK = await fetchSourceData(slug, SOURCES.SOURCE_K);
        if (sourceK?.movie) return sourceK;
        return await fetchSourceData(slug, SOURCES.SOURCE_O);
    } catch {
        return null;
    }
};

const applySourceDataToPayload = (payload, sourceData) => {
    if (!sourceData) return;
    if (sourceData.movie) {
        payload.movie = sanitizeMovieInfo(sourceData.movie);
    }
    const ep = extractFirstEpisode(sourceData.episodes);
    if (ep) {
        payload.episode = ep;
    }
};

export const isDirectStreamUrl = (url) => {
    if (!url || typeof url !== "string") return false;
    const clean = url.trim().toLowerCase();
    const isHttp = clean.startsWith("http://") || clean.startsWith("https://");
    if (!isHttp) return false;
    return clean.includes(".m3u8") || clean.includes(".mpd") || clean.includes("/m3u8") || clean.includes("/mpd");
};

export const createCustomStreamPayload = (streamUrl, customTitle = "") => {
    const cleanUrl = streamUrl.trim();
    const isMpd = cleanUrl.toLowerCase().includes(".mpd");
    const streamType = isMpd ? "DASH (MPD)" : "HLS (M3U8)";
    const title = customTitle?.trim() || (isMpd ? "Luồng trực tiếp DASH (.mpd)" : "Luồng trực tiếp HLS (.m3u8)");

    return {
        movie: {
            slug: `stream-${Date.now()}`,
            name: title,
            origin_name: streamType,
            thumb_url: "",
            poster_url: "",
            isCustomStream: true,
        },
        episode: {
            name: "Trực tiếp",
            slug: "live-stream",
            server_name: streamType,
            link_m3u8: cleanUrl,
            link_embed: "",
        },
    };
};

/**
 * Xử lý và chuẩn bị dữ liệu phim và tập phim để tạo phòng xem chung mới
 */
export const resolveMovieAndEpisodePayload = async (rawSlug, prefillMovie, prefillEpisode, customTitle = "") => {
    const input = String(rawSlug || "").trim();

    // Tự động nhận diện link stream m3u8 hoặc mpd dán trực tiếp
    if (isDirectStreamUrl(input)) {
        return createCustomStreamPayload(input, customTitle);
    }

    const slug = extractCleanMovieSlug(input) || input;

    if (prefillMovie && prefillMovie.slug === slug && prefillEpisode) {
        return buildPrefillPayload(prefillMovie, prefillEpisode);
    }

    const payload = {
        movie: { slug, name: prefillMovie?.name || `Phim ${input}`, thumb_url: "" },
        episode: { name: "Tập 1", slug: "tap-1", server_name: "Vietsub", link_m3u8: "" },
    };

    if (!slug) return payload;

    const sourceData = await fetchBestSourceData(slug);
    applySourceDataToPayload(payload, sourceData);

    return payload;
};

/**
 * Lấy liên kết tuyệt đối đầy đủ của phòng xem chung để chia sẻ hoặc tạo mã QR
 * Tự động tính đúng base URL của ứng dụng (ví dụ /entertainment/ trên GitHub Pages hoặc / trên localhost)
 */
export const getWatchPartyShareUrl = (roomId) => {
    if (!roomId) return "";
    const roomPath = getWatchPartyRoomPath(roomId);
    if (typeof window === "undefined") return roomPath;

    const base = import.meta.env.BASE_URL || "/";
    const cleanBase = base.endsWith("/") ? base.slice(0, -1) : base;
    const cleanPath = roomPath.startsWith("/") ? roomPath : `/${roomPath}`;

    return `${window.location.origin}${cleanBase}${cleanPath}`;
};

