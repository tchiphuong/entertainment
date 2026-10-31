import { useState, useEffect, useRef, useCallback } from "react";
import { updateWatchPartyPlayback } from "../../services/vod/watchPartyService";
import { calculateSynchronizedTime, applyPreciseVideoSync } from "../../utils/watchPartyUtils";

/**
 * Xử lý phản hồi khi nhận được yêu cầu đồng bộ từ tab khác
 */
const handleSyncRequest = (video, canControl, localChannel, tabId, activeUserUid) => {
    if (!canControl || video.paused) return;
    localChannel?.postMessage({
        type: "SYNC_EVENT",
        isPlaying: !video.paused,
        currentTime: video.currentTime,
        timestamp: Date.now(),
        senderTabId: tabId,
        senderUid: activeUserUid,
    });
};

const safelyReleaseRemoteFlag = (video, isRemoteApplyingRef, delayMs = 800) => {
    isRemoteApplyingRef.current = true;
    const handleSeekedOnce = () => {
        video.removeEventListener("seeked", handleSeekedOnce);
        setTimeout(() => {
            isRemoteApplyingRef.current = false;
        }, 200);
    };
    video.addEventListener("seeked", handleSeekedOnce);
    setTimeout(() => {
        video.removeEventListener("seeked", handleSeekedOnce);
        isRemoteApplyingRef.current = false;
    }, delayMs);
};

/**
 * Áp dụng sự kiện đồng bộ nhận được từ tab phát
 */
const handleSyncEvent = (video, data, isRemoteApplyingRef) => {
    safelyReleaseRemoteFlag(video, isRemoteApplyingRef, 800);
    const elapsed = Math.max(0, Math.min(3, (Date.now() - (data.timestamp || Date.now())) / 1000));
    const targetTime = Number(data.currentTime || 0) + (data.isPlaying ? elapsed : 0);
    const isPlaying = Boolean(data.isPlaying);

    applyPreciseVideoSync(video, targetTime, isPlaying, {
        hardSeekThreshold: data.type === "TICK" ? 1.5 : 1.0,
        rateAdjustThreshold: 0.08,
    });
};

/**
 * Xử lý tin nhắn nhận được từ BroadcastChannel giữa các tab cùng trình duyệt
 */
const handleLocalChannelMessage = ({
    event,
    tabId,
    activeUserUid,
    canControl,
    localChannel,
    isRemoteApplyingRef,
}) => {
    const data = event?.data;
    if (!data || data.senderTabId === tabId) return;

    const video = document.getElementById("shaka-video") || document.getElementById("hls-video") || document.querySelector("video");
    if (!video) return;

    if (data.type === "REQUEST_SYNC") {
        handleSyncRequest(video, canControl, localChannel, tabId, activeUserUid);
        return;
    }

    if (data.type === "SYNC_EVENT" || data.type === "TICK") {
        handleSyncEvent(video, data, isRemoteApplyingRef);
    }
};

const shouldBlockAccidentalReset = (currentTime, episodeData, roomPlayback) => {
    if (episodeData) return false;
    const currentSavedTime = Number(roomPlayback?.currentTime) || 0;
    return currentTime < 1 && currentSavedTime > 5;
};

const notifyLocalBroadcastChannel = (localChannel, payload) => {
    if (!localChannel) return;
    try {
        localChannel.postMessage(payload);
    } catch {
        // bỏ qua lỗi kênh đã đóng
    }
};

const postLocalTick = (video, localChannel, tabId, activeUid) => {
    if (!localChannel) return;
    localChannel.postMessage({
        type: "TICK",
        isPlaying: true,
        currentTime: video.currentTime,
        timestamp: Date.now(),
        senderTabId: tabId,
        senderUid: activeUid,
    });
};

