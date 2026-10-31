import {
    doc,
    collection,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    addDoc,
    serverTimestamp,
    query,
    orderBy,
    limit,
} from "firebase/firestore";
import { db } from "../firebase";
import {
    generateRoomCode,
    parseRoomCodeFromText,
    hashWatchPartyPassword,
    verifyWatchPartyPassword,
    isRoomExpired,
    ROOM_EMPTY_EXPIRATION_MS,
    PARTICIPANT_ONLINE_TIMEOUT_MS,
    isParticipantOnline,
    getOnlineParticipants,
    getOnlineParticipantCount,
    sanitizeMovieInfo,
} from "../../utils/watchPartyUtils";

export {
    generateRoomCode,
    parseRoomCodeFromText,
    hashWatchPartyPassword,
    verifyWatchPartyPassword,
    isRoomExpired,
    ROOM_EMPTY_EXPIRATION_MS,
    PARTICIPANT_ONLINE_TIMEOUT_MS,
    isParticipantOnline,
    getOnlineParticipants,
    getOnlineParticipantCount,
};

const ROOMS_COLLECTION = "watch_party_rooms";
const MESSAGES_SUB_COLLECTION = "messages";

const buildRoomMovieData = (movie) => {
    const raw = movie || {};
    const thumb = raw.thumb_url || raw.poster_url || "";
    return {
        slug: raw.slug || "",
        name: raw.name || "Chưa chọn phim",
        origin_name: raw.origin_name || "",
        thumb_url: thumb,
        poster_url: raw.poster_url || "",
    };
};

const buildRoomEpisodeData = (episode) => {
    const raw = episode || {};
    return {
        name: raw.name || "Tập 1",
        slug: raw.slug || "tap-1",
        server_name: raw.server_name || "Vietsub",
        link_m3u8: raw.link_m3u8 || "",
        link_embed: raw.link_embed || "",
    };
};

const buildHostParticipant = (hostUser) => ({
    uid: hostUser.uid,
    name: hostUser.displayName || "Chủ phòng",
    avatar: hostUser.photoURL || "",
    isHost: true,
    joinedAt: Date.now(),
    lastActive: Date.now(),
    micEnabled: false,
    camEnabled: false,
});

/**
 * Tạo phòng xem chung mới
 */
