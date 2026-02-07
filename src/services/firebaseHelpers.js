import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    arrayRemove,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * Dedupe history array theo slug, merge episodes và giữ position cao nhất
 */
function dedupeHistory(rawHistory) {
    if (!Array.isArray(rawHistory)) return [];

    const dedupeMap = new Map();
    rawHistory.forEach((h) => {
        if (!h || !h.slug) return;
        const existing = dedupeMap.get(h.slug);
        if (!existing) {
            dedupeMap.set(h.slug, { ...h });
        } else {
            // Merge 2 entries cùng slug
            const mergedEpisodes = new Map();

            // Episodes từ entry cũ
            (existing.episodes || []).forEach((ep) => {
                const key = String(ep.key);
                mergedEpisodes.set(key, ep);
            });

            // Merge episodes từ entry mới, giữ position cao hơn
            (h.episodes || []).forEach((ep) => {
                const key = String(ep.key);
                const existingEp = mergedEpisodes.get(key);
                if (!existingEp) {
                    mergedEpisodes.set(key, ep);
                } else {
                    const newPos = ep.position || 0;
                    const oldPos = existingEp.position || 0;
                    const newTime = new Date(ep.timestamp || 0).getTime();
                    const oldTime = new Date(
                        existingEp.timestamp || 0,
                    ).getTime();
                    if (
                        newPos > oldPos ||
                        (newPos === oldPos && newTime > oldTime)
                    ) {
                        mergedEpisodes.set(key, ep);
                    }
                }
            });

            // Giữ entry mới hơn
            const existingTime = new Date(existing.time || 0).getTime();
            const hTime = new Date(h.time || 0).getTime();
            const merged =
                hTime > existingTime
                    ? { ...existing, ...h }
                    : { ...h, ...existing };
            merged.episodes = Array.from(mergedEpisodes.values());
            merged.time = hTime > existingTime ? h.time : existing.time;
            dedupeMap.set(h.slug, merged);
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
    if (!uid || !item || !item.slug) return;
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
 * Xóa item khỏi history trên Firestore (với fallback khi offline)
 */
export const removeHistoryFromFirestore = async (uid, item) => {
    if (!uid) return;
    try {
        const docRef = doc(db, "users", uid);
        await updateDoc(docRef, {
            history: arrayRemove(item),
        });
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
 * Thêm item vào favorites trên Firestore (tìm theo slug, không trùng lặp)
 */
export const addFavoriteToFirestore = async (uid, item) => {
    if (!uid || !item || !item.slug) return;
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
            await setDoc(docRef, {
                history: [],
                favorites: [item],
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
                // Chưa có, thêm mới vào đầu mảng
                const newFavorites = [item, ...favorites];
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
    if (!uid) return;
    try {
        const docRef = doc(db, "users", uid);
        await updateDoc(docRef, {
            favorites: arrayRemove(item),
        });
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
