import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { SOURCES } from "../constants/vodConstants";
import { vodService } from "../services/vod/vodService";
import { normalizeTMDBMovie } from "../services/vod/tmdbService";
import { getEpisodeKey } from "../utils/vodHelpers";

const TYPE_CONFIG = {
    vietsub: { label: "Vietsub", color: "bg-red-600" },
    thuyetminh: { label: "Thuyết Minh", color: "bg-blue-600" },
    longtieng: { label: "Lồng Tiếng", color: "bg-green-600" },
};

const getTypeKey = (serverName) => {
    if (!serverName) return null;
    const name = serverName.toLowerCase();
    if (name.includes("vietsub")) return "vietsub";
    if (name.includes("thuyết minh") || name.includes("thuyet minh"))
        return "thuyetminh";
    if (name.includes("lồng tiếng") || name.includes("long tieng"))
        return "longtieng";
    return "vietsub";
};

// Helper xác định danh sách source cần truy vấn (ưu tiên K và C, tạm disabled O)
const determineSources = (initialSource) => {
    const priorityOrder = [SOURCES.SOURCE_K, SOURCES.SOURCE_C];

    if (initialSource && initialSource !== SOURCES.SOURCE_TMDB && initialSource !== SOURCES.SOURCE_O) {
        return [initialSource, ...priorityOrder.filter((s) => s !== initialSource)];
    }
    return priorityOrder;
};

// Helper fetch dữ liệu nguồn
const fetchSourcesData = async (slug, isTmdb, sources) => {
    const results = [];
    const resultsBySource = {};

    if (isTmdb) {
        try {
            const kRes = await vodService.fetchSourceData(slug, SOURCES.SOURCE_K);
            results.push({ src: SOURCES.SOURCE_K, res: kRes });
            resultsBySource[SOURCES.SOURCE_K] = kRes;
            const realSlug = kRes?.movie?.slug;
            if (realSlug) {
                // Tích hợp SOURCE_C trong fallback
                const otherPromises = [SOURCES.SOURCE_C].map(async (src) => {
                    try {
                        const res = await vodService.fetchSourceData(realSlug, src);
                        return { src, res };
                    } catch {
                        return { src, res: null };
                    }
                });
                const otherResults = await Promise.all(otherPromises);
                for (const item of otherResults) {
                    results.push(item);
                    resultsBySource[item.src] = item.res;
                }
            }
        } catch (err) {
            console.warn("Error fetching TMDB detail from Source K:", err.message);
        }
    } else {
        const fetchPromises = sources.map(async (src) => {
            try {
                const res = await vodService.fetchSourceData(slug, src);
                return { src, res };
            } catch (err) {
                console.warn(`Error fetching from ${src}:`, err.message);
                return { src, res: null };
            }
        });

        const fetchResults = await Promise.all(fetchPromises);
        for (const item of fetchResults) {
            results.push(item);
            resultsBySource[item.src] = item.res;
        }
    }

    return { results, resultsBySource };
};

// Helper tìm thông tin TMDB tốt nhất từ các nguồn
const findBestTmdbInfo = (resultsBySource, foundTmdbId = null) => {
    const tmdbPriority = [SOURCES.SOURCE_K, SOURCES.SOURCE_C];
    let foundTmdbType = null;
    let bestTmdbInfo = null;

    for (const src of tmdbPriority) {
        const res = resultsBySource[src];
        const currentTmdbId = res?.movie?.tmdb?.id || res?.movie?.tmdb_id;
        if (currentTmdbId) {
            foundTmdbId = currentTmdbId;
            foundTmdbType =
                res.movie?.type === "series" ||
                res.movie?.type === "tv" ||
                res.movie?.type === "tvshows"
                    ? "tv"
                    : "movie";
            bestTmdbInfo = res.movie.tmdb;
            break;
        }
    }

    return { foundTmdbId, foundTmdbType, bestTmdbInfo };
};