export const createWatchPartyRoom = async ({
    movie,
    episode,
    hostUser,
    password = "",
    customSettings = {},
}) => {
    if (!hostUser?.uid) {
        throw new Error("Cần thông tin người dùng để tạo phòng xem chung.");
    }
    const roomId = generateRoomCode();
    const roomRef = doc(db, ROOMS_COLLECTION, roomId);
    const cleanPassword = typeof password === "string" ? password.trim() : "";
    const passwordHash = cleanPassword ? await hashWatchPartyPassword(cleanPassword) : "";

    const initialSettings = {
        controlMode: "host_only",
        allowChat: true,
        allowWebcam: true,
        autoSync: true,
        emptyAutoDelete: true,
        hasPassword: !!passwordHash,
        passwordHash,
        ...customSettings,
    };
    delete initialSettings.password;

    const hostParticipant = buildHostParticipant(hostUser);

    const roomData = {
        roomId,
        hostId: hostUser.uid,
        hostName: hostUser.displayName || "Chủ phòng",
        hasPassword: !!passwordHash,
        passwordHash,
        movie: buildRoomMovieData(movie),
        episode: buildRoomEpisodeData(episode),
        playback: {
            isPlaying: true,
            currentTime: 0,
            lastUpdated: Date.now(),
            updatedBy: hostUser.uid,
        },
        settings: initialSettings,
        participants: {
            [hostUser.uid]: hostParticipant,
        },
        participantCount: 1,
        emptyAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    await setDoc(roomRef, roomData);
    return roomId;
};

/**
 * Lấy dữ liệu chi tiết của một phòng (tự động xoá nếu phòng trống đã quá 1 giờ)
 */
export const getWatchPartyRoom = async (roomId) => {
    if (!roomId) return null;
    const roomRef = doc(db, ROOMS_COLLECTION, roomId);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return null;
    const data = snap.data();

    // Nếu phòng trống đã quá 1 giờ -> tự động xoá phòng khỏi Firestore
    if (isRoomExpired(data)) {
        await deleteDoc(roomRef).catch(() => {});
        return null;
    }

    return data;
};

/**
 * Xóa phòng (sử dụng khi chủ phòng chủ động giải tán hoặc không còn ai)
 */
export const deleteWatchPartyRoom = async (roomId) => {
    if (!roomId) return;
    try {
        const roomRef = doc(db, ROOMS_COLLECTION, roomId);
        await deleteDoc(roomRef);
    } catch (err) {
        console.warn(`Không thể xóa phòng ${roomId}:`, err);
    }
};

const resolveIsHostAndActualUid = (roomData, user, roomId) => {
    let isCreator = false;
    try {
        const stored = sessionStorage.getItem(`wp_creator_${roomId}`);
        if (stored && (stored === roomData.hostId || stored === user?.uid)) {
            isCreator = true;
        }
    } catch {}

    const isHost = roomData.hostId === user?.uid || isCreator;
    const actualUid = isHost ? roomData.hostId : user?.uid;
    return { isHost, actualUid };
};

const validateRoomPassword = async (roomData, isHost, inputPassword) => {
    if (!roomData.hasPassword || isHost) return;
    const isValid = await verifyWatchPartyPassword(roomData, inputPassword);
    if (!isValid) {
        const err = new Error("Mật khẩu phòng không chính xác.");
        err.code = "INCORRECT_PASSWORD";
        throw err;
    }
};

const buildParticipantRecord = (actualUid, user, isHost, roomData, currentParticipants) => {
    const existing = currentParticipants[actualUid] || {};
    const fallbackName = isHost ? (roomData.hostName || "Chủ phòng") : `Thành viên #${Object.keys(currentParticipants).length + 1}`;
    return {
        uid: actualUid,
        name: user.displayName || fallbackName,
        avatar: user.photoURL || existing.avatar || "",
        isHost,
        joinedAt: existing.joinedAt || Date.now(),
        lastActive: Date.now(),
        micEnabled: Boolean(existing.micEnabled),
        camEnabled: Boolean(existing.camEnabled),
    };
};

const buildUpdatedParticipants = (currentParticipants, user, actualUid, isHost, participantInfo, hostId) => {
    const result = { ...currentParticipants };
    if (isHost && user.uid !== hostId && result[user.uid]) {
        delete result[user.uid];
    }
    result[actualUid] = participantInfo;
    return result;
};

/**
 * Tham gia vào phòng xem chung (có kiểm tra mật khẩu)
 */
export const joinWatchPartyRoom = async (roomId, user, inputPassword = "") => {
    const roomRef = doc(db, ROOMS_COLLECTION, roomId);
    const snap = await getDoc(roomRef);

    if (!snap.exists()) {
        throw new Error("Phòng xem chung không tồn tại hoặc đã tự động đóng.");
    }

    const roomData = snap.data();
    if (isRoomExpired(roomData)) {
        await deleteDoc(roomRef).catch(() => {});
        throw new Error("Phòng xem chung đã tự động xoá do không có người tham gia sau 1 giờ.");
    }

    const { isHost, actualUid } = resolveIsHostAndActualUid(roomData, user, roomId);

    if (!isHost && Array.isArray(roomData.bannedUids) && roomData.bannedUids.includes(actualUid)) {
        throw new Error("BANNED_FROM_ROOM: Bạn đã bị Trưởng phòng chặn khỏi phòng xem này.");
    }

    await validateRoomPassword(roomData, isHost, inputPassword);

    const currentParticipants = { ...(roomData.participants || {}) };
    const participantInfo = buildParticipantRecord(actualUid, user, isHost, roomData, currentParticipants);
    const updatedParticipants = buildUpdatedParticipants(
        currentParticipants,
        user,
        actualUid,
        isHost,
        participantInfo,
        roomData.hostId
    );

    await updateDoc(roomRef, {
        participants: updatedParticipants,
        participantCount: Object.keys(updatedParticipants).length,
        emptyAt: null,
        updatedAt: serverTimestamp(),
    });

    return roomData;
};

/**
 * Rời phòng xem chung
 * Cơ chế dọn phòng trống: Nếu số lượng người tham gia về 0 -> ghi nhận emptyAt để tự động xoá sau 1 giờ
 */
export const leaveWatchPartyRoom = async (roomId, userId) => {
    if (!roomId || !userId) return;

    try {
        const roomRef = doc(db, ROOMS_COLLECTION, roomId);
        const snap = await getDoc(roomRef);
        if (!snap.exists()) return;

        const roomData = snap.data();
        const currentParticipants = { ...roomData.participants };
        if (!currentParticipants[userId]) return;
        delete currentParticipants[userId];

        const remainingCount = Object.keys(currentParticipants).length;

        // Nếu phòng không còn ai -> Ghi nhận emptyAt để tự động xoá sau 1 giờ trống
        if (remainingCount === 0) {
            await updateDoc(roomRef, {
                participants: {},
                participantCount: 0,
                emptyAt: Date.now(),
                updatedAt: serverTimestamp(),
            });
            return;
        }

        // Nếu người rời phòng là Host, chuyển quyền Host cho người kế tiếp
        let newHostId = roomData.hostId;
        let newHostName = roomData.hostName;

        if (roomData.hostId === userId) {
            const nextHostUid = Object.keys(currentParticipants)[0];
            if (nextHostUid && currentParticipants[nextHostUid]) {
                currentParticipants[nextHostUid].isHost = true;
                newHostId = nextHostUid;
                newHostName = currentParticipants[nextHostUid].name;
            }
        }

        await updateDoc(roomRef, {
            participants: currentParticipants,
            participantCount: remainingCount,
            hostId: newHostId,
            hostName: newHostName,
            updatedAt: serverTimestamp(),
        });
    } catch (err) {
        console.warn(`Lỗi khi rời phòng ${roomId}:`, err);
    }
};

const parsePlaybackParams = (options, maybeTime, maybeUser) => {
    const isPlaying = typeof options === "boolean" ? options : Boolean(options?.isPlaying);
    const currentTime = typeof maybeTime === "number" ? maybeTime : (Number(options?.currentTime) || 0);
    const updatedBy = maybeUser || options?.updatedBy || "";
    const episode = typeof options === "object" ? options?.episode : null;
    const tabId = options?.tabId || "";
    return { isPlaying, currentTime, updatedBy, episode, tabId };
};

const buildPlaybackEpisodePayload = (episode) => {
    if (!episode) return null;
    return {
        name: episode.name || "",
        slug: episode.slug || "",
        server_name: episode.server_name || "",
        link_m3u8: episode.link_m3u8 || "",
        link_embed: episode.link_embed || "",
    };
};

/**
 * Cập nhật trạng thái phát video (Play, Pause, Tua thời gian)
 */
export const updateWatchPartyPlayback = async (roomId, options = {}, maybeTime, maybeUser) => {
    if (!roomId) return;
    const roomRef = doc(db, ROOMS_COLLECTION, roomId);
    const { isPlaying, currentTime, updatedBy, episode, tabId } = parsePlaybackParams(options, maybeTime, maybeUser);

    const payload = {
        "playback.isPlaying": isPlaying,
        "playback.currentTime": currentTime,
        "playback.lastUpdated": Date.now(),
        "playback.updatedBy": updatedBy,
        "playback.tabId": tabId,
        updatedAt: serverTimestamp(),
    };

    const epData = buildPlaybackEpisodePayload(episode);
    if (epData) {
        payload.episode = epData;
    }

    await updateDoc(roomRef, payload);
};

/**
 * Cập nhật cấu hình phòng (Settings) an toàn không ghi đè mất các thiết lập khác
 */
export const updateWatchPartySettings = async (roomId, newSettings) => {
    if (!roomId || !newSettings) return;
    const roomRef = doc(db, ROOMS_COLLECTION, roomId);
    const payload = { ...newSettings };

    if (payload.password) {
        payload.passwordHash = await hashWatchPartyPassword(payload.password);
        payload.hasPassword = !!payload.passwordHash;
        delete payload.password;
    } else if (payload.hasPassword === false) {
        payload.passwordHash = "";
        delete payload.password;
    }

    const docUpdates = {
        updatedAt: serverTimestamp(),
    };

    // Dùng dot notation cập nhật từng thuộc tính trong settings để không ghi đè mất cài đặt khác
    Object.entries(payload).forEach(([key, val]) => {
        docUpdates[`settings.${key}`] = val;
    });

    if (typeof payload.hasPassword === "boolean") {
        docUpdates.hasPassword = payload.hasPassword;
        docUpdates.passwordHash = payload.passwordHash || "";
    }

    await updateDoc(roomRef, docUpdates);
};

/**
 * Cập nhật trạng thái Camera / Micro của một thành viên
 */
export const updateWatchPartyMediaState = async (roomId, userId, { micEnabled, camEnabled }) => {
    if (!roomId || !userId) return;
    const roomRef = doc(db, ROOMS_COLLECTION, roomId);

    const updates = {};
    if (typeof micEnabled === "boolean") {
        updates[`participants.${userId}.micEnabled`] = micEnabled;
    }
    if (typeof camEnabled === "boolean") {
        updates[`participants.${userId}.camEnabled`] = camEnabled;
    }
    updates[`participants.${userId}.lastActive`] = Date.now();

    await updateDoc(roomRef, updates);
};

/**
 * Heartbeat định kỳ để duy trì kết nối của thành viên
 */
export const heartbeatParticipant = async (roomId, userId) => {
    if (!roomId || !userId) return;
    try {
        const roomRef = doc(db, ROOMS_COLLECTION, roomId);
        await updateDoc(roomRef, {
            [`participants.${userId}.lastActive`]: Date.now(),
        });
    } catch {
        // Bỏ qua lỗi heartbeat ngầm
    }
};

/**
 * Cập nhật tên hiển thị của thành viên trong phòng (hỗ trợ khách đổi tên)
 */
export const updateWatchPartyParticipantName = async (roomId, userId, newName) => {
    if (!roomId || !userId || !newName?.trim()) return;
    try {
        const roomRef = doc(db, ROOMS_COLLECTION, roomId);
        const cleanName = newName.trim().substring(0, 30);
        const updates = {
            [`participants.${userId}.name`]: cleanName,
            [`participants.${userId}.lastActive`]: Date.now(),
        };

        const roomSnap = await getDoc(roomRef);
        if (roomSnap.exists() && roomSnap.data().hostId === userId) {
            updates.hostName = cleanName;
        }

        await updateDoc(roomRef, updates);
    } catch (err) {
        console.warn("Lỗi cập nhật tên thành viên:", err);
    }
};

/**
 * Đổi tập phim cho cả phòng xem chung
 */
export const changeWatchPartyEpisode = async (roomId, newEpisode) => {
    if (!roomId || !newEpisode) return;
    try {
        const roomRef = doc(db, ROOMS_COLLECTION, roomId);
        await updateDoc(roomRef, {
            episode: buildRoomEpisodeData(newEpisode),
            playback: {
                isPlaying: true,
                currentTime: 0,
                lastUpdated: Date.now(),
                updatedBy: "host",
            },
            updatedAt: serverTimestamp(),
        });
    } catch (err) {
        console.warn("Lỗi đổi tập phim trong phòng:", err);
        throw err;
    }
};

/**
 * Đổi phim khác cho cả phòng xem chung
 */
export const changeWatchPartyMovie = async (roomId, newMovie, newEpisode = null) => {
    if (!roomId || !newMovie) return;
    try {
        const roomRef = doc(db, ROOMS_COLLECTION, roomId);
        const moviePayload = sanitizeMovieInfo(newMovie);
        const updates = {
            movie: moviePayload,
            playback: {
                isPlaying: true,
                currentTime: 0,
                lastUpdated: Date.now(),
                updatedBy: "host",
            },
            updatedAt: serverTimestamp(),
        };

        if (newEpisode) {
            updates.episode = buildRoomEpisodeData(newEpisode);
        }

        await updateDoc(roomRef, updates);
    } catch (err) {
        console.warn("Lỗi đổi phim trong phòng xem chung:", err);
        throw err;
    }
};

/**
 * Cấp hoặc thu hồi quyền điều khiển video cho thành viên xem chung
 */
export const updateParticipantControlPermission = async (roomId, targetUid, canControl) => {
    if (!roomId || !targetUid) return;
    try {
        const roomRef = doc(db, ROOMS_COLLECTION, roomId);
        await updateDoc(roomRef, {
            [`participants.${targetUid}.canControl`]: !!canControl,
        });
    } catch (err) {
        console.warn("Lỗi cập nhật quyền điều khiển:", err);
        throw err;
    }
};

/**
 * Chuyển giao quyền Trưởng phòng cho thành viên khác
 */
export const transferWatchPartyHost = async (roomId, newHostUid) => {
    if (!roomId || !newHostUid) return;
    try {
        const roomRef = doc(db, ROOMS_COLLECTION, roomId);
        const snap = await getDoc(roomRef);
        if (!snap.exists()) return;
        const data = snap.data();
        const currentHostUid = data.hostId;
        const newHostName = data.participants?.[newHostUid]?.name || "Chủ phòng";

        const updates = {
            hostId: newHostUid,
            hostName: newHostName,
            [`participants.${newHostUid}.isHost`]: true,
            [`participants.${newHostUid}.canControl`]: true,
        };
        if (currentHostUid && data.participants?.[currentHostUid]) {
            updates[`participants.${currentHostUid}.isHost`] = false;
        }

        await updateDoc(roomRef, updates);
    } catch (err) {
        console.warn("Lỗi chuyển giao quyền trưởng phòng:", err);
        throw err;
    }
};

/**
 * Trưởng phòng mời một thành viên ra khỏi phòng xem (Kick)
 */
export const kickWatchPartyParticipant = async (roomId, targetUid, hostUid, targetName = "") => {
    if (!roomId || !targetUid || !hostUid || targetUid === hostUid) return;
    try {
        const roomRef = doc(db, ROOMS_COLLECTION, roomId);
        const snap = await getDoc(roomRef);
        if (!snap.exists()) return;
        const data = snap.data();
        if (data.hostId !== hostUid) {
            throw new Error("Chỉ Trưởng phòng mới có quyền mời thành viên ra khỏi phòng.");
        }
        const updatedParticipants = { ...(data.participants || {}) };
        delete updatedParticipants[targetUid];

        await updateDoc(roomRef, {
            participants: updatedParticipants,
            participantCount: Object.keys(updatedParticipants).length,
            lastKickEvent: {
                uid: targetUid,
                name: targetName || "Thành viên",
                isBanned: false,
                timestamp: Date.now(),
            },
        });
    } catch (err) {
        console.warn("Lỗi kick thành viên:", err);
        throw err;
    }
};

const buildUpdatedBannedLists = (data, targetUid, targetName) => {
    const existingUids = Array.isArray(data.bannedUids) ? data.bannedUids : [];
    const updatedUids = Array.from(new Set([...existingUids, targetUid]));

    const existingUsers = Array.isArray(data.bannedUsers) ? data.bannedUsers : [];
    const filteredUsers = existingUsers.filter((u) => u.uid !== targetUid);
    const participantName = data.participants?.[targetUid]?.name;
    const resolvedName = targetName || participantName || "Thành viên";

    const updatedUsers = [
        ...filteredUsers,
        { uid: targetUid, name: resolvedName, bannedAt: Date.now() },
    ];

    return { updatedUids, updatedUsers, resolvedName };
};

/**
 * Trưởng phòng chặn một thành viên vĩnh viễn khỏi phòng xem (Ban)
 */
export const banWatchPartyParticipant = async (roomId, targetUid, hostUid, targetName = "") => {
    if (!roomId || !targetUid || !hostUid || targetUid === hostUid) return;
    try {
        const roomRef = doc(db, ROOMS_COLLECTION, roomId);
        const snap = await getDoc(roomRef);
        if (!snap.exists()) return;
        const data = snap.data();
        if (data.hostId !== hostUid) {
            throw new Error("Chỉ Trưởng phòng mới có quyền chặn thành viên khỏi phòng.");
        }
        const updatedParticipants = { ...(data.participants || {}) };
        delete updatedParticipants[targetUid];

        const { updatedUids, updatedUsers, resolvedName } = buildUpdatedBannedLists(data, targetUid, targetName);

        await updateDoc(roomRef, {
            participants: updatedParticipants,
            participantCount: Object.keys(updatedParticipants).length,
            bannedUids: updatedUids,
            bannedUsers: updatedUsers,
            lastKickEvent: {
                uid: targetUid,
                name: resolvedName,
                isBanned: true,
                timestamp: Date.now(),
            },
        });
    } catch (err) {
        console.warn("Lỗi chặn thành viên:", err);
        throw err;
    }
};

/**
 * Trưởng phòng gỡ bỏ lệnh chặn một thành viên (Unban)
 */
export const unbanWatchPartyParticipant = async (roomId, targetUid, hostUid) => {
    if (!roomId || !targetUid || !hostUid) return;
    try {
        const roomRef = doc(db, ROOMS_COLLECTION, roomId);
        const snap = await getDoc(roomRef);
        if (!snap.exists()) return;
        const data = snap.data();
        if (data.hostId !== hostUid) {
            throw new Error("Chỉ Trưởng phòng mới có quyền bỏ chặn thành viên.");
        }
        const updatedBannedUids = (data.bannedUids || []).filter((uid) => uid !== targetUid);
        const updatedBannedUsers = (data.bannedUsers || []).filter((u) => u.uid !== targetUid);

        await updateDoc(roomRef, {
            bannedUids: updatedBannedUids,
            bannedUsers: updatedBannedUsers,
        });
    } catch (err) {
        console.warn("Lỗi bỏ chặn thành viên:", err);
        throw err;
    }
};

const extractSenderInfo = (payload) => {
    const sender = payload.sender;
    const senderId = payload.senderId || sender?.uid || "";
    const senderName = payload.senderName || sender?.name || sender?.displayName || "Ẩn danh";
    const avatar = payload.avatar || sender?.photoURL || "";
    return { senderId, senderName, avatar };
};

const extractTimestamp = (payload) => {
    const raw = payload.videoTimestamp ?? payload.timestampSeconds;
    return typeof raw === "number" ? Math.floor(raw) : null;
};

const extractReplyTo = (payload) => {
    if (!payload?.replyTo || typeof payload.replyTo !== "object") return null;
    return {
        id: payload.replyTo.id || "",
        senderName: payload.replyTo.senderName || "",
        text: (payload.replyTo.text || "").substring(0, 100),
    };
};

const resolveMessagePayload = (roomIdOrPayload, maybePayload) => {
    const isString = typeof roomIdOrPayload === "string";
    const roomId = isString ? roomIdOrPayload : roomIdOrPayload?.roomId;
    const payload = isString ? (maybePayload || {}) : (roomIdOrPayload || {});

    const { senderId, senderName, avatar } = extractSenderInfo(payload);
    const text = (payload.text || "").trim();
    const videoTimestamp = extractTimestamp(payload);
    const replyTo = extractReplyTo(payload);
    const isSystem = Boolean(payload.isSystem);

    return { roomId, senderId, senderName, avatar, text, videoTimestamp, replyTo, isSystem };
};

/**
 * Gửi tin nhắn chat trong phòng (hỗ trợ trích dẫn replyTo chuẩn Zoom)
 */
export const sendWatchPartyMessage = async (roomIdOrPayload, maybePayload) => {
    const { roomId, senderId, senderName, avatar, text, videoTimestamp, replyTo, isSystem } = resolveMessagePayload(roomIdOrPayload, maybePayload);
    if (!roomId || !text) return;

    const messagesRef = collection(db, ROOMS_COLLECTION, roomId, MESSAGES_SUB_COLLECTION);
    const messageDoc = {
        senderId,
        senderName,
        avatar,
        text,
        videoTimestamp,
        isSystem,
        createdAt: serverTimestamp(),
        timestamp: Date.now(),
    };
    if (replyTo) {
        messageDoc.replyTo = replyTo;
    }
    await addDoc(messagesRef, messageDoc);
};

/**
 * Cập nhật trạng thái Giơ tay phát biểu (Raise Hand) chuẩn Zoom
 */
export const updateWatchPartyRaiseHand = async (roomId, userId, isHandRaised) => {
    if (!roomId || !userId) return;
    try {
        const roomRef = doc(db, ROOMS_COLLECTION, roomId);
        await updateDoc(roomRef, {
            [`participants.${userId}.isHandRaised`]: Boolean(isHandRaised),
            [`participants.${userId}.lastActive`]: Date.now(),
        });
    } catch (err) {
        console.warn("Lỗi cập nhật trạng thái giơ tay:", err);
    }
};

/**
 * Trưởng phòng tắt tiếng (Mute All) tất cả thành viên trong phòng (chuẩn Zoom)
 */
export const muteAllParticipants = async (roomId, hostUserId) => {
    if (!roomId) return;
    try {
        const roomRef = doc(db, ROOMS_COLLECTION, roomId);
        const snap = await getDoc(roomRef);
        if (!snap.exists()) return;
        const participants = snap.data().participants || {};
        const updates = {};
        Object.keys(participants).forEach((uid) => {
            if (uid !== hostUserId) {
                updates[`participants.${uid}.micEnabled`] = false;
            }
        });
        if (Object.keys(updates).length > 0) {
            await updateDoc(roomRef, updates);
        }
    } catch (err) {
        console.warn("Lỗi tắt tiếng toàn phòng:", err);
    }
};

/**
 * Chuẩn hóa và lưu đường dẫn Google Meet / Zoom họp trực tuyến vào phòng
 */
export const updateWatchPartyMeetUrl = async (roomId, rawUrl) => {
    if (!roomId) return "";
    try {
        const roomRef = doc(db, ROOMS_COLLECTION, roomId);
        let cleanUrl = (rawUrl || "").trim();
        if (cleanUrl && !cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
            cleanUrl = `https://${cleanUrl}`;
        }
        await updateDoc(roomRef, {
            meetUrl: cleanUrl,
            updatedAt: serverTimestamp(),
        });
        return cleanUrl;
    } catch (err) {
        console.warn("Lỗi cập nhật link họp:", err);
        throw err;
    }
};

/**
 * Tự động dọn dẹp các thành viên đã offline quá 60 giây khỏi danh sách participants của phòng
 */
export const cleanStaleRoomParticipants = async (roomId, currentParticipants) => {
    if (!roomId || !currentParticipants || typeof currentParticipants !== "object") return;
    const now = Date.now();
    let hasStale = false;
    const activeParticipants = {};

    Object.entries(currentParticipants).forEach(([uid, p]) => {
        if (isParticipantOnline(p, now)) {
            activeParticipants[uid] = p;
        } else {
            hasStale = true;
        }
    });

    if (hasStale) {
        try {
            const roomRef = doc(db, ROOMS_COLLECTION, roomId);
            const remainingCount = Object.keys(activeParticipants).length;
            const updates = {
                participants: activeParticipants,
                participantCount: remainingCount,
                updatedAt: serverTimestamp(),
            };
            if (remainingCount === 0) {
                updates.emptyAt = now;
            }
            await updateDoc(roomRef, updates);
        } catch (err) {
            console.warn("Lỗi dọn dẹp thành viên offline:", err);
        }
    }
};

/**
 * Đăng ký lắng nghe thay đổi thông tin phòng thời gian thực (onSnapshot)
 */
export const subscribeWatchPartyRoom = (roomId, onUpdate, onError) => {
    if (!roomId) return () => {};
    const roomRef = doc(db, ROOMS_COLLECTION, roomId);
    return onSnapshot(
        roomRef,
        (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (isRoomExpired(data)) {
                    // Không thực hiện deleteDoc trong onSnapshot để tránh side-effect và tiết kiệm quota
                    onUpdate(null);
                    return;
                }
                const onlineParticipants = getOnlineParticipants(data.participants);
                const onlineCount = Object.keys(onlineParticipants).length;
                onUpdate({
                    ...data,
                    participants: onlineParticipants,
                    participantCount: onlineCount,
                });
            } else {
                onUpdate(null); // Phòng đã bị xoá
            }
        },
        (error) => {
            console.error("Lỗi subscribe phòng xem chung:", error);
            if (onError) onError(error);
        }
    );
};

