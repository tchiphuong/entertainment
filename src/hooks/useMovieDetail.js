import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { SOURCES } from "../constants/vodConstants";
import { vodService } from "../services/vod/vodService";

export const useMovieDetail = (slug, initialSource = null) => {
    const { t, i18n } = useTranslation();
    const [movie, setMovie] = useState(null);
    const [episodes, setEpisodes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tmdbData, setTmdbData] = useState(null);
    const [tmdbCredits, setTmdbCredits] = useState(null);
    const [tmdbImages, setTmdbImages] = useState(null);
    const [tmdbVideos, setTmdbVideos] = useState(null);
    const [fanartLogo, setFanartLogo] = useState(null);
    const isFetchingRef = useRef(false);

    const typeConfig = {
        sub: { id: "sub", label: t("vods.subFull"), color: "bg-red-600" },
        tm: { id: "tm", label: t("vods.tmFull"), color: "bg-blue-600" },
        lt: { id: "lt", label: t("vods.ltFull"), color: "bg-emerald-600" },
    };

    const getTypeKey = (name = "") => {
        const n = name.toLowerCase();
        if (n.includes("vietsub") || n.includes("phụ đề") || n.includes("pđ"))
            return "sub";
        if (n.includes("thuyết minh") || n.includes("tm")) return "tm";
        if (n.includes("lồng tiếng") || n.includes("lt")) return "lt";
        return null;
    };

    const getEpisodeKey = (slug, name) => {
        const source = (name || slug || "").trim();
        if (!source) return null;

        // Tìm số (hỗ trợ cả số thập phân như 12.5)
        const match = source.match(/\d+(\.\d+)?/);
        if (match) {
            return Number(match[0]);
        }

        // Không có số → trả string gốc (đã trim)
        return source;
    };

    const fetchAllData = useCallback(async () => {
        if (!slug || isFetchingRef.current) return;
        isFetchingRef.current = true;
        setLoading(true);
        setError(null);

        try {
            // Thứ tự ưu tiên cứng: O > K > C
            const priorityOrder = [
                SOURCES.SOURCE_O,
                SOURCES.SOURCE_K,
                SOURCES.SOURCE_C,
            ];
            const sources = initialSource
                ? [
                      initialSource,
                      ...priorityOrder.filter((s) => s !== initialSource),
                  ]
                : priorityOrder;

            const mappedData = {};
            let firstMovieData = null;

            // Gọi đồng thời tất cả các nguồn
            const fetchPromises = sources.map(async (src) => {
                try {
                    const res = await vodService.fetchSourceData(slug, src);
                    return { src, res };
                } catch (e) {
                    console.warn(`Error fetching from ${src}:`, e.message);
                    return { src, res: null };
                }
            });

            const results = await Promise.all(fetchPromises);

            // Lưu kết quả theo nguồn để truy vấn nhanh
            const resultsBySource = {};
            for (const { src, res } of results) {
                resultsBySource[src] = res;
            }

            // Tìm TMDB ID theo thứ tự ưu tiên cứng: O → K → C
            // (bất kể initialSource là gì)
            const tmdbPriority = [
                SOURCES.SOURCE_O,
                SOURCES.SOURCE_K,
                SOURCES.SOURCE_C,
            ];
            let foundTmdbId = null;
            let foundTmdbType = null;
            let bestTmdbInfo = null;
            for (const src of tmdbPriority) {
                const res = resultsBySource[src];
                const currentTmdbId =
                    res?.movie?.tmdb?.id || res?.movie?.tmdb_id;
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

            // Xử lý kết quả theo thứ tự sources (movie data & episodes)
            for (const { src, res } of results) {
                if (res && res.movie) {
                    // Ưu tiên movie data từ nguồn đầu tiên thành công (theo thứ tự sources)
                    if (!firstMovieData) {
                        firstMovieData = { ...res.movie };
                        // Nếu nguồn hiện tại không phải nguồn TMDB tốt nhất, cập nhật info TMDB
                        if (bestTmdbInfo) {
                            firstMovieData.tmdb = bestTmdbInfo;
                            firstMovieData.tmdb_id = foundTmdbId;
                        }
                    }

                    if (res.episodes) {
                        res.episodes.forEach((serverGroup) => {
                            const typeKey = getTypeKey(serverGroup.server_name);
                            if (!typeKey) return;

                            if (!mappedData[typeKey]) {
                                mappedData[typeKey] = {
                                    server_name: typeConfig[typeKey].label,
                                    type_id: typeKey,
                                    color: typeConfig[typeKey].color,
                                    episodesMap: {},
                                };
                            }

                            (
                                serverGroup.server_data ||
                                serverGroup.items ||
                                []
                            ).forEach((item) => {
                                const epName = item.name;
                                if (!mappedData[typeKey].episodesMap[epName]) {
                                    mappedData[typeKey].episodesMap[epName] = {
                                        ...item,
                                        backups: [],
                                    };
                                }

                                const link_m3u8 = item.link_m3u8 || item.m3u8;
                                const link_embed =
                                    item.link_embed || item.embed;

                                mappedData[typeKey].episodesMap[
                                    epName
                                ].backups.push({
                                    source: src,
                                    link_m3u8: link_m3u8,
                                    link_embed: link_embed,
                                });

                                // Set primary links if not set
                                if (
                                    !mappedData[typeKey].episodesMap[epName]
                                        .link_m3u8
                                ) {
                                    mappedData[typeKey].episodesMap[
                                        epName
                                    ].link_m3u8 = link_m3u8;
                                }
                                if (
                                    !mappedData[typeKey].episodesMap[epName]
                                        .link_embed
                                ) {
                                    mappedData[typeKey].episodesMap[
                                        epName
                                    ].link_embed = link_embed;
                                }
                            });
                        });
                    }
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

            setMovie(firstMovieData);
            setEpisodes(finalEpisodes);

            // Fetch TMDB Data if available
            if (foundTmdbId) {
                try {
                    const lang = i18n.language === "vi" ? "vi-VN" : "en-US";
                    const tmdb = await vodService.fetchTMDbData(
                        foundTmdbId,
                        foundTmdbType,
                        lang,
                    );
                    if (tmdb && tmdb.details) {
                        const details = tmdb.details;
                        setTmdbData(details);
                        setTmdbCredits(details.credits);
                        setTmdbImages(details.images);
                        setTmdbVideos(details.videos?.results || []);

                        // Fetch Fanart Logo nếu TMDB không có logo
                        const imdbId =
                            details.imdb_id || details.external_ids?.imdb_id;
                        const hasTmdbLogos =
                            details.images?.logos &&
                            details.images.logos.length > 0;

                        if (imdbId && !hasTmdbLogos) {
                            try {
                                const fanart =
                                    await vodService.fetchFanartLogo(imdbId);
                                if (fanart) {
                                    const logo =
                                        fanart.hdmovielogo?.[0] ||
                                        fanart.movielogo?.[0];
                                    if (logo) {
                                        setFanartLogo(logo.url);
                                    }
                                }
                            } catch (e) {
                                console.warn(
                                    "Fanart logo fetch failed:",
                                    e.message,
                                );
                            }
                        } else {
                            setFanartLogo(null);
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
        fanartLogo,
        refresh: fetchAllData,
    };
};