const shouldSkipFirestoreTick = (video, room, lastFirestoreTickRef, now) => {
    const hasMultipleParticipants = (room?.participantCount || 0) > 1;
    if (!hasMultipleParticipants || now - lastFirestoreTickRef.current < 10000) {
        return true;
    }
    // Áo giáp bảo vệ: Nếu video chưa nạp xong đang ở < 2s trong khi phòng đang xem > 5s, không ghi đè 0:00 lên phòng
    const currentSavedTime = Number(room?.playback?.currentTime) || 0;
    return video.currentTime < 2 && currentSavedTime > 5;
};

const syncPeriodicFirestorePlayback = ({ video, roomId, activeUser, tabId, room, lastFirestoreTickRef }) => {
    const now = Date.now();
    if (shouldSkipFirestoreTick(video, room, lastFirestoreTickRef, now)) {
        return;
    }

    lastFirestoreTickRef.current = now;
    updateWatchPartyPlayback(roomId, {
        isPlaying: true,
        currentTime: video.currentTime,
        updatedBy: activeUser?.uid,
        tabId,
    }).catch(() => {});
};

/**
 * Hook quản lý đồng bộ video siêu chính xác đến từng mili-giây cho phòng xem chung
 * Sử dụng BroadcastChannel với TabId định danh độc lập kết hợp Firestore NTP elapsed time
 */
