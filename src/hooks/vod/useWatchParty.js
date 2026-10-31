import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
    joinWatchPartyRoom,
    leaveWatchPartyRoom,
    getWatchPartyRoom,
    subscribeWatchPartyRoom,
    subscribeWatchPartyMessages,
    sendWatchPartyMessage,
    updateWatchPartySettings,
    updateWatchPartyMediaState,
    updateWatchPartyParticipantName,
    changeWatchPartyEpisode,
    updateParticipantControlPermission,
    transferWatchPartyHost,
    kickWatchPartyParticipant,
    banWatchPartyParticipant,
    unbanWatchPartyParticipant,
    heartbeatParticipant,
    updateWatchPartyRaiseHand,
    muteAllParticipants,
    updateWatchPartyMeetUrl,
    cleanStaleRoomParticipants,
    hashWatchPartyPassword,
    verifyWatchPartyPassword,
} from "../../services/vod/watchPartyService";
import { WatchPartyWebRTC } from "../../services/vod/watchPartyWebRTC";
import { getGuestProfile, setGuestName } from "../../utils/watchPartyGuest";
import { useWatchPartySync } from "./useWatchPartySync";

const handleRoomSnapshot = (roomData, isMounted, roomId, currentUid, setters) => {
    if (!isMounted) return;
    if (!roomData) {
        setters.setIsRoomClosed(true);
        setters.setRoom(null);
        return;
    }
    setters.setRoom(roomData);
    cleanStaleRoomParticipants(roomId, roomData.participants);

    if (!currentUid) return;

    if (Array.isArray(roomData.bannedUids) && roomData.bannedUids.includes(currentUid)) {
        setters.setIsBanned(true);
        setters.setKickNotice("Bạn đã bị Trưởng phòng chặn khỏi phòng xem này.");
        return;
    }

    const kickEvent = roomData.lastKickEvent;
    if (kickEvent?.uid === currentUid && Date.now() - kickEvent.timestamp < 30000) {
        if (kickEvent.isBanned) {
            setters.setIsBanned(true);
            setters.setKickNotice("Bạn đã bị Trưởng phòng chặn khỏi phòng xem này.");
        } else {
            setters.setIsKicked(true);
            setters.setKickNotice("Bạn đã bị Trưởng phòng mời ra khỏi phòng xem chung.");
        }
    }
};

const resolveJoinError = (err) => {
    const code = err?.code || "";
    const msg = err?.message || "";

    if (code === "INCORRECT_PASSWORD" || msg === "INCORRECT_PASSWORD") {
        return { isPassErr: true, isBanned: false, msg: "Phòng này yêu cầu mật khẩu hoặc mật khẩu đã nhập không chính xác." };
    }
    if (msg.includes("BANNED_FROM_ROOM") || msg.includes("chặn khỏi phòng")) {
        return { isPassErr: false, isBanned: true, msg: "Bạn đã bị Trưởng phòng chặn khỏi phòng xem này." };
    }
    if (code === "permission-denied" || msg.includes("insufficient permissions")) {
        return { isPassErr: false, isBanned: false, msg: "Thiếu quyền truy cập Firestore (Missing or insufficient permissions). Vui lòng cập nhật Firestore Security Rules." };
    }
    return { isPassErr: false, isBanned: false, msg: msg || "Không thể kết nối vào phòng." };
};

const checkIsCreator = (roomId, currentUserUid, guestProfileUid, roomHostId) => {
    try {
        const stored = sessionStorage.getItem(`wp_creator_${roomId}`);
        if (!stored) return false;
        return stored === currentUserUid || stored === guestProfileUid || stored === roomHostId;
    } catch {
        return false;
    }
};

const resolveActiveUserData = (baseUser, isHost, roomHostId, roomHostName) => {
    if (isHost && roomHostId) {
        return {
            ...baseUser,
            uid: baseUser.uid || roomHostId,
            displayName: baseUser.displayName || roomHostName || "Chủ phòng",
            isHost: true,
        };
    }
    return {
        ...baseUser,
        isHost: false,
    };
};

const checkIsHost = (baseUid, isCreator, hostId) => {
    if (!baseUid) return false;
    if (isCreator) return true;
    return hostId === baseUid;
};

