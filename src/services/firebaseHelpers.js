import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    arrayUnion,
    arrayRemove,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * Fetch history từ Firestore (với fallback khi offline)
 */
export const fetchHistoryFromFirestore = async (uid) => {
    if (!uid) return [];
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data().history || [];
        }
        return [];
    } catch (error) {
        // Nếu offline hoặc lỗi Firestore, fallback về localStorage
        console.warn("Firestore offline, using localStorage:", error?.message);
        try {
            const localHistory = localStorage.getItem("viewHistory");
            return localHistory ? JSON.parse(localHistory) : [];
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
 * Thêm item vào history trên Firestore (với fallback khi offline)
 */
export const addHistoryToFirestore = async (uid, item) => {
    if (!uid) return;
    try {
        const docRef = doc(db, "users", uid);
        // Nếu doc chưa tồn tại, tạo mới; nếu tồn tại, thêm vào array
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
            await setDoc(docRef, {
                history: [item],
                favorites: [],
            });
        } else {
            await updateDoc(docRef, {
                history: arrayUnion(item),
            });
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
 * Thêm item vào favorites trên Firestore (với fallback khi offline)
 */
export const addFavoriteToFirestore = async (uid, item) => {
    if (!uid) return;
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
            await setDoc(docRef, {
                history: [],
                favorites: [item],
            });
        } else {
            await updateDoc(docRef, {
                favorites: arrayUnion(item),
            });
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
