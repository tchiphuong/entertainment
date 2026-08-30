import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import VodLayout from "../../components/layout/VodLayout";
import { PlaySkeleton } from "../../components/vod/VodSkeletons";
import { useAuth } from "../../contexts/AuthContext";
import { fetchHistoryFromFirestore } from "../../services/firebaseHelpers";
import {
    initNetworkInterceptors,
    getMovieImage,
    computeEpisodeListData,
    computeMaxDigits,
    formatEpisodeNameHelper,
    togglePiP,
    handleCastTV,
    ensureYoutubeEmbedUrl,
} from "../../utils/vodPlayHelpers";
import {
    VodPlayerContainer,
} from "../../components/vod/play/VodPlayerSection";
import {
    VodPlayEpisodesSection,
} from "../../components/vod/play/VodPlayEpisodesSection";
import {
    VodPlayMediaSection,
} from "../../components/vod/play/VodPlayMediaSection";
import {
    ImageModal,
    ShareModal,
    NotFoundState,
} from "../../components/vod/play/VodPlayModals";
import {
    VodPlayBackgroundHero,
} from "../../components/vod/play/VodPlayHeroSection";
import {
    useVodPlayRouteParams,
    useVodPlayState,
    useVodPlayCompactView,
    useVodPlayIntroSettings,
    useVodPlaySyncRefs,
    useVodPlayDetailSync,
    useVodPlayerManagement,
    useVodPlayCountdown,
    useVideoKeyboardShortcuts,
    usePlayerInitialization,
    useMediaSession,
    useSeasonDetection,
    useFirestoreHistorySync,
    useFetchSeasonEpisodes,
    useVodFavorites,
    useVodPlayModals,
} from "../../hooks/vod/useVodPlayLogic";

// Khởi tạo Network Interceptors một lần cho toàn ứng dụng
initNetworkInterceptors();

