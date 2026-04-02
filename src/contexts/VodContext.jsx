import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useMemo,
} from "react";
import { useAuth } from "./AuthContext";
import {
    fetchFavoritesFromFirestore,
    addFavoriteToFirestore,
    removeFavoriteFromFirestore,
    fetchHistoryFromFirestore,
    removeHistoryFromFirestore,
    clearHistoryFromFirestore,
    dedupeHistory,
    normalizeMovie,
} from "../services/firebaseHelpers";

const VodContext = createContext();

export function VodProvider({ children }) {
    const { currentUser } = useAuth();
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [initialFilters, setInitialFilters] = useState({});
    const [favorites, setFavorites] = useState([]);
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);

    // Load favorites khi mount hoặc user thay đổi
    useEffect(() => {
        const loadFavorites = async () => {
            if (currentUser?.uid) {
                const firestoreFavs = await fetchFavoritesFromFirestore(
                    currentUser.uid,
                );
                setFavorites(firestoreFavs);
            } else {
                const localFavs = localStorage.getItem("favorites");
                setFavorites(localFavs ? JSON.parse(localFavs) : []);
            }
        };
        loadFavorites();
    }, [currentUser?.uid]);

    // Load history khi mount hoặc user thay đổi
    useEffect(() => {
        const loadHistory = async () => {
            setHistoryLoading(true);
            try {
                // Lấy từ localStorage trước (chứa dữ liệu mới nhất vừa xem)
                const localHistoryStr = localStorage.getItem("viewHistory");
                const localHistory = localHistoryStr
                    ? JSON.parse(localHistoryStr)
                    : [];

                let rawHistory = localHistory;

                if (currentUser?.uid) {
                    // Nếu có User, lấy thêm từ Firestore rồi merge
                    const firestoreHistory = await fetchHistoryFromFirestore(
                        currentUser.uid,
                    );
                    rawHistory = dedupeHistory([
                        ...localHistory,
                        ...firestoreHistory,
                    ]);
                }

                setHistory(rawHistory);
            } catch (error) {
                console.error("Load history error:", error);
                setHistory([]);
            } finally {
                setHistoryLoading(false);
            }
        };
        loadHistory();
    }, [currentUser?.uid]);

    const openFilter = useCallback((filters = {}) => {
        setInitialFilters(filters);
        setIsFilterOpen(true);
    }, []);

    const closeFilter = useCallback(() => {
        setIsFilterOpen(false);
    }, []);

    // ===== FAVORITES =====
    const isFavorite = useCallback(
        (slug) => {
            return favorites.some((f) => f.slug === slug);
        },
        [favorites],
    );

    const toggleFavorite = useCallback(
        async (movie) => {
            if (!movie?.slug) return;

            const exists = isFavorite(movie.slug);
            let newFavorites;

            if (exists) {
                newFavorites = favorites.filter((f) => f.slug !== movie.slug);
                if (currentUser?.uid) {
                    await removeFavoriteFromFirestore(currentUser.uid, movie);
                }
            } else {
                const normalized = normalizeMovie(movie);
                newFavorites = [normalized, ...favorites];
                if (currentUser?.uid) {
                    await addFavoriteToFirestore(currentUser.uid, movie);
                }
            }

            setFavorites(newFavorites);
            // Luôn cập nhật localStorage làm fallback
            localStorage.setItem("favorites", JSON.stringify(newFavorites));
        },
        [favorites, currentUser?.uid, isFavorite],
    );

    // ===== HISTORY =====

    // Xóa một item khỏi lịch sử
    const removeFromHistory = useCallback(
        async (slug) => {
            if (!slug) return;

            const newHistory = history.filter((h) => h.slug !== slug);
            setHistory(newHistory);
            // Cập nhật localStorage
            localStorage.setItem("viewHistory", JSON.stringify(newHistory));

            // Đồng bộ lên Firebase
            if (currentUser?.uid) {
                await removeHistoryFromFirestore(currentUser.uid, slug);
            }
        },
        [history, currentUser?.uid],
    );

    // Xóa toàn bộ lịch sử
    const clearAllHistory = useCallback(async () => {
        setHistory([]);
        localStorage.setItem("viewHistory", JSON.stringify([]));

        // Đồng bộ lên Firebase
        if (currentUser?.uid) {
            await clearHistoryFromFirestore(currentUser.uid);
        }
    }, [currentUser?.uid]);

    const value = useMemo(
        () => ({
            isFilterOpen,
            setIsFilterOpen,
            initialFilters,
            openFilter,
            closeFilter,
            favorites,
            isFavorite,
            toggleFavorite,
            history,
            historyLoading,
            removeFromHistory,
            clearAllHistory,
        }),
        [
            isFilterOpen,
            initialFilters,
            openFilter,
            closeFilter,
            favorites,
            isFavorite,
            toggleFavorite,
            history,
            historyLoading,
            removeFromHistory,
            clearAllHistory,
        ],
    );

    return <VodContext.Provider value={value}>{children}</VodContext.Provider>;
}

export function useVodContext() {
    const context = useContext(VodContext);
    if (!context) {
        throw new Error("useVodContext must be used within a VodProvider");
    }
    return context;
}
