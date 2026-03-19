import { getMovieImage } from "../utils/vodHelpers";

const CONFIG = {
    API_ENDPOINT: import.meta.env.VITE_SOURCE_K_API + "/phim",
    APP_DOMAIN_SOURCE_K: import.meta.env.VITE_SOURCE_K_API,
    APP_DOMAIN_SOURCE_K_CDN_IMAGE: import.meta.env.VITE_SOURCE_K_CDN_IMAGE,
    APP_DOMAIN_SOURCE_C: import.meta.env.VITE_SOURCE_C_API,
    APP_DOMAIN_SOURCE_O: import.meta.env.VITE_SOURCE_O_API,
    APP_DOMAIN_SOURCE_O_FRONTEND: import.meta.env.VITE_SOURCE_O_FRONTEND,
    APP_DOMAIN_SOURCE_O_CDN_IMAGE: import.meta.env.VITE_SOURCE_O_CDN_IMAGE,
    TMDB_API_KEY: import.meta.env.VITE_TMDB_API_KEY,
    TMDB_BASE_URL: import.meta.env.VITE_TMDB_BASE_URL,
};

const SOURCES = {
    SOURCE_C: "source_c",
    SOURCE_K: "source_k",
    SOURCE_O: "source_o",
};

/**
 * Chuẩn hóa dữ liệu phim theo nguồn (Source)
 */
export function normalizeMovieForSource(item, source) {
    if (!item) return item;
    const m = { ...item };

    if (source === SOURCES.SOURCE_C) {
        m.poster_url = getMovieImage(item.thumb_url || item.poster_url, source, CONFIG);
        m.thumb_url = getMovieImage(item.poster_url || item.thumb_url, source, CONFIG);
        m.episode_current = m.current_episode;
        m.lang = m.language;
        m.content = m.description;
        m.actor = m.casts ? m.casts.split(", ") : [];
        if (m.category && typeof m.category === "object") {
            m.category = Object.values(m.category).flatMap((group) => group.list || []);
        }
    } else if (source === SOURCES.SOURCE_O) {
        let posterPath = item.thumb_url || item.poster_url;
        if (posterPath && !posterPath.startsWith("uploads/movies/")) posterPath = `uploads/movies/${posterPath}`;
        m.poster_url = getMovieImage(posterPath, source, CONFIG);

        let thumbPath = item.poster_url || item.thumb_url;
        if (thumbPath && !thumbPath.startsWith("uploads/movies/")) thumbPath = `uploads/movies/${thumbPath}`;
        m.thumb_url = getMovieImage(thumbPath, source, CONFIG);
    } else {
        if (!m.poster_url) m.poster_url = getMovieImage(m.poster_url || m.thumb_url || m.image || "", source, CONFIG);
    }

    if (!m.poster_url) m.poster_url = m.thumb_url || "";
    if (!m.thumb_url) m.thumb_url = m.poster_url || "";
    return m;
}

/**
 * Lấy chi tiết phim từ Primary Source (KKPhim/NguonC)
 */
export async function fetchPrimaryMovieData(slug) {
    try {
        const res = await fetch(`${CONFIG.API_ENDPOINT}/${slug}`);
        const data = await res.json();
        if (data?.status && data.movie) {
            const movie = normalizeMovieForSource(data.movie, "primary");
            const allowedTypes = ["Vietsub", "Thuyết Minh", "Lồng Tiếng"];
            const episodes = (data.episodes || []).filter(ep => 
                allowedTypes.some(type => (ep.server_name || "").toLowerCase().includes(type.toLowerCase()))
            ).map(ep => {
                let displayName = ep.server_name;
                allowedTypes.forEach(type => {
                    if (displayName.toLowerCase().includes(type.toLowerCase())) displayName = type;
                });
                return { ...ep, original_server_name: ep.server_name, server_name: displayName };
            });
            return { movie, episodes };
        }
    } catch (err) { console.error("fetchPrimaryMovieData error:", err); }
    return null;
}

