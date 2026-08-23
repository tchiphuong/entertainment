import { memo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useVodContext } from "../../contexts/VodContext";
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

const MediaItemCard = memo(
    ({ item, source, getImageUrl, onImageError, className = "", onDelete }) => {
        const { t } = useTranslation();
        const { isFavorite, toggleFavorite } = useVodContext();
        if (!item?.slug) return null;

        const favorite = isFavorite(item.slug);
        const qualityBadge = getQualityBadge(item.quality);

        const episodeParam = item.current_episode?.key
            ? `&episode=${item.current_episode.key}`
            : "";
        const serverParam = item.server ? `&server=${item.server}` : "";
        const playUrl = `/vod/play/${item.slug}?source=${item.source || source || "source_k"}${episodeParam}${serverParam}`;

        const handleToggleFavorite = (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFavorite(item);
        };

        const handleDelete = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (onDelete) onDelete(item.slug);
        };

        return (
            <div
                className={`group mx-auto w-full max-w-[13.75rem] transition-all duration-300 hover:z-40 hover:scale-[1.02] md:max-w-[15rem] lg:max-w-[16.25rem] xl:max-w-[17.5rem] ${className}`}
            >
            <Link to={playUrl} className="block">
                <div className="aspect-2/3 group relative flex flex-col overflow-hidden rounded-xl border border-white/5 bg-zinc-900/40 transition-all duration-500 hover:border-primary-500/30 hover:bg-zinc-900/60 hover:shadow-2xl">
                    <img
                        loading="lazy"
                        src={getImageUrl(item, "poster")}
                        alt={item.name}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                        onError={onImageError}
                    />

                    {/* Favorite Button (Premium Design) */}
                    <div className="absolute left-2 top-2 z-40">
                        <button
                            onClick={handleToggleFavorite}
                            className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/10 shadow-2xl backdrop-blur-md transition-all duration-300 active:scale-95 ${
                                favorite
                                    ? "border-primary-500/30 bg-primary-500/20 opacity-100"
                                    : "bg-black/20 opacity-0 hover:bg-white/20 group-hover:opacity-100"
                            }`}
                            title={
                                favorite ? t("common.remove") : t("common.add")
                            }
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className={`h-5 w-5 transition-all duration-300 ${
                                    favorite
                                        ? "fill-primary-500 stroke-primary-500 drop-shadow-[0_0_8px_rgba(245,184,0,0.8)]"
                                        : "fill-none stroke-white/80 group-hover:stroke-white"
                                }`}
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                            </svg>
                        </button>
                    </div>

                    {/* Nút xóa khỏi lịch sử (chỉ hiện khi có onDelete) */}
                    {onDelete && (
                        <div className="absolute bottom-2 right-2 z-40">
                            <button
                                onClick={handleDelete}
                                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/40 opacity-0 shadow-xl backdrop-blur-md transition-all duration-300 hover:border-primary-500/50 hover:bg-primary-600/80 active:scale-90 group-hover:opacity-100"
                                title={t("common.delete") || "Xóa"}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-3.5 w-3.5 stroke-white"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    )}

                    <div className="absolute right-2 top-2 z-30 flex flex-col items-end gap-1">
                        {item.isTrailer ? (
                            <div className="rounded-full bg-red-600/90 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-lg backdrop-blur-sm">
                                {t("vods.comingSoon")}
                            </div>
                        ) : (
                            <>
                                <MovieLanguageBadges
                                    lang={item.lang}
                                    className="flex-col items-end"
                                />
                                {qualityBadge && (
                                    <div className="rounded-full border border-white/20 bg-black/80 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-lg ring-1 ring-white/10 backdrop-blur-sm">
                                        {qualityBadge}
                                    </div>
                                )}
                                {item.year && (
                                    <div className="rounded-full border border-white/20 bg-black/80 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-lg ring-1 ring-white/10 backdrop-blur-sm">
                                        {item.year || "N/A"}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="bg-linear-to-t absolute inset-0 from-zinc-950 via-transparent to-transparent opacity-60" />
                </div>

                <div className="mt-2 px-1">
                    <p className="line-clamp-1 text-sm font-black transition-colors group-hover:text-primary-500">
                        {item.name}
                    </p>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                        <p className="line-clamp-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                            {item.origin_name || ""}
                        </p>
                        {item.current_episode?.value && (
                            <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[9px] font-black uppercase text-primary-500 ring-1 ring-white/5">
                                {item.current_episode.value}
                            </span>
                        )}
                    </div>
                </div>
            </Link>
        </div>
        );
    }
);

export default MediaItemCard;
