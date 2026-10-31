import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { HeartIcon as HeartSolidIcon } from "@heroicons/react/24/solid";
import {
    TvIcon,
    RectangleStackIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    HeartIcon as HeartOutlineIcon,
    ShareIcon,
    UsersIcon,
    FilmIcon,
    BackwardIcon,
    ForwardIcon,
    ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { Button, Switch, InputGroup } from "../../ui";
import {
    formatEpisodeNameHelper,
    computeMaxDigits,
    getNextEpisodeData,
    getPrevEpisodeData,
} from "../../../utils/vodPlayHelpers";
import { VodSharedPlayer } from "./VodSharedPlayer";
import { ROUTES } from "../../../constants";

export const CountdownOverlay = ({
    showNextCountdown,
    countdownSeconds,
    COUNTDOWN_DURATION,
    cancelCountdown,
    skipCountdown,
}) => {
    const { t } = useTranslation();
    if (!showNextCountdown) return null;

    const strokeDashoffset =
        2 * Math.PI * 42 * (1 - countdownSeconds / COUNTDOWN_DURATION);

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm transition-all duration-500">
            <div className="flex flex-col items-center space-y-6 text-center">
                <div className="relative flex h-28 w-28 items-center justify-center">
                    <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
                        <circle
                            cx="50"
                            cy="50"
                            r="42"
                            className="stroke-zinc-800"
                            strokeWidth="6"
                            fill="transparent"
                        />
                        <circle
                            cx="50"
                            cy="50"
                            r="42"
                            className="stroke-red-600 transition-all duration-1000 ease-linear"
                            strokeWidth="6"
                            strokeDasharray={2 * Math.PI * 42}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            fill="transparent"
                        />
                    </svg>
                    <span className="absolute text-4xl font-black text-white">
                        {countdownSeconds}
                    </span>
                </div>
                <div className="space-y-2">
                    <h3 className="text-lg font-black tracking-wider text-white">
                        {t("vodPlay.nextEpisodeCountdown") || "TỰ ĐỘNG CHUYỂN TẬP TIẾP THEO"}
                    </h3>
                    <p className="text-xs text-zinc-400">
                        {t("vodPlay.countdownDesc") || "Video tiếp theo sẽ bắt đầu sau ít giây"}
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <Button
                        onPress={cancelCountdown}
                        variant="secondary"
                    >
                        {t("common.cancel") || "Hủy"}
                    </Button>
                    <Button
                        onPress={skipCountdown}
                        variant="primary"
                    >
                        {t("vodPlay.watchNow") || "Xem ngay"}
                    </Button>
                </div>
            </div>
        </div>
    );
};

const resolveDisplayEpisodeName = (currentEpisodeId, maxDigits, episodeLabel) => {
    if (!currentEpisodeId) return "Chưa có nguồn";
    if (String(currentEpisodeId).toLowerCase() === "full") return "Full";
    if (/^\d+$/.test(currentEpisodeId)) {
        return formatEpisodeNameHelper(currentEpisodeId, maxDigits, episodeLabel);
    }
    return currentEpisodeId;
};