export default function VodPlay() {
    const location = useLocation();
    const backgrounds = location.state?.backgrounds;
    const { t } = useTranslation();
    const { currentUser } = useAuth();

    const { slug, episodeParam, serverParam, sourceParam, setSearchParams } = useVodPlayRouteParams();

    const playerRef = useRef(null);
    const currentUrlRef = useRef(null);
    const hasInitializedRef = useRef(false);
    const lastFirestoreSyncRef = useRef(0);
    const positionRestoredRef = useRef(null);
    const lastHistorySyncRef = useRef(0);

    const {
        movie, setMovie, episodes, setEpisodes, activeEpisode, setActiveEpisode,
        currentEpisodeId, setCurrentEpisodeId, isLoading, setIsLoading,
        errorMessage, setErrorMessage, tmdbData, setTmdbData, tmdbCredits, setTmdbCredits,
        tmdbImages, setTmdbImages, tmdbVideos, setTmdbVideos, tmdbRelated, setTmdbRelated,
        imdbEpisodes, setImdbEpisodes, viewHistory, setViewHistory, favorites, setFavorites,
        autoplayEnabled, setAutoplayEnabled,
    } = useVodPlayState();

    const viewHistoryRef = useRef(viewHistory);
    const { isCompactView, setIsCompactView } = useVodPlayCompactView();
    const {
        skipIntroEnabled, setSkipIntroEnabled, skipIntroEnabledRef,
        setIntroDurations, introDuration, setIntroDuration, introDurationRef,
    } = useVodPlayIntroSettings(slug);

    const { autoplayEnabledRef, episodesRef, activeEpisodeRef, currentEpisodeIdRef, movieRef } = useVodPlaySyncRefs({
        autoplayEnabled, episodes, activeEpisode, currentEpisodeId, movie,
    });

    const [memoizedBackgrounds, setMemoizedBackgrounds] = useState(() => {
        if (backgrounds) {
            return {
                poster_url: backgrounds.poster_url || "",
                thumb_url: backgrounds.thumb_url || "",
            };
        }
        return null;
    });

    useEffect(() => {
        document.title = slug ? `${t("vodPlay.loading") || "Đang tải..."} • VOD Player` : "VOD Player";
        if (slug) {
            hasInitializedRef.current = false;
            currentUrlRef.current = null;
            setMemoizedBackgrounds(
                location.state?.backgrounds
                    ? {
                          poster_url: location.state.backgrounds.poster_url || "",
                          thumb_url: location.state.backgrounds.thumb_url || "",
                      }
                    : null
            );
        }
    }, [slug, location.state, t]);

    useEffect(() => {
        if (movie?.name) {
            document.title = `${movie.name} • VOD Player`;
        }
    }, [movie]);

    const maxDigits = useMemo(() => computeMaxDigits(episodes), [episodes]);
    const formatEpisodeName = useCallback(
        (name) => formatEpisodeNameHelper(name, maxDigits, t("vodPlay.episode") || "Tập"),
        [maxDigits, t]
    );

    const episodeListData = useMemo(() => {
        return computeEpisodeListData(activeEpisode, imdbEpisodes, movie, tmdbData);
    }, [activeEpisode, imdbEpisodes, movie, tmdbData]);

    const { fetchedTmdbVideos } = useVodPlayDetailSync({
        slug, sourceParam, setMovie, setEpisodes, activeEpisode, setActiveEpisode,
        setTmdbData, setTmdbCredits, setTmdbImages, setTmdbVideos, setTmdbRelated,
        setIsLoading, setMemoizedBackgrounds,
    });

    const {
        playNextEpisode, playPrevEpisode, switchTab, openEpisode, initializeFromUrl,
    } = useVodPlayerManagement({
        movie, slug, serverParam, episodeParam, activeEpisode, setActiveEpisode,
        currentEpisodeId, setCurrentEpisodeId, episodesRef, currentEpisodeIdRef, activeEpisodeRef, movieRef,
        hasInitializedRef, positionRestoredRef, currentUrlRef, playerRef, memoizedBackgrounds,
        introDurationRef, skipIntroEnabledRef, autoplayEnabledRef, setShowNextCountdown: () => {}, setCountdownSeconds: () => {},
        COUNTDOWN_DURATION: 5, setErrorMessage, setSearchParams, fetchedTmdbVideos, viewHistory,
        viewHistoryRef, setViewHistory, lastHistorySyncRef, currentUser, lastFirestoreSyncRef, formatEpisodeName,
    });

    const {
        showNextCountdown, countdownSeconds, COUNTDOWN_DURATION, cancelCountdown, skipCountdown,
    } = useVodPlayCountdown(playNextEpisode);

    const handleSelectTrailerVideo = useCallback(
        (video) => {
            if (!video?.key) return;
            const trailerItem = {
                name: video.name || "Trailer",
                slug: "trailer",
                link_embed: ensureYoutubeEmbedUrl(video.key ? `https://www.youtube.com/watch?v=${video.key}` : ""),
                link_m3u8: null,
                backups: [],
            };
            const trailerGroup = {
                server_name: "Trailer",
                type_id: "trailer",
                color: "bg-zinc-800",
                server_data: [trailerItem],
            };
            setActiveEpisode(trailerGroup);
            openEpisode(trailerItem, trailerGroup, movie);
            window.scrollTo({ top: 0, behavior: "smooth" });
        },
        [movie, openEpisode, setActiveEpisode]
    );

    const { isFavorited, toggleFavorite } = useVodFavorites(favorites, setFavorites, setErrorMessage, getMovieImage);
    const {
        showShareModal, setShowShareModal, shareMessage,
        showImageModal, setShowImageModal, modalImages, setModalImages,
        currentImageIndex, setCurrentImageIndex, copyToClipboard,
    } = useVodPlayModals(t);

    const detectedSeason = useSeasonDetection(movie);
    useMediaSession(movie, currentEpisodeId, memoizedBackgrounds);
    useFetchSeasonEpisodes(tmdbData, movie, detectedSeason, setImdbEpisodes);
    useFirestoreHistorySync(currentUser, setViewHistory, fetchHistoryFromFirestore);

    usePlayerInitialization({
        movie, episodes, tmdbVideos, hasInitializedRef, initializeFromUrl,
        setEpisodes, setActiveEpisode, setErrorMessage, t,
    });

    useVideoKeyboardShortcuts({
        showImageModal, showShareModal, playerRef, playNextEpisode, playPrevEpisode,
    });

    return (
        <VodLayout>
            <VodPlayBackgroundHero
                movie={movie}
                memoizedBackgrounds={memoizedBackgrounds || backgrounds}
                tmdbData={tmdbData}
                getMovieImage={getMovieImage}
            />

            {errorMessage && (
                <div className="fixed bottom-6 right-6 z-50 flex animate-bounce items-center gap-2 rounded-xl bg-red-600 px-6 py-3 font-semibold text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {errorMessage}
                </div>
            )}

            {isLoading && <PlaySkeleton />}
            {!isLoading && !movie && <NotFoundState />}

            <ImageModal
                showImageModal={showImageModal}
                setShowImageModal={setShowImageModal}
                modalImages={modalImages}
                currentImageIndex={currentImageIndex}
                setCurrentImageIndex={setCurrentImageIndex}
            />

            <ShareModal
                showShareModal={showShareModal}
                setShowShareModal={setShowShareModal}
                movie={movie}
                shareMessage={shareMessage}
                copyToClipboard={copyToClipboard}
                t={t}
            />

            {!isLoading && movie && (
                <div className="relative min-h-screen">
                    <div className="container relative z-10 mx-auto flex-col gap-8 px-4 pb-12 pt-20">

                        <div className="flex flex-col gap-8">
                            <VodPlayerContainer
                                playerRef={playerRef}
                                currentUrlRef={currentUrlRef}
                                memoizedBackgrounds={memoizedBackgrounds}
                                getMovieImage={getMovieImage}
                                showNextCountdown={showNextCountdown}
                                countdownSeconds={countdownSeconds}
                                COUNTDOWN_DURATION={COUNTDOWN_DURATION}
                                cancelCountdown={cancelCountdown}
                                skipCountdown={skipCountdown}
                                currentEpisodeId={currentEpisodeId}
                                handleCastTV={() => handleCastTV(currentUrlRef.current)}
                                togglePiP={togglePiP}
                                episodeListData={episodeListData}
                                playPrevEpisode={playPrevEpisode}
                                playNextEpisode={playNextEpisode}
                                episodes={episodes}
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
                                movie={movie}
                                isFavorited={isFavorited}
                                toggleFavorite={toggleFavorite}
                                onShare={() => setShowShareModal(true)}
                            />

                            <VodPlayEpisodesSection
                                episodes={episodes}
                                activeEpisode={activeEpisode}
                                switchTab={switchTab}
                                isCompactView={isCompactView}
                                episodeListData={episodeListData}
                                currentEpisodeId={currentEpisodeId}
                                openEpisode={openEpisode}
                                movie={movie}
                                formatEpisodeName={formatEpisodeName}
                            />
                        </div>

                        <VodPlayMediaSection
                            movie={movie}
                            tmdbData={tmdbData}
                            tmdbImages={tmdbImages}
                            tmdbCredits={tmdbCredits}
                            tmdbVideos={tmdbVideos}
                            tmdbRelated={tmdbRelated}
                            onSelectTrailer={handleSelectTrailerVideo}
                            setModalImages={setModalImages}
                            setCurrentImageIndex={setCurrentImageIndex}
                            setShowImageModal={setShowImageModal}
                            getMovieImage={getMovieImage}
                        />
                    </div>
                </div>
            )}
        </VodLayout>
    );
}
