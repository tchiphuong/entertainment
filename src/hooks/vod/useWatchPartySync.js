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

/**
 * Áp dụng sự kiện đồng bộ nhận được từ tab phát
 */
const handleSyncEvent = (video, data, isRemoteApplyingRef) => {
    isRemoteApplyingRef.current = true;
    const elapsed = Math.max(0, (Date.now() - (data.timestamp || Date.now())) / 1000);
    const targetTime = Number(data.currentTime || 0) + (data.isPlaying ? elapsed : 0);
    const isPlaying = Boolean(data.isPlaying);

    applyPreciseVideoSync(video, targetTime, isPlaying, {
        hardSeekThreshold: data.type === "TICK" ? 0.12 : 0.05,
        rateAdjustThreshold: 0.02,
    });

    setTimeout(() => {
        isRemoteApplyingRef.current = false;
    }, 120);
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

        // Phát sóng tức thì qua BroadcastChannel cho các tab cùng trình duyệt
        if (localChannelRef.current) {
            try {
                localChannelRef.current.postMessage({
                    type: "SYNC_EVENT",
                    isPlaying,
                    currentTime,
                    timestamp: Date.now(),
                    senderTabId: tabId,
                    senderUid: activeUser?.uid,
                });
            } catch {
                // bỏ qua lỗi kênh đã đóng
            }
        }

        // Phát sóng lên Firestore cho các máy khác qua mạng (hạn chế tối đa 350ms/lần)
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
    }, [roomId, canControl, tabId, activeEpisode, activeUser?.uid, isRemoteApplyingRef]);

    // 3. Heartbeat phát sóng định kỳ của người điều khiển (Host)
    useEffect(() => {
        if (!canControl) return;

        const tickTimer = setInterval(() => {
            const video = document.getElementById("shaka-video") || document.getElementById("hls-video") || document.querySelector("video");
            if (!video || video.paused) return;

            // Bắn tick qua BroadcastChannel mỗi giây để các tab cùng máy bám khít từng mili-giây
            if (localChannelRef.current) {
                localChannelRef.current.postMessage({
                    type: "TICK",
                    isPlaying: true,
                    currentTime: video.currentTime,
                    timestamp: Date.now(),
                    senderTabId: tabId,
                    senderUid: activeUser?.uid,
                });
            }

            // Cứ mỗi 5 giây, cập nhật lên Firestore một lần để máy từ xa không bị trôi
            const now = Date.now();
            if (now - lastFirestoreTickRef.current >= 5000) {
                lastFirestoreTickRef.current = now;
                updateWatchPartyPlayback(roomId, {
                    isPlaying: true,
                    currentTime: video.currentTime,
                    updatedBy: activeUser?.uid,
                    tabId,
                }).catch(() => {});
            }
        }, 1000);

        return () => clearInterval(tickTimer);
    }, [canControl, roomId, tabId, activeUser?.uid]);

    // 4. Lắng nghe cập nhật Firestore (áp dụng cho máy khác hoặc khi không có BroadcastChannel)
    useEffect(() => {
        const pb = room?.playback;
        if (!pb) return;
        if (pb.tabId ? pb.tabId === tabId : pb.updatedBy === activeUser?.uid) return;

        const video = document.getElementById("shaka-video") || document.getElementById("hls-video") || document.querySelector("video");
        if (!video) return;

        isRemoteApplyingRef.current = true;
        const targetTime = calculateSynchronizedTime(pb);
        const isTargetPlaying = Boolean(pb.isPlaying);

        applyPreciseVideoSync(video, targetTime, isTargetPlaying, {
            hardSeekThreshold: 0.2,
            rateAdjustThreshold: 0.03,
        });

        const timer = setTimeout(() => {
            isRemoteApplyingRef.current = false;
        }, 200);

        return () => clearTimeout(timer);
    }, [room?.playback, tabId, activeUser?.uid, isRemoteApplyingRef]);

    // 5. Cơ chế tự động giám sát độ trôi (Drift Monitor) định kỳ cho người xem
    useEffect(() => {
        if (canControl || !room?.playback?.isPlaying) return;

        const driftCheckTimer = setInterval(() => {
            const video = document.getElementById("shaka-video") || document.getElementById("hls-video") || document.querySelector("video");
            if (!video || isRemoteApplyingRef.current) return;

            const expectedTime = calculateSynchronizedTime(room.playback);
            applyPreciseVideoSync(video, expectedTime, true, {
                hardSeekThreshold: 0.25,
                rateAdjustThreshold: 0.04,
            });
        }, 2000);

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
