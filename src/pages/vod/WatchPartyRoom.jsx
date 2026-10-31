import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import "shaka-player/dist/controls.css";
import "../../assets/styles/shaka-player.css";
import { useAuth } from "../../contexts/AuthContext";
import { useWatchParty } from "../../hooks/vod/useWatchParty";
import { useWatchPartyPlayer } from "../../hooks/vod/useWatchPartyPlayer";
import { leaveWatchPartyRoom } from "../../services/vod/watchPartyService";
import { WatchPartyHeader } from "../../components/vod/watchparty/WatchPartyHeader";
import { WatchPartyChatSidebar } from "../../components/vod/watchparty/WatchPartyChatSidebar";
import { WatchPartyWebcamGrid } from "../../components/vod/watchparty/WatchPartyWebcamGrid";
import { ZoomFlyingReactions } from "../../components/vod/watchparty/ZoomFlyingReactions";
import { WatchPartySettingsModal } from "../../components/vod/watchparty/WatchPartySettingsModal";
import { WatchPartyQRModal } from "../../components/vod/watchparty/WatchPartyQRModal";
import { WatchPartyPasswordModal } from "../../components/vod/watchparty/WatchPartyPasswordModal";
import { WatchPartyNameModal } from "../../components/vod/watchparty/WatchPartyNameModal";
import { WatchPartyEpisodeModal } from "../../components/vod/watchparty/WatchPartyEpisodeModal";
import { WatchPartyMembersModal } from "../../components/vod/watchparty/WatchPartyMembersModal";
import { WatchPartyMeetModal } from "../../components/vod/watchparty/WatchPartyMeetModal";
import { WatchPartyChangeMovieModal } from "../../components/vod/watchparty/WatchPartyChangeMovieModal";
import { WatchPartyNotificationToast } from "../../components/vod/watchparty/WatchPartyNotificationToast";
import { VodPlayerContainer } from "../../components/vod/play/VodPlayerSection";
import { EmptyState, BackgroundVoiceAudio } from "../../components/common";
import { ROUTES } from "../../constants";

const RoomLoadingView = ({ roomId }) => {
    const { t } = useTranslation();
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-800 border-t-red-600" />
            <p className="mt-4 text-sm font-semibold text-zinc-400">
                {t("watchParty.room.loading")} ({roomId})
            </p>
        </div>
    );
};

const RoomClosedView = ({ onNavigateLobby, onNavigateHome }) => {
    const { t } = useTranslation();
    return (
        <EmptyState
            variant="warning"
            title={t("watchParty.room.roomNotFound")}
            description={t("watchParty.room.roomNotFoundDesc")}
            actionLabel={t("watchParty.lobby.createRoom")}
            onAction={onNavigateLobby}
            secondaryActionLabel={t("vods.backToVodHub")}
            onSecondaryAction={onNavigateHome}
            minHeight="min-h-screen"
            className="bg-black"
        />
    );
};

const RoomErrorView = ({ error, onNavigateLobby }) => {
    const { t } = useTranslation();
    return (
        <EmptyState
            variant="error"
            title={t("common.error")}
            description={error || t("watchParty.room.roomNotFoundDesc")}
            actionLabel={t("watchParty.room.backToLobby")}
            onAction={onNavigateLobby}
            actionIcon={ArrowLeftIcon}
            minHeight="min-h-screen"
            className="bg-black"
        />
    );
};

const RoomKickedOrBannedView = ({ isBanned, notice, onNavigateLobby }) => {
    const { t } = useTranslation();
    const title = isBanned
        ? t("watchParty.room.bannedTitle", { defaultValue: "Bạn đã bị chặn khỏi phòng" })
        : t("watchParty.room.kickedTitle", { defaultValue: "Bạn đã rời khỏi phòng xem" });
    const description = notice || (isBanned
        ? t("watchParty.room.bannedDesc", { defaultValue: "Trưởng phòng đã chặn bạn khỏi phòng xem chung này." })
        : t("watchParty.room.kickedDesc", { defaultValue: "Trưởng phòng đã mời bạn rời khỏi phòng xem chung." }));

    return (
        <EmptyState
            variant={isBanned ? "error" : "warning"}
            title={title}
            description={description}
            actionLabel={t("watchParty.room.backToLobby", { defaultValue: "Quay về Sảnh xem chung" })}
            onAction={onNavigateLobby}
            actionIcon={ArrowLeftIcon}
            minHeight="min-h-screen"
            className="bg-black"
        />
    );
};