export const useWatchPartySync = ({
    roomId,
    room,
    canControl,
    activeUser,
    activeEpisode,
    isRemoteApplyingRef,
}) => {
    const [isSyncing, setIsSyncing] = useState(false);
    const tabIdRef = useRef(`tab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    const localChannelRef = useRef(null);
    const lastBroadcastTimeRef = useRef(0);
    const lastFirestoreTickRef = useRef(0);

    const tabId = tabIdRef.current;

    // 1. Khởi tạo BroadcastChannel để đồng bộ tức thì giữa các tab trên cùng một máy
    useEffect(() => {
        if (!roomId || typeof window === "undefined" || !window.BroadcastChannel) {
            return;
        }

        const channel = new window.BroadcastChannel(`wp_local_sync_${roomId}`);
        localChannelRef.current = channel;

        const onMessage = (event) => {
            handleLocalChannelMessage({
                event,
                tabId,
                activeUserUid: activeUser?.uid,
                canControl,
                localChannel: channel,
                isRemoteApplyingRef,
            });
        };

        channel.addEventListener("message", onMessage);

        // Nếu là người xem vừa mở tab, yêu cầu Host gửi ngay mốc thời gian tức thì
        if (!canControl) {
            channel.postMessage({
                type: "REQUEST_SYNC",
                senderTabId: tabId,
                senderUid: activeUser?.uid,
            });
        }

        return () => {
            channel.removeEventListener("message", onMessage);
            channel.close();
            localChannelRef.current = null;
        };
    }, [roomId, canControl, tabId, activeUser?.uid, isRemoteApplyingRef]);

    // 2. Phát sóng cập nhật trạng thái Play/Pause/Seek
    const broadcastPlayback = useCallback((isPlaying, currentTime, episodeData = null) => {
        if (!roomId || !canControl || isRemoteApplyingRef.current) return;
        if (shouldBlockAccidentalReset(currentTime, episodeData, room?.playback)) return;

        notifyLocalBroadcastChannel(localChannelRef.current, {
            type: "SYNC_EVENT",
            isPlaying,
            currentTime,
            timestamp: Date.now(),
            senderTabId: tabId,
            senderUid: activeUser?.uid,
        });

        const now = Date.now();
        if (now - lastBroadcastTimeRef.current < 350) return;
        lastBroadcastTimeRef.current = now;

        updateWatchPartyPlayback(roomId, {
            isPlaying,
            currentTime,
            episode: episodeData || activeEpisode,
            updatedBy: activeUser?.uid,
            tabId,
        }).catch((err) => console.warn("Lỗi phát sóng trạng thái video:", err));
    }, [roomId, canControl, tabId, activeEpisode, activeUser?.uid, isRemoteApplyingRef, room?.playback]);

    // 3. Heartbeat phát sóng định kỳ của người điều khiển (Host)
    useEffect(() => {
        if (!canControl) return;

        const tickTimer = setInterval(() => {
            const video = document.getElementById("shaka-video") || document.getElementById("hls-video") || document.querySelector("video");
            if (!video || video.paused) return;

            // Bắn tick qua BroadcastChannel mỗi giây để các tab cùng máy bám khít từng mili-giây
            postLocalTick(video, localChannelRef.current, tabId, activeUser?.uid);

            // Cứ mỗi 10 giây (và khi có từ 2 người cùng xem), cập nhật lên Firestore để máy từ xa không bị trôi
            syncPeriodicFirestorePlayback({
                video,
                roomId,
                activeUser,
                tabId,
                room,
                lastFirestoreTickRef,
            });
        }, 1000);

        return () => clearInterval(tickTimer);
    }, [canControl, roomId, tabId, activeUser?.uid, room?.participantCount]);

    // 4. Lắng nghe cập nhật Firestore (áp dụng cho máy khác hoặc khi không có BroadcastChannel)
    useEffect(() => {
        const pb = room?.playback;
        if (!pb) return;
        if (pb.tabId ? pb.tabId === tabId : pb.updatedBy === activeUser?.uid) return;

        const video = document.getElementById("shaka-video") || document.getElementById("hls-video") || document.querySelector("video");
        if (!video) return;

        safelyReleaseRemoteFlag(video, isRemoteApplyingRef, 1000);
        const targetTime = calculateSynchronizedTime(pb);
        const isTargetPlaying = Boolean(pb.isPlaying);

        applyPreciseVideoSync(video, targetTime, isTargetPlaying, {
            hardSeekThreshold: 1.5,
            rateAdjustThreshold: 0.1,
        });
    }, [room?.playback, tabId, activeUser?.uid, isRemoteApplyingRef]);

    // 5. Cơ chế tự động giám sát độ trôi (Drift Monitor) định kỳ cho người xem
    useEffect(() => {
        if (canControl || !room?.playback?.isPlaying) return;

        const driftCheckTimer = setInterval(() => {
            const video = document.getElementById("shaka-video") || document.getElementById("hls-video") || document.querySelector("video");
            if (!video || isRemoteApplyingRef.current || video.paused) return;

            const expectedTime = calculateSynchronizedTime(room.playback);
            applyPreciseVideoSync(video, expectedTime, true, {
                hardSeekThreshold: 2.5,
                rateAdjustThreshold: 0.15,
            });
        }, 4000);

        return () => clearInterval(driftCheckTimer);
    }, [canControl, room?.playback, isRemoteApplyingRef]);

    // 6. Nút kích hoạt đồng bộ chủ động (Manual Sync)
    const syncPlaybackNow = useCallback(() => {
        setIsSyncing(true);
        const video = document.getElementById("shaka-video") || document.getElementById("hls-video") || document.querySelector("video");
        if (!video) {
            setIsSyncing(false);
            return;
        }

        if (canControl) {
            broadcastPlayback(!video.paused, video.currentTime);
        } else {
            // Yêu cầu tab Host gửi mốc thời gian tức thì qua BroadcastChannel
            if (localChannelRef.current) {
                localChannelRef.current.postMessage({
                    type: "REQUEST_SYNC",
                    senderTabId: tabId,
                    senderUid: activeUser?.uid,
                });
            }
            // Đồng thời ép nhảy đến mốc thời gian tính từ Firestore
            const targetTime = calculateSynchronizedTime(room?.playback);
            applyPreciseVideoSync(video, targetTime, Boolean(room?.playback?.isPlaying), {
                hardSeekThreshold: 0.05,
            });
        }

        setTimeout(() => {
            setIsSyncing(false);
        }, 400);
    }, [canControl, broadcastPlayback, tabId, room?.playback, activeUser?.uid]);

    return {
        broadcastPlayback,
        syncPlaybackNow,
        isSyncing,
    };
};
