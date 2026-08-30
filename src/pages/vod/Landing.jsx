import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
    HeroSkeleton,
    MovieRowSkeleton,
} from "../../components/vod/VodSkeletons";

import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { Button } from "../../components/ui";
import { useVodData } from "../../hooks/useVodData";
import { useImageFallback } from "../../hooks/useImageFallback";
import { useHorizontalScrollState } from "../../hooks/useHorizontalScrollState";
import MovieLanguageBadges from "../../components/vod/MovieLanguageBadges";
import VodMovieCard from "../../components/vod/VodMovieCard";
import VodTopViewRow from "../../components/vod/VodTopViewRow";
import { CATEGORIES, SOURCES } from "../../constants";
import { getMoviePlayUrl } from "../../utils/vodHelpers";
import VodLayout from "../../components/layout/VodLayout";
import { useVodContext } from "../../contexts/VodContext";

const HeroSlideBadges = ({ movie, idx }) => (
    <div className="flex flex-wrap items-center gap-2 text-xs font-bold md:gap-3">
        {movie.tmdbBranding?.brandLogo && (
            <div className="mr-1 flex items-center border-r border-zinc-700/80 pr-3">
                <div className="rounded-md bg-black/50 px-2 py-1 backdrop-blur-md">
                    <img
                        loading="lazy"
                        src={movie.tmdbBranding.brandLogo}
                        alt="Brand Logo"
                        className="h-5 md:h-7 object-contain"
                    />
                </div>
            </div>
        )}
        <span className="flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5 text-[0.625rem] font-black uppercase text-white shadow-sm md:text-xs">
            TOP {idx + 1} • HOT
        </span>
        {movie.year && (
            <span className="rounded-md border border-zinc-700/80 bg-zinc-900/90 px-2 py-0.5 text-[0.625rem] font-bold text-zinc-300 md:text-xs">
                {movie.year}
            </span>
        )}
        {movie.quality && (
            <span className="rounded-md border border-zinc-700/80 bg-zinc-900/90 px-2 py-0.5 text-[0.625rem] font-bold text-white md:text-xs">
                {movie.quality}
            </span>
        )}
        <MovieLanguageBadges lang={movie.lang} useLight={true} />
        {movie.episode_current && !movie.isTrailer && (
            <span className="hidden rounded-md border border-zinc-700/80 bg-zinc-900/90 px-2 py-0.5 text-[0.625rem] font-bold text-zinc-300 sm:inline-block md:text-xs">
                {movie.episode_current}
            </span>
        )}
    </div>
);

const HeroSlideActionButtons = ({ movie, isFav, navigate, toggleFavorite, t }) => (
    <div className="flex items-center gap-2.5 pt-2 md:gap-4 md:pt-4">
        <button
            type="button"
            onClick={() =>
                navigate(getMoviePlayUrl(movie, "source_k"), {
                    state: {
                        backgrounds: {
                            poster_url: movie.poster_url || movie.poster || movie.poster_path,
                            thumb_url: movie.thumb_url || movie.thumbnail || movie.backdrop_url || movie.backdrop_path,
                        },
                    },
                })
            }
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl md:rounded-full bg-red-600 py-3 px-5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-red-600/30 transition-all hover:bg-red-500 active:scale-95 md:flex-none md:px-8 md:py-3.5 md:text-sm"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 fill-current md:h-5 md:w-5" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
            </svg>
            <span>{t("vods.watchNow") || "Xem Ngay"}</span>
        </button>

        <button
            type="button"
            onClick={() => toggleFavorite(movie)}
            className={`flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-2xl md:rounded-full border transition-all active:scale-90 md:h-12 md:px-6 md:text-sm ${
                isFav
                    ? "border-red-600 bg-red-600/20 text-red-500 shadow-md shadow-red-600/20"
                    : "border-zinc-700/80 bg-zinc-900/90 text-zinc-300 hover:border-zinc-500 hover:text-white"
            }`}
            title={isFav ? t("common.remove") : t("common.add")}
            aria-label="Yêu thích"
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill={isFav ? "currentColor" : "none"}
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
            </svg>
            <span className="hidden md:inline font-bold">
                {isFav ? t("common.remove") || "Đã lưu" : t("vods.favorites") || "Yêu thích"}
            </span>
        </button>

        <button
            type="button"
            onClick={() =>
                navigate(getMoviePlayUrl(movie, "source_k"), {
                    state: {
                        backgrounds: {
                            poster_url: movie.poster_url || movie.poster || movie.poster_path,
                            thumb_url: movie.thumb_url || movie.thumbnail || movie.backdrop_url || movie.backdrop_path,
                        },
                    },
                })
            }
            className="flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-2xl md:rounded-full border border-zinc-700/80 bg-zinc-900/90 px-3.5 text-xs font-bold text-zinc-200 transition-all hover:bg-zinc-800 hover:text-white active:scale-95 md:h-12 md:px-6 md:text-sm"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="hidden sm:inline">{t("vods.info") || "Chi tiết"}</span>
        </button>
    </div>
);

