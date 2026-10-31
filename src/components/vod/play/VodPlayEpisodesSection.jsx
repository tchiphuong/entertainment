import { useState, useCallback, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { PlayIcon } from "@heroicons/react/24/solid";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { FALLBACK_IMAGE, SOURCES } from "../../../constants";
import {
    formatRuntime,
    getEpisodeKey,
    extractServerType,
    resolveEpisodeThumb,
    computeEpisodeListData,
} from "../../../utils/vodPlayHelpers";
import { vodService } from "../../../services/vod/vodService";
import { Button } from "../../ui";

export const SeasonTabs = ({ seasons, currentSeason, playingSeason, movie, onSelectSeason }) => {
    const { t } = useTranslation();
    if (!seasons || seasons.length <= 1) return null;

    return (
        <div className="flex flex-col gap-2.5 border-b border-white/5 bg-zinc-950/70 px-4 md:px-6 py-3">
            <div className="flex items-center gap-2">
                <span className="flex h-4 w-4 items-center justify-center text-red-500">
                    <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                        <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                    </svg>
                </span>
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-300">
                    {t("vodPlay.seasons") || "Các phần / Mùa phim"}
                </h4>
            </div>

            <div className="overflow-x-auto no-scrollbar py-1">
                <div className="flex items-center gap-2 shrink-0">
                    {seasons.map((item) => {
                        const isViewing = Number(item.season) === Number(currentSeason);
                        const isPlaying =
                            Number(item.season) === Number(playingSeason) ||
                            (Boolean(item.slug && movie?.slug) && item.slug === movie.slug);

                        return (
                            <button
                                key={item.season || item.slug}
                                type="button"
                                onClick={() => onSelectSeason(item)}
                                className={clsx(
                                    "flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-all cursor-pointer whitespace-nowrap select-none",
                                    isViewing
                                        ? "border border-red-600 bg-red-600 text-white shadow-md shadow-red-600/30"
                                        : isPlaying
                                        ? "border border-red-600/50 bg-zinc-900 text-white hover:border-red-500 hover:bg-zinc-800"
                                        : "border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
                                )}
                            >
                                <span>{item.name || `Mùa ${item.season}`}</span>

                                {isPlaying && !isViewing && (
                                    <span className="flex items-center gap-1 rounded bg-red-600/20 px-1.5 py-0.5 text-[9px] font-black text-red-400 uppercase tracking-wider">
                                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                                        {t("vodPlay.playing") || "Đang phát"}
                                    </span>
                                )}

                                {item.episodeCount > 0 && (
                                    <span
                                        className={clsx(
                                            "rounded px-1.5 py-0.5 text-[10px] font-black",
                                            isViewing
                                                ? "bg-black/30 text-white"
                                                : "bg-zinc-800 text-zinc-400"
                                        )}
                                    >
                                        {item.episodeCount} tập
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

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

const EpisodeThumbnail = ({ episodeThumb, episodeLabel, k, isActive, imdbEp }) => {
    const isFull = String(k || "").toLowerCase() === "full";
    const altText = isFull ? "Full" : `${episodeLabel} ${k}`;

    return (
        <div className="relative aspect-video w-full overflow-hidden">
            <img
                loading="lazy"
                src={episodeThumb || FALLBACK_IMAGE}
                alt={altText}
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
};

const resolveEpisodeTitle = (k, displayName, episodeLabel) => {
    const kStr = String(k || "").trim();
    const dStr = String(displayName || "").trim();
    const kLower = kStr.toLowerCase();
    const dLower = dStr.toLowerCase();

    // Trường hợp phim lẻ / bản Full: chỉ hiển thị "Full" (tránh lặp "Tập full: Full")
    if (kLower === "full" || dLower === "full") {
        if (dLower === "full" || !dStr || dLower === kLower) {
            return "Full";
        }
        return dStr.startsWith(episodeLabel) ? dStr : `Full: ${dStr}`;
    }

    // Nếu displayName đã chứa nhãn "Tập ..."
    if (dStr.startsWith(episodeLabel)) {
        return dStr;
    }

    // Nếu displayName trùng với k hoặc là số thuần (tránh "Tập 1: 1")
    if (dLower === kLower || /^\d+$/.test(dStr)) {
        return /^\d+$/.test(kStr) ? `${episodeLabel} ${kStr}` : dStr;
    }

    // Nếu k là số và có tên tập riêng
    if (/^\d+$/.test(kStr)) {
        return `${episodeLabel} ${kStr}: ${dStr}`;
    }

    return dStr || kStr;
};

const EpisodeInfo = ({ k, displayName, imdbEp, isActive, episodeLabel }) => (
    <div className="flex flex-1 flex-col justify-between p-3">
        <div>
            <div className="flex items-center justify-between gap-2">
                <span
                    className={`text-xs font-black tracking-wide ${
                        isActive ? "text-red-500" : "text-zinc-200 group-hover:text-white"
                    }`}
                >
                    {resolveEpisodeTitle(k, displayName, episodeLabel)}
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
        {String(k).toLowerCase() === "full" ? "Full" : k}
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

const isTmdbSeasonAvailable = (tmdbData, seasonNumber) => {
    if (!tmdbData || !seasonNumber) return true;
    if (Array.isArray(tmdbData.seasons) && tmdbData.seasons.length > 0) {
        return tmdbData.seasons.some((s) => Number(s.season_number) === Number(seasonNumber));
    }
    if (tmdbData.number_of_seasons) {
        return Number(seasonNumber) <= tmdbData.number_of_seasons;
    }
    return true;
};

const fetchSeasonEpisodesData = async (seasonItem, tmdbId, tmdbData) => {
    try {
        const canFetchTmdb = Boolean(
            tmdbId &&
            seasonItem?.season &&
            isTmdbSeasonAvailable(tmdbData, seasonItem.season)
        );

        const fetchPromises = [
            seasonItem?.slug
                ? vodService.fetchSourceData(seasonItem.slug, SOURCES.SOURCE_K)
                : Promise.resolve(null),
            canFetchTmdb
                ? vodService.fetchTMDBSeason(tmdbId, seasonItem.season)
                : Promise.resolve(null),
        ];

        const [sourceRes, tmdbSeasonRes] = await Promise.all(fetchPromises);
        return {
            episodes: sourceRes?.episodes || [],
            movie: sourceRes?.movie || null,
            imdbEpisodes: tmdbSeasonRes?.episodes || [],
        };
    } catch (err) {
        console.warn("fetchSeasonEpisodesData error:", err);
        return { episodes: [], movie: null, imdbEpisodes: [] };
    }
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
    seasons = [],
    currentSeason = 1,
    tmdbData,
    onPlaySeasonEpisode,
}) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(true);
    const [viewingSeason, setViewingSeason] = useState(currentSeason);
    const [seasonCache, setSeasonCache] = useState({});
    const [loadingSeason, setLoadingSeason] = useState(false);
    const [activeRefServer, setActiveRefServer] = useState(null);

    useEffect(() => {
        if (currentSeason) {
            setViewingSeason(currentSeason);
        }
    }, [currentSeason]);

    const isCurrentSeasonView = Number(viewingSeason) === Number(currentSeason);

    const handleSelectSeasonTab = useCallback(async (seasonItem) => {
        const sNum = seasonItem.season;
        setViewingSeason(sNum);
        setActiveRefServer(null);

        if (Number(sNum) === Number(currentSeason) || seasonCache[sNum]) {
            return;
        }

        setLoadingSeason(true);
        const tmdbId = movie?.tmdb_id || movie?.tmdb?.id || tmdbData?.id || seasonItem.tmdbId;
        const result = await fetchSeasonEpisodesData(seasonItem, tmdbId, tmdbData);
        setSeasonCache((prev) => ({ ...prev, [sNum]: result }));
        setLoadingSeason(false);
    }, [currentSeason, seasonCache, movie, tmdbData]);

    const currentSeasonData = useMemo(() => {
        if (isCurrentSeasonView) {
            return {
                episodesList: episodes,
                activeGroup: activeEpisode,
                items: episodeListData,
                targetMovie: movie,
            };
        }

        const cached = seasonCache[viewingSeason];
        const cachedEps = cached?.episodes || [];
        const cachedGroup = activeRefServer || cachedEps[0] || null;
        const cachedImdb = cached?.imdbEpisodes || [];
        const seasonMovie = cached?.movie || movie;
        const computedList = computeEpisodeListData(cachedGroup, cachedImdb, seasonMovie, tmdbData);

        return {
            episodesList: cachedEps,
            activeGroup: cachedGroup,
            items: computedList,
            targetMovie: seasonMovie,
        };
    }, [isCurrentSeasonView, episodes, activeEpisode, episodeListData, movie, seasonCache, viewingSeason, activeRefServer, tmdbData]);

    const handleSwitchServerTab = useCallback((group) => {
        if (isCurrentSeasonView) {
            switchTab(group);
        } else {
            setActiveRefServer(group);
        }
    }, [isCurrentSeasonView, switchTab]);

    const handleEpisodeClick = useCallback((itemServer, activeGroup, targetMovie) => {
        if (isCurrentSeasonView) {
            openEpisode(itemServer, activeGroup, targetMovie);
        } else {
            const seasonItem = seasons.find((s) => Number(s.season) === Number(viewingSeason));
            if (onPlaySeasonEpisode) {
                onPlaySeasonEpisode({
                    server: itemServer,
                    activeEpisode: activeGroup,
                    movie: targetMovie,
                    seasonItem,
                });
            } else {
                openEpisode(itemServer, activeGroup, targetMovie);
            }
        }
    }, [isCurrentSeasonView, openEpisode, seasons, viewingSeason, onPlaySeasonEpisode]);

    if (!episodes || episodes.length === 0) return null;

    return (
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-zinc-900/30 shadow-2xl backdrop-blur-xl transition-all duration-300">
            {seasons && seasons.length > 1 && (
                <SeasonTabs
                    seasons={seasons}
                    currentSeason={viewingSeason}
                    playingSeason={currentSeason}
                    movie={movie}
                    onSelectSeason={handleSelectSeasonTab}
                />
            )}

            <ServerTabs
                episodes={currentSeasonData.episodesList}
                activeEpisode={currentSeasonData.activeGroup}
                switchTab={handleSwitchServerTab}
                isOpen={isOpen}
                onToggleOpen={() => setIsOpen((prev) => !prev)}
            />

            {isOpen && (
                <div className="p-4 md:p-6 animate-in fade-in slide-in-from-top-2 duration-200">
                    {loadingSeason ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-600 border-t-transparent mb-2" />
                            <p className="text-xs font-bold text-zinc-400">
                                {t("vodPlay.loadingSeason") || "Đang tải danh sách tập..."}
                            </p>
                        </div>
                    ) : currentSeasonData.items && currentSeasonData.items.length > 0 ? (
                        <div
                            className={`grid gap-3 md:gap-4 ${
                                isCompactView
                                    ? "grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10"
                                    : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
                            }`}
                        >
                            {currentSeasonData.items.map((item) => {
                                if (!item?.server) return null;
                                const episodeKey = String(getEpisodeKey(item.server.slug, item.server.name));
                                const isActive = isCurrentSeasonView && String(currentEpisodeId) === episodeKey;

                                return (
                                    <EpisodeGridItem
                                        key={episodeKey}
                                        k={item.k}
                                        server={item.server}
                                        isActive={isActive}
                                        isCompactView={isCompactView}
                                        imdbEp={item.server?.imdbEp}
                                        episodeThumb={item.server?.thumb}
                                        openEpisode={() => handleEpisodeClick(item.server, currentSeasonData.activeGroup, currentSeasonData.targetMovie)}
                                        formatEpisodeName={formatEpisodeName}
                                        movie={currentSeasonData.targetMovie}
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
