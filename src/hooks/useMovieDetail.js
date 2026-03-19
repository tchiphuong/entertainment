import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { SOURCES } from "../constants/vodConstants";
import { vodService } from "../services/vod/vodService";

export const useMovieDetail = (slug) => {
    const { t, i18n } = useTranslation();
    const [movie, setMovie] = useState(null);
    const [episodes, setEpisodes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tmdbData, setTmdbData] = useState(null);
    const [tmdbCredits, setTmdbCredits] = useState(null);
    const [tmdbImages, setTmdbImages] = useState(null);
    const [tmdbVideos, setTmdbVideos] = useState(null);
    const isFetchingRef = useRef(false);

    const typeConfig = {
        sub: { id: "sub", label: t("vods.subFull"), color: "bg-red-600" },
        tm: { id: "tm", label: t("vods.tmFull"), color: "bg-blue-600" },
        lt: { id: "lt", label: t("vods.ltFull"), color: "bg-emerald-600" }
    };

    const getTypeKey = (name = "") => {
        const n = name.toLowerCase();
        if (n.includes("vietsub") || n.includes("phụ đề") || n.includes("pđ")) return "sub";
        if (n.includes("thuyết minh") || n.includes("tm")) return "tm";
        if (n.includes("lồng tiếng") || n.includes("lt")) return "lt";
        return null;
    };

    const getEpisodeKey = (slug, name) => {
        if (!name && !slug) return null;
        let epName = name || "";
        if (!epName && slug) {
            const parts = slug.split("-");
            epName = parts[parts.length - 1];
        }
        const cleanName = epName.replace(/[^0-9]/g, "");
        return cleanName ? parseInt(cleanName, 10) : epName;
    };

    const fetchAllData = useCallback(async () => {
        if (!slug || isFetchingRef.current) return;
        isFetchingRef.current = true;
        setLoading(true);
        setError(null);

        try {
            const sources = [SOURCES.SOURCE_O, SOURCES.SOURCE_K, SOURCES.SOURCE_C];
            const mappedData = {};
            let firstMovieData = null;

            for (const src of sources) {
                const res = await vodService.fetchSourceData(slug, src);
                if (res && res.movie) {
                    if (!firstMovieData) firstMovieData = res.movie;
                    
                    if (res.episodes) {
                        res.episodes.forEach(serverGroup => {
                            const typeKey = getTypeKey(serverGroup.server_name);
                            if (!typeKey) return;

                            if (!mappedData[typeKey]) {
                                mappedData[typeKey] = {
                                    server_name: typeConfig[typeKey].label,
                                    type_id: typeKey,
                                    color: typeConfig[typeKey].color,
                                    episodesMap: {}
                                };
                            }

                            (serverGroup.server_data || []).forEach(item => {
                                const epName = item.name;
                                if (!mappedData[typeKey].episodesMap[epName]) {
                                    mappedData[typeKey].episodesMap[epName] = {
                                        ...item,
                                        backups: []
                                    };
                                }

                                mappedData[typeKey].episodesMap[epName].backups.push({
                                    source: src,
                                    link_m3u8: item.link_m3u8,
                                    link_embed: item.link_embed
                                });

                                // Set primary links if not set
                                if (!mappedData[typeKey].episodesMap[epName].link_m3u8) {
                                    mappedData[typeKey].episodesMap[epName].link_m3u8 = item.link_m3u8;
                                }
                                if (!mappedData[typeKey].episodesMap[epName].link_embed) {
                                    mappedData[typeKey].episodesMap[epName].link_embed = item.link_embed;
                                }
                            });
                        });
                    }
                }
            }

            const finalEpisodes = Object.values(mappedData).map(group => ({
                server_name: group.server_name,
                type_id: group.type_id,
                color: group.color,
                server_data: Object.values(group.episodesMap).sort((a, b) => {
                    const ka = getEpisodeKey(a.slug, a.name);
                    const kb = getEpisodeKey(b.slug, b.name);
                    return (typeof ka === 'number' && typeof kb === 'number') ? ka - kb : 0;
                })
            }));

            setMovie(firstMovieData);
            setEpisodes(finalEpisodes);

            // Fetch TMDB Data if available
            const tmdbId = firstMovieData?.tmdb?.id || firstMovieData?.tmdb_id;
            if (tmdbId) {
                const tmdbType = (firstMovieData?.type === "series" || firstMovieData?.type === "tv") ? "tv" : "movie";
                const lang = i18n.language === "vi" ? "vi-VN" : "en-US";
                const tmdb = await vodService.fetchTMDbData(tmdbId, tmdbType, lang);
                if (tmdb) {
                    setTmdbData(tmdb.details);
                    setTmdbCredits(tmdb.credits);
                    setTmdbImages(tmdb.images);
                    setTmdbVideos(tmdb.videos?.results || []);
                }
            }

        } catch (err) {
            console.error("useMovieDetail error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
            isFetchingRef.current = false;
        }
    }, [slug, i18n.language]);

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
        refresh: fetchAllData 
    };
};
