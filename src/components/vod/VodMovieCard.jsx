import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import MovieLanguageBadges from "./MovieLanguageBadges";

function getQualityBadge(quality) {
    const normalized = String(quality || "").toUpperCase();

    if (
        normalized.includes("FHD") ||
        normalized.includes("FULL HD") ||
        normalized.includes("1080")
    ) {
        return "FHD";
    }

    if (normalized.includes("HD") || normalized.includes("720")) {
        return "HD";
    }

    if (normalized.includes("CAM") || normalized.includes("TS")) {
        return "CAM";
    }

    return quality || "";
}

export default function VodMovieCard({
    movie,
    source,
    getImageUrl,
    onImageError,
}) {
    const { t } = useTranslation();
    if (!movie?.slug) return null;

    const qualityBadge = getQualityBadge(movie.quality);

    // Tối ưu URL play: nếu có thông tin tập đang xem từ lịch sử, đính kèm vào URL
    const episodeParam = movie.current_episode?.key
        ? `&episode=${movie.current_episode.key}`
        : "";
    const serverParam = movie.server ? `&server=${movie.server}` : "";
    const playUrl = `/vod/play/${movie.slug}?source=${movie.source || source || "source_k"}${episodeParam}${serverParam}`;

    return (
        <div className="group transition-all duration-500 hover:z-40 hover:scale-110">
            <Link to={playUrl} className="block">
                <div className="aspect-2/3 relative overflow-hidden rounded-lg border border-white/5 bg-zinc-900 shadow-2xl transition-all">
                    <img
                        loading="lazy"
                        src={getImageUrl(movie, "poster")}
                        alt={movie.name}
                        className="h-full w-full object-cover"
                        onError={onImageError}
                    />

                    <div className="absolute right-2 top-2 z-30 flex flex-col items-end gap-1">
                        {movie.isTrailer ? (
                            <div className="rounded-sm bg-red-600/90 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-lg backdrop-blur-sm">
                                {t("vods.comingSoon")}
                            </div>
                        ) : (
                            <>
                                <MovieLanguageBadges
                                    lang={movie.lang}
                                    className="flex-col items-end"
                                />
                                {qualityBadge && (
                                    <div className="rounded-sm border border-white/20 bg-black/80 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-lg ring-1 ring-white/10 backdrop-blur-sm">
                                        {qualityBadge}
                                    </div>
                                )}
                                {movie.year && (
                                    <div className="rounded-sm border border-white/20 bg-black/80 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-lg ring-1 ring-white/10 backdrop-blur-sm">
                                        {movie.year || "N/A"}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="bg-linear-to-t absolute inset-0 from-zinc-950 via-transparent to-transparent opacity-60" />
                </div>

                <div className="mt-2 px-1">
                    <p className="line-clamp-1 text-sm font-black transition-colors group-hover:text-red-500">
                        {movie.name}
                    </p>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                        <p className="line-clamp-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                            {movie.origin_name || ""}
                        </p>
                        {movie.current_episode?.value && (
                            <span className="shrink-0 rounded-sm bg-zinc-800 px-1.5 py-0.5 text-[9px] font-black uppercase text-red-500 ring-1 ring-white/5">
                                {movie.current_episode.value}
                                {movie.episode_total &&
                                    movie.episode_total !== "1" &&
                                    movie.current_episode.value.includes(
                                        "Tập",
                                    ) && (
                                        <span className="ml-0.5 text-zinc-500">
                                            /{movie.episode_total}
                                        </span>
                                    )}
                            </span>
                        )}
                    </div>
                </div>
            </Link>
        </div>
    );
}
