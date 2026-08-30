import { memo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { HeartIcon as HeartSolidIcon } from "@heroicons/react/24/solid";
import { HeartIcon as HeartOutlineIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useVodContext } from "../../contexts/VodContext";
import { FALLBACK_IMAGE } from "../../constants";
import MovieLanguageBadges from "./MovieLanguageBadges";
import { Button } from "../ui";
import { getMoviePlayUrl, getQualityBadge, getMovieImage } from "../../utils/vodHelpers";

const defaultGetImageUrl = (m, type) => {
    const raw = type === "thumb" ? (m?.thumb_url || m?.poster_url || m?.poster) : (m?.poster_url || m?.thumb_url || m?.poster);
    return getMovieImage(raw, m?.source);
};

const defaultOnImageError = (e) => {
    e.target.onerror = null;
    e.target.src = FALLBACK_IMAGE;
};

const VodMovieFavoriteButton = ({ favorite, onToggleFavorite, t }) => (
    <div className="absolute left-2 top-2 z-40">
        <Button
            onPress={onToggleFavorite}
            variant={favorite ? "danger" : "secondary"}
            size="sm"
            isIconOnly
            aria-label={favorite ? t("common.remove") : t("common.add")}
        >
            {favorite ? (
                <HeartSolidIcon className="h-4 w-4" />
            ) : (
                <HeartOutlineIcon className="h-4 w-4" />
            )}
        </Button>
    </div>
);

const VodMovieDeleteButton = ({ onDelete, t }) => {
    if (!onDelete) return null;
    return (
        <div className="absolute bottom-2 right-2 z-40">
            <Button
                onPress={onDelete}
                variant="secondary"
                size="sm"
                isIconOnly
                aria-label={t("common.delete") || "Xóa"}
            >
                <XMarkIcon className="h-4 w-4 stroke-2" />
            </Button>
        </div>
    );
};

const VodMovieTopRightBadges = ({ movie, qualityBadge, t }) => (
    <div className="absolute right-2 top-2 z-30 flex flex-col items-end gap-1">
        {movie.isTrailer ? (
            <div className="rounded-full bg-red-600/90 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-lg backdrop-blur-sm">
                {t("vods.comingSoon")}
            </div>
        ) : (
            <>
                <MovieLanguageBadges lang={movie.lang} className="flex-col items-end" />
                {qualityBadge && (
                    <div className="rounded-full border border-white/20 bg-black/80 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-lg ring-1 ring-white/10 backdrop-blur-sm">
                        {qualityBadge}
                    </div>
                )}
                {movie.year && (
                    <div className="rounded-full border border-white/20 bg-black/80 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-lg ring-1 ring-white/10 backdrop-blur-sm">
                        {movie.year}
                    </div>
                )}
            </>
        )}
    </div>
);

const VodMovieMeta = ({ movie }) => (
    <div className="mt-2 px-1">
        <p className="line-clamp-1 text-sm font-black transition-colors group-hover:text-red-500">
            {movie.name}
        </p>
        <div className="mt-0.5 flex items-center justify-between gap-2">
            <p className="line-clamp-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                {movie.origin_name || ""}
            </p>
            {movie.current_episode?.value && (
                <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[9px] font-black uppercase text-red-500 ring-1 ring-white/5">
                    {movie.current_episode.value}
                </span>
            )}
        </div>
    </div>
);

const VodMovieCard = memo(
    ({
        movie,
        source,
        getImageUrl = defaultGetImageUrl,
        onImageError = defaultOnImageError,
        className = "",
        onDelete,
    }) => {
        const { t } = useTranslation();
        const { isFavorite, toggleFavorite } = useVodContext();
        if (!movie) return null;

        const favorite = isFavorite(movie.slug);
        const qualityBadge = getQualityBadge(movie.quality);
        const playUrl = getMoviePlayUrl(movie, source);

        const handleToggleFavorite = (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFavorite(movie);
        };

        const handleDelete = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (onDelete) onDelete(movie.slug);
        };

        return (
            <div
                className={`group mx-auto w-full max-w-[13.75rem] transition-all duration-300 hover:z-40 hover:scale-[1.02] md:max-w-[15rem] lg:max-w-[16.25rem] xl:max-w-[17.5rem] ${className}`}
            >
                <Link to={playUrl} className="block">
                    <div className="aspect-2/3 relative overflow-hidden rounded-lg border border-white/5 bg-zinc-900 shadow-2xl transition-all">
                        <img
                            loading="lazy"
                            src={getImageUrl(movie, "poster")}
                            alt={movie.name}
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                            onError={onImageError}
                        />

                        <VodMovieFavoriteButton
                            favorite={favorite}
                            onToggleFavorite={handleToggleFavorite}
                            t={t}
                        />

                        <VodMovieDeleteButton
                            onDelete={onDelete ? handleDelete : null}
                            t={t}
                        />

                        <VodMovieTopRightBadges
                            movie={movie}
                            qualityBadge={qualityBadge}
                            t={t}
                        />

                        <div className="pointer-events-none absolute inset-0 bg-black/40" />
                    </div>

                    <VodMovieMeta movie={movie} />
                </Link>
            </div>
        );
    },
);

export default VodMovieCard;
