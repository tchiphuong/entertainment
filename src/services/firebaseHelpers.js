import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import {
    getHistoryItemKey,
    extractTmdbId,
    
    isMovieMatch,
    distinctMovies,
} from "../utils/vodIdentifier";

export { getHistoryItemKey,  isMovieMatch, distinctMovies };

const mergeSingleEpisode = (mergedEpisodes, ep) => {
    const epKey = String(ep.key);
    const existingEp = mergedEpisodes.get(epKey);
    if (!existingEp) {
        mergedEpisodes.set(epKey, ep);
        return;
    }
    const newPos = ep.position || 0;
    const oldPos = existingEp.position || 0;
    const newTime = new Date(ep.timestamp || 0).getTime();
    const oldTime = new Date(existingEp.timestamp || 0).getTime();
    if (newPos > oldPos || (newPos === oldPos && newTime > oldTime)) {
        mergedEpisodes.set(epKey, ep);
    }
};

const getPreferredHistorySlug = (existing, h) => {
    if (existing.slug && !existing.slug.startsWith("tmdb-")) return existing.slug;
    if (h.slug && !h.slug.startsWith("tmdb-")) return h.slug;
    return existing.slug || h.slug;
};

const mergeTwoHistoryEntries = (existing, h) => {
    const mergedEpisodes = new Map();
    (existing.episodes || []).forEach((ep) => mergedEpisodes.set(String(ep.key), ep));
    (h.episodes || []).forEach((ep) => mergeSingleEpisode(mergedEpisodes, ep));

    const existingTime = new Date(existing.time || 0).getTime();
    const hTime = new Date(h.time || 0).getTime();
    const isNewer = hTime >= existingTime;

    const baseObj = isNewer ? { ...existing, ...h } : { ...h, ...existing };
    return {
        ...baseObj,
        slug: getPreferredHistorySlug(existing, h),
        episodes: Array.from(mergedEpisodes.values()),
        time: isNewer ? (h.time || existing.time) : (existing.time || h.time),
        current_episode: isNewer
            ? (h.current_episode || existing.current_episode)
            : (existing.current_episode || h.current_episode),
    };
};

/**
 * Dedupe history array theo TMDB ID / slug, merge episodes và giữ position cao nhất
 */
export function dedupeHistory(rawHistory) {
    if (!Array.isArray(rawHistory)) return [];

    const dedupeMap = new Map();
    rawHistory.forEach((h) => {
        if (!h) return;
        const key = getHistoryItemKey(h);
        if (!key) return;

        const existing = dedupeMap.get(key);
        if (!existing) {
            dedupeMap.set(key, { ...h });
        } else {
            dedupeMap.set(key, mergeTwoHistoryEntries(existing, h));
        }
    });

    // Sort theo time (mới nhất trước)
    return Array.from(dedupeMap.values()).sort(
        (a, b) =>
            new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime(),
    );
}

/**
 * Fetch history từ Firestore (với fallback khi offline)
 * Tự động dedupe nếu có entries trùng lặp
 */
export const fetchHistoryFromFirestore = async (uid) => {
    if (!uid) return [];
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const rawHistory = docSnap.data().history || [];
            // Dedupe để clean dữ liệu bị trùng
            return dedupeHistory(rawHistory);
        }
        return [];
    } catch (error) {
        // Nếu offline hoặc lỗi Firestore, fallback về localStorage
        console.warn("Firestore offline, using localStorage:", error?.message);
        try {
            const localHistory = localStorage.getItem("viewHistory");
            const parsed = localHistory ? JSON.parse(localHistory) : [];
            return dedupeHistory(parsed);
        } catch {
            return [];
        }
    }
};

/**
 * Dedupe favorites array theo TMDB Key + Season / Slug, giữ item mới nhất
 */
export function dedupeFavorites(rawFavorites) {
    if (!Array.isArray(rawFavorites)) return [];
    const deduped = distinctMovies(rawFavorites);
    return deduped.sort(
        (a, b) =>
            new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime(),
    );
}

/**
 * Fetch favorites từ Firestore (với fallback khi offline)
 */
export const fetchFavoritesFromFirestore = async (uid) => {
    if (!uid) return [];
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return dedupeFavorites(docSnap.data().favorites || []);
        }
        return [];
    } catch (error) {
        // Nếu offline hoặc lỗi Firestore, fallback về localStorage
        console.warn("Firestore offline, using localStorage:", error?.message);
        try {
            const localFavorites = localStorage.getItem("favorites");
            const parsed = localFavorites ? JSON.parse(localFavorites) : [];
            return dedupeFavorites(parsed);
        } catch {
            return [];
        }
    }
};

/**
 * Thêm hoặc cập nhật item trong history trên Firestore
 * Tìm theo slug và merge thay vì dùng arrayUnion (gây trùng lặp)
 */