const checkCanControl = (isHost, controlMode, isIndividualGranted) => {
    if (isHost) return true;
    if (controlMode === "anyone") return true;
    return Boolean(isIndividualGranted);
};

const useWatchPartyUser = ({ roomId, room, currentUser }) => {
    const [guestProfile, setGuestProfile] = useState(() => getGuestProfile());
    const hostId = room?.hostId;
    const hostName = room?.hostName;
    const currentUid = currentUser?.uid;
    const guestUid = guestProfile?.uid;
    const baseUid = currentUid || guestUid;

    useEffect(() => {
        if (!currentUser) {
            setGuestProfile(getGuestProfile());
        }
    }, [currentUser]);

    const isCreator = useMemo(
        () => checkIsCreator(roomId, currentUid, guestUid, hostId),
        [roomId, currentUid, guestUid, hostId]
    );

    const isHost = useMemo(
        () => checkIsHost(baseUid, isCreator, hostId),
        [baseUid, isCreator, hostId]
    );

    const activeUser = useMemo(() => {
        const baseUser = currentUser || guestProfile;
        return resolveActiveUserData(baseUser, isHost, hostId, hostName);
    }, [currentUser, guestProfile, isHost, hostId, hostName]);

    const isIndividualGranted = room?.participants?.[activeUser.uid]?.canControl === true;
    const canControl = checkCanControl(isHost, room?.settings?.controlMode, isIndividualGranted);

    return { activeUser, isHost, canControl, setGuestProfile };
};

const useWatchPartyModeration = ({ roomId, isHost, activeUserUid, sendMessage }) => {
    const toggleParticipantControl = useCallback(async (targetUid, allowControl) => {
        if (!roomId || !isHost || !targetUid) return;
        await updateParticipantControlPermission(roomId, targetUid, allowControl);
    }, [roomId, isHost]);

    const transferHost = useCallback(async (newHostUid) => {
        if (!roomId || !isHost || !newHostUid) return;
        await transferWatchPartyHost(roomId, newHostUid);
    }, [roomId, isHost]);

    const kickParticipant = useCallback(async (targetUid, targetName) => {
        if (!roomId || !isHost || !targetUid) return;
        await kickWatchPartyParticipant(roomId, targetUid, activeUserUid, targetName);
        if (targetName) {
            await sendMessage(`Trưởng phòng đã mời ${targetName} rời khỏi phòng xem.`);
        }
    }, [roomId, isHost, activeUserUid, sendMessage]);

    const banParticipant = useCallback(async (targetUid, targetName) => {
        if (!roomId || !isHost || !targetUid) return;
        await banWatchPartyParticipant(roomId, targetUid, activeUserUid, targetName);
        if (targetName) {
            await sendMessage(`Trưởng phòng đã chặn ${targetName} khỏi phòng xem.`);
        }
    }, [roomId, isHost, activeUserUid, sendMessage]);

    const unbanParticipant = useCallback(async (targetUid) => {
        if (!roomId || !isHost || !targetUid) return;
        await unbanWatchPartyParticipant(roomId, targetUid, activeUserUid);
    }, [roomId, isHost, activeUserUid]);

    const muteAllRemoteParticipants = useCallback(async () => {
        if (!roomId || !isHost || !activeUserUid) return;
        await muteAllParticipants(roomId, activeUserUid);
    }, [roomId, isHost, activeUserUid]);

    return {
        toggleParticipantControl,
        transferHost,
        kickParticipant,
        banParticipant,
        unbanParticipant,
        muteAllRemoteParticipants,
    };
};

/**
 * Custom hook quản lý toàn bộ logic thời gian thực của phòng xem chung (Watch Party)
 */
