import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
    HeroSkeleton,
    MovieRowSkeleton,
} from "../../components/vod/VodSkeletons";

import { useVodData } from "../../hooks/useVodData";
import { useImageFallback } from "../../hooks/useImageFallback";
import MovieLanguageBadges from "../../components/vod/MovieLanguageBadges";
import VodMovieCard from "../../components/vod/VodMovieCard";
import { CATEGORIES, SOURCES } from "../../constants/vodConstants";
import VodLayout from "../../components/layout/VodLayout";
import { useAuth } from "../../contexts/AuthContext";
import {
    fetchHistoryFromFirestore,
    fetchFavoritesFromFirestore,
    dedupeHistory,
} from "../../services/firebaseHelpers";

export default function VodLanding() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { sections, heroMovies, loading } = useVodData(CATEGORIES);
    const { getImageUrl, handleImageError } = useImageFallback();

    const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
    const [scrollY, setScrollY] = useState(0);
    const sliderTimerRef = useRef(null);
    const touchStartX = useRef(0);
    const touchEndX = useRef(0);
    const [historyItems, setHistoryItems] = useState([]);
    const [favoriteItems, setFavoriteItems] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
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

    useEffect(() => {
        const loadHistoryForLanding = async () => {
            setHistoryLoading(true);
            try {
                // Luôn lấy từ localStorage TRƯỚC (vì nó chứa cái mới nhất vừa xem)
                const localHistoryStr = localStorage.getItem("viewHistory");
                const localHistory = localHistoryStr
                    ? JSON.parse(localHistoryStr)
                    : [];

                let rawHistory = localHistory;

                if (currentUser?.uid) {
                    // Nếu có User, lấy thêm từ Firestore rồi merge
                    const firestoreHistory = await fetchHistoryFromFirestore(
                        currentUser.uid,
                    );
                    rawHistory = dedupeHistory([
                        ...localHistory,
                        ...firestoreHistory,
                    ]);
                }

                const normalizedHistory = normalizeLibraryItems(rawHistory);
                setHistoryItems(normalizedHistory);
            } catch (error) {
                console.error("Load history for landing error:", error);
                setHistoryItems([]);
            } finally {
                setHistoryLoading(false);
            }
        };

        loadHistoryForLanding();
    }, [currentUser?.uid, normalizeLibraryItems]);

    useEffect(() => {
        const loadFavoritesForLanding = async () => {
            setFavoriteLoading(true);
            try {
                let rawFavorites = [];
                if (currentUser?.uid) {
                    rawFavorites = await fetchFavoritesFromFirestore(
                        currentUser.uid,
                    );
                } else {
                    const localFavorites = localStorage.getItem("favorites");
                    rawFavorites = localFavorites
                        ? JSON.parse(localFavorites)
                        : [];
                }

                const normalizedFavorites = normalizeLibraryItems(rawFavorites);
                setFavoriteItems(normalizedFavorites);
            } catch (error) {
                console.error("Load favorites for landing error:", error);
                setFavoriteItems([]);
            } finally {
                setFavoriteLoading(false);
            }
        };

        loadFavoritesForLanding();
    }, [currentUser?.uid, normalizeLibraryItems]);

    useEffect(() => {
        document.title = "Entertainment - VOD Hub";
        const handleScroll = () => setScrollY(window.scrollY);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
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

    const handleTouchStart = (e) => {
        touchStartX.current = e.targetTouches[0].clientX;
    };

    const handleTouchMove = (e) => {
        touchEndX.current = e.targetTouches[0].clientX;
    };

    const handleTouchEnd = (e) => {
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
                    className="relative mx-auto h-[85vh] w-full max-w-[1920px] overflow-hidden md:h-screen lg:min-h-[850px]"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    {heroMovies.map((movie, idx) => (
                        <div
                            key={movie.slug}
                            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${idx === currentHeroIndex ? "pointer-events-auto z-10 opacity-100" : "pointer-events-none invisible z-0 opacity-0"}`}
                        >
                            <div className="absolute inset-0 z-0">
                                <img
                                    loading="lazy"
                                    src={getImageUrl(movie, "thumbnail")}
                                    alt={movie.name}
                                    className="hidden h-full w-full object-cover brightness-[0.7] md:block"
                                    onError={handleImageError}
                                />
                                <img
                                    loading="lazy"
                                    src={getImageUrl(movie, "poster")}
                                    alt={movie.name}
                                    className="h-full w-full object-cover brightness-[0.6] md:hidden"
                                    onError={handleImageError}
                                />
                                <div className="bg-linear-to-t absolute inset-0 from-zinc-950 via-zinc-950/20 to-transparent" />
                                <div className="bg-linear-to-r absolute inset-0 from-zinc-950 via-zinc-950/10 to-transparent md:via-transparent" />
                            </div>
                            <div className="relative z-10 mx-auto flex h-full w-full max-w-[1920px] flex-col justify-center space-y-8 px-4 md:px-12 lg:px-20">
                                <div
                                    className={
                                        idx === currentHeroIndex
                                            ? "animate-fade-in-down"
                                            : "opacity-0"
                                    }
                                >
                                    <div className="mb-6 flex flex-wrap items-center gap-3 text-sm font-black uppercase tracking-widest md:gap-4">
                                        {movie.tmdbBranding?.brandLogo && (
                                            <div className="mr-2 flex items-center border-r border-zinc-700 pr-4">
                                                <img
                                                    loading="lazy"
                                                    src={
                                                        movie.tmdbBranding
                                                            .brandLogo
                                                    }
                                                    alt="Brand Logo"
                                                    className="h-6 object-contain brightness-0 invert"
                                                />
                                            </div>
                                        )}
                                        <div className="flex items-center gap-1.5 rounded-sm bg-red-600 px-2 py-0.5 text-[10px] text-white md:text-xs">
                                            {t("vods.topHotMovies", {
                                                count: heroMovies.length,
                                            })}
                                        </div>
                                        {movie.isTrailer ? (
                                            <span className="rounded-xs bg-red-600 px-2 py-0.5 text-[10px] font-black uppercase text-white shadow-lg md:text-xs">
                                                {t("vods.comingSoon")}
                                            </span>
                                        ) : (
                                            <>
                                                {movie.year && (
                                                    <span className="text-zinc-300">
                                                        {movie.year}
                                                    </span>
                                                )}
                                                {movie.quality && (
                                                    <span className="rounded-xs border border-zinc-700 bg-zinc-800/50 px-1.5 py-0.5 text-zinc-300">
                                                        {movie.quality}
                                                    </span>
                                                )}
                                            </>
                                        )}
                                        <MovieLanguageBadges
                                            lang={movie.lang}
                                            useLight={true}
                                        />
                                        {!movie.isTrailer && (
                                            <span className="hidden text-zinc-300 md:block">
                                                {movie.episode_current ||
                                                    "Full HD"}
                                            </span>
                                        )}
                                    </div>
                                    {movie.tmdbBranding?.titleLogo ? (
                                        <>
                                            <div className="mb-2 h-[80px] w-full max-w-[300px] md:mb-3 md:h-[150px] md:max-w-[500px] lg:h-[200px]">
                                                <img
                                                    loading="lazy"
                                                    src={
                                                        movie.tmdbBranding
                                                            .titleLogo
                                                    }
                                                    alt={movie.name}
                                                    className="h-full w-full object-contain object-left drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]"
                                                />
                                            </div>
                                            <p className="mb-4 text-sm font-bold tracking-wide text-zinc-400 drop-shadow-lg md:mb-6 md:text-lg">
                                                {movie.name}
                                                {movie.origin_name &&
                                                    movie.origin_name !==
                                                        movie.name && (
                                                        <span className="ml-2 text-xs font-medium text-zinc-500 md:text-sm">
                                                            ({movie.origin_name}
                                                            )
                                                        </span>
                                                    )}
                                            </p>
                                        </>
                                    ) : (
                                        <h1 className="font-handwriting mb-4 text-5xl font-medium leading-tight tracking-normal text-white drop-shadow-2xl md:text-8xl md:leading-[1.1] lg:text-[10rem]">
                                            {movie.name}
                                        </h1>
                                    )}
                                    <div className="mb-6 flex flex-wrap gap-2 text-sm font-bold text-red-500 md:text-base">
                                        {movie.category?.length > 0 ? (
                                            movie.category.map((c, i) => (
                                                <span key={c.id || i}>
                                                    {c.name}
                                                    {i <
                                                    movie.category.length - 1
                                                        ? " • "
                                                        : ""}
                                                </span>
                                            ))
                                        ) : (
                                            <span>
                                                {t("vods.recommendedHeader")}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <p
                                    className={`line-clamp-3 max-w-2xl text-sm font-medium leading-relaxed text-zinc-300 drop-shadow-lg md:text-xl lg:text-2xl ${idx === currentHeroIndex ? "animate-fade-in" : "opacity-0"}`}
                                >
                                    {movie.content?.replace(/<[^>]*>?/gm, "")}
                                </p>
                                <div
                                    className={`flex flex-wrap items-center gap-3 pt-4 md:gap-4 md:pt-6 ${idx === currentHeroIndex ? "animate-fade-in-up" : "opacity-0"}`}
                                >
                                    <button
                                        onClick={() =>
                                            navigate(
                                                `/vod/play/${movie.slug}?source=${movie.source || "source_k"}`,
                                                {
                                                    state: {
                                                        backgrounds: {
                                                            poster_url:
                                                                movie.poster_url,
                                                            thumb_url:
                                                                movie.thumb_url,
                                                        },
                                                    },
                                                },
                                            )
                                        }
                                        className="flex items-center gap-2 rounded bg-white px-5 py-2.5 text-sm font-black text-black shadow-2xl transition-all hover:bg-zinc-200 active:scale-95 md:gap-3 md:px-9 md:py-3.5 md:text-lg"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-5 w-5 fill-current md:h-7 md:w-7"
                                            viewBox="0 0 24 24"
                                        >
                                            <path d="M8 5v14l11-7z" />
                                        </svg>
                                        {t("vods.watchNow")}
                                    </button>
                                    <button
                                        onClick={() =>
                                            navigate(
                                                `/vod/play/${movie.slug}?source=${movie.source || "source_k"}`,
                                                {
                                                    state: {
                                                        backgrounds: {
                                                            poster_url:
                                                                movie.poster_url,
                                                            thumb_url:
                                                                movie.thumb_url,
                                                        },
                                                    },
                                                },
                                            )
                                        }
                                        className="flex items-center gap-2 rounded border border-white/10 bg-zinc-600/40 px-5 py-2.5 text-sm font-black text-white shadow-xl backdrop-blur-md transition-all hover:bg-zinc-600/60 md:gap-3 md:px-9 md:py-3.5 md:text-lg"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-5 w-5 md:h-7 md:w-7"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2.5}
                                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                            />
                                        </svg>
                                        {t("vods.info")}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Navigation Arrows */}
                    <div className="pointer-events-none absolute inset-y-0 left-0 z-20 flex w-16 items-center justify-start pl-2 opacity-50 transition-opacity hover:opacity-100 md:w-24 md:pl-4 lg:pl-10">
                        <button
                            onClick={prevHero}
                            className="group pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white backdrop-blur-md transition-all hover:border-red-600 hover:bg-red-600 active:scale-90 md:h-14 md:w-14"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-6 w-6 transition-transform group-hover:-translate-x-1 md:h-8 md:w-8"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2.5}
                                    d="M15 19l-7-7 7-7"
                                />
                            </svg>
                        </button>
                    </div>
                    <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex w-16 items-center justify-end pr-2 opacity-50 transition-opacity hover:opacity-100 md:w-24 md:pr-4 lg:pr-10">
                        <button
                            onClick={nextHero}
                            className="group pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white backdrop-blur-md transition-all hover:border-red-600 hover:bg-red-600 active:scale-90 md:h-14 md:w-14"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-6 w-6 transition-transform group-hover:translate-x-1 md:h-8 md:w-8"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2.5}
                                    d="M9 5l7 7-7 7"
                                />
                            </svg>
                        </button>
                    </div>

                    {/* Slider Indicators */}
                    <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 flex-row gap-3">
                        {heroMovies.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => {
                                    setCurrentHeroIndex(idx);
                                    startSlider();
                                }}
                                className="group relative flex h-6 w-12 items-center justify-center px-1"
                                aria-label={`Go to slide ${idx + 1}`}
                            >
                                <span
                                    className={`h-1.5 rounded-full transition-all duration-500 group-hover:bg-zinc-400 ${idx === currentHeroIndex ? "w-10 scale-y-110 bg-red-600" : "w-4 bg-zinc-700"}`}
                                />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="relative z-20 mt-10 space-y-8 pb-32">
                {historyLoading ? (
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
                    />
                )}

                {favoriteLoading ? (
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
                              cat.id !== "favorites",
                      ).map((cat) => (
                          <MovieRowSkeleton key={cat.id} title={cat.title} />
                      ))
                    : CATEGORIES.filter(
                          (cat) =>
                              cat.isView !== false &&
                              cat.id !== "history" &&
                              cat.id !== "favorites",
                      ).map((cat) => (
                          <MovieRow
                              key={cat.id}
                              title={t(cat.titleKey || cat.title)}
                              items={sections[cat.id]?.items || []}
                              source={cat.source}
                              link={
                                  cat.type?.startsWith("quoc-gia/")
                                      ? `/vod/country/${cat.type.split("/")[1]}?source=${cat.source}`
                                      : `/vod/category/${cat.id}?source=${cat.source}`
                              }
                              getImageUrl={getImageUrl}
                              handleImageError={handleImageError}
                              navigate={navigate}
                          />
                      ))}
            </div>

            <footer className="border-t border-zinc-900 bg-zinc-950 px-4 py-24 text-zinc-500 md:px-12 lg:px-20">
                <div className="mx-auto flex max-w-7xl flex-col justify-between gap-12 md:flex-row">
                    <div className="max-w-sm space-y-6">
                        <Link
                            to="/vod"
                            className="flex items-center gap-1 text-3xl font-black uppercase tracking-tighter text-red-600"
                        >
                            <span className="mr-0.5 rounded-sm bg-red-600 px-1.5 text-white">
                                M
                            </span>
                            Hub
                        </Link>
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
                                <a
                                    href="#"
                                    className="transition-colors hover:text-white"
                                >
                                    {t("footer.terms")}
                                </a>
                                <a
                                    href="#"
                                    className="transition-colors hover:text-white"
                                >
                                    {t("footer.privacy")}
                                </a>
                                <a
                                    href="#"
                                    className="transition-colors hover:text-white"
                                >
                                    {t("footer.about")}
                                </a>
                                <a
                                    href="#"
                                    className="transition-colors hover:text-white"
                                >
                                    {t("footer.contact")}
                                </a>
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
    navigate,
}) {
    const { t } = useTranslation();
    const rowRef = useRef(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(true);

    const handleScroll = () => {
        if (rowRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
            setShowLeftArrow(scrollLeft > 0);
            setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 10);
        }
    };

    const scroll = (direction) => {
        if (rowRef.current) {
            const { clientWidth } = rowRef.current;
            const scrollAmount =
                direction === "left" ? -clientWidth * 0.8 : clientWidth * 0.8;
            rowRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
        }
    };

    if (!items || items.length === 0) return null;

    return (
        <div className="group/row space-y-5">
            <div className="group/title -mb-4 flex items-center justify-between gap-4 px-4 md:px-12 lg:justify-start lg:px-20">
                <h2 className="flex items-center gap-3 text-2xl font-black text-zinc-100 md:text-3xl">
                    <span className="h-8 w-1.5 rounded-full bg-red-600"></span>
                    {title}
                </h2>
                {link && (
                    <Link
                        to={link}
                        className="flex items-center gap-1 text-sm font-bold text-zinc-500 opacity-100 transition-all duration-300 hover:text-red-500 focus:opacity-100 group-hover/title:opacity-100 md:opacity-0"
                    >
                        {t("common.seeMore")}
                    </Link>
                )}
            </div>
            <div className="relative">
                {showLeftArrow && (
                    <button
                        onClick={() => scroll("left")}
                        className="z-60 absolute left-0 top-0 hidden h-full w-12 items-center justify-center bg-zinc-950/50 text-white opacity-0 transition-opacity hover:bg-zinc-950/80 group-hover/row:opacity-100 md:flex md:w-16"
                    >
                        <svg
                            className="h-10 w-10"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M15 19l-7-7 7-7"
                            />
                        </svg>
                    </button>
                )}
                <div
                    ref={rowRef}
                    onScroll={handleScroll}
                    className="no-scrollbar flex gap-4 overflow-x-auto scroll-smooth px-4 py-8 transition-all md:px-12 lg:px-20"
                >
                    {items.map((item) => (
                        <div
                            key={item.slug}
                            className="relative min-w-[170px] transition-all duration-500 hover:z-50 md:min-w-[210px] lg:min-w-[250px]"
                        >
                            <VodMovieCard
                                movie={item}
                                source={source}
                                getImageUrl={getImageUrl}
                                onImageError={handleImageError}
                            />
                        </div>
                    ))}
                </div>
                {showRightArrow && (
                    <button
                        onClick={() => scroll("right")}
                        className="z-60 absolute right-0 top-0 hidden h-full w-12 items-center justify-center bg-zinc-950/50 text-white opacity-0 transition-opacity hover:bg-zinc-950/80 group-hover/row:opacity-100 md:flex md:w-16"
                    >
                        <svg
                            className="h-10 w-10"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M9 5l7 7-7 7"
                            />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
}
