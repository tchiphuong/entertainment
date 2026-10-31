import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    VideoCameraIcon,
    VideoCameraSlashIcon,
    MicrophoneIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    Squares2X2Icon,
    Bars3BottomLeftIcon,
    SpeakerXMarkIcon,
} from "@heroicons/react/24/outline";
import { UserAvatar } from "../../common";
import { getOnlineParticipants } from "../../../utils/watchPartyUtils";

const IconMicOff = ({ className = "h-4 w-4" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3zM3 3l18 18" />
    </svg>
);

const IconHandRaised = ({ className = "h-4 w-4" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M10.5 1.5a1.5 1.5 0 00-1.5 1.5v8.25a.75.75 0 01-1.5 0V3a1.5 1.5 0 00-3 0v9.75A6.75 6.75 0 0011.25 19.5h1.5A6.75 6.75 0 0019.5 12.75V6a1.5 1.5 0 00-3 0v5.25a.75.75 0 01-1.5 0V2.25a1.5 1.5 0 00-3 0v6.75a.75.75 0 01-1.5 0V1.5z" />
    </svg>
);

const unlockAudioElement = (audioEl) => {
    const handleUnlock = () => {
        audioEl.play().catch(() => {});
    };
    window.addEventListener("click", handleUnlock, { once: true });
    window.addEventListener("keydown", handleUnlock, { once: true });
};

const RemotePeerAudio = ({ stream }) => {
    const audioRef = useRef(null);

    useEffect(() => {
        const audioEl = audioRef.current;
        if (!audioEl || !stream) return;

        audioEl.srcObject = stream;
        const playPromise = audioEl.play();
        if (playPromise) {
            playPromise.catch((err) => {
                console.warn("[Voice] Autoplay bị chặn bởi trình duyệt:", err);
                unlockAudioElement(audioEl);
            });
        }
    }, [stream]);

    return <audio ref={audioRef} autoPlay playsInline />;
};

const HandRaisedBadge = ({ isHandRaised }) => {
    if (!isHandRaised) return null;
    return (
        <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-1 rounded-md border border-amber-500/80 bg-amber-950/90 px-1.5 py-0.5 shadow-lg animate-bounce">
            <IconHandRaised className="h-3 w-3 text-amber-400" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-300">Giơ tay</span>
        </div>
    );
};

const ParticipantOverlayLabel = ({ name, micEnabled, isLocal, isHost }) => (
    <div className="absolute bottom-1 left-1 z-10 flex items-center gap-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
        <span className="max-w-[70px] truncate">{isLocal ? "Bạn" : name}</span>
        {isHost && (
            <span className="rounded bg-red-950 px-1.5 py-0.2 text-[8px] font-bold text-red-400 border border-red-800/80">
                Trưởng phòng
            </span>
        )}
        {micEnabled ? (
            <MicrophoneIcon className="h-2.5 w-2.5 text-emerald-400 stroke-2" />
        ) : (
            <IconMicOff className="h-2.5 w-2.5 text-red-400 stroke-2" />
        )}
    </div>
);

const ParticipantVideoCard = ({
    name,
    avatar,
    stream,
    hasVideo,
    micEnabled,
    isHandRaised,
    isLocal = false,
    isHost = false,
    cardAspectClass = "aspect-video",
}) => {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && stream && hasVideo) {
            videoRef.current.srcObject = stream;
        }
    }, [stream, hasVideo]);

    const borderStyle = isHandRaised
        ? "border-amber-500 ring-2 ring-amber-500/80"
        : micEnabled
        ? "border-emerald-500 ring-2 ring-emerald-500/60"
        : "border-zinc-800";

    return (
        <div className={`relative ${cardAspectClass} overflow-hidden rounded-xl border bg-zinc-900 transition-all ${borderStyle}`}>
            <HandRaisedBadge isHandRaised={isHandRaised} />

            {hasVideo ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={isLocal}
                    className={`h-full w-full object-cover ${isLocal ? "-scale-x-100" : ""}`}
                />
            ) : (
                <div className="flex h-full w-full flex-col items-center justify-center text-zinc-500">
                    <UserAvatar name={name} avatarUrl={avatar} size="sm" isHost={isHost} />
                    <span className="mt-1 max-w-[85%] truncate text-[10px] text-zinc-300">
                        {isLocal ? "Bạn" : name}
                    </span>
                </div>
            )}

            <ParticipantOverlayLabel
                name={name}
                micEnabled={micEnabled}
                isLocal={isLocal}
                isHost={isHost}
            />
        </div>
    );
};

