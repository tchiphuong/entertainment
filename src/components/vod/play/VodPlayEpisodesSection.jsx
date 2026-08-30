import { useState } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { PlayIcon } from "@heroicons/react/24/solid";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { FALLBACK_IMAGE } from "../../../constants";
import {
    formatRuntime,
    getEpisodeKey,
    extractServerType,
    resolveEpisodeThumb,
} from "../../../utils/vodPlayHelpers";
import { Button } from "../../ui";

export const ServerTabs = ({ episodes, activeEpisode, switchTab, isOpen, onToggleOpen }) => {
    const { t } = useTranslation();
    if (!episodes || episodes.length === 0) return null;

    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 bg-zinc-900/50 px-4 md:px-6 py-2.5">
            <button
                type="button"
                onClick={onToggleOpen}
                className="flex items-center gap-2 shrink-0 cursor-pointer text-left select-none group/title transition-colors"
                title={isOpen ? (t("vodPlay.collapse") || "Thu gọn") : (t("vodPlay.episodes") || "Danh sách tập")}
                aria-expanded={isOpen}
            >
                <span className="h-4 w-1 rounded-full bg-red-600" />
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-300 group-hover/title:text-white transition-colors whitespace-nowrap">
                    {t("vodPlay.episodes")}
                </h3>
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-zinc-800/80 text-zinc-400 group-hover/title:bg-zinc-700 group-hover/title:text-white transition-all">
                    <ChevronDownIcon
                        className={`h-3.5 w-3.5 stroke-2 transition-transform duration-300 ${
                            isOpen ? "rotate-180" : "rotate-0"
                        }`}
                    />
                </span>
            </button>

            <div className="w-full sm:w-auto overflow-x-auto no-scrollbar flex items-center justify-start sm:justify-end">
                <div className="flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/80 p-1 shrink-0">
                    {episodes.map((episode) => {
                        const isActive = activeEpisode?.server_name === episode.server_name;
                        const displayName = extractServerType(episode.server_name) || episode.server_name;

                        return (
                            <button
                                key={episode.server_name}
                                type="button"
                                onClick={() => switchTab(episode)}
                                className={clsx(
                                    "flex items-center rounded-full px-4 py-1.5 text-xs font-bold transition-all cursor-pointer whitespace-nowrap select-none",
                                    isActive
                                        ? "border border-red-600/50 bg-red-600 text-white shadow-md shadow-red-600/20"
                                        : "text-zinc-400 hover:text-white"
                                )}
                            >
                                {displayName}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const resolveEpisodeDisplayName = (server, imdbEp, formatEpisodeName, k, episodeLabel) => {
    if (imdbEp?.name) return imdbEp.name;
    if (formatEpisodeName && server?.name) return formatEpisodeName(server.name);
    if (/^\d+$/.test(String(k))) return `${episodeLabel} ${k}`;
    return server?.name || episodeLabel;
};

const EpisodeThumbnail = ({ episodeThumb, episodeLabel, k, isActive, imdbEp }) => (
    <div className="relative aspect-video w-full overflow-hidden">
        <img
            loading="lazy"
            src={episodeThumb || FALLBACK_IMAGE}
            alt={`${episodeLabel} ${k}`}
            className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-110 ${
                isActive ? "" : "opacity-60 group-hover:opacity-100"
            }`}
            onError={(e) => {
                e.target.onerror = null;
                e.target.src = FALLBACK_IMAGE;
            }}
        />
        {isActive && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-red-600/50 ring-4 ring-red-600/30 animate-pulse">
                    <PlayIcon className="ml-0.5 h-5 w-5 fill-current" />
                </div>
            </div>
        )}
        {imdbEp?.runtime && (
            <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-zinc-300 backdrop-blur-md">
                {formatRuntime(imdbEp.runtime)}
            </span>
        )}
    </div>
);

const EpisodeInfo = ({ k, displayName, imdbEp, isActive, episodeLabel }) => (
    <div className="flex flex-1 flex-col justify-between p-3">
        <div>
            <div className="flex items-center justify-between gap-2">
                <span
                    className={`text-xs font-black tracking-wide ${
                        isActive ? "text-red-500" : "text-zinc-200 group-hover:text-white"
                    }`}
                >
                    {displayName.startsWith(episodeLabel)
                        ? displayName
                        : `${episodeLabel} ${k}: ${displayName}`}
                </span>
                {imdbEp?.vote_average > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] font-black text-amber-400">
                        ★ {imdbEp.vote_average.toFixed(1)}
                    </span>
                )}
            </div>
            {imdbEp?.overview && (
                <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-relaxed text-zinc-400 group-hover:text-zinc-300">
                    {imdbEp.overview}
                </p>
            )}
        </div>
        {imdbEp?.air_date && (
            <span className="mt-2 text-[10px] font-medium text-zinc-400">
                {imdbEp.air_date}
            </span>
        )}
    </div>
);

const EpisodeCardView = ({
    episodeThumb,
    episodeLabel,
    k,
    isActive,
    imdbEp,
    displayName,
    openEpisode,
}) => (
    <button
        type="button"
        onClick={openEpisode}
        className={`group relative flex flex-col overflow-hidden rounded-xl border text-left transition-all duration-300 cursor-pointer ${
            isActive
                ? "border-red-600/60 bg-red-600/10 shadow-lg shadow-red-600/10 ring-1 ring-red-600/50"
                : "border-white/5 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-800/60 hover:shadow-md"
        }`}
    >
        <EpisodeThumbnail
            episodeThumb={episodeThumb}
            episodeLabel={episodeLabel}
            k={k}
            isActive={isActive}
            imdbEp={imdbEp}
        />
        <EpisodeInfo
            k={k}
            displayName={displayName}
            imdbEp={imdbEp}
            isActive={isActive}
            episodeLabel={episodeLabel}
        />
    </button>
);

const EpisodeCompactView = ({ isActive, k, displayName, openEpisode }) => (
    <Button
        onPress={openEpisode}
        variant={isActive ? "primary" : "secondary"}
        size="md"
        className="w-full font-black text-xs"
        title={displayName}
    >
        {k}
    </Button>
);

export const EpisodeGridItem = ({
    k,
    server,
    isActive,
    isCompactView,
    imdbEp,
    episodeThumb,
    openEpisode,
    formatEpisodeName,
    movie,
}) => {
    const { t } = useTranslation();
    const episodeLabel = t("vodPlay.episode") || "Tập";
    const resolvedImdbEp = imdbEp || server?.imdbEp;
    const resolvedThumb =
        episodeThumb ||
        server?.thumb ||
        resolveEpisodeThumb(resolvedImdbEp, null, movie);

    const displayName = resolveEpisodeDisplayName(
        server,
        resolvedImdbEp,
        formatEpisodeName,
        k,
        episodeLabel,
    );

    if (isCompactView) {
        return (
            <EpisodeCompactView
                isActive={isActive}
                k={k}
                displayName={displayName}
                openEpisode={openEpisode}
            />
        );
    }

    return (
        <EpisodeCardView
            displayName={displayName}
            episodeLabel={episodeLabel}
            k={k}
            imdbEp={resolvedImdbEp}
            episodeThumb={resolvedThumb}
            isActive={isActive}
            formatEpisodeName={formatEpisodeName}
            openEpisode={openEpisode}
        />
    );
};

export const VodPlayEpisodesSection = ({
    episodes,
    activeEpisode,
    switchTab,
    isCompactView,
    episodeListData,
    currentEpisodeId,
    openEpisode,
    movie,
    formatEpisodeName,
}) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(true);

    if (!episodes || episodes.length === 0) return null;

    return (
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-zinc-900/30 shadow-2xl backdrop-blur-xl transition-all duration-300">
            <ServerTabs
                episodes={episodes}
                activeEpisode={activeEpisode}
                switchTab={switchTab}
                isOpen={isOpen}
                onToggleOpen={() => setIsOpen((prev) => !prev)}
            />

            {isOpen && (
                <div className="p-4 md:p-6 animate-in fade-in slide-in-from-top-2 duration-200">
                    {episodeListData && episodeListData.length > 0 ? (
                        <div
                            className={`grid gap-3 md:gap-4 ${
                                isCompactView
                                    ? "grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10"
                                    : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
                            }`}
                        >
                            {episodeListData.map((item) => {
                                if (!item?.server) return null;
                                const episodeKey = String(getEpisodeKey(item.server.slug, item.server.name));
                                const isActive = String(currentEpisodeId) === episodeKey;

                                return (
                                    <EpisodeGridItem
                                        key={episodeKey}
                                        k={item.k}
                                        server={item.server}
                                        isActive={isActive}
                                        isCompactView={isCompactView}
                                        imdbEp={item.server?.imdbEp}
                                        episodeThumb={item.server?.thumb}
                                        openEpisode={() => openEpisode(item.server, activeEpisode, movie)}
                                        formatEpisodeName={formatEpisodeName}
                                        movie={movie}
                                    />
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <p className="text-sm font-bold text-zinc-500">
                                {t("vodPlay.noEpisodesAvailable") || "Không có danh sách tập phim khả dụng cho server này"}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