export const addHistoryToFirestore = async (uid, item) => {
    if (!uid || !item?.slug) return;
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            // Doc chưa tồn tại, tạo mới
            await setDoc(docRef, {
                history: [item],
                favorites: [],
            });
        } else {
            // Doc đã tồn tại, dedupe và merge item mới
            const data = docSnap.data();
            const rawHistory = Array.isArray(data.history) ? data.history : [];

            // Thêm item mới vào đầu rồi dedupe (dedupeHistory sẽ merge các entries cùng slug)
            let history = dedupeHistory([item, ...rawHistory]);

            // Giới hạn history tối đa 100 items
            if (history.length > 100) {
                history = history.slice(0, 100);
            }

            await updateDoc(docRef, { history });
        }
    } catch (error) {
        // Nếu offline, chỉ cảnh báo (localStorage đã được cập nhật ở Vods/VodPlay)
        console.warn(
            "Firestore offline, history saved locally only:",
            error?.message,
        );
    }
};

/**
 * Xóa item khỏi history trên Firestore (lọc theo slug để đảm bảo xóa chính xác)
 */
export const removeHistoryFromFirestore = async (uid, slug) => {
    if (!uid || !slug) return;
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            const history = Array.isArray(data.history) ? data.history : [];
            const newHistory = history.filter((h) => h.slug !== slug);

            if (newHistory.length !== history.length) {
                await updateDoc(docRef, { history: newHistory });
            }
        }
    } catch (error) {
        console.warn(
            "Firestore offline, history deleted locally only:",
            error?.message,
        );
    }
};

/**
 * Xóa tất cả history trên Firestore (với fallback khi offline)
 */
export const clearHistoryFromFirestore = async (uid) => {
    if (!uid) return;
    try {
        const docRef = doc(db, "users", uid);
        await updateDoc(docRef, {
            history: [],
        });
    } catch (error) {
        console.warn(
            "Firestore offline, history cleared locally only:",
            error?.message,
        );
    }
};

const toSafeString = (val) => {
    if (typeof val === "string") return val;
    return val ? String(val) : "";
};

/**
 * Chuẩn hóa đối tượng phim để lưu vào danh sách yêu thích
 * Chỉ giữ lại các trường metadata cần thiết để đảm bảo tính đồng nhất trên toàn hệ thống
 */
export const normalizeMovie = (movie) => {
    if (!movie) return null;
    const tmdbId = extractTmdbId(movie);

    return {
        slug: toSafeString(movie.slug),
        name: toSafeString(movie.name),
        origin_name: toSafeString(movie.origin_name),
        thumb_url: toSafeString(movie.thumb_url),
        poster_url: toSafeString(movie.poster_url),
        source: toSafeString(movie.source),
        type: toSafeString(movie.type),
        year: toSafeString(movie.year),
        lang: toSafeString(movie.lang),
        quality: toSafeString(movie.quality),
        tmdb: movie.tmdb ?? undefined,
        tmdb_id: tmdbId || undefined,
        time: new Date().toISOString(), // Lưu thời điểm thêm vào yêu thích
    };
};

/**
 * Thêm item vào favorites trên Firestore (tìm theo slug, không trùng lặp)
 */
export const addFavoriteToFirestore = async (uid, item) => {
    if (!uid || !item?.slug) return;
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
            await setDoc(docRef, {
                history: [],
                favorites: [normalizeMovie(item)],
            });
        } else {
            // Kiểm tra xem đã có item này chưa (so khớp TMDB, season, slug)
            const data = docSnap.data();
            const favorites = Array.isArray(data.favorites)
                ? data.favorites
                : [];
            const existingIndex = favorites.findIndex((f) => isMovieMatch(f, item));

            if (existingIndex === -1) {
                // Chưa có, thêm mới vào đầu mảng và dedupe sạch sẽ
                const newFavorites = dedupeFavorites([normalizeMovie(item), ...favorites]);
                await updateDoc(docRef, { favorites: newFavorites });
            }
            // Đã có thì không làm gì (tránh trùng lặp)
        }
    } catch (error) {
        console.warn(
            "Firestore offline, favorite saved locally only:",
            error?.message,
        );
    }
};

/**
 * Xóa item khỏi favorites trên Firestore (với fallback khi offline)
 */
export const removeFavoriteFromFirestore = async (uid, item) => {
    if (!uid || !item) return;
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            const favorites = Array.isArray(data.favorites)
                ? data.favorites
                : [];

            // Lọc phim theo isMovieMatch để đảm bảo xóa chính xác theo khóa TMDB/slug
            const newFavorites = favorites.filter((f) => !isMovieMatch(f, item));

            if (newFavorites.length !== favorites.length) {
                await updateDoc(docRef, {
                    favorites: newFavorites,
                });
            }
        }
    } catch (error) {
        console.warn(
            "Firestore offline, favorite deleted locally only:",
            error?.message,
        );
    }
};

/**
 * Xóa tất cả favorites trên Firestore (với fallback khi offline)
 */
export const clearFavoritesFromFirestore = async (uid) => {
    if (!uid) return;
    try {
        const docRef = doc(db, "users", uid);
        await updateDoc(docRef, {
            favorites: [],
        });
    } catch (error) {
        console.warn(
            "Firestore offline, favorites cleared locally only:",
            error?.message,
        );
    }
};

export {getMovieUniqueKey} from "../utils/vodIdentifier";