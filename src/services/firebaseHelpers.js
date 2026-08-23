import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { extractSeasonNumber } from "../utils/vodHelpers";

/**
 * Lấy khóa định danh duy nhất cho một item trong history
 */
export const getHistoryItemKey = (item) => {
    if (!item) return "";

    const tmdbId =
        item.tmdb?.id ||
        item.tmdb_id ||
        item.tmdbId ||
        (typeof item.slug === "string" && item.slug.startsWith("tmdb-")
            ? item.slug.replace("tmdb-", "")
            : null);

    const season = extractSeasonNumber(item);

    if (tmdbId) {
        return season && season > 1 ? `tmdb_${tmdbId}_s${season}` : `tmdb_${tmdbId}`;
    }

    if (item.slug && !item.slug.startsWith("tmdb-")) {
        return `slug_${item.slug.trim()}`;
    }

    const name = (item.name || "").trim().toLowerCase();
    return name ? `name_${name}` : `id_${item._id || item.id || item.slug || ""}`;
};

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

const mergeTwoHistoryEntries = (existing, h) => {
    const mergedEpisodes = new Map();
    (existing.episodes || []).forEach((ep) => mergedEpisodes.set(String(ep.key), ep));
    (h.episodes || []).forEach((ep) => mergeSingleEpisode(mergedEpisodes, ep));

    const preferredSlug =
        (existing.slug && !existing.slug.startsWith("tmdb-") ? existing.slug : null) ||
        (h.slug && !h.slug.startsWith("tmdb-") ? h.slug : null) ||
        existing.slug ||
        h.slug;

    const existingTime = new Date(existing.time || 0).getTime();
    const hTime = new Date(h.time || 0).getTime();
    const isNewer = hTime >= existingTime;

    const merged = isNewer ? { ...existing, ...h } : { ...h, ...existing };
    merged.slug = preferredSlug;
    merged.episodes = Array.from(mergedEpisodes.values());
    merged.time = isNewer ? (h.time || existing.time) : (existing.time || h.time);
    merged.current_episode = isNewer
        ? (h.current_episode || existing.current_episode)
        : (existing.current_episode || h.current_episode);

    return merged;
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
 * Fetch favorites từ Firestore (với fallback khi offline)
 */
export const fetchFavoritesFromFirestore = async (uid) => {
    if (!uid) return [];
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data().favorites || [];
        }
        return [];
    } catch (error) {
        // Nếu offline hoặc lỗi Firestore, fallback về localStorage
        console.warn("Firestore offline, using localStorage:", error?.message);
        try {
            const localFavorites = localStorage.getItem("favorites");
            return localFavorites ? JSON.parse(localFavorites) : [];
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

/**
 * Chuẩn hóa đối tượng phim để lưu vào danh sách yêu thích
 * Chỉ giữ lại các trường metadata cần thiết để đảm bảo tính đồng nhất trên toàn hệ thống
 */
export const normalizeMovie = (movie) => {
    if (!movie) return null;
    return {
        slug: movie.slug || "",
        name: movie.name || "",
        origin_name: movie.origin_name || "",
        thumb_url: movie.thumb_url || "",
        poster_url: movie.poster_url || "",
        source: movie.source || "",
        type: movie.type || "",
        year: movie.year || "",
        lang: movie.lang || "",
        quality: movie.quality || "",
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
            // Kiểm tra xem đã có item với slug này chưa
            const data = docSnap.data();
            const favorites = Array.isArray(data.favorites)
                ? data.favorites
                : [];
            const existingIndex = favorites.findIndex(
                (f) => f.slug === item.slug,
            );

            if (existingIndex === -1) {
                // Chưa có, thêm mới vào đầu mảng (đã chuẩn hóa)
                const newFavorites = [normalizeMovie(item), ...favorites];
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
    if (!uid || !item?.slug) return;
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            const favorites = Array.isArray(data.favorites)
                ? data.favorites
                : [];

            // Lọc phim theo slug để đảm bảo xóa chính xác dù metadata có thay đổi
            const newFavorites = favorites.filter((f) => f.slug !== item.slug);

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