/**
 * Đăng ký lắng nghe tin nhắn chat thời gian thực
 */
export const subscribeWatchPartyMessages = (roomId, onUpdate) => {
    if (!roomId) return () => {};
    const messagesRef = collection(db, ROOMS_COLLECTION, roomId, MESSAGES_SUB_COLLECTION);
    const q = query(messagesRef, orderBy("createdAt", "asc"), limit(100));

    return onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
        }));
        onUpdate(messages);
    });
};

const processRoomSnapshotDoc = (docSnap, activeRooms) => {
    const data = docSnap.data();
    const room = { id: docSnap.id, ...data };
    const onlineParticipants = getOnlineParticipants(room.participants);
    const onlineCount = Object.keys(onlineParticipants).length;

    // Chuẩn hóa danh sách thành viên và số lượng người xem theo thời gian thực (chỉ tính toán trên UI, không write DB)
    room.participants = onlineParticipants;
    room.participantCount = onlineCount;

    // Chỉ hiển thị phòng nếu thực sự có người đang ở trong room và chưa hết hạn
    if (onlineCount > 0 && !isRoomExpired(room)) {
        activeRooms.push(room);
    }
};

/**
 * Đăng ký lắng nghe danh sách các phòng đang mở (realtime)
 */
export const subscribeActiveWatchPartyRooms = (onUpdate, onError) => {
    try {
        const roomsRef = collection(db, ROOMS_COLLECTION);
        const q = query(roomsRef, limit(30));

        return onSnapshot(
            q,
            (snapshot) => {
                const activeRooms = [];
                snapshot.docs.forEach((d) => processRoomSnapshotDoc(d, activeRooms));
                onUpdate(activeRooms);
            },
            (error) => {
                // Nếu Firebase Rules chưa cấp quyền đọc collection (Missing or insufficient permissions)
                if (error?.code === "permission-denied") {
                    console.warn(
                        "[WatchParty] Firestore Security Rules chưa mở quyền đọc collection 'watch_party_rooms'. Cần cấu hình rule 'allow read, write: if true;' trên Firebase Console."
                    );
                } else {
                    console.warn("Lỗi lấy danh sách phòng xem chung:", error?.message || error);
                }
                onUpdate([]); // Trả về danh sách rỗng để UI không bị treo loading
                if (onError) onError(error);
            }
        );
    } catch (err) {
        console.warn("Không thể khởi tạo listener phòng xem chung:", err);
        onUpdate([]);
        return () => {};
    }
};

export const watchPartyService = {
    generateRoomCode,
    hashWatchPartyPassword,
    verifyWatchPartyPassword,
    createWatchPartyRoom,
    getWatchPartyRoom,
    deleteWatchPartyRoom,
    joinWatchPartyRoom,
    leaveWatchPartyRoom,
    updateWatchPartyPlayback,
    updateWatchPartySettings,
    updateWatchPartyMediaState,
    updateWatchPartyParticipantName,
    changeWatchPartyEpisode,
    changeWatchPartyMovie,
    updateParticipantControlPermission,
    transferWatchPartyHost,
    kickWatchPartyParticipant,
    banWatchPartyParticipant,
    unbanWatchPartyParticipant,
    heartbeatParticipant,
    updateWatchPartyRaiseHand,
    muteAllParticipants,
    updateWatchPartyMeetUrl,
    sendWatchPartyMessage,
    subscribeWatchPartyRoom,
    subscribeWatchPartyMessages,
    subscribeActiveWatchPartyRooms,
    cleanStaleRoomParticipants,
    getOnlineParticipants,
    getOnlineParticipantCount,
    ROOM_EMPTY_EXPIRATION_MS,
    isRoomExpired,
};