const HeroSlideItem = ({
    movie,
    idx,
    isActive,
    isFav,
    getImageUrl,
    handleImageError,
    navigate,
    toggleFavorite,
    t,
}) => (
    <div
        className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
            isActive ? "pointer-events-auto z-10 opacity-100" : "pointer-events-none invisible z-0 opacity-0"
        }`}
    >
        <div className="absolute inset-0 z-0">
            <img
                loading="lazy"
                src={getImageUrl(movie, "thumbnail")}
                alt={movie.name}
                className="hidden h-full w-full object-cover object-center brightness-[0.75] md:block"
                onError={handleImageError}
            />
            <img
                loading="lazy"
                src={getImageUrl(movie, "poster")}
                alt={movie.name}
                className="h-full w-full object-cover object-top brightness-[0.65] md:hidden"
                onError={handleImageError}
            />
            <div className="absolute inset-0 bg-black/40" />
        </div>

        <div className="relative z-30 mx-auto flex h-full w-full max-w-[120rem] flex-col justify-end px-4 pb-12 md:justify-center md:px-12 md:pb-0 lg:px-20">
            <div className={`max-w-3xl lg:max-w-4xl space-y-3 md:space-y-5 ${isActive ? "animate-fade-in-down" : "opacity-0"}`}>
                <HeroSlideBadges movie={movie} idx={idx} />

                <div>
                    {movie.tmdbBranding?.titleLogo ? (
                        <div className="mb-2 max-h-16 max-w-[16.25rem] md:max-h-28 md:max-w-[28rem] lg:max-h-36 lg:max-w-[34rem]">
                            <img
                                loading="lazy"
                                src={movie.tmdbBranding.titleLogo}
                                alt={movie.name}
                                className="max-h-16 md:max-h-28 lg:max-h-36 w-auto object-contain object-left drop-shadow-2xl"
                            />
                        </div>
                    ) : (
                        <h1 className="text-balance text-2xl font-black leading-tight tracking-tight text-white drop-shadow-2xl md:text-5xl lg:text-6xl md:leading-[1.15]">
                            {movie.name}
                        </h1>
                    )}
                    {movie.origin_name && movie.origin_name !== movie.name && (
                        <p className="mt-1 text-xs font-semibold text-zinc-400 drop-shadow md:text-sm">
                            {movie.origin_name}
                        </p>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-zinc-300 md:text-sm">
                    {movie.category?.length > 0 ? (
                        movie.category.slice(0, 5).map((c, i, arr) => (
                            <span key={c.id || i} className="flex items-center gap-1.5">
                                <span className="hover:text-red-400">{c.name}</span>
                                {i < arr.length - 1 && <span className="text-zinc-600">•</span>}
                            </span>
                        ))
                    ) : (
                        <span>{t("vods.recommendedHeader")}</span>
                    )}
                </div>

                <p className="hidden md:line-clamp-3 max-w-2xl text-sm font-medium leading-relaxed text-zinc-300 drop-shadow-md lg:text-base">
                    {movie.content?.replace(/<[^>]*>?/gm, "")}
                </p>

                <HeroSlideActionButtons
                    movie={movie}
                    isFav={isFav}
                    navigate={navigate}
                    toggleFavorite={toggleFavorite}
                    t={t}
                />
            </div>
        </div>
    </div>
);

export default function VodLanding() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const {
        favorites: rawFavorites,
        history: rawHistory,
        historyLoading,
        removeFromHistory,
        clearAllHistory,
        isFavorite,
        toggleFavorite,
    } = useVodContext();
    const { sections, heroMovies, loading } = useVodData(CATEGORIES);
    const { getImageUrl, handleImageError } = useImageFallback();

    const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
    const sliderTimerRef = useRef(null);
    const touchStartX = useRef(0);
    const touchEndX = useRef(0);
    const [historyItems, setHistoryItems] = useState([]);
    const [favoriteItems, setFavoriteItems] = useState([]);
    const [favoriteLoading, setFavoriteLoading] = useState(false);

    const normalizeLibraryItems = useCallback(
        (rawItems) => {
            return (Array.isArray(rawItems) ? rawItems : [])
                .filter((item) => item?.slug)
                .map((item) => {
                    const poster =
                        item.poster || item.poster_url || item.thumb_url || "";
                    const server = String(item.server || "").toLowerCase();

                    let itemSource = SOURCES.SOURCE_K;
                    if (server.includes(SOURCES.SOURCE_O))
                        itemSource = SOURCES.SOURCE_O;
                    if (server.includes(SOURCES.SOURCE_C))
                        itemSource = SOURCES.SOURCE_C;

                    return {
                        ...item,
                        source: itemSource,
                        name: item.name || t("vods.unknownTitle"),
                        poster_url: poster,
                        thumb_url: poster,
                        poster,
                        thumbnail: poster,
                    };
                });
        },
        [t],
    );

    // Đồng bộ history từ VodContext
    useEffect(() => {
        const normalizedHistory = normalizeLibraryItems(rawHistory);
        setHistoryItems(normalizedHistory);
    }, [rawHistory, normalizeLibraryItems]);

    useEffect(() => {
        const normalizedFavorites = normalizeLibraryItems(rawFavorites);
        setFavoriteItems(normalizedFavorites);
        setFavoriteLoading(false);
    }, [rawFavorites, normalizeLibraryItems]);

    useEffect(() => {
        document.title = "VOD Hub • Media Library";
    }, []);

    const startSlider = useCallback(() => {
        if (sliderTimerRef.current) clearInterval(sliderTimerRef.current);
        sliderTimerRef.current = setInterval(() => {
            setCurrentHeroIndex((prev) =>
                heroMovies.length > 0 ? (prev + 1) % heroMovies.length : 0,
            );
        }, 8000);
    }, [heroMovies]);

    const nextHero = useCallback(() => {
        setCurrentHeroIndex((prev) =>
            heroMovies.length > 0 ? (prev + 1) % heroMovies.length : 0,
        );
        startSlider();
    }, [heroMovies, startSlider]);

    const prevHero = useCallback(() => {
        setCurrentHeroIndex((prev) =>
            heroMovies.length > 0
                ? (prev - 1 + heroMovies.length) % heroMovies.length
                : 0,
        );
        startSlider();
    }, [heroMovies, startSlider]);

    const isSwiping = useRef(false);

    const handleTouchStart = (e) => {
        touchStartX.current = e.targetTouches[0].clientX;
        touchEndX.current = e.targetTouches[0].clientX; // Khởi tạo bằng start để tránh distance lớn khi chỉ tap
        isSwiping.current = false;
    };

    const handleTouchMove = (e) => {
        touchEndX.current = e.targetTouches[0].clientX;
        // Chỉ đánh dấu swiping nếu di chuyển đủ xa (> 10px)
        if (Math.abs(touchStartX.current - touchEndX.current) > 10) {
            isSwiping.current = true;
        }
    };

    const handleTouchEnd = (e) => {
        // Nếu không swipe (chỉ tap) → bỏ qua, cho phép button click bình thường
        if (!isSwiping.current) {
            touchStartX.current = 0;
            touchEndX.current = 0;
            return;
        }

        const threshold = 70;
        const distance = touchStartX.current - touchEndX.current;

        if (Math.abs(distance) > threshold) {
            if (e.cancelable) e.preventDefault();
            if (distance > threshold) {
                nextHero();
            } else if (distance < -threshold) {
                prevHero();
            }
        }
        touchStartX.current = 0;
        touchEndX.current = 0;
        isSwiping.current = false;
    };

    useEffect(() => {
        if (heroMovies.length > 0) {
            startSlider();
        }
        return () => {
            if (sliderTimerRef.current) clearInterval(sliderTimerRef.current);
        };
    }, [heroMovies, startSlider]);

    return (
        <VodLayout>
            {/* Hero Section */}
            {loading ? (
                <HeroSkeleton />
            ) : (
                <div
                    className="relative w-full h-[78vh] min-h-[32.5rem] max-h-[45rem] overflow-hidden select-none bg-zinc-950 md:h-screen md:min-h-[50rem] md:max-h-none"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    {heroMovies.map((movie, idx) => (
                        <HeroSlideItem
                            key={movie.slug || idx}
                            movie={movie}
                            idx={idx}
                            isActive={idx === currentHeroIndex}
                            isFav={isFavorite?.(movie.slug)}
                            getImageUrl={getImageUrl}
                            handleImageError={handleImageError}
                            navigate={navigate}
                            toggleFavorite={toggleFavorite}
                            t={t}
                        />
                    ))}

                    {/* Navigation Arrows (Desktop Only) */}
                    <div className="pointer-events-none absolute left-0 top-1/2 z-40 hidden w-16 -translate-y-1/2 items-center justify-start pl-4 md:flex lg:pl-8">
                        <button
                            type="button"
                            onClick={prevHero}
                            className="group pointer-events-auto flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-zinc-700/80 bg-zinc-950/80 text-white shadow-xl backdrop-blur-md transition-all hover:scale-110 hover:border-red-600 hover:bg-red-600 active:scale-90"
                            aria-label="Slide trước"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                    </div>
                    <div className="pointer-events-none absolute right-0 top-1/2 z-40 hidden w-16 -translate-y-1/2 items-center justify-end pr-4 md:flex lg:pr-8">
                        <button
                            type="button"
                            onClick={nextHero}
                            className="group pointer-events-auto flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-zinc-700/80 bg-zinc-950/80 text-white shadow-xl backdrop-blur-md transition-all hover:scale-110 hover:border-red-600 hover:bg-red-600 active:scale-90"
                            aria-label="Slide tiếp theo"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>

                    {/* App-like Slide Pill Indicators */}
                    <div className="absolute bottom-3.5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 md:bottom-6 md:gap-2">
                        {heroMovies.map((movie, idx) => (
                            <button
                                key={movie.slug || idx}
                                type="button"
                                onClick={() => {
                                    setCurrentHeroIndex(idx);
                                    startSlider();
                                }}
                                className="group flex h-4 cursor-pointer items-center justify-center p-0.5"
                                aria-label={`Slide ${idx + 1}`}
                            >
                                <span
                                    className={`h-1 rounded-full transition-all duration-300 ${
                                        idx === currentHeroIndex
                                            ? "w-6 bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.8)]"
                                            : "w-1.5 bg-zinc-700 group-hover:bg-zinc-500"
                                    }`}
                                />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="relative z-20 mt-10 space-y-8 pb-32">
                {/* Top View nằm trên đầu danh sách (trên cả Lịch sử xem) */}
                {loading ? (
                    <MovieRowSkeleton title={t("vods.topViews")} />
                ) : (
                    <VodTopViewRow
                        title={t("vods.topViews")}
                        items={sections["top-view"]?.items || []}
                        source={SOURCES.SOURCE_TMDB}
                        link="/vod/category/top-view?source=source_tmdb"
                        getImageUrl={getImageUrl}
                        handleImageError={handleImageError}
                    />
                )}

                {(loading || historyLoading) ? (
                    <MovieRowSkeleton title={t("vods.history")} />
                ) : (
                    <MovieRow
                        title={t("vods.history")}
                        items={historyItems}
                        source=""
                        link="/vod/category/history"
                        getImageUrl={getImageUrl}
                        handleImageError={handleImageError}
                        navigate={navigate}
                        onDelete={removeFromHistory}
                        onClearAll={clearAllHistory}
                    />
                )}

                {(loading || favoriteLoading) ? (
                    <MovieRowSkeleton title={t("vods.favorites")} />
                ) : (
                    <MovieRow
                        title={t("vods.favorites")}
                        items={favoriteItems}
                        source=""
                        link="/vod/category/favorites"
                        getImageUrl={getImageUrl}
                        handleImageError={handleImageError}
                        navigate={navigate}
                    />
                )}

                {loading
                    ? CATEGORIES.filter(
                          (cat) =>
                              cat.isView !== false &&
                              cat.id !== "history" &&
                              cat.id !== "favorites" &&
                              cat.id !== "top-view",
                      ).map((cat) => (
                          <MovieRowSkeleton key={cat.id} title={t(cat.titleKey || cat.title)} />
                      ))
                    : CATEGORIES.filter(
                          (cat) =>
                              cat.isView !== false &&
                              cat.id !== "history" &&
                              cat.id !== "favorites" &&
                              cat.id !== "top-view",
                      ).map((cat) => {
                          const categoryLink = cat.type?.startsWith("quoc-gia/")
                              ? `/vod/country/${cat.type.split("/")[1]}?source=${cat.source}`
                              : `/vod/category/${cat.id}?source=${cat.source}`;

                          return (
                              <MovieRow
                                  key={cat.id}
                                  title={t(cat.titleKey || cat.title)}
                                  items={sections[cat.id]?.items || []}
                                  source={cat.source}
                                  link={categoryLink}
                                  getImageUrl={getImageUrl}
                                  handleImageError={handleImageError}
                                  navigate={navigate}
                              />
                          );
                      })}
            </div>

            <footer className="border-t border-zinc-900 bg-zinc-950 px-4 py-24 text-zinc-500 md:px-12 lg:px-20">
                <div className="mx-auto flex max-w-7xl flex-col justify-between gap-12 md:flex-row">
                    <div className="max-w-sm space-y-6">
                        <p className="text-sm font-medium leading-relaxed">
                            {t("footer.description")}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-10 md:grid-cols-3 md:gap-20">
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold uppercase tracking-widest text-white">
                                {t("footer.explore")}
                            </h4>
                            <div className="flex flex-col gap-2.5 text-xs font-medium">
                                <Link
                                    to="/tv"
                                    className="transition-colors hover:text-white"
                                >
                                    {t("footer.liveTv")}
                                </Link>
                                <Link
                                    to="/schedule"
                                    className="transition-colors hover:text-white"
                                >
                                    {t("footer.schedule")}
                                </Link>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold uppercase tracking-widest text-white">
                                {t("footer.info")}
                            </h4>
                            <div className="flex flex-col gap-2.5 text-xs font-medium">
                                <Link
                                    to="/"
                                    className="transition-colors hover:text-white"
                                >
                                    {t("footer.terms")}
                                </Link>
                                <Link
                                    to="/"
                                    className="transition-colors hover:text-white"
                                >
                                    {t("footer.privacy")}
                                </Link>
                                <Link
                                    to="/"
                                    className="transition-colors hover:text-white"
                                >
                                    {t("footer.about")}
                                </Link>
                                <Link
                                    to="/"
                                    className="transition-colors hover:text-white"
                                >
                                    {t("footer.contact")}
                                </Link>
                            </div>
                        </div>
                        <div className="hidden space-y-4 md:block">
                            <h4 className="text-sm font-bold uppercase tracking-widest text-white">
                                {t("footer.apps")}
                            </h4>
                            <div className="flex flex-col gap-3">
                                <div className="flex cursor-pointer items-center gap-2 rounded border border-zinc-800 bg-zinc-900 px-4 py-2 text-[10px] font-bold text-zinc-300 transition-colors hover:bg-zinc-800">
                                    <img
                                        loading="lazy"
                                        src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg"
                                        alt="Play Store"
                                        className="h-6"
                                    />
                                </div>
                                <div className="flex cursor-pointer items-center gap-2 rounded border border-zinc-800 bg-zinc-900 px-4 py-2 text-[10px] font-bold text-zinc-300 transition-colors hover:bg-zinc-800">
                                    <img
                                        loading="lazy"
                                        src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg"
                                        alt="App Store"
                                        className="h-6"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="mx-auto mt-20 flex max-w-7xl flex-col items-center justify-between gap-4 border-t border-dashed border-zinc-900 pt-8 text-[10px] font-bold uppercase tracking-[0.2em] md:flex-row">
                    <p>
                        &copy; 2026 MoviesHub Entertainment. All rights
                        reserved.
                    </p>
                </div>
            </footer>

            <style
                dangerouslySetInnerHTML={{
                    __html: `
                @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                .animate-fade-in-down { animation: fade-in-down 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .animate-fade-in-up { animation: fade-in-up 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: 0.2s; }
                .animate-fade-in { animation: fade-in 1.5s ease-out forwards; animation-delay: 0.1s; }
                
                @keyframes fade-in-down { from { opacity: 0; transform: translateY(-30px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes fade-in-up { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
            `,
                }}
            />
        </VodLayout>
    );
}

function MovieRow({
    title,
    items,
    source,
    link,
    getImageUrl,
    handleImageError,
    onDelete,
    onClearAll,
}) {
    const { t } = useTranslation();
    const { scrollRef, canScrollLeft, canScrollRight, hasOverflow, scrollLeft, scrollRight } =
        useHorizontalScrollState([items?.length]);

    if (!items || items.length === 0) return null;

    return (
        <div className="group/row space-y-5">
            <div className="group/title -mb-4 flex items-center justify-between gap-4 px-4 md:px-12 lg:px-20">
                <div className="flex items-center gap-3">
                    <h2 className="flex items-center gap-3 text-2xl font-black text-zinc-100 md:text-3xl">
                        <span className="h-8 w-1.5 rounded-full bg-red-600"></span>
                        {title}
                    </h2>
                    {/* Nút xóa tất cả lịch sử */}
                    {onClearAll && items.length > 0 && (
                        <button
                            type="button"
                            onClick={onClearAll}
                            className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 transition-all hover:border-red-600/50 hover:bg-red-600/10 hover:text-red-500 active:scale-95"
                            title={t("common.clearAll") || "Xóa tất cả"}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-3.5 w-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                            </svg>
                            {t("common.clearAll") || "Xóa tất cả"}
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {link && (
                        <Link
                            to={link}
                            className="flex items-center gap-1 text-sm font-bold text-zinc-500 transition-all duration-300 hover:text-red-500 focus:opacity-100"
                        >
                            {t("common.seeMore")}
                            <ChevronRightIcon className="h-4 w-4 stroke-2" />
                        </Link>
                    )}
                    {hasOverflow && (
                        <div className="flex items-center gap-2">
                            {canScrollLeft && (
                                <Button
                                    onPress={() => scrollLeft(0.8)}
                                    variant="secondary"
                                    size="sm"
                                    isIconOnly
                                    aria-label="Cuộn sang trái"
                                >
                                    <ChevronLeftIcon className="h-4 w-4 stroke-2" />
                                </Button>
                            )}
                            {canScrollRight && (
                                <Button
                                    onPress={() => scrollRight(0.8)}
                                    variant="secondary"
                                    size="sm"
                                    isIconOnly
                                    aria-label="Cuộn sang phải"
                                >
                                    <ChevronRightIcon className="h-4 w-4 stroke-2" />
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>
            <div className="relative">
                <div
                    ref={scrollRef}
                    className="no-scrollbar flex gap-4 overflow-x-auto scroll-smooth px-4 py-8 transition-all md:px-12 lg:px-20"
                >
                    {items.map((item) => (
                        <div
                            key={item.slug}
                            className="relative w-40 shrink-0 transition-all duration-300 hover:z-40 sm:w-48 md:w-56 lg:w-60 xl:w-64"
                        >
                            <VodMovieCard
                                movie={item}
                                source={source}
                                getImageUrl={getImageUrl}
                                onImageError={handleImageError}
                                onDelete={onDelete}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