export const FavoriteShareButtons = ({
    movie,
    isFavorited,
    toggleFavorite,
    onShare,
}) => {
    const { t } = useTranslation();
    const isFav = Boolean(movie && isFavorited?.(movie.slug));
    const favText = isFav ? (t("vodPlay.liked") || "Đã thích") : (t("vodPlay.like") || "Yêu thích");
    const shareText = t("common.share") || "Chia sẻ";

    return (
        <>
            {movie && toggleFavorite && (
                <Button
                    onPress={() => toggleFavorite(movie)}
                    variant={isFav ? "danger" : "secondary"}
                    size="sm"
                    title={favText}
                >
                    {isFav ? (
                        <HeartSolidIcon className="h-4 w-4" />
                    ) : (
                        <HeartOutlineIcon className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">{favText}</span>
                </Button>
            )}

            {onShare && (
                <Button
                    onPress={onShare}
                    variant="secondary"
                    size="sm"
                    title={shareText}
                >
                    <ShareIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">{shareText}</span>
                </Button>
            )}
        </>
    );
};

const PlayerMovieTitleInfo = ({ movie, displayEpisodeName, fallbackStatus, serverName }) => (
    <div className="flex items-center gap-4 min-w-0 max-w-xl">
        <div className="flex h-10 w-1 shrink-0 rounded-full bg-red-600" />
        <div className="min-w-0">
            <h2 className="truncate text-base md:text-lg font-black text-white" title={movie?.name}>
                {movie?.name || fallbackStatus}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
                {serverName && (
                    <span className="shrink-0 rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                        {serverName}
                    </span>
                )}
                {displayEpisodeName && (
                    <span className="shrink-0 rounded bg-red-600/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-500 ring-1 ring-red-600/30">
                        {displayEpisodeName}
                    </span>
                )}
                {movie?.origin_name && (
                    <span className="truncate text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                        {movie.origin_name}
                    </span>
                )}
            </div>
        </div>
    </div>
);

const WatchPartyControls = ({
    canControl,
    isHost,
    onOpenEpisodeModal,
    onSeekStep,
    onSyncPlayback,
    isSyncing,
    t,
}) => (
    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {onSyncPlayback && (
            <Button
                onPress={onSyncPlayback}
                variant="secondary"
                size="sm"
                className={`h-8 gap-1 px-2 text-xs transition-colors sm:px-2.5 ${
                    isSyncing ? "border-emerald-500 text-emerald-400" : "text-zinc-300 hover:text-white"
                }`}
                title={isHost ? "Ép đồng bộ thời gian video cho toàn phòng" : "Chủ động đồng bộ thời gian theo Trưởng phòng"}
            >
                <ArrowPathIcon className={`h-3.5 w-3.5 stroke-2 ${isSyncing ? "animate-spin text-emerald-400" : ""}`} />
                <span className="hidden sm:inline">{isSyncing ? "Đang đồng bộ..." : isHost ? "Đồng bộ phòng" : "Đồng bộ"}</span>
            </Button>
        )}
        {canControl && onOpenEpisodeModal && (
            <Button
                onPress={onOpenEpisodeModal}
                variant="secondary"
                size="sm"
                className="h-8 gap-1 px-2 text-xs text-red-400 hover:text-red-300 sm:px-2.5"
                title={t("vodPlay.changeEpisode", { defaultValue: "Đổi tập" })}
            >
                <FilmIcon className="h-3.5 w-3.5 stroke-2" />
                <span className="hidden sm:inline">{t("vodPlay.changeEpisode", { defaultValue: "Đổi tập" })}</span>
            </Button>
        )}
        {canControl && onSeekStep && (
            <div className="flex items-center gap-1">
                <Button
                    onPress={() => onSeekStep(-10)}
                    variant="secondary"
                    size="sm"
                    className="h-8 w-8 p-0"
                    title="Tua lùi 10 giây"
                >
                    <BackwardIcon className="h-3.5 w-3.5 stroke-2" />
                </Button>
                <Button
                    onPress={() => onSeekStep(10)}
                    variant="secondary"
                    size="sm"
                    className="h-8 w-8 p-0"
                    title="Tua tới 10 giây"
                >
                    <ForwardIcon className="h-3.5 w-3.5 stroke-2" />
                </Button>
            </div>
        )}
    </div>
);

const PlayerStandardControls = ({
    movie,
    activeEpisode,
    handleCastTV,
    togglePiP,
    t,
    navigate,
}) => (
    <>
        <Button
            onPress={() =>
                navigate(ROUTES.VOD.WATCH_PARTY, {
                    state: {
                        movie,
                        activeEpisode,
                    },
                })
            }
            variant="secondary"
            size="sm"
            title={t("watchParty.watchWithFriends")}
        >
            <UsersIcon className="h-4 w-4 text-emerald-400 stroke-2" />
            <span className="hidden sm:inline">{t("watchParty.navTitle")}</span>
        </Button>
        {handleCastTV && (
            <Button
                onPress={handleCastTV}
                variant="secondary"
                size="sm"
                title="Cast TV"
            >
                <TvIcon className="h-4 w-4 text-blue-500 stroke-2" />
                <span>Cast TV</span>
            </Button>
        )}
        {togglePiP && (
            <Button
                onPress={togglePiP}
                variant="secondary"
                size="sm"
                title="Picture-in-Picture"
            >
                <RectangleStackIcon className="h-4 w-4 stroke-2" />
                <span className="hidden sm:inline">PiP</span>
            </Button>
        )}
    </>
);

const PlayerNavigationButtons = ({
    hasPrev,
    hasNext,
    playPrevEpisode,
    playNextEpisode,
    t,
}) => {
    if (!hasPrev && !hasNext) return null;

    return (
        <div className="flex items-center gap-2">
            {hasPrev && (
                <Button
                    onPress={playPrevEpisode}
                    variant="secondary"
                    size="sm"
                    title={`${t("vodPlay.prevEpisode") || "Tập trước"} (P)`}
                >
                    <ChevronLeftIcon className="h-4 w-4 stroke-[2.5]" />
                    <span className="hidden sm:inline">
                        {t("vodPlay.prev") || "Trước"}
                    </span>
                </Button>
            )}
            {hasNext && (
                <Button
                    onPress={playNextEpisode}
                    variant="secondary"
                    size="sm"
                    title={`${t("vodPlay.nextEpisode") || "Tập tiếp theo"} (N)`}
                >
                    <span className="hidden sm:inline">
                        {t("vodPlay.next") || "Tiếp"}
                    </span>
                    <ChevronRightIcon className="h-4 w-4 stroke-[2.5]" />
                </Button>
            )}
        </div>
    );
};

export const PlayerControlBar = ({
    currentEpisodeId,
    handleCastTV,
    togglePiP,
    playPrevEpisode,
    playNextEpisode,
    episodes,
    activeEpisode,
    movie,
    isFavorited,
    toggleFavorite,
    onShare,
    isWatchParty = false,
    canControl = false,
    isHost = false,
    onOpenEpisodeModal,
    onSeekStep,
    onSyncPlayback,
    isSyncing,
    serverName,
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const maxDigits = useMemo(() => computeMaxDigits(episodes), [episodes]);
    const displayEpisodeName = resolveDisplayEpisodeName(
        currentEpisodeId,
        maxDigits,
        t("vodPlay.episode") || "Tập"
    );

    const hasNext = useMemo(() => {
        if (!Array.isArray(episodes) || episodes.length === 0) return false;
        return Boolean(getNextEpisodeData(episodes, currentEpisodeId, null, activeEpisode));
    }, [episodes, currentEpisodeId, activeEpisode]);

    const hasPrev = useMemo(() => {
        if (!Array.isArray(episodes) || episodes.length === 0) return false;
        return Boolean(getPrevEpisodeData(episodes, currentEpisodeId, null, activeEpisode));
    }, [episodes, currentEpisodeId, activeEpisode]);

    return (
        <div className="border-t border-white/5 bg-zinc-950 p-4 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <PlayerMovieTitleInfo
                    movie={movie}
                    displayEpisodeName={displayEpisodeName}
                    fallbackStatus={t("vodPlay.status") || "Phim"}
                    serverName={serverName}
                />

                <div className="flex flex-wrap items-center gap-3 md:justify-end">
                    <div className="flex items-center gap-2">
                        {!isWatchParty && (
                            <FavoriteShareButtons
                                movie={movie}
                                isFavorited={isFavorited}
                                toggleFavorite={toggleFavorite}
                                onShare={onShare}
                            />
                        )}

                        {isWatchParty ? (
                            <>
                                {handleCastTV && (
                                    <Button
                                        onPress={handleCastTV}
                                        variant="secondary"
                                        size="sm"
                                        title={t("vodPlay.castTv") || "Truyền lên TV"}
                                    >
                                        <TvIcon className="h-4 w-4 stroke-2" />
                                        <span className="hidden sm:inline">Cast TV</span>
                                    </Button>
                                )}
                                {togglePiP && (
                                    <Button
                                        onPress={togglePiP}
                                        variant="secondary"
                                        size="sm"
                                        title="Picture-in-Picture"
                                    >
                                        <RectangleStackIcon className="h-4 w-4 stroke-2" />
                                        <span className="hidden sm:inline">PiP</span>
                                    </Button>
                                )}
                                <WatchPartyControls
                                    canControl={canControl}
                                    isHost={isHost}
                                    onOpenEpisodeModal={onOpenEpisodeModal}
                                    onSeekStep={onSeekStep}
                                    onSyncPlayback={onSyncPlayback}
                                    isSyncing={isSyncing}
                                    t={t}
                                />
                            </>
                        ) : (
                            <PlayerStandardControls
                                movie={movie}
                                activeEpisode={activeEpisode}
                                handleCastTV={handleCastTV}
                                togglePiP={togglePiP}
                                t={t}
                                navigate={navigate}
                            />
                        )}
                    </div>

                    <PlayerNavigationButtons
                        hasPrev={hasPrev}
                        hasNext={hasNext}
                        playPrevEpisode={playPrevEpisode}
                        playNextEpisode={playNextEpisode}
                        t={t}
                    />
                </div>
            </div>
        </div>
    );
};

const AutoplaySwitch = ({ autoplayEnabled, setAutoplayEnabled, t }) => (
    <Switch
        size="sm"
        isSelected={autoplayEnabled}
        onChange={setAutoplayEnabled}
    >
        <Switch.Content>
            <Switch.Control>
                <Switch.Thumb />
            </Switch.Control>
            <span>{t("vodPlay.autoplay") || "Tự động chuyển tập"}</span>
        </Switch.Content>
    </Switch>
);

const SkipIntroControl = ({
    skipIntroEnabled,
    setSkipIntroEnabled,
    introDuration,
    handleIntroChange,
    t,
}) => {
    const secondsLabel = t("vodPlay.seconds") || "giây";
    return (
        <div className="flex items-center gap-2">
            <Switch
                size="sm"
                isSelected={skipIntroEnabled}
                onChange={setSkipIntroEnabled}
            >
                <Switch.Content>
                    <Switch.Control>
                        <Switch.Thumb />
                    </Switch.Control>
                    <span>{t("vodPlay.skipIntro") || "Bỏ qua giới thiệu"}</span>
                </Switch.Content>
            </Switch>

            {skipIntroEnabled && (
                <div className="w-24">
                    <InputGroup size="sm">
                        <InputGroup.Input
                            type="number"
                            min="0"
                            max="600"
                            value={introDuration}
                            onChange={(e) => handleIntroChange(e.target.value)}
                            aria-label={secondsLabel}
                        />
                        <InputGroup.Suffix>
                            <span className="text-[11px] text-zinc-500">{secondsLabel}</span>
                        </InputGroup.Suffix>
                    </InputGroup>
                </div>
            )}
        </div>
    );
};

const CompactViewSwitch = ({ isCompactView, setIsCompactView, t }) => (
    <Switch
        size="sm"
        isSelected={isCompactView}
        onChange={setIsCompactView}
    >
        <Switch.Content>
            <Switch.Control>
                <Switch.Thumb />
            </Switch.Control>
            <span>{t("vodPlay.compactView") || "Dạng gọn"}</span>
        </Switch.Content>
    </Switch>
);

export const VodPlaySettingsBar = ({
    autoplayEnabled,
    setAutoplayEnabled,
    skipIntroEnabled,
    setSkipIntroEnabled,
    introDuration,
    setIntroDuration,
    setIntroDurations,
    slug,
    isCompactView,
    setIsCompactView,
}) => {
    const { t } = useTranslation();
    const handleIntroChange = (newVal) => {
        const val = Math.max(0, Number.parseInt(newVal, 10) || 0);
        setIntroDuration(val);
        if (slug) {
            const cleanSlug = slug.split("?")[0];
            setIntroDurations((prev) => ({ ...prev, [cleanSlug]: val }));
        }
    };

    return (
        <div className="border-t border-white/5 bg-zinc-950/60 px-4 py-3 md:px-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-5 text-xs font-bold text-zinc-400">
                    <AutoplaySwitch
                        autoplayEnabled={autoplayEnabled}
                        setAutoplayEnabled={setAutoplayEnabled}
                        t={t}
                    />
                    <SkipIntroControl
                        skipIntroEnabled={skipIntroEnabled}
                        setSkipIntroEnabled={setSkipIntroEnabled}
                        introDuration={introDuration}
                        handleIntroChange={handleIntroChange}
                        t={t}
                    />
                </div>

                {Boolean(setIsCompactView) && (
                    <div className="flex items-center gap-3">
                        <CompactViewSwitch
                            isCompactView={isCompactView}
                            setIsCompactView={setIsCompactView}
                            t={t}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

const resolveActiveEpisodeId = (currentEpisodeId, episode) => {
    if (currentEpisodeId) return currentEpisodeId;
    if (episode?.name) return episode.name;
    return episode?.slug || "";
};

const resolveServerName = (episode, activeEpisode) => {
    if (episode?.server_name) return episode.server_name;
    return activeEpisode?.server_name || "";
};

const PlayerCountdownSlot = ({ show, seconds, duration, onCancel, onSkip }) => {
    if (!show) return null;
    return (
        <CountdownOverlay
            showNextCountdown={show}
            countdownSeconds={seconds}
            COUNTDOWN_DURATION={duration}
            cancelCountdown={onCancel}
            skipCountdown={onSkip}
        />
    );
};

const PlayerSettingsSlot = ({ isWatchParty, setAutoplayEnabled, settingsProps }) => {
    if (isWatchParty || !setAutoplayEnabled) return null;
    return <VodPlaySettingsBar {...settingsProps} setAutoplayEnabled={setAutoplayEnabled} />;
};

export const VodPlayerContainer = ({
    playerRef,
    videoRef,
    episode,
    currentUrlRef,
    memoizedBackgrounds,
    getMovieImage,
    showNextCountdown,
    countdownSeconds,
    COUNTDOWN_DURATION,
    cancelCountdown,
    skipCountdown,
    currentEpisodeId,
    handleCastTV,
    togglePiP,
    playPrevEpisode,
    playNextEpisode,
    episodes,
    activeEpisode,
    autoplayEnabled,
    setAutoplayEnabled,
    skipIntroEnabled,
    setSkipIntroEnabled,
    introDuration,
    setIntroDuration,
    setIntroDurations,
    slug,
    isCompactView,
    setIsCompactView,
    movie,
    isFavorited,
    toggleFavorite,
    onShare,
    isWatchParty = false,
    canControl = false,
    isHost = false,
    hasInteracted = true,
    onStartPlayback,
    syncNotice,
    onOpenEpisodeModal,
    onSeekStep,
    onSyncPlayback,
    isSyncing,
    className = "",
}) => {
    const activeEpisodeId = resolveActiveEpisodeId(currentEpisodeId, episode);
    const serverName = resolveServerName(episode, activeEpisode);

    return (
        <div className={`flex w-full shrink-0 flex-col overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/5 ${className}`}>
            <VodSharedPlayer
                playerRef={playerRef}
                videoRef={videoRef}
                episode={episode}
                currentUrl={currentUrlRef?.current}
                memoizedBackgrounds={memoizedBackgrounds}
                getMovieImage={getMovieImage}
                movie={movie}
                hasInteracted={hasInteracted}
                isHost={isHost}
                onStartPlayback={onStartPlayback}
                syncNotice={syncNotice}
                className="md:max-h-[80vh]"
                overlays={
                    <PlayerCountdownSlot
                        show={showNextCountdown}
                        seconds={countdownSeconds}
                        duration={COUNTDOWN_DURATION}
                        onCancel={cancelCountdown}
                        onSkip={skipCountdown}
                    />
                }
            />

            <PlayerControlBar
                currentEpisodeId={activeEpisodeId}
                handleCastTV={handleCastTV}
                togglePiP={togglePiP}
                playPrevEpisode={playPrevEpisode}
                playNextEpisode={playNextEpisode}
                episodes={episodes}
                activeEpisode={activeEpisode}
                movie={movie}
                isFavorited={isFavorited}
                toggleFavorite={toggleFavorite}
                onShare={onShare}
                isWatchParty={isWatchParty}
                canControl={canControl}
                isHost={isHost}
                onOpenEpisodeModal={onOpenEpisodeModal}
                onSeekStep={onSeekStep}
                onSyncPlayback={onSyncPlayback}
                isSyncing={isSyncing}
                serverName={serverName}
            />

            <PlayerSettingsSlot
                isWatchParty={isWatchParty}
                setAutoplayEnabled={setAutoplayEnabled}
                settingsProps={{
                    autoplayEnabled,
                    skipIntroEnabled,
                    setSkipIntroEnabled,
                    introDuration,
                    setIntroDuration,
                    setIntroDurations,
                    slug,
                    isCompactView,
                    setIsCompactView,
                }}
            />
        </div>
    );
};