const RoomWebcamSection = ({
    allowWebcam,
    isCamOn,
    isMicOn,
    localStream,
    remoteStreams,
    toggleCamera,
    toggleMic,
    participants,
    currentUserId,
    mediaError,
    isHandRaised,
    onToggleRaiseHand,
    isHost,
    hostId,
    onMuteAll,
    micVolume,
    updateMicVolume,
    speakerVolume,
    updateSpeakerVolume,
}) => {
    if (allowWebcam) {
        return (
            <div className="mt-3">
                <WatchPartyWebcamGrid
                    isCamOn={isCamOn}
                    isMicOn={isMicOn}
                    localStream={localStream}
                    remoteStreams={remoteStreams}
                    onToggleCam={toggleCamera}
                    onToggleMic={toggleMic}
                    participants={participants || {}}
                    currentUserId={currentUserId}
                    mediaError={mediaError}
                    isHandRaised={isHandRaised}
                    onToggleRaiseHand={onToggleRaiseHand}
                    isHost={isHost}
                    hostId={hostId}
                    onMuteAll={onMuteAll}
                    micVolume={micVolume}
                    onMicVolumeChange={updateMicVolume}
                    speakerVolume={speakerVolume}
                    onSpeakerVolumeChange={updateSpeakerVolume}
                />
            </div>
        );
    }

    const streamEntries = Array.from(remoteStreams?.entries?.() || []);
    return (
        <>
            {streamEntries.map(([peerId, stream]) => (
                <BackgroundVoiceAudio key={peerId} stream={stream} volume={speakerVolume} />
            ))}
        </>
    );
};

const resolveChatContainerClass = (isCollapsed, isExpanded) => {
    // Trên desktop (lg trở lên): luôn ăn trọn 100% chiều cao (h-full), gỡ bỏ giới hạn max-height/min-height của mobile
    const desktopClasses = "lg:h-full lg:max-h-none lg:min-h-0 lg:w-80 xl:w-96";

    if (isCollapsed) {
        return `h-11 ${desktopClasses}`;
    }
    if (isExpanded) {
        return `h-[82vh] max-h-[85vh] ${desktopClasses}`;
    }
    return `h-[52vh] min-h-[380px] max-h-[580px] sm:h-[56vh] ${desktopClasses}`;
};