export const useWatchParty = ({
    roomId,
    currentUser,
    _movie,
    _activeEpisode,
}) => {
    const [room, setRoom] = useState(null);
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isRoomClosed, setIsRoomClosed] = useState(false);
    const [isPasswordRequired, setIsPasswordRequired] = useState(false);
    const [joinAttempt, setJoinAttempt] = useState(0);
    const [isKicked, setIsKicked] = useState(false);
    const [isBanned, setIsBanned] = useState(false);
    const [kickNotice, setKickNotice] = useState("");

    // Media states (Camera & Mic & WebRTC Remote Streams)
    const [isCamOn, setIsCamOn] = useState(false);
    const [isMicOn, setIsMicOn] = useState(false);
    const [localStream, setLocalStream] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState(new Map());
    const [mediaError, setMediaError] = useState(null);

    // Flags tránh loop giữa local event và remote update
    const isRemoteApplyingRef = useRef(false);
    const heartbeatTimerRef = useRef(null);
    const rtcManagerRef = useRef(null);

    const { activeUser, isHost, canControl, setGuestProfile } = useWatchPartyUser({
        roomId,
        room,
        currentUser,
    });

    const activeUserRef = useRef(activeUser);
    activeUserRef.current = activeUser;

    // Quản lý đồng bộ thời gian video đa tab & đa thiết bị chính xác đến từng mili-giây
    const { broadcastPlayback, syncPlaybackNow, isSyncing } = useWatchPartySync({
        roomId,
        room,
        canControl,
        activeUser,
        activeEpisode: room?.episode,
        isRemoteApplyingRef,
    });

    // 1. Tham gia phòng và đăng ký lắng nghe
    useEffect(() => {
        if (!roomId || !activeUser.uid) return;
        let isMounted = true;
        setIsLoading(true);
        setError(null);
        setIsRoomClosed(false);

        // Tham gia phòng (kèm mật khẩu đã lưu nếu có)
        const currentActiveUser = activeUserRef.current;
        const storedPass = sessionStorage.getItem(`wp_pass_${roomId}`) || "";
        joinWatchPartyRoom(roomId, currentActiveUser, storedPass)
            .then(() => {
                if (!isMounted) return;
                setIsPasswordRequired(false);
                setIsLoading(false);
            })
            .catch((err) => {
                if (!isMounted) return;
                const { isPassErr, isBanned: isBannedErr, msg } = resolveJoinError(err);
                if (isPassErr) {
                    setIsPasswordRequired(true);
                } else if (isBannedErr) {
                    setIsBanned(true);
                    setKickNotice(msg);
                } else {
                    setError(msg);
                }
                setIsLoading(false);
            });

        // Lắng nghe dữ liệu phòng
        const unsubscribeRoom = subscribeWatchPartyRoom(
            roomId,
            (roomData) => {
                handleRoomSnapshot(
                    roomData,
                    isMounted,
                    roomId,
                    activeUserRef.current?.uid,
                    { setIsRoomClosed, setRoom, setIsBanned, setIsKicked, setKickNotice }
                );
            },
            (err) => {
                if (!isMounted) return;
                setError(err.message || "Lỗi đồng bộ phòng.");
            }
        );

        // Lắng nghe tin nhắn
        const unsubscribeMessages = subscribeWatchPartyMessages(roomId, (msgList) => {
            if (!isMounted) return;
            setMessages(msgList);
        });

        // Thiết lập heartbeat định kỳ mỗi 15s để duy trì trạng thái online
        heartbeatTimerRef.current = setInterval(() => {
            heartbeatParticipant(roomId, activeUserRef.current?.uid);
        }, 15000);

        // Xử lý khi tắt tab hoặc rời trang: Tự động rời phòng và kích hoạt xoá nếu phòng trống
        const handleBeforeUnload = () => {
            if (activeUserRef.current?.uid) {
                leaveWatchPartyRoom(roomId, activeUserRef.current.uid);
            }
        };
        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            isMounted = false;
            window.removeEventListener("beforeunload", handleBeforeUnload);
            if (heartbeatTimerRef.current) {
                clearInterval(heartbeatTimerRef.current);
            }
            unsubscribeRoom();
            unsubscribeMessages();
            // Rời phòng khi unmount component
            if (activeUserRef.current?.uid) {
                leaveWatchPartyRoom(roomId, activeUserRef.current.uid);
            }
        };
    }, [roomId, activeUser.uid, joinAttempt]);

    // 2. Logic WebCam & Micro
    const toggleCamera = useCallback(async () => {
        setMediaError(null);
        if (isCamOn) {
            // Tắt camera
            if (localStream) {
                localStream.getVideoTracks().forEach((track) => track.stop());
                rtcManagerRef.current?.updateLocalStream(localStream);
            }
            setIsCamOn(false);
            updateWatchPartyMediaState(roomId, activeUser.uid, { camEnabled: false });
        } else {
            // Bật camera
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 320 }, height: { ideal: 240 } },
                    audio: isMicOn,
                });
                setLocalStream(stream);
                setIsCamOn(true);
                updateWatchPartyMediaState(roomId, activeUser.uid, { camEnabled: true });
                rtcManagerRef.current?.updateLocalStream(stream);
            } catch (err) {
                console.warn("Không thể truy cập camera:", err);
                setMediaError("Không thể mở camera. Vui lòng cấp quyền trong trình duyệt.");
            }
        }
    }, [isCamOn, isMicOn, localStream, roomId, activeUser.uid]);

    const toggleMic = useCallback(async () => {
        setMediaError(null);
        if (isMicOn) {
            if (localStream) {
                localStream.getAudioTracks().forEach((track) => {
                    track.enabled = false;
                });
                rtcManagerRef.current?.updateLocalStream(localStream);
            }
            setIsMicOn(false);
            updateWatchPartyMediaState(roomId, activeUser.uid, { micEnabled: false });
        } else {
            try {
                if (localStream && localStream.getAudioTracks().length > 0) {
                    localStream.getAudioTracks().forEach((track) => {
                        track.enabled = true;
                    });
                    rtcManagerRef.current?.updateLocalStream(localStream);
                } else {
                    const audioStream = await navigator.mediaDevices.getUserMedia({
                        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                    });
                    let streamToUse = audioStream;
                    if (localStream) {
                        audioStream.getAudioTracks().forEach((t) => localStream.addTrack(t));
                        streamToUse = localStream;
                    } else {
                        setLocalStream(audioStream);
                    }
                    rtcManagerRef.current?.updateLocalStream(streamToUse);
                }
                setIsMicOn(true);
                updateWatchPartyMediaState(roomId, activeUser.uid, { micEnabled: true });
            } catch (err) {
                console.warn("Không thể truy cập micro:", err);
                setMediaError("Không thể mở micro. Vui lòng cấp quyền trong trình duyệt.");
            }
        }
    }, [isMicOn, localStream, roomId, activeUser.uid]);

    const localStreamRef = useRef(null);
    localStreamRef.current = localStream;

    // Dọn dẹp media streams chỉ khi unmount rời khỏi phòng xem chung
    useEffect(() => {
        return () => {
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((t) => t.stop());
            }
        };
    }, []);

    // 4. Quản lý kết nối thoại thời gian thực WebRTC P2P Voice Mesh
    useEffect(() => {
        if (!roomId || !activeUser?.uid) return;

        const rtc = new WatchPartyWebRTC({
            roomId,
            currentUserId: activeUser.uid,
            onRemoteStreamChange: (streamsMap) => {
                setRemoteStreams(new Map(streamsMap));
            },
        });

        rtc.init();
        rtcManagerRef.current = rtc;

        return () => {
            rtc.destroy();
            rtcManagerRef.current = null;
        };
    }, [roomId, activeUser?.uid]);

    // Đồng bộ danh sách thành viên với WebRTC Mesh
    useEffect(() => {
        if (rtcManagerRef.current && room?.participants) {
            rtcManagerRef.current.syncParticipants(room.participants);
        }
    }, [room?.participants]);

    // Đồng bộ local stream (micro / webcam) vào WebRTC senders
    useEffect(() => {
        if (rtcManagerRef.current) {
            rtcManagerRef.current.updateLocalStream(localStream);
        }
    }, [localStream]);

    // 5. Gửi tin nhắn chat (hỗ trợ trích dẫn replyTo chuẩn Zoom)
    const sendMessage = useCallback(async (text, videoTimestamp = null, replyTo = null) => {
        if (!roomId || !text?.trim()) return;
        try {
            await sendWatchPartyMessage(roomId, {
                senderId: activeUser.uid,
                senderName: activeUser.displayName || "Bạn xem chung",
                avatar: activeUser.photoURL || "",
                text,
                videoTimestamp,
                replyTo,
            });
        } catch (err) {
            console.warn("Lỗi gửi tin nhắn:", err);
        }
    }, [roomId, activeUser]);

    // 6. Cập nhật Settings
    const updateSettings = useCallback(async (newSettings) => {
        if (!roomId || !isHost) return;
        await updateWatchPartySettings(roomId, {
            ...room?.settings,
            ...newSettings,
        });
    }, [roomId, isHost, room?.settings]);

    // 7. Nhập lại mật khẩu phòng (nếu phòng có bảo vệ bằng pass)
    const retryWithPassword = useCallback(async (plainPassword) => {
        const targetRoom = room || (await getWatchPartyRoom(roomId));
        if (!targetRoom) return false;
        const isValid = await verifyWatchPartyPassword(targetRoom, plainPassword);
        if (!isValid) {
            return false;
        }
        const passHash = await hashWatchPartyPassword(plainPassword);
        sessionStorage.setItem(`wp_pass_${roomId}`, passHash);
        setIsPasswordRequired(false);
        setError(null);
        setJoinAttempt((prev) => prev + 1);
        return true;
    }, [room, roomId]);

    // 8. Đổi tên hiển thị cho khách xem chung (lưu vào localStorage và đồng bộ Firestore)
    const updateDisplayName = useCallback(async (newName) => {
        const cleanName = setGuestName(newName);
        if (!cleanName) return;

        if (!currentUser) {
            setGuestProfile((prev) => ({
                ...prev,
                displayName: cleanName,
            }));
        }

        if (roomId && activeUser?.uid) {
            await updateWatchPartyParticipantName(roomId, activeUser.uid, cleanName);
        }
    }, [roomId, currentUser, activeUser?.uid]);

    // 9. Đổi tập phim (Trưởng phòng hoặc người có quyền)
    const changeEpisode = useCallback(async (newEpisode) => {
        if (!roomId || !canControl || !newEpisode) return;
        await changeWatchPartyEpisode(roomId, newEpisode);
    }, [roomId, canControl]);

    // 10. Giơ tay phát biểu (Raise Hand) chuẩn Zoom
    const isHandRaised = Boolean(room?.participants?.[activeUser.uid]?.isHandRaised);
    const toggleRaiseHand = useCallback(async () => {
        if (!roomId || !activeUser?.uid) return;
        const nextState = !isHandRaised;
        await updateWatchPartyRaiseHand(roomId, activeUser.uid, nextState);
    }, [roomId, activeUser?.uid, isHandRaised]);

    // 13. Ghim link họp trực tuyến (Google Meet / Zoom)
    const meetUrl = room?.meetUrl || "";
    const updateMeetUrl = useCallback(async (newMeetUrl) => {
        if (!roomId || !isHost) return;
        const clean = await updateWatchPartyMeetUrl(roomId, newMeetUrl);
        if (clean) {
            await sendMessage(`Trưởng phòng đã ghim link họp Google Meet: ${clean}`);
        }
    }, [roomId, isHost, sendMessage]);

    // 14. Các thao tác quản trị phòng (Kick, Ban, Unban, Phân quyền, Chuyển host)
    const {
        toggleParticipantControl,
        transferHost,
        kickParticipant,
        banParticipant,
        unbanParticipant,
        muteAllRemoteParticipants,
    } = useWatchPartyModeration({
        roomId,
        isHost,
        activeUserUid: activeUser?.uid,
        sendMessage,
    });

    return {
        room,
        messages,
        isLoading,
        error,
        isRoomClosed,
        isPasswordRequired,
        retryWithPassword,
        isKicked,
        isBanned,
        kickNotice,
        kickParticipant,
        banParticipant,
        unbanParticipant,
        activeUser,
        updateDisplayName,
        isHost,
        canControl,
        broadcastPlayback,
        changeEpisode,
        toggleParticipantControl,
        transferHost,
        // Sync Feature
        isSyncing,
        syncPlaybackNow,
        // Media & Voice P2P
        isCamOn,
        isMicOn,
        localStream,
        remoteStreams,
        mediaError,
        toggleCamera,
        toggleMic,
        // Zoom & Meet Features
        isHandRaised,
        toggleRaiseHand,
        muteAllRemoteParticipants,
        meetUrl,
        updateMeetUrl,
        // Chat & Settings
        sendMessage,
        updateSettings,
    };
};
