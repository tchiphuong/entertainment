import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { SOURCES, TYPE_CONFIG } from "../constants";
import { vodService } from "../services/vod/vodService";
import { normalizeTMDBMovie, searchTMDBFirstMatch } from "../services/vod/tmdbService";
import {
    getEpisodeKey,
    extractBestTrailerUrl,
    appendTrailerServerGroup,
    extractSeasonNumber,
} from "../utils/vodHelpers";
import {
    tryFindFallbackSeasonMovie,
    cleanBaseSlug,
} from "../utils/vodPlayHelpers";

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

// Helper xác định danh sách source cần truy vấn (ưu tiên source truyền vào hoặc Source K)
const determineSources = (initialSource) => {
    const availableSources = [SOURCES.SOURCE_K, SOURCES.SOURCE_O, SOURCES.SOURCE_R];
    if (initialSource && availableSources.includes(initialSource)) {
        return [initialSource, ...availableSources.filter((s) => s !== initialSource)];
    }
    return availableSources;
};

const fetchTmdbSourcesData = async ({ slug, tmdbId, mediaType, sources = [SOURCES.SOURCE_K, SOURCES.SOURCE_O] }) => {
    const results = [];
    const resultsBySource = {};

    for (const src of sources) {
        try {
            let res = await vodService.fetchSourceData(slug, src, tmdbId, mediaType);
            if (!res?.movie && slug && src === SOURCES.SOURCE_K) {
                const fallbackMovie = await tryFindFallbackSeasonMovie(slug);
                if (fallbackMovie?.slug) {
                    res = await vodService.fetchSourceData(fallbackMovie.slug, src, tmdbId, mediaType);
                }
            }
            if (res?.movie) {
                results.push({ src, res });
                resultsBySource[src] = res;
                break;
            }
        } catch (err) {
            console.warn(`Error fetching TMDB detail from ${src}:`, err.message);
        }
    }

    return { results, resultsBySource };
};

const fetchDirectSourcesData = async (slug, sources) => {
    // Sắp xếp thứ tự nguồn đảm bảo Source K luôn đứng trước
    const orderedSources = [
        SOURCES.SOURCE_K,
        ...sources.filter((s) => s !== SOURCES.SOURCE_K),
    ];

    const results = [];
    const resultsBySource = {};

    for (const src of orderedSources) {
        try {
            let res = await vodService.fetchSourceData(slug, src);
            if (!res?.movie && src === SOURCES.SOURCE_K && slug) {
                // Tự động tìm kiếm fallback nếu slug không tồn tại (ví dụ phi-vu-trieu-do -> phi-vu-trieu-do-phan-1)
                const fallbackMovie = await tryFindFallbackSeasonMovie(slug);
                if (fallbackMovie?.slug) {
                    res = await vodService.fetchSourceData(fallbackMovie.slug, src);
                }
            }
            if (res?.movie) {
                results.push({ src, res });
                resultsBySource[src] = res;
            }
        } catch (err) {
            console.warn(`Error fetching from ${src}:`, err.message);
        }
    }

    return { results, resultsBySource };
};

// Helper fetch dữ liệu nguồn
const fetchSourcesData = async (slug, isTmdb, sources, tmdbId = null, mediaType = "movie") => {
    const isValidSlug = slug && !/^\d+$/.test(String(slug).trim()) && !slug.startsWith("tmdb-");
    if (isTmdb && tmdbId) {
        return fetchTmdbSourcesData({ slug, tmdbId, mediaType, isValidSlug, sources });
    }
    return fetchDirectSourcesData(slug, sources);
};

const isSeriesType = (type) =>
    type === "series" || type === "tv" || type === "tvshows";

const extractTmdbFromSourceResult = (res, initialMediaType) => {
    const movie = res?.movie;
    const currentTmdbId = movie?.tmdb?.id || movie?.tmdb_id;
    if (!currentTmdbId) return null;

    return {
        tmdbId: currentTmdbId,
        tmdbType: isSeriesType(movie.type) ? "tv" : (initialMediaType || "movie"),
        tmdbInfo: movie.tmdb,
    };
};

