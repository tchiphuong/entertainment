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
} from "../services/firebaseHelpers";

const VodContext = createContext();

export function VodProvider({ children }) {
    const { currentUser } = useAuth();
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [initialFilters, setInitialFilters] = useState({});
    const [favorites, setFavorites] = useState([]);

    // Load favorites on mount or user change
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

    const openFilter = useCallback((filters = {}) => {
        setInitialFilters(filters);
        setIsFilterOpen(true);
    }, []);

    const closeFilter = useCallback(() => {
        setIsFilterOpen(false);
    }, []);

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
                newFavorites = [movie, ...favorites];
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
        }),
        [
            isFilterOpen,
            initialFilters,
            openFilter,
            closeFilter,
            favorites,
            isFavorite,
            toggleFavorite,
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