/**
 * Lấy chi tiết phim từ Source C (NguonC API riêng)
 */
export async function fetchSourceCMovieData(slug) {
    try {
        const res = await fetch(`${CONFIG.APP_DOMAIN_SOURCE_C}/api/film/${slug}`);
        const data = await res.json();
        if (data?.status === "success" && data.movie) {
            const movie = normalizeMovieForSource(data.movie, SOURCES.SOURCE_C);
            let episodesData = (data.movie.episodes || []).map(ep => ({
                server_name: ep.server_name,
                server_data: (ep.items || []).map(item => ({
                    name: item.name, slug: item.slug, link_embed: item.embed, link_m3u8: item.m3u8
                }))
            }));
            const allowedTypes = ["Vietsub", "Thuyết Minh", "Lồng Tiếng"];
            const episodes = episodesData.filter(ep => 
                allowedTypes.some(type => (ep.server_name || "").toLowerCase().includes(type.toLowerCase()))
            ).map(ep => {
                let displayName = ep.server_name;
                allowedTypes.forEach(type => {
                    if (displayName.toLowerCase().includes(type.toLowerCase())) displayName = type;
                });
                return { ...ep, original_server_name: ep.server_name, server_name: displayName };
            });
            return { movie, episodes };
        }
    } catch (err) { console.error("fetchSourceCMovieData error:", err); }
    return null;
}

/**
 * Lấy chi tiết phim từ Source O (OPhim)
 */
export async function fetchSourceOMovieData(slug) {
    try {
        const res = await fetch(`${CONFIG.APP_DOMAIN_SOURCE_O}/v1/api/phim/${slug}`);
        if (res.ok) {
            const data = await res.json();
            if (data?.data?.item) {
                const movie = normalizeMovieForSource(data.data.item, SOURCES.SOURCE_O);
                const episodes = (data.data.item.episodes || []).map(ep => ({
                    server_name: ep.server_name,
                    server_data: (ep.server_data || []).map(item => ({
                        name: item.name, slug: item.slug, link_embed: item.link_embed, link_m3u8: item.link_m3u8
                    }))
                }));
                return { movie, episodes };
            }
        }
    } catch (err) { console.error("fetchSourceOMovieData error:", err); }
    return null;
}

/**
 * Gộp dữ liệu phim từ tất cả các nguồn
 */
export async function fetchAllMovieDetails(slug) {
    const results = await Promise.all([
        fetchPrimaryMovieData(slug).catch(() => null),
        fetchSourceCMovieData(slug).catch(() => null),
        fetchSourceOMovieData(slug).catch(() => null),
    ]);

    const primary = results[0];
    const sourceC = results[1];
    const sourceO = results[2];

    if (!primary && !sourceC && !sourceO) return null;

    // Ưu tiên movie từ primary -> sourceC -> sourceO
    const finalMovie = primary?.movie || sourceC?.movie || sourceO?.movie;
    
    // Merge episodes từ tất cả các server
    const allEpisodesMap = new Map();
    [primary, sourceC, sourceO].forEach(sourceData => {
        if (sourceData?.episodes) {
            sourceData.episodes.forEach(server => {
                const name = server.server_name;
                if (!allEpisodesMap.has(name)) {
                    allEpisodesMap.set(name, { ...server });
                } else {
                    const existing = allEpisodesMap.get(name);
                    server.server_data.forEach(newEp => {
                        if (!existing.server_data.some(e => e.slug === newEp.slug)) {
                            existing.server_data.push(newEp);
                        }
                    });
                }
            });
        }
    });

    const finalEpisodes = Array.from(allEpisodesMap.values());
    return { movie: finalMovie, episodes: finalEpisodes };
}

// Giữ lại các hàm cũ để tương thích nếu cần
export { CONFIG, SOURCES };