// Helper tìm thông tin TMDB tốt nhất từ các nguồn
const findBestTmdbInfo = (resultsBySource, initialTmdbId = null, initialMediaType = null) => {
    const tmdbPriority = [SOURCES.SOURCE_K, SOURCES.SOURCE_O, SOURCES.SOURCE_R];
    let foundTmdbId = initialTmdbId;
    let foundTmdbType = initialMediaType || "movie";
    let bestTmdbInfo = null;

    for (const src of tmdbPriority) {
        const parsed = extractTmdbFromSourceResult(resultsBySource[src], initialMediaType);
        if (parsed) {
            foundTmdbId = parsed.tmdbId;
            foundTmdbType = parsed.tmdbType;
            bestTmdbInfo = parsed.tmdbInfo;
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
            const epKey = getEpisodeKey(item.slug, item.name) ?? item.name;
            if (!mappedData[typeKey].episodesMap[epKey]) {
                mappedData[typeKey].episodesMap[epKey] = {
                    ...item,
                    backups: [],
                };
            }

            const link_m3u8 = item.link_m3u8 || item.m3u8;
            const link_embed = item.link_embed || item.embed;

            mappedData[typeKey].episodesMap[epKey].backups.push({
                source: src,
                link_m3u8,
                link_embed,
            });

            if (!mappedData[typeKey].episodesMap[epKey].link_m3u8 && link_m3u8) {
                mappedData[typeKey].episodesMap[epKey].link_m3u8 = link_m3u8;
            }
            if (!mappedData[typeKey].episodesMap[epKey].link_embed && link_embed) {
                mappedData[typeKey].episodesMap[epKey].link_embed = link_embed;
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

const extractTmdbIdFromSlug = (slug, isNumericId) => {
    if (isNumericId) return String(slug).trim();
    if (typeof slug === "string" && slug.startsWith("tmdb-")) {
        return slug.replace("tmdb-", "");
    }
    return null;
};

const parseSlugTmdbInfo = (slug, initialSource, initialId, initialType) => {
    const isNumericId = /^\d+$/.test(String(slug).trim());
    const rawTmdbId = initialId || extractTmdbIdFromSlug(slug, isNumericId);
    const tmdbIdFromSlug = rawTmdbId ? String(rawTmdbId).trim() : null;
    const isTmdb = Boolean(tmdbIdFromSlug) || initialSource === SOURCES.SOURCE_TMDB;
    const mediaType = initialType || "movie";
    return { isTmdb, tmdbIdFromSlug, mediaType };
};

const applyTmdbDetailsToState = (details, firstMovieData, setters) => {
    setters.setTmdbData(details);
    setters.setTmdbCredits(details.credits);
    setters.setTmdbImages(details.images);
    setters.setTmdbVideos(details.videos?.results || []);

    if (!firstMovieData) {
        setters.setMovie(normalizeTMDBMovie(details));
    }
};

const applyTrailerToEpisodes = (episodesList, movieData, videos = []) => {
    const trailerUrl = extractBestTrailerUrl(movieData, videos);
    return appendTrailerServerGroup(episodesList, trailerUrl);
};

const resolveMovieTmdbId = async (initialTmdbId, initialTmdbType, movieData) => {
    if (initialTmdbId || !movieData) {
        return { tmdbId: initialTmdbId, tmdbType: initialTmdbType };
    }
    const searchTitle = movieData.original_name || movieData.origin_name || movieData.name;
    const matched = await searchTMDBFirstMatch(searchTitle, initialTmdbType);
    if (matched?.id) {
        return {
            tmdbId: matched.id,
            tmdbType: matched.media_type || initialTmdbType,
        };
    }
    return { tmdbId: null, tmdbType: initialTmdbType };
};

const resolveInitialMovieData = async ({ slug, initialSource, initialId, initialType }) => {
    const { isTmdb, tmdbIdFromSlug, mediaType } = parseSlugTmdbInfo(slug, initialSource, initialId, initialType);
    const sources = determineSources(initialSource);
    const { results, resultsBySource } = await fetchSourcesData(slug, isTmdb, sources, tmdbIdFromSlug, mediaType);
    const { foundTmdbId: rawTmdbId, foundTmdbType: rawTmdbType, bestTmdbInfo } = findBestTmdbInfo(
        resultsBySource,
        tmdbIdFromSlug,
        mediaType,
    );
    const { firstMovieData, finalEpisodes } = processMovieAndEpisodes(results, bestTmdbInfo, rawTmdbId);
    const { tmdbId: foundTmdbId, tmdbType: foundTmdbType } = await resolveMovieTmdbId(
        rawTmdbId,
        rawTmdbType,
        firstMovieData,
    );
    if (firstMovieData && foundTmdbId) {
        firstMovieData.tmdb_id = foundTmdbId;
    }
    return { firstMovieData, finalEpisodes, foundTmdbId, foundTmdbType };
};

const buildTmdbSeasonsList = (seasons, cleanSlug, baseSlug, foundTmdbId) => {
    const isOriginalSeason1WithSuffix = Boolean(baseSlug && /-(?:phan|season|mua|ss|part)-1$/i.test(baseSlug));
    return seasons
        .filter((s) => s.season_number > 0)
        .map((s) => {
            const isFirst = s.season_number === 1;
            const seasonSlug = isFirst && isOriginalSeason1WithSuffix ? baseSlug : `${cleanSlug}-phan-${s.season_number}`;
            return {
                season: s.season_number,
                name: s.name || `Mùa ${s.season_number}`,
                episodeCount: s.episode_count,
                posterPath: s.poster_path,
                slug: isFirst && !isOriginalSeason1WithSuffix ? cleanSlug : seasonSlug,
                tmdbId: foundTmdbId,
            };
        });
};

const appendMissingHigherSeasons = (seasonsList, currentMovie, cleanSlug, foundTmdbId, defaultPoster) => {
    const currentSeasonNum = extractSeasonNumber(currentMovie) || Number(currentMovie?.tmdb?.season) || 0;
    if (currentSeasonNum <= 0) return;

    const maxSeason = Math.max(...seasonsList.map((s) => s.season), 0);
    if (currentSeasonNum <= maxSeason) return;

    for (let sNum = maxSeason + 1; sNum <= currentSeasonNum; sNum++) {
        const epCount = sNum === currentSeasonNum ? (currentMovie?.episodes?.[0]?.server_data?.length || 0) : 0;
        seasonsList.push({
            season: sNum,
            name: `Mùa ${sNum}`,
            episodeCount: epCount,
            posterPath: defaultPoster,
            slug: `${cleanSlug}-phan-${sNum}`,
            tmdbId: foundTmdbId,
        });
    }
};

const applyTmdbSeasons = (tmdbDetails, baseSlug, foundTmdbId, setSeasons, currentMovie) => {
    if (!tmdbDetails?.seasons?.length) return;

    const cleanSlug = cleanBaseSlug(baseSlug);
    const tmdbSeasonsList = buildTmdbSeasonsList(tmdbDetails.seasons, cleanSlug, baseSlug, foundTmdbId);
    appendMissingHigherSeasons(tmdbSeasonsList, currentMovie, cleanSlug, foundTmdbId, tmdbDetails.poster_path);

    if (tmdbSeasonsList.length > 1) {
        setSeasons(tmdbSeasonsList);
    }
};

const loadTmdbExtraDetails = async ({
    foundTmdbId,
    foundTmdbType,
    lang,
    firstMovieData,
    slug,
    stateSetters,
}) => {
    if (!foundTmdbId) return;
    const [tmdb, related] = await Promise.all([
        vodService.fetchTMDbData(foundTmdbId, foundTmdbType, lang),
        vodService.fetchTMDBRelated(foundTmdbId, foundTmdbType, lang),
    ]);

    if (related?.items) {
        stateSetters.setTmdbRelated(related.items);
    }

    if (tmdb?.details) {
        const tmdbVids = tmdb.details.videos?.results || [];
        applyTmdbDetailsToState(tmdb.details, firstMovieData, {
            setTmdbData: stateSetters.setTmdbData,
            setTmdbCredits: stateSetters.setTmdbCredits,
            setTmdbImages: stateSetters.setTmdbImages,
            setTmdbVideos: stateSetters.setTmdbVideos,
            setMovie: stateSetters.setMovie,
        });
        stateSetters.setEpisodes((prev) => applyTrailerToEpisodes(prev, firstMovieData, tmdbVids));
        applyTmdbSeasons(tmdb.details, firstMovieData?.slug || slug, foundTmdbId, stateSetters.setSeasons, firstMovieData);
    }
};

export const useMovieDetail = (
    slug,
    initialSource = null,
    initialId = null,
    initialType = null,
    _initialSeason = null,
) => {
    const { i18n } = useTranslation();
    const [movie, setMovie] = useState(null);
    const [episodes, setEpisodes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tmdbData, setTmdbData] = useState(null);
    const [tmdbCredits, setTmdbCredits] = useState(null);
    const [tmdbImages, setTmdbImages] = useState(null);
    const [tmdbVideos, setTmdbVideos] = useState([]);
    const [tmdbRelated, setTmdbRelated] = useState([]);
    const [seasons, setSeasons] = useState([]);

    const isFetchingRef = useRef(false);

    const fetchAllData = useCallback(async () => {
        if (!slug || isFetchingRef.current) return;
        isFetchingRef.current = true;
        setLoading(true);
        setError(null);

        try {
            const { firstMovieData, finalEpisodes, foundTmdbId, foundTmdbType } = await resolveInitialMovieData({
                slug,
                initialSource,
                initialId,
                initialType,
            });

            const episodesWithTrailer = applyTrailerToEpisodes(finalEpisodes, firstMovieData);
            setMovie(firstMovieData);
            setEpisodes(episodesWithTrailer);

            const lang = i18n.language === "vi" ? "vi-VN" : "en-US";
            await loadTmdbExtraDetails({
                foundTmdbId,
                foundTmdbType,
                lang,
                firstMovieData,
                slug,
                stateSetters: {
                    setTmdbRelated,
                    setTmdbData,
                    setTmdbCredits,
                    setTmdbImages,
                    setTmdbVideos,
                    setMovie,
                    setEpisodes,
                    setSeasons,
                },
            });
        } catch (err) {
            console.error("useMovieDetail error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
            isFetchingRef.current = false;
        }
    }, [slug, i18n.language, initialSource, initialId, initialType]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    return {
        movie,
        episodes,
        seasons,
        loading,
        error,
        tmdbData,
        tmdbCredits,
        tmdbImages,
        tmdbVideos,
        tmdbRelated,
        refresh: fetchAllData,
    };
};