const RoomContentView = ({
    room,
    messages,
    activeUser,
    isHost,
    canControl,
    isCamOn,
    isMicOn,
    localStream,
    remoteStreams,
    mediaError,
    toggleCamera,
    toggleMic,
    sendMessage,
    player,
    setIsSettingsOpen,
    onOpenQRModal,
    onOpenNameModal,
    onOpenMembersModal,
    onOpenEpisodeModal,
    onOpenChangeMovieModal,
    onNavigateLobby,
    isHandRaised,
    toggleRaiseHand,
    muteAllRemoteParticipants,
    onOpenMeetModal,
    isSyncing,
    syncPlaybackNow,
    micVolume,
    updateMicVolume,
    speakerVolume,
    updateSpeakerVolume,
}) => {
    const { t } = useTranslation();
    const [isMobileChatCollapsed, setIsMobileChatCollapsed] = useState(false);
    const [isMobileChatExpanded, setIsMobileChatExpanded] = useState(false);
    const allowWebcam = room.settings?.allowWebcam !== false;
    const allowChat = room.settings?.allowChat !== false;

    return (
        <div className="flex h-screen flex-col bg-black text-white overflow-hidden">
            <WatchPartyHeader
                room={room}
                isHost={isHost}
                activeUser={activeUser}
                onOpenNameModal={onOpenNameModal}
                onOpenMembersModal={onOpenMembersModal}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onOpenQRModal={onOpenQRModal}
                onLeaveRoom={onNavigateLobby}
                onOpenMeetModal={onOpenMeetModal}
                onOpenChangeMovieModal={onOpenChangeMovieModal}
            />

            <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
                <main className="relative flex flex-1 flex-col overflow-y-auto p-3 lg:p-4">
                    {/* Hiệu ứng cảm xúc bay lượn (Floating Reactions) chuẩn Zoom */}
                    <ZoomFlyingReactions messages={messages} />

                    <VodPlayerContainer
                        isWatchParty={true}
                        episode={player.effectiveEpisode || room?.episode}
                        movie={room?.movie}
                        playerRef={player.playerRef}
                        currentUrlRef={player.currentUrlRef}
                        showNextCountdown={player.showNextCountdown}
                        countdownSeconds={player.countdownSeconds}
                        COUNTDOWN_DURATION={player.COUNTDOWN_DURATION}
                        cancelCountdown={player.cancelCountdown}
                        skipCountdown={player.skipCountdown}
                        currentEpisodeId={player.currentEpisodeId}
                        handleCastTV={player.handleCastTV}
                        togglePiP={player.togglePiP}
                        playPrevEpisode={player.playPrevEpisode}
                        playNextEpisode={player.playNextEpisode}
                        episodes={player.episodes}
                        activeEpisode={player.activeEpisode}
                        autoplayEnabled={player.autoplayEnabled}
                        setAutoplayEnabled={player.setAutoplayEnabled}
                        skipIntroEnabled={player.skipIntroEnabled}
                        setSkipIntroEnabled={player.setSkipIntroEnabled}
                        introDuration={player.introDuration}
                        setIntroDuration={player.setIntroDuration}
                        setIntroDurations={player.setIntroDurations}
                        slug={room?.movie?.slug}
                        canControl={canControl}
                        isHost={isHost}
                        hasInteracted={player.hasInteracted}
                        onStartPlayback={player.handleStartPlayback}
                        syncNotice={room?.hostName ? `${t("watchParty.room.syncNotice")} (${room.hostName})` : ""}
                        onOpenEpisodeModal={onOpenEpisodeModal}
                        onSeekStep={player.handleSeekStep}
                        onShare={onOpenQRModal}
                        onSyncPlayback={syncPlaybackNow}
                        isSyncing={isSyncing}
                        className="border border-zinc-800"
                    />

                    <RoomWebcamSection
                        allowWebcam={allowWebcam}
                        isCamOn={isCamOn}
                        isMicOn={isMicOn}
                        localStream={localStream}
                        remoteStreams={remoteStreams}
                        toggleCamera={toggleCamera}
                        toggleMic={toggleMic}
                        participants={room.participants}
                        currentUserId={activeUser.uid}
                        mediaError={mediaError}
                        isHandRaised={isHandRaised}
                        onToggleRaiseHand={toggleRaiseHand}
                        isHost={isHost}
                        hostId={room?.hostId}
                        onMuteAll={muteAllRemoteParticipants}
                        micVolume={micVolume}
                        updateMicVolume={updateMicVolume}
                        speakerVolume={speakerVolume}
                        updateSpeakerVolume={updateSpeakerVolume}
                    />
                </main>

                {allowChat && (
                    <div
                        className={`w-full shrink-0 transition-all duration-300 ${resolveChatContainerClass(
                            isMobileChatCollapsed,
                            isMobileChatExpanded
                        )}`}
                    >
                        <WatchPartyChatSidebar
                            messages={messages}
                            onSendMessage={sendMessage}
                            onSeekToTimestamp={player.handleSeekToTimestamp}
                            isMobileCollapsed={isMobileChatCollapsed}
                            isMobileExpanded={isMobileChatExpanded}
                            onToggleMobileCollapse={() => {
                                setIsMobileChatCollapsed((prev) => !prev);
                                if (!isMobileChatCollapsed) setIsMobileChatExpanded(false);
                            }}
                            onToggleMobileExpand={() => {
                                setIsMobileChatExpanded((prev) => !prev);
                                setIsMobileChatCollapsed(false);
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default function WatchPartyRoom() {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isQROpen, setIsQROpen] = useState(false);
    const [isNameModalOpen, setIsNameModalOpen] = useState(false);
    const [isEpisodeModalOpen, setIsEpisodeModalOpen] = useState(false);
    const [isChangeMovieModalOpen, setIsChangeMovieModalOpen] = useState(false);
    const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
    const [isMeetModalOpen, setIsMeetModalOpen] = useState(false);
    const [passwordModalError, setPasswordModalError] = useState("");

    const watchParty = useWatchParty({ roomId, currentUser });
    const {
        room,
        isLoading,
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
        changeEpisode,
        changeMovie,
        isRemoteApplyingRef,
        toggleParticipantControl,
        transferHost,
        error,
        isHost,
        updateSettings,
    } = watchParty;

    const player = useWatchPartyPlayer({
        room,
        canControl: watchParty.canControl,
        onBroadcastPlayback: watchParty.broadcastPlayback,
        changeEpisode,
        isRemoteApplyingRef,
    });

    const handleSubmitPassword = async (pass) => {
        const ok = await retryWithPassword(pass);
        if (!ok) {
            setPasswordModalError("Mật khẩu phòng không đúng. Vui lòng thử lại.");
        } else {
            setPasswordModalError("");
        }
    };

    const handleLeaveRoom = async () => {
        try {
            if (activeUser?.uid && roomId) {
                await watchParty.sendMessage(
                    `${activeUser.displayName || "Một thành viên"} đã rời khỏi phòng xem`,
                    { isSystem: true }
                ).catch(() => {});
                await leaveWatchPartyRoom(roomId, activeUser.uid);
            }
        } finally {
            navigate(ROUTES.VOD.WATCH_PARTY);
        }
    };

    if (isLoading) return <RoomLoadingView roomId={roomId} />;
    if (isPasswordRequired) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-center text-white">
                <RoomLoadingView roomId={roomId} />
                <WatchPartyPasswordModal
                    isOpen={true}
                    onOpenChange={(open) => {
                        if (!open) navigate(ROUTES.VOD.WATCH_PARTY);
                    }}
                    roomId={roomId}
                    roomName={room?.movie?.name}
                    onSubmitPassword={handleSubmitPassword}
                    errorMessage={passwordModalError}
                />
            </div>
        );
    }
    if (isRoomClosed) return <RoomClosedView onNavigateLobby={() => navigate(ROUTES.VOD.WATCH_PARTY)} onNavigateHome={() => navigate(ROUTES.VOD.ROOT)} />;
    if (isBanned || isKicked) {
        return (
            <RoomKickedOrBannedView
                isBanned={isBanned}
                notice={kickNotice}
                onNavigateLobby={() => navigate(ROUTES.VOD.WATCH_PARTY)}
            />
        );
    }
    if (error || !room) return <RoomErrorView error={error} onNavigateLobby={() => navigate(ROUTES.VOD.WATCH_PARTY)} />;

    return (
        <>
            <RoomContentView
                {...watchParty}
                player={player}
                setIsSettingsOpen={setIsSettingsOpen}
                onOpenQRModal={() => setIsQROpen(true)}
                onOpenNameModal={() => setIsNameModalOpen(true)}
                onOpenMembersModal={() => setIsMembersModalOpen(true)}
                onOpenEpisodeModal={() => setIsEpisodeModalOpen(true)}
                onOpenChangeMovieModal={() => setIsChangeMovieModalOpen(true)}
                onOpenMeetModal={() => setIsMeetModalOpen(true)}
                onNavigateLobby={handleLeaveRoom}
            />
            <WatchPartySettingsModal
                isOpen={isSettingsOpen}
                onOpenChange={setIsSettingsOpen}
                settings={room.settings}
                isHost={isHost}
                onSaveSettings={updateSettings}
                micVolume={watchParty.micVolume}
                onMicVolumeChange={watchParty.updateMicVolume}
                speakerVolume={watchParty.speakerVolume}
                onSpeakerVolumeChange={watchParty.updateSpeakerVolume}
            />
            <WatchPartyQRModal
                isOpen={isQROpen}
                onOpenChange={setIsQROpen}
                roomId={room.roomId}
                roomName={room.movie?.name}
            />
            <WatchPartyNameModal
                isOpen={isNameModalOpen}
                onOpenChange={setIsNameModalOpen}
                currentName={activeUser?.displayName}
                onSaveName={updateDisplayName}
            />
            <WatchPartyEpisodeModal
                isOpen={isEpisodeModalOpen}
                onOpenChange={setIsEpisodeModalOpen}
                movie={room.movie}
                currentEpisode={room.episode}
                onSelectEpisode={changeEpisode}
            />
            <WatchPartyChangeMovieModal
                isOpen={isChangeMovieModalOpen}
                onOpenChange={setIsChangeMovieModalOpen}
                currentMovie={room.movie}
                onSelectMovie={changeMovie}
            />
            <WatchPartyMeetModal
                isOpen={isMeetModalOpen}
                onOpenChange={setIsMeetModalOpen}
                currentMeetUrl={room.meetUrl}
                onSaveMeetUrl={watchParty.updateMeetUrl}
            />
            <WatchPartyMembersModal
                isOpen={isMembersModalOpen}
                onOpenChange={setIsMembersModalOpen}
                participants={room.participants}
                bannedUsers={room.bannedUsers}
                hostId={room.hostId}
                currentUserId={activeUser?.uid}
                isHost={isHost}
                controlMode={room.settings?.controlMode}
                onToggleControl={toggleParticipantControl}
                onTransferHost={transferHost}
                onKick={kickParticipant}
                onBan={banParticipant}
                onUnban={unbanParticipant}
            />
            <WatchPartyNotificationToast
                participants={room.participants}
                currentUserId={activeUser?.uid}
            />
        </>
    );
}