// Helper ghép danh sách tập phim từ các server
const mergeEpisodesIntoMap = (mappedData, episodes, src) => {
    if (!episodes) return;
    episodes.forEach((serverGroup) => {
        const typeKey = getTypeKey(serverGroup.server_name);
        if (!typeKey) return;

        if (!mappedData[typeKey]) {
            mappedData[typeKey] = {
                server_name: TYPE_CONFIG[typeKey].label,
                type_id: typeKey,
                color: TYPE_CONFIG[typeKey].color,
                episodesMap: {},
            };
        }

        const items = serverGroup.server_data || serverGroup.items || [];
        items.forEach((item) => {
            const epName = item.name;
            if (!mappedData[typeKey].episodesMap[epName]) {
                mappedData[typeKey].episodesMap[epName] = {
                    ...item,
                    backups: [],
                };
            }

            const link_m3u8 = item.link_m3u8 || item.m3u8;
            const link_embed = item.link_embed || item.embed;

            mappedData[typeKey].episodesMap[epName].backups.push({
                source: src,
                link_m3u8,
                link_embed,
            });

            if (!mappedData[typeKey].episodesMap[epName].link_m3u8) {
                mappedData[typeKey].episodesMap[epName].link_m3u8 = link_m3u8;
            }
            if (!mappedData[typeKey].episodesMap[epName].link_embed) {
                mappedData[typeKey].episodesMap[epName].link_embed = link_embed;
            }
        });
    });
};

// Helper tổng hợp movie data và sorted episodes
const processMovieAndEpisodes = (results, bestTmdbInfo, foundTmdbId) => {
    const mappedData = {};
    let firstMovieData = null;

    for (const { src, res } of results) {
        if (res?.movie) {
            if (!firstMovieData) {
                firstMovieData = { ...res.movie, source: res.movie.source || src };
                if (bestTmdbInfo) {
                    firstMovieData.tmdb = bestTmdbInfo;
                    firstMovieData.tmdb_id = foundTmdbId;
                }
            }
            mergeEpisodesIntoMap(mappedData, res.episodes, src);
        }
    }

    const finalEpisodes = Object.values(mappedData).map((group) => ({
        server_name: group.server_name,
        type_id: group.type_id,
        color: group.color,
        server_data: Object.values(group.episodesMap).sort((a, b) => {
            const ka = getEpisodeKey(a.slug, a.name);
            const kb = getEpisodeKey(b.slug, b.name);
            return typeof ka === "number" && typeof kb === "number"
                ? ka - kb
                : 0;
        }),
    }));

    return { firstMovieData, finalEpisodes };
};

export const useMovieDetail = (slug, initialSource = null) => {
    const { i18n } = useTranslation();
    const [movie, setMovie] = useState(null);
    const [episodes, setEpisodes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tmdbData, setTmdbData] = useState(null);
    const [tmdbCredits, setTmdbCredits] = useState(null);
    const [tmdbImages, setTmdbImages] = useState(null);
    const [tmdbVideos, setTmdbVideos] = useState([]);

    const isFetchingRef = useRef(false);

    const fetchAllData = useCallback(async () => {
        if (!slug || isFetchingRef.current) return;
        isFetchingRef.current = true;
        setLoading(true);
        setError(null);

        try {
            const isTmdb = typeof slug === "string" && slug.startsWith("tmdb-");
            const tmdbIdFromSlug = isTmdb ? slug.replace("tmdb-", "") : null;
            const sources = determineSources(initialSource);

            const { results, resultsBySource } = await fetchSourcesData(slug, isTmdb, sources);
            const { foundTmdbId, foundTmdbType, bestTmdbInfo } = findBestTmdbInfo(resultsBySource, tmdbIdFromSlug);
            const { firstMovieData, finalEpisodes } = processMovieAndEpisodes(results, bestTmdbInfo, foundTmdbId);

            setMovie(firstMovieData);
            setEpisodes(finalEpisodes);

            if (foundTmdbId) {
                try {
                    const lang = i18n.language === "vi" ? "vi-VN" : "en-US";
                    const tmdb = await vodService.fetchTMDbData(
                        foundTmdbId,
                        foundTmdbType,
                        lang,
                    );
                    if (tmdb?.details) {
                        const details = tmdb.details;
                        setTmdbData(details);
                        setTmdbCredits(details.credits);
                        setTmdbImages(details.images);
                        setTmdbVideos(details.videos?.results || []);

                        if (!firstMovieData) {
                            const normalized = normalizeTMDBMovie(details);
                            setMovie(normalized);
                        }
                    }
                } catch (e) {
                    console.warn("TMDB data fetch failed:", e.message);
                }
            }
        } catch (err) {
            console.error("useMovieDetail error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
            isFetchingRef.current = false;
        }
    }, [slug, i18n.language, initialSource]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    return {
        movie,
        episodes,
        loading,
        error,
        tmdbData,
        tmdbCredits,
        tmdbImages,
        tmdbVideos,
        refresh: fetchAllData,
    };
};