const MicAndCamButtons = ({ isMicOn, isCamOn, onToggleMic, onToggleCam, t }) => (
    <>
        <button
            type="button"
            onClick={onToggleMic}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                isMicOn ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
            }`}
            title={isMicOn ? t("watchParty.webcam.muteMic") : t("watchParty.webcam.unmuteMic")}
        >
            {isMicOn ? <MicrophoneIcon className="h-4 w-4 stroke-2" /> : <IconMicOff className="h-4 w-4 stroke-2" />}
            <span className="hidden sm:inline">{isMicOn ? "Bật mic" : "Tắt mic"}</span>
        </button>

        <button
            type="button"
            onClick={onToggleCam}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                isCamOn ? "bg-red-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
            }`}
            title={isCamOn ? t("watchParty.webcam.turnCamOff") : t("watchParty.webcam.turnCamOn")}
        >
            {isCamOn ? <VideoCameraIcon className="h-4 w-4 stroke-2" /> : <VideoCameraSlashIcon className="h-4 w-4 stroke-2" />}
            <span className="hidden sm:inline">{isCamOn ? "Bật cam" : "Tắt cam"}</span>
        </button>
    </>
);

const ZoomActionButtons = ({
    isHandRaised,
    onToggleRaiseHand,
    viewMode,
    onToggleViewMode,
    isMinimized,
    onToggleMinimize,
    isHost,
    onMuteAll,
    t,
}) => (
    <>
        <button
            type="button"
            onClick={onToggleRaiseHand}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                isHandRaised ? "bg-amber-600 text-white animate-pulse" : "bg-zinc-800 text-zinc-300 hover:text-white"
            }`}
            title={isHandRaised ? "Hạ tay phát biểu" : "Giơ tay phát biểu"}
        >
            <IconHandRaised className="h-4 w-4" />
            <span className="hidden sm:inline">{isHandRaised ? "Hạ tay" : "Giơ tay"}</span>
        </button>

        <button
            type="button"
            onClick={onToggleViewMode}
            className="rounded-lg bg-zinc-800 p-1.5 text-zinc-400 hover:text-white"
            title={viewMode === "gallery" ? "Chuyển sang dải ngang (Strip View)" : "Chuyển sang dạng lưới (Gallery View)"}
        >
            {viewMode === "gallery" ? <Bars3BottomLeftIcon className="h-4 w-4 stroke-2" /> : <Squares2X2Icon className="h-4 w-4 stroke-2" />}
        </button>

        {isHost && onMuteAll && (
            <button
                type="button"
                onClick={onMuteAll}
                className="rounded-lg bg-zinc-800 p-1.5 text-zinc-400 hover:bg-red-950 hover:text-red-400"
                title="Tắt tiếng tất cả (Mute All)"
            >
                <SpeakerXMarkIcon className="h-4 w-4 stroke-2" />
            </button>
        )}

        <button
            type="button"
            onClick={onToggleMinimize}
            className="rounded-lg bg-zinc-800 p-1.5 text-zinc-400 hover:text-white"
            title={isMinimized ? t("watchParty.webcam.expand") : t("watchParty.webcam.collapse")}
        >
            {isMinimized ? <ChevronUpIcon className="h-4 w-4 stroke-2" /> : <ChevronDownIcon className="h-4 w-4 stroke-2" />}
        </button>
    </>
);

const ZoomDockControls = (props) => (
    <div className="flex flex-wrap items-center gap-1.5">
        <MicAndCamButtons
            isMicOn={props.isMicOn}
            isCamOn={props.isCamOn}
            onToggleMic={props.onToggleMic}
            onToggleCam={props.onToggleCam}
            t={props.t}
        />
        <ZoomActionButtons
            isHandRaised={props.isHandRaised}
            onToggleRaiseHand={props.onToggleRaiseHand}
            viewMode={props.viewMode}
            onToggleViewMode={props.onToggleViewMode}
            isMinimized={props.isMinimized}
            onToggleMinimize={props.onToggleMinimize}
            isHost={props.isHost}
            onMuteAll={props.onMuteAll}
            t={props.t}
        />
    </div>
);

export const WatchPartyWebcamGrid = ({
    isCamOn,
    isMicOn,
    localStream,
    remoteStreams = new Map(),
    onToggleCam,
    onToggleMic,
    participants = {},
    currentUserId,
    mediaError,
    isHandRaised = false,
    onToggleRaiseHand,
    isHost = false,
    hostId,
    onMuteAll,
}) => {
    const { t } = useTranslation();
    const [isMinimized, setIsMinimized] = useState(false);
    const [viewMode, setViewMode] = useState("gallery"); // "gallery" | "strip"

    const onlineParticipants = getOnlineParticipants(participants);
    const participantList = Object.entries(onlineParticipants).map(([uid, p]) => ({
        ...p,
        uid: p.uid || uid,
    }));
    const otherParticipants = participantList.filter((p) => p.uid !== currentUserId);
    const currentParticipant = participants[currentUserId] || { uid: currentUserId };

    const containerGridClass = viewMode === "gallery"
        ? "grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4"
        : "flex gap-2 overflow-x-auto pb-1";

    const cardAspect = viewMode === "gallery" ? "aspect-video" : "h-24 w-36 shrink-0";

    return (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white shadow-xl">
            {/* Âm thanh nền */}
            {Array.from(remoteStreams.entries()).map(([peerId, stream], idx) => (
                <RemotePeerAudio key={peerId || `remote_peer_${idx}`} stream={stream} />
            ))}

            {/* Header Zoom Dock Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-2">
                <div className="flex items-center gap-2">
                    <VideoCameraIcon className="h-4 w-4 text-red-500 stroke-2" />
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                        Gọi video nhóm ({participantList.length})
                    </span>
                </div>

                <ZoomDockControls
                    isMicOn={isMicOn}
                    isCamOn={isCamOn}
                    isHandRaised={isHandRaised}
                    onToggleMic={onToggleMic}
                    onToggleCam={onToggleCam}
                    onToggleRaiseHand={onToggleRaiseHand}
                    viewMode={viewMode}
                    onToggleViewMode={() => setViewMode((prev) => (prev === "gallery" ? "strip" : "gallery"))}
                    isMinimized={isMinimized}
                    onToggleMinimize={() => setIsMinimized((prev) => !prev)}
                    isHost={isHost}
                    onMuteAll={onMuteAll}
                    t={t}
                />
            </div>

            {mediaError && (
                <div className="mt-2 rounded bg-red-950/60 p-2 text-[11px] text-red-400 border border-red-900/50">
                    {mediaError}
                </div>
            )}

            {/* Danh sách người tham gia theo Grid hoặc Strip */}
            {!isMinimized && (
                <div className={`mt-3 ${containerGridClass}`}>
                    {/* Thẻ của chính mình */}
                    <ParticipantVideoCard
                        name={currentParticipant.name || "Bạn"}
                        avatar={currentParticipant.avatar}
                        stream={localStream}
                        hasVideo={isCamOn}
                        micEnabled={isMicOn}
                        isHandRaised={isHandRaised}
                        isLocal={true}
                        isHost={Boolean(isHost || (hostId && currentParticipant.uid === hostId))}
                        cardAspectClass={cardAspect}
                    />

                    {/* Thẻ của các thành viên khác */}
                    {otherParticipants.map((p, idx) => {
                        const stream = remoteStreams.get(p.uid);
                        const hasRemoteVideo = Boolean(stream && stream.getVideoTracks().length > 0);
                        return (
                            <ParticipantVideoCard
                                key={p.uid || `participant_${idx}`}
                                name={p.name}
                                avatar={p.avatar}
                                stream={stream}
                                hasVideo={hasRemoteVideo}
                                micEnabled={p.micEnabled}
                                isHandRaised={p.isHandRaised}
                                isHost={Boolean((hostId && p.uid === hostId) || p.isHost)}
                                cardAspectClass={cardAspect}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
};
