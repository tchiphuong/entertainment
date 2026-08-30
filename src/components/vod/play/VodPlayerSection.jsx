import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { HeartIcon as HeartSolidIcon } from "@heroicons/react/24/solid";
import {
    TvIcon,
    RectangleStackIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    HeartIcon as HeartOutlineIcon,
    ShareIcon,
} from "@heroicons/react/24/outline";
import { Button, Switch, InputGroup } from "../../ui";
import {
    formatEpisodeNameHelper,
    computeMaxDigits,
    getNextEpisodeData,
    getPrevEpisodeData,
} from "../../../utils/vodPlayHelpers";

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

const PlayerMovieTitleInfo = ({ movie, displayEpisodeName, fallbackStatus }) => (
    <div className="flex items-center gap-4 min-w-0 max-w-xl">
        <div className="flex h-10 w-1 shrink-0 rounded-full bg-red-600" />
        <div className="min-w-0">
            <h2 className="truncate text-base md:text-lg font-black text-white" title={movie?.name}>
                {movie?.name || fallbackStatus}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
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
}) => {
    const { t } = useTranslation();
    const maxDigits = useMemo(() => computeMaxDigits(episodes), [episodes]);
    const displayEpisodeName = resolveDisplayEpisodeName(
        currentEpisodeId,
        maxDigits,
        t("vodPlay.episode") || "Tập"
    );

    const hasNext = useMemo(() => {
        return Boolean(getNextEpisodeData(episodes, currentEpisodeId, null, activeEpisode));
    }, [episodes, currentEpisodeId, activeEpisode]);

    const hasPrev = useMemo(() => {
        return Boolean(getPrevEpisodeData(episodes, currentEpisodeId, null, activeEpisode));
    }, [episodes, currentEpisodeId, activeEpisode]);

    return (
        <div className="border-t border-white/5 bg-zinc-950 p-4 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <PlayerMovieTitleInfo
                    movie={movie}
                    displayEpisodeName={displayEpisodeName}
                    fallbackStatus={t("vodPlay.status") || "Phim"}
                />

                <div className="flex flex-wrap items-center gap-3 md:justify-end">
                    <div className="flex items-center gap-2">
                        <FavoriteShareButtons
                            movie={movie}
                            isFavorited={isFavorited}
                            toggleFavorite={toggleFavorite}
                            onShare={onShare}
                        />
                        <Button
                            onPress={handleCastTV}
                            variant="secondary"
                            size="sm"
                            title="Cast TV"
                        >
                            <TvIcon className="h-4 w-4 text-blue-500 stroke-2" />
                            <span>Cast TV</span>
                        </Button>
                        <Button
                            onPress={togglePiP}
                            variant="secondary"
                            size="sm"
                            title="Picture-in-Picture"
                        >
                            <RectangleStackIcon className="h-4 w-4 stroke-2" />
                            <span className="hidden sm:inline">PiP</span>
                        </Button>
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

                <div className="flex items-center gap-3">
                    <CompactViewSwitch
                        isCompactView={isCompactView}
                        setIsCompactView={setIsCompactView}
                        t={t}
                    />
                </div>
            </div>
        </div>
    );
};

export const VodPlayerContainer = ({
    playerRef,
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
}) => (
    <div className="flex w-full flex-col overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/5">
        <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-black md:max-h-[80vh]">
            {!currentUrlRef.current && memoizedBackgrounds && (
                <div
                    className="absolute inset-0 scale-110 bg-cover bg-center opacity-50 blur-2xl transition-opacity duration-700"
                    style={{
                        backgroundImage: `url(${getMovieImage(memoizedBackgrounds.thumb_url || memoizedBackgrounds.poster_url)})`,
                    }}
                />
            )}

            <div ref={playerRef} className="relative z-10 h-full w-full" />

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
            playPrevEpisode={playPrevEpisode}
            playNextEpisode={playNextEpisode}
            episodes={episodes}
            activeEpisode={activeEpisode}
            movie={movie}
            isFavorited={isFavorited}
            toggleFavorite={toggleFavorite}
            onShare={onShare}
        />

        <VodPlaySettingsBar
            autoplayEnabled={autoplayEnabled}
            setAutoplayEnabled={setAutoplayEnabled}
            skipIntroEnabled={skipIntroEnabled}
            setSkipIntroEnabled={setSkipIntroEnabled}
            introDuration={introDuration}
            setIntroDuration={setIntroDuration}
            setIntroDurations={setIntroDurations}
            slug={slug}
            isCompactView={isCompactView}
            setIsCompactView={setIsCompactView}
        />
    </div>
);
