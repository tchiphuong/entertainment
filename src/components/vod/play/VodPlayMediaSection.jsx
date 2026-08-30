import { useRef, useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { PlayIcon, StarIcon } from "@heroicons/react/24/solid";
import {
    ChevronDownIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
} from "@heroicons/react/24/outline";
import ActorAvatar from "../ActorAvatar";
import VodMovieCard from "../VodMovieCard";
import { Button } from "../../ui";
import {
    FALLBACK_IMAGE,
    TMDB_IMAGE_BASE_URL,
    TMDB_IMAGE_SIZES,
} from "../../../constants";
import { useHorizontalScrollState } from "../../../hooks/useHorizontalScrollState";

export const MovieTitle = ({ movie, tmdbImages }) => {
    const titleLogo = useMemo(() => {
        if (tmdbImages?.logos?.length > 0) {
            const viLogo = tmdbImages.logos.find((l) => l.iso_639_1 === "vi");
            const enLogo = tmdbImages.logos.find((l) => l.iso_639_1 === "en");
            return viLogo || enLogo || tmdbImages.logos[0];
        }
        return null;
    }, [tmdbImages]);

    const logoUrl = titleLogo
        ? `${TMDB_IMAGE_BASE_URL}/${TMDB_IMAGE_SIZES.POSTER}${titleLogo.file_path}`
        : null;

    if (logoUrl) {
        return (
            <div className="h-16 sm:h-20 md:h-24 lg:h-28 w-auto max-w-[280px] sm:max-w-[380px] md:max-w-[480px] lg:max-w-[560px] shrink-0 mb-3 drop-shadow-2xl">
                <img
                    loading="lazy"
                    src={logoUrl}
                    alt={movie.name}
                    className="h-full w-auto object-contain object-left"
                />
            </div>
        );
    }

    return (
        <h2 className="text-2xl font-black tracking-tight text-white md:text-3xl lg:text-4xl">
            {movie.name}
        </h2>
    );
};

export const MovieMetaTags = ({ movie, tmdbData }) => {
    const year =
        movie.year ||
        (tmdbData?.release_date && new Date(tmdbData.release_date).getFullYear()) ||
        (() => {
            if (!Array.isArray(movie.category) && movie.category && typeof movie.category === "object") {
                const yearGroup = Object.values(movie.category).find((g) => g.group?.name === "Năm");
                return yearGroup?.list?.[0]?.name;
            }
            return null;
        })();

    let categories = [];
    if (Array.isArray(movie.category)) {
        categories = movie.category;
    } else if (movie.category && typeof movie.category === "object") {
        categories = Object.values(movie.category).flatMap((group) => group.list || []);
    }

    return (
        <div className="flex flex-wrap items-center gap-3 pt-2 md:gap-4">
            {year && (
                <>
                    <span className="text-sm font-black text-white">{year}</span>
                    <span className="h-1 w-1 rounded-full bg-zinc-800" />
                </>
            )}
            {movie.time && (
                <>
                    <span className="text-sm font-bold text-zinc-400">{movie.time}</span>
                    <span className="h-1 w-1 rounded-full bg-zinc-800" />
                </>
            )}
            <span className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-black uppercase text-white">
                {movie.quality || "HD"}
            </span>
            {tmdbData?.vote_average > 0 && (
                <span className="flex items-center gap-1.5 text-sm font-black text-amber-500">
                    <StarIcon className="h-4 w-4 fill-current text-amber-500" />
                    {tmdbData.vote_average.toFixed(1)}
                </span>
            )}

            {categories.length > 0 && (
                <>
                    <span className="h-1 w-1 rounded-full bg-zinc-800" />
                    <div className="flex flex-wrap items-center gap-2">
                        {categories.map((cat, idx) => {
                            const uniqueKey = `${cat.id || ""}-${cat.slug || ""}-${cat.name || ""}-${idx}`;
                            return (
                                <span
                                    key={uniqueKey}
                                    className="rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400 transition-all hover:border-red-600 hover:text-white"
                                >
                                    {cat.name}
                                </span>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
};

export const MovieDescription = ({ content }) => {
    const { t } = useTranslation();
    const [isExpanded, setIsExpanded] = useState(false);
    const [isClamped, setIsClamped] = useState(false);
    const textRef = useRef(null);

    useEffect(() => {
        if (textRef.current) {
            const hasOverflow = textRef.current.scrollHeight > textRef.current.clientHeight + 8;
            setIsClamped(hasOverflow);
        }
    }, [content]);

    if (!content) return null;

    const sanitizedContent = content.trim();

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-red-600">
                {t("vodPlay.summary") || "Tóm tắt nội dung"}
            </h3>
            <div className="space-y-3">
                <div
                    ref={textRef}
                    className={clsx(
                        "text-justify text-base font-normal leading-relaxed text-zinc-300 transition-all duration-300 md:text-lg",
                        !isExpanded && "line-clamp-3 md:line-clamp-4"
                    )}
                    dangerouslySetInnerHTML={{ __html: sanitizedContent }}
                />
                {isClamped && (
                    <div>
                        <Button
                            onPress={() => setIsExpanded((prev) => !prev)}
                            variant="secondary"
                            size="sm"
                            className="rounded-full border border-zinc-800 bg-zinc-900/80 text-xs font-bold text-zinc-300 hover:border-red-600 hover:text-white"
                        >
                            <span>
                                {isExpanded
                                    ? (t("vodPlay.collapse") || "Thu gọn")
                                    : (t("vodPlay.readMore") || "Đọc thêm")}
                            </span>
                            <ChevronDownIcon
                                className={clsx(
                                    "h-3.5 w-3.5 stroke-[2.5] transition-transform duration-300",
                                    isExpanded && "rotate-180"
                                )}
                            />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export const MovieCast = ({ tmdbCredits, movie }) => {
    const { t } = useTranslation();

    const hasCast = (tmdbCredits?.cast && tmdbCredits.cast.length > 0) || (movie.actor && movie.actor.length > 0);

    const castList = useMemo(() => {
        if (tmdbCredits?.cast?.length > 0) return tmdbCredits.cast;
        return (movie.actor || []).map((name, idx) => ({ id: idx, name, character: "", profile_path: null }));
    }, [tmdbCredits?.cast, movie.actor]);

    const { scrollRef, canScrollLeft, canScrollRight, hasOverflow, scrollLeft, scrollRight } =
        useHorizontalScrollState([castList.length]);

    if (!hasCast || castList.length === 0) return null;

    return (
        <section className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-[0.3em] text-red-600">
                    {t("vodPlay.cast") || "Dàn diễn viên"}
                </h3>
                {hasOverflow && (
                    <div className="flex items-center gap-2">
                        {canScrollLeft && (
                            <Button
                                onPress={() => scrollLeft()}
                                variant="secondary"
                                size="sm"
                                isIconOnly
                                aria-label="Previous cast"
                            >
                                <ChevronLeftIcon className="h-4 w-4 stroke-2" />
                            </Button>
                        )}
                        {canScrollRight && (
                            <Button
                                onPress={() => scrollRight()}
                                variant="secondary"
                                size="sm"
                                isIconOnly
                                aria-label="Next cast"
                            >
                                <ChevronRightIcon className="h-4 w-4 stroke-2" />
                            </Button>
                        )}
                    </div>
                )}
            </div>

            <div
                ref={scrollRef}
                className="no-scrollbar flex gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory py-4 px-1"
            >
                {castList.map((c) => {
                    const isTmdbId = typeof c.id === "number" && c.id > 10;
                    const actorLink = isTmdbId
                        ? `/vod/actor/${c.id}?name=${encodeURIComponent(c.name || "")}`
                        : `/vod/actor/${encodeURIComponent(c.name || "")}`;

                    return (
                        <Link
                            key={c.id}
                            to={actorLink}
                            className="group shrink-0 space-y-4 snap-start w-24 md:w-28 cursor-pointer block focus:outline-none"
                        >
                            <div className="mx-auto h-24 w-24 overflow-hidden rounded-full ring-2 ring-transparent transition-all duration-300 group-hover:ring-red-600 md:h-28 md:w-28">
                                <ActorAvatar name={c.name} profilePath={c.profile_path} />
                            </div>
                            <div className="text-center">
                                <p className="line-clamp-1 text-xs font-black text-zinc-200 transition-colors group-hover:text-red-600">
                                    {c.name}
                                </p>
                                <p className="line-clamp-1 text-[9px] font-bold uppercase tracking-widest text-zinc-600">
                                    {c.character}
                                </p>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </section>
    );
};

const MediaGalleryTabs = ({ availableTabs, activeTab, setActiveTab }) => {
    if (availableTabs.length <= 1) return null;

    return (
        <div className="flex flex-wrap items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/80 p-1">
            {availableTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={clsx(
                            "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all",
                            isActive
                                ? "border border-red-600/50 bg-red-600 text-white shadow-md shadow-red-600/20"
                                : "text-zinc-400 hover:text-white"
                        )}
                    >
                        <span>{tab.label}</span>
                        <span
                            className={clsx(
                                "rounded-full px-1.5 py-0.2 text-[10px] font-black",
                                isActive
                                    ? "bg-black/30 text-white"
                                    : "bg-zinc-800 text-zinc-400"
                            )}
                        >
                            {tab.count}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

const MediaGalleryVideosList = ({ scrollRef, trailerList, onSelectTrailer }) => (
    <div
        ref={scrollRef}
        className="no-scrollbar flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory py-2 md:gap-6"
    >
        {trailerList.map((video) => (
            <button
                type="button"
                key={video.id || video.key}
                onClick={() => onSelectTrailer?.(video)}
                className="group shrink-0 snap-start w-64 md:w-80 space-y-3 cursor-pointer text-left focus:outline-none"
            >
                <div className="aspect-video relative w-full overflow-hidden rounded-xl border border-white/5 bg-zinc-900 shadow-xl transition-all duration-300 group-hover:border-red-600/50 group-hover:scale-[1.02]">
                    <img
                        loading="lazy"
                        src={`https://img.youtube.com/vi/${video.key}/hqdefault.jpg`}
                        alt={video.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/40 transition-opacity duration-300 group-hover:bg-black/20" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-xl shadow-red-600/40 transition-transform duration-300 group-hover:scale-110">
                            <PlayIcon className="h-5 w-5 fill-current ml-0.5" />
                        </div>
                    </div>
                    <span className="absolute bottom-2 left-2 rounded bg-black/80 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white backdrop-blur-sm">
                        {video.type || "Trailer"}
                    </span>
                </div>
                <p className="line-clamp-2 text-xs font-bold text-zinc-300 transition-colors group-hover:text-white md:text-sm">
                    {video.name}
                </p>
            </button>
        ))}
    </div>
);

const MediaGalleryBackdropsList = ({
    scrollRef,
    backdrops,
    setModalImages,
    setCurrentImageIndex,
    setShowImageModal,
}) => (
    <div
        ref={scrollRef}
        className="no-scrollbar flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory py-2 md:gap-6"
    >
        {backdrops.slice(0, 20).map((img, idx) => (
            <button
                type="button"
                key={img.file_path}
                onClick={() => {
                    setModalImages(backdrops);
                    setCurrentImageIndex(idx);
                    setShowImageModal(true);
                }}
                className="group shrink-0 snap-start w-64 md:w-80 aspect-video overflow-hidden rounded-xl border border-white/5 bg-zinc-900 shadow-xl transition-all duration-300 hover:border-red-600/50 hover:scale-[1.02] cursor-pointer focus:outline-none"
            >
                <img
                    loading="lazy"
                    src={`https://image.tmdb.org/t/p/w780${img.file_path}`}
                    alt={`Backdrop ${idx + 1}`}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
            </button>
        ))}
    </div>
);

const MediaGalleryPostersList = ({
    scrollRef,
    posters,
    setModalImages,
    setCurrentImageIndex,
    setShowImageModal,
}) => (
    <div
        ref={scrollRef}
        className="no-scrollbar flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory py-2 md:gap-6"
    >
        {posters.slice(0, 20).map((img, idx) => (
            <button
                type="button"
                key={img.file_path}
                onClick={() => {
                    setModalImages(posters);
                    setCurrentImageIndex(idx);
                    setShowImageModal(true);
                }}
                className="group shrink-0 snap-start w-36 md:w-44 aspect-2/3 overflow-hidden rounded-xl border border-white/5 bg-zinc-900 shadow-xl transition-all duration-300 hover:border-red-600/50 hover:scale-105 cursor-pointer focus:outline-none"
            >
                <img
                    loading="lazy"
                    src={`https://image.tmdb.org/t/p/w500${img.file_path}`}
                    alt={`Poster ${idx + 1}`}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
            </button>
        ))}
    </div>
);

export const MovieMediaGallery = ({
    tmdbVideos,
    movie,
    onSelectTrailer,
    tmdbImages,
    setModalImages,
    setCurrentImageIndex,
    setShowImageModal,
}) => {
    const { t } = useTranslation();

    const trailerList = useMemo(() => {
        const list =
            Array.isArray(tmdbVideos) && tmdbVideos.length > 0
                ? tmdbVideos.filter((v) => v?.site === "YouTube" && Boolean(v?.key))
                : [];
        if (list.length === 0 && movie?.trailer_url) {
            const ytMatch = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/.exec(movie.trailer_url);
            if (ytMatch?.[1]) {
                return [
                    {
                        id: "custom_trailer",
                        key: ytMatch[1],
                        name: "Trailer Chính Thức",
                        type: "Trailer",
                        site: "YouTube",
                    },
                ];
            }
        }
        return list;
    }, [tmdbVideos, movie?.trailer_url]);

    const backdrops = useMemo(() => tmdbImages?.backdrops || [], [tmdbImages]);
    const posters = useMemo(() => tmdbImages?.posters || [], [tmdbImages]);

    const hasVideos = trailerList.length > 0;
    const hasBackdrops = backdrops.length > 0;
    const hasPosters = posters.length > 0;

    const availableTabs = useMemo(() => {
        const tabs = [];
        if (hasVideos) tabs.push({ id: "videos", label: t("vodPlay.trailers") || "Trailers & Videos", count: trailerList.length });
        if (hasBackdrops) tabs.push({ id: "backdrops", label: t("vodPlay.backdrops") || "Hình nền", count: backdrops.length });
        if (hasPosters) tabs.push({ id: "posters", label: t("vodPlay.posters") || "Áp phích", count: posters.length });
        return tabs;
    }, [hasVideos, hasBackdrops, hasPosters, trailerList.length, backdrops.length, posters.length, t]);

    const [activeTab, setActiveTab] = useState(availableTabs[0]?.id || "videos");

    useEffect(() => {
        if (availableTabs.length > 0 && !availableTabs.some((tab) => tab.id === activeTab)) {
            setActiveTab(availableTabs[0].id);
        }
    }, [availableTabs, activeTab]);

    const { scrollRef, canScrollLeft, canScrollRight, hasOverflow, scrollLeft, scrollRight } =
        useHorizontalScrollState([activeTab, trailerList.length, backdrops.length, posters.length]);

    if (!hasVideos && !hasBackdrops && !hasPosters) return null;

    return (
        <section className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-sm font-black uppercase tracking-[0.3em] text-red-600">
                        {t("vodPlay.mediaGallery") || "Thư viện Media"}
                    </h3>

                    <MediaGalleryTabs
                        availableTabs={availableTabs}
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                    />
                </div>

                {hasOverflow && (
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                        {canScrollLeft && (
                            <Button
                                onPress={() => scrollLeft()}
                                variant="secondary"
                                size="sm"
                                isIconOnly
                                aria-label="Previous media"
                            >
                                <ChevronLeftIcon className="h-4 w-4 stroke-2" />
                            </Button>
                        )}
                        {canScrollRight && (
                            <Button
                                onPress={() => scrollRight()}
                                variant="secondary"
                                size="sm"
                                isIconOnly
                                aria-label="Next media"
                            >
                                <ChevronRightIcon className="h-4 w-4 stroke-2" />
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {activeTab === "videos" && hasVideos && (
                <MediaGalleryVideosList
                    scrollRef={scrollRef}
                    trailerList={trailerList}
                    onSelectTrailer={onSelectTrailer}
                />
            )}

            {activeTab === "backdrops" && hasBackdrops && (
                <MediaGalleryBackdropsList
                    scrollRef={scrollRef}
                    backdrops={backdrops}
                    setModalImages={setModalImages}
                    setCurrentImageIndex={setCurrentImageIndex}
                    setShowImageModal={setShowImageModal}
                />
            )}

            {activeTab === "posters" && hasPosters && (
                <MediaGalleryPostersList
                    scrollRef={scrollRef}
                    posters={posters}
                    setModalImages={setModalImages}
                    setCurrentImageIndex={setCurrentImageIndex}
                    setShowImageModal={setShowImageModal}
                />
            )}
        </section>
    );
};

export const MovieRelated = ({ tmdbRelated, getMovieImage }) => {
    const { t } = useTranslation();
    const relatedList = Array.isArray(tmdbRelated) ? tmdbRelated : [];

    const { scrollRef, canScrollLeft, canScrollRight, hasOverflow, scrollLeft, scrollRight } =
        useHorizontalScrollState([relatedList.length]);

    if (relatedList.length === 0) return null;

    return (
        <section className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h3 className="text-sm font-black uppercase tracking-[0.3em] text-red-600">
                        {t("vodPlay.recommendations") || "Đề xuất"}
                    </h3>
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-black text-zinc-400">
                        {relatedList.length}
                    </span>
                </div>
                {hasOverflow && (
                    <div className="flex gap-2">
                        {canScrollLeft && (
                            <Button
                                onPress={() => scrollLeft()}
                                variant="secondary"
                                size="sm"
                                isIconOnly
                                aria-label="Previous related"
                            >
                                <ChevronLeftIcon className="h-4 w-4 stroke-2" />
                            </Button>
                        )}
                        {canScrollRight && (
                            <Button
                                onPress={() => scrollRight()}
                                variant="secondary"
                                size="sm"
                                isIconOnly
                                aria-label="Next related"
                            >
                                <ChevronRightIcon className="h-4 w-4 stroke-2" />
                            </Button>
                        )}
                    </div>
                )}
            </div>

            <div
                ref={scrollRef}
                className="no-scrollbar flex gap-4 md:gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory py-4 px-1"
            >
                {tmdbRelated.map((relatedMovie) => (
                    <div
                        key={relatedMovie.id || relatedMovie.slug}
                        className="w-36 sm:w-44 md:w-52 shrink-0 snap-start"
                    >
                        <VodMovieCard
                            movie={relatedMovie}
                            getImageUrl={getMovieImage ? (m) => getMovieImage(m?.poster_url || m?.thumb_url || m?.poster, m?.source) : undefined}
                        />
                    </div>
                ))}
            </div>
        </section>
    );
};

export const VodPlayMediaSection = ({
    movie,
    tmdbData,
    tmdbImages,
    tmdbCredits,
    tmdbVideos,
    tmdbRelated,
    onSelectTrailer,
    setModalImages,
    setCurrentImageIndex,
    setShowImageModal,
    getMovieImage,
}) => {
    const backdropSrc = tmdbData?.backdrop_path
        ? `${TMDB_IMAGE_BASE_URL}/${TMDB_IMAGE_SIZES.BACKDROP}${tmdbData.backdrop_path}`
        : getMovieImage(movie.thumb_url || movie.poster_url, movie.source);

    const posterSrc = tmdbData?.poster_path
        ? `${TMDB_IMAGE_BASE_URL}/${TMDB_IMAGE_SIZES.POSTER}${tmdbData.poster_path}`
        : getMovieImage(movie.poster_url || movie.thumb_url, movie.source);

    return (
        <div className="mt-8 space-y-16">
            <section className="flex flex-col lg:flex-row gap-6 md:gap-8 lg:gap-12 items-start">
                <div className="w-full lg:w-auto lg:shrink-0">
                    <div className="aspect-video relative w-full overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10 lg:hidden">
                        <img
                            loading="lazy"
                            src={backdropSrc}
                            alt={movie.name}
                            className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = FALLBACK_IMAGE;
                            }}
                        />
                        <div className="absolute inset-0 bg-zinc-950/60" />
                    </div>
                    <div className="aspect-2/3 relative hidden overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10 lg:block lg:w-72 xl:w-80">
                        <img
                            loading="lazy"
                            src={posterSrc}
                            alt={movie.name}
                            className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = FALLBACK_IMAGE;
                            }}
                        />
                        <div className="absolute inset-0 bg-zinc-950/60" />
                    </div>
                </div>
                <div className="flex-1 space-y-6 w-full">
                    <header className="space-y-3">
                        <MovieTitle movie={movie} tmdbImages={tmdbImages} />
                        <MovieMetaTags movie={movie} tmdbData={tmdbData} />
                    </header>
                    <MovieDescription content={movie.content} />
                </div>
            </section>

            <MovieCast tmdbCredits={tmdbCredits} movie={movie} />
            <MovieMediaGallery
                tmdbVideos={tmdbVideos}
                movie={movie}
                onSelectTrailer={onSelectTrailer}
                tmdbImages={tmdbImages}
                setModalImages={setModalImages}
                setCurrentImageIndex={setCurrentImageIndex}
                setShowImageModal={setShowImageModal}
            />
            {/* Show Related & Recommendations from TMDB */}
            <MovieRelated tmdbRelated={tmdbRelated} getMovieImage={getMovieImage} />
        </div>
    );
};

