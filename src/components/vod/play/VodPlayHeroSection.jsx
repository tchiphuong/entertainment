import { TMDB_IMAGE_BASE_URL, TMDB_IMAGE_SIZES, FALLBACK_IMAGE } from "../../../constants";

const getBackgroundFallback = (bg) => {
    if (!bg) return null;
    return bg.thumb_url || bg.thumbnail || bg.backdrop_url || bg.poster_url || bg.poster || null;
};

const resolveRawHeroImage = (tmdbData, memoizedBackgrounds, movie) => {
    if (tmdbData?.backdrop_path) {
        return `${TMDB_IMAGE_BASE_URL}/${TMDB_IMAGE_SIZES.BACKDROP}${tmdbData.backdrop_path}`;
    }
    const bgImage = getBackgroundFallback(memoizedBackgrounds);
    if (bgImage) return bgImage;

    return movie?.thumb_url || movie?.poster_url || null;
};

const resolveHeroBgUrl = (rawImage, movieSource, getMovieImage) => {
    if (!rawImage) return null;
    if (rawImage.startsWith("http")) return rawImage;
    if (typeof getMovieImage === "function") {
        return getMovieImage(rawImage, movieSource);
    }
    return rawImage;
};

export const VodPlayBackgroundHero = ({ movie, memoizedBackgrounds, getMovieImage, tmdbData }) => {
    const rawImage = resolveRawHeroImage(tmdbData, memoizedBackgrounds, movie);
    const bgUrl = resolveHeroBgUrl(rawImage, movie?.source, getMovieImage);

    if (!bgUrl) return null;

    return (
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-zinc-950">
            <img
                src={bgUrl}
                alt=""
                className="h-full w-full object-cover object-center scale-105 blur-2xl opacity-40 transition-opacity duration-700"
                onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = FALLBACK_IMAGE;
                }}
            />
            <div className="absolute inset-0 bg-zinc-950/60" />
        </div>
    );
};
