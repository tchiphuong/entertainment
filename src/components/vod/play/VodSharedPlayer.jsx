import { useTranslation } from "react-i18next";
import { PlayIcon } from "@heroicons/react/24/outline";
import "shaka-player/dist/controls.css";
import "../../../assets/styles/shaka-player.css";

const VideoIframeEmbed = ({ linkEmbed, title }) => (
    <iframe
        src={linkEmbed}
        title={title || "Video"}
        className="h-full w-full border-none object-contain"
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-forms allow-fullscreen allow-popups"
    />
);

const VideoEmptyPlaceholder = ({ t }) => (
    <div className="flex h-full w-full flex-col items-center justify-center text-zinc-500">
        <PlayIcon className="h-12 w-12 stroke-1 opacity-40" />
        <p className="mt-2 text-xs">
            {t("vodPlay.noPlayableLink", { defaultValue: "Chưa có nguồn phát video khả dụng." })}
        </p>
    </div>
);

const BackgroundPoster = ({ posterUrl }) => {
    if (!posterUrl) return null;
    return (
        <div
            className="absolute inset-0 scale-110 bg-cover bg-center opacity-30 blur-xl transition-opacity duration-700"
            style={{ backgroundImage: `url(${posterUrl})` }}
        />
    );
};

const DirectShakaVideo = ({ videoRef }) => (
    <div className="relative z-10 h-full w-full">
        <video
            id="shaka-video"
            ref={videoRef}
            controls
            playsInline
            className="h-full w-full object-contain"
        />
    </div>
);

const PlayerCoreMedia = ({
    playerRef,
    episode,
    movieTitle,
    videoRef,
    currentUrl,
    t,
}) => {
    if (playerRef) {
        return <div ref={playerRef} className="relative z-10 h-full w-full" />;
    }

    const playM3u8 = episode?.link_m3u8;
    if (playM3u8) {
        return (
            <DirectShakaVideo videoRef={videoRef} />
        );
    }

    const playEmbed = episode?.link_embed;
    if (playEmbed) {
        return (
            <div className="relative z-10 h-full w-full">
                <VideoIframeEmbed linkEmbed={playEmbed} title={movieTitle} />
            </div>
        );
    }

    if (!currentUrl) {
        return <VideoEmptyPlaceholder t={t} />;
    }

    return null;
};

const resolvePosterUrl = (movie, backgrounds, getImage) => {
    const raw = backgrounds?.thumb_url || backgrounds?.poster_url || movie?.thumb_url || movie?.poster_url || "";
    if (getImage && raw) {
        return getImage(raw);
    }
    return raw;
};

/**
 * Component trình phát video trung tâm cho trang xem phim (Play)
 */
export const VodSharedPlayer = ({
    episode,
    movie,
    videoRef,
    playerRef,
    currentUrl,
    memoizedBackgrounds,
    getMovieImage,
    overlays,
    className = "",
    children,
}) => {
    const { t } = useTranslation();
    const posterUrl = resolvePosterUrl(movie, memoizedBackgrounds, getMovieImage);
    const hasMedia = Boolean(currentUrl || episode?.link_m3u8 || episode?.link_embed);
    const showBackground = !hasMedia && Boolean(posterUrl);

    return (
        <div className={`relative flex aspect-video w-full shrink-0 items-center justify-center overflow-hidden bg-black ${className}`}>
            {showBackground && <BackgroundPoster posterUrl={posterUrl} />}
            <PlayerCoreMedia
                playerRef={playerRef}
                episode={episode}
                movieTitle={movie?.name || "Video"}
                videoRef={videoRef}
                currentUrl={currentUrl}
                t={t}
            />
            {overlays}
            {children}
        </div>
    );
};

export default VodSharedPlayer;
