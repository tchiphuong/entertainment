import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ConfirmDialog from "../components/ConfirmDialog";
import { useAuth } from "../contexts/AuthContext";
import { auth } from "../services/firebase";
import {
    fetchHistoryFromFirestore,
    fetchFavoritesFromFirestore,
    addHistoryToFirestore,
    removeHistoryFromFirestore,
    clearHistoryFromFirestore,
    addFavoriteToFirestore,
    removeFavoriteFromFirestore,
    clearFavoritesFromFirestore,
} from "../services/firebaseHelpers";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import clsx from "clsx";
import {
    Combobox,
    ComboboxButton,
    ComboboxInput,
    ComboboxOption,
    ComboboxOptions,
} from "@headlessui/react";

function UserProfile({ onLogout }) {
    const { currentUser } = useAuth();
    const { t } = useTranslation();
    const [authError, setAuthError] = useState(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef(null);
    const avatarRef = useRef(null);
    const [avatarError, setAvatarError] = useState(false);

    const avatarInitial =
        currentUser?.displayName?.trim()?.charAt(0)?.toUpperCase() || "U";

    const handleLogin = async () => {
        const provider = new GoogleAuthProvider();
        // Thêm custom parameters để cải thiện trải nghiệm
        provider.setCustomParameters({
            prompt: "select_account",
        });

        try {
            const result = await signInWithPopup(auth, provider);
            console.log("Đăng nhập thành công:", result.user);
            setAuthError(null); // Xóa lỗi nếu có
        } catch (error) {
            // Xử lý các loại lỗi khác nhau
            if (error.code === "auth/popup-closed-by-user") {
                console.log("Người dùng đã đóng cửa sổ đăng nhập");
            } else if (error.code === "auth/popup-blocked") {
                console.error("Popup bị chặn bởi trình duyệt");
                setAuthError({
                    message: "Vui lòng cho phép popup trong trình duyệt",
                });
            } else if (error.code === "auth/cancelled-popup-request") {
                console.log("Yêu cầu popup bị hủy");
            } else {
                console.error("Lỗi khi đăng nhập:", error);
                setAuthError(error);
            }
        }
    };

    const handleLogout = async (e) => {
        e.preventDefault(); // Ngăn hành vi mặc định của thẻ <a>
        setIsMenuOpen(false);
        try {
            await signOut(auth);
            // Clear tất cả dữ liệu khi đăng xuất
            localStorage.removeItem("viewHistory");
            localStorage.removeItem("favorites");
            // Gọi callback để reset state trong parent component
            onLogout();
            console.log("Đăng xuất thành công");
        } catch (error) {
            console.error("Lỗi đăng xuất:", error);
            setAuthError(error);
        }
    };

    useEffect(() => {
        // Reset lỗi avatar khi đổi account / đổi ảnh
        setAvatarError(false);
    }, [currentUser?.photoURL]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(event.target) &&
                avatarRef.current &&
                !avatarRef.current.contains(event.target)
            ) {
                setIsMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("touchstart", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("touchstart", handleClickOutside);
        };
    }, []);

    return (
        <div className="relative">
            {currentUser ? (
                <div className="group relative">
                    <button
                        ref={avatarRef}
                        onClick={() => setIsMenuOpen((prev) => !prev)}
                        aria-label="Mở menu người dùng"
                        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 shadow-lg ring-2 ring-zinc-600/80 transition-all duration-200 hover:scale-110 hover:shadow-blue-500/20 hover:ring-blue-500/70"
                        type="button"
                    >
                        {avatarError || !currentUser.photoURL ? (
                            <span className="bg-linear-to-br from-blue-400 to-indigo-500 bg-clip-text text-sm font-bold text-transparent">
                                {avatarInitial}
                            </span>
                        ) : (
                            <img
                                src={currentUser.photoURL}
                                alt={currentUser.displayName}
                                onError={() => setAvatarError(true)}
                                className="h-full w-full rounded-full object-cover"
                            />
                        )}
                    </button>
                    <div
                        ref={menuRef}
                        className={clsx(
                            "absolute right-0 top-full mt-2 w-48 origin-top-right rounded-md bg-zinc-800 shadow-lg transition-all duration-200 ease-in-out",
                            isMenuOpen
                                ? "pointer-events-auto scale-100 opacity-100"
                                : "pointer-events-none scale-95 opacity-0",
                        )}
                    >
                        <div className="py-1">
                            <div className="border-b border-zinc-700 px-4 py-2">
                                <p className="text-sm font-semibold text-zinc-100">
                                    {currentUser.displayName}
                                </p>
                                <p className="truncate text-xs text-zinc-400">
                                    {currentUser.email}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="block w-full cursor-pointer px-4 py-2 text-left text-sm text-zinc-300 transition hover:bg-zinc-700"
                            >
                                {t("common.logout")}
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <button
                    onClick={handleLogin}
                    className="flex items-center gap-2 rounded-full bg-blue-500 p-2 text-sm font-semibold text-white transition-colors hover:bg-blue-600"
                >
                    <svg
                        className="h-5 w-5"
                        aria-hidden="true"
                        focusable="false"
                        data-prefix="fab"
                        data-icon="google"
                        role="img"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 488 512"
                    >
                        <path
                            fill="currentColor"
                            d="M488 261.8C488 403.3 381.5 512 244 512 109.8 512 0 402.2 0 256S109.8 0 244 0c73.2 0 136.2 29.3 182.4 75.4l-62.4 60.3C337.2 114.6 295.6 96 244 96c-88.6 0-160.1 71.1-160.1 160s71.5 160 160.1 160c97.4 0 134-60.5 138.5-93.2H244v-74.4h239.9c2.4 12.6 3.6 25.8 3.6 40.2z"
                        ></path>
                    </svg>
                    <span>{t("common.login")}</span>
                </button>
            )}
            {authError && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-md bg-red-900/50 p-3 text-sm text-red-200 shadow-lg">
                    <p className="font-bold">{t("auth.authError")}</p>
                    <p className="mt-1 text-xs">{authError.message}</p>
                </div>
            )}
        </div>
    );
}

// Lấy config từ biến môi trường
const CONFIG = {
    APP_DOMAIN_SOURCE_K: import.meta.env.VITE_SOURCE_K_API,
    APP_DOMAIN_SOURCE_K_CDN_IMAGE: import.meta.env.VITE_SOURCE_K_CDN_IMAGE,
    APP_DOMAIN_SOURCE_C: import.meta.env.VITE_SOURCE_C_API,
    APP_DOMAIN_SOURCE_O: import.meta.env.VITE_SOURCE_O_API,
    APP_DOMAIN_SOURCE_O_FRONTEND: import.meta.env.VITE_SOURCE_O_FRONTEND,
    APP_DOMAIN_SOURCE_O_CDN_IMAGE: import.meta.env.VITE_SOURCE_O_CDN_IMAGE,
};

// Source constants
const SOURCES = {
    SOURCE_C: "source_c",
    SOURCE_K: "source_k",
    SOURCE_O: "source_o",
};

// Helper để tính URL ảnh phù hợp theo nguồn đã lưu
function getMovieImage(imagePath) {
    function getSelectedSource() {
        try {
            const v = localStorage.getItem("selected_source");
            if (!v) return "source_k"; // default to source_k
            if (v === SOURCES.SOURCE_K) return "source_k";
            if (v === SOURCES.SOURCE_O) return "source_o";
            if (v === SOURCES.SOURCE_C) return "source_c";
            return "source_k";
        } catch (e) {
            return "source_k";
        }
    }

    if (!imagePath)
        return `https://picsum.photos/2000/3000?random=${new Date().getTime()}`;

    const source = getSelectedSource();

    if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
        if (source === "source_k" || source === "source_o") {
            const hostname = (() => {
                try {
                    return new URL(imagePath).hostname || "";
                } catch (e) {
                    return "";
                }
            })();

            if (
                hostname.indexOf("phimimg.com") !== -1 ||
                hostname.indexOf("phimapi.com") !== -1 ||
                hostname.indexOf("img.ophim.live") !== -1
            ) {
                const domain =
                    source === "source_k"
                        ? CONFIG.APP_DOMAIN_SOURCE_K
                        : CONFIG.APP_DOMAIN_SOURCE_O_FRONTEND;
                if (source === "source_o") {
                    return `${domain}/_next/image?url=${encodeURIComponent(imagePath)}&w=1080&q=75`;
                } else {
                    return `${domain}/image.php?url=${encodeURIComponent(imagePath)}`;
                }
            }

            return imagePath;
        }

        return imagePath;
    }

    const cdnUrl = `${source === "source_k" ? CONFIG.APP_DOMAIN_SOURCE_K_CDN_IMAGE : CONFIG.APP_DOMAIN_SOURCE_O_CDN_IMAGE}/${imagePath}`;
    if (source === "source_k" || source === "source_o") {
        const domain =
            source === "source_k"
                ? CONFIG.APP_DOMAIN_SOURCE_K
                : CONFIG.APP_DOMAIN_SOURCE_O_FRONTEND;
        if (source === "source_o") {
            return `${domain}/_next/image?url=${encodeURIComponent(cdnUrl)}&w=1080&q=75`;
        } else {
            return `${domain}/image.php?url=${encodeURIComponent(cdnUrl)}`;
        }
    }

    return cdnUrl;
}

function useLocalStorage(key, initial) {
    const [state, setState] = useState(() => {
        try {
            const v = localStorage.getItem(key);
            return v ? JSON.parse(v) : initial;
        } catch (e) {
            return initial;
        }
    });
    useEffect(() => {
        window.localStorage.setItem(key, JSON.stringify(state));
    }, [key, state]);
    return [state, setState];
}

export default function Vods() {
    const { t } = useTranslation();
    const [copiedMovieSlug, setCopiedMovieSlug] = useState(null);

    const handleCopyLink = useCallback(async (slug) => {
        const link = `${window.location.origin}/entertainment/vods/play/${slug}`;
        try {
            await navigator.clipboard.writeText(link);
            setCopiedMovieSlug(slug);
            const timer = setTimeout(() => setCopiedMovieSlug(null), 2000);
            return () => clearTimeout(timer);
        } catch (err) {
            console.error("Failed to copy link:", err);
        }
    }, []);

    // Define tabs với SVG icons
    const TABS = [
        {
            id: SOURCES.SOURCE_O,
            label: t("vods.sourceA"),
            // Icon: Server
            icon: (
                <svg
                    className="h-4 w-4 md:h-5 md:w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                    />
                </svg>
            ),
        },
        {
            id: SOURCES.SOURCE_K,
            label: t("vods.sourceB"),
            // Icon: Database
            icon: (
                <svg
                    className="h-4 w-4 md:h-5 md:w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                    />
                </svg>
            ),
        },
        {
            id: SOURCES.SOURCE_C,
            label: t("vods.sourceC"),
            // Icon: Cloud
            icon: (
                <svg
                    className="h-4 w-4 md:h-5 md:w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                    />
                </svg>
            ),
        },
    ];

    // Initialize state directly from URL params
    const getInitialPage = () => {
        const params = new URLSearchParams(window.location.search);
        return parseInt(params.get("page")) || 1;
    };

    const getInitialKeyword = () => {
        const params = new URLSearchParams(window.location.search);
        return params.get("keyword") || "";
    };

    const getInitialCountry = () => {
        const params = new URLSearchParams(window.location.search);
        return params.get("country") || "viet-nam";
    };

    const getInitialCategory = () => {
        const params = new URLSearchParams(window.location.search);
        return params.get("category") || "";
    };

    const [movies, setMovies] = useState([]);
    const [currentPage, setCurrentPage] = useState(getInitialPage);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [searchKeyword, setSearchKeyword] = useState(getInitialKeyword);
    const [searchInputValue, setSearchInputValue] = useState(getInitialKeyword);
    const [country, setCountry] = useState(getInitialCountry);
    const [category, setCategory] = useState(getInitialCategory);
    const [countryQuery, setCountryQuery] = useState("");
    const [categoryQuery, setCategoryQuery] = useState("");
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [history, setHistory] = useLocalStorage("viewHistory", []);
    const [countries, setCountries] = useState([]);
    const [categories, setCategories] = useState([]);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [confirmDeleteFavorites, setConfirmDeleteFavorites] = useState(false);
    const [isSearching, setIsSearching] = useState(false); // Track khi đang search/debounce
    const [isFavoritesOpen, setIsFavoritesOpen] = useState(false); // Track khi mở modal yêu thích
    const [favorites, setFavorites] = useLocalStorage("favorites", []); // Danh sách yêu thích
    const [isFilterOpen, setIsFilterOpen] = useState(false); // Track khi mở modal filter
    const navigate = useNavigate();
    const { currentUser } = useAuth();

    // Thêm state cho source: source_c, source_k, all
    const [source, setSource] = useState(() => {
        try {
            return localStorage.getItem("selected_source") || SOURCES.SOURCE_O;
        } catch (e) {
            return SOURCES.SOURCE_O;
        }
    });

    // Persist source selection
    useEffect(() => {
        try {
            localStorage.setItem("selected_source", source);
        } catch (e) {}
    }, [source]);

    // Load history và favorites từ Firestore khi user đăng nhập
    useEffect(() => {
        if (currentUser) {
            const loadFirestoreData = async () => {
                const firestoreHistory = await fetchHistoryFromFirestore(
                    currentUser.uid,
                );
                const firestoreFavorites = await fetchFavoritesFromFirestore(
                    currentUser.uid,
                );
                setHistory(firestoreHistory);
                setFavorites(firestoreFavorites);
            };
            loadFirestoreData();
        }
    }, [currentUser]);

    const countriesFetchedRef = useRef(false);
    const categoriesFetchedRef = useRef(false);
    const pageInputTimerRef = useRef(null); // Debounce cho page input
    const searchInputTimerRef = useRef(null); // Debounce cho search input

    const goToPage = useCallback(
        (page) => {
            if (page >= 1 && page <= totalPages) {
                setCurrentPage(page);
            }
        },
        [totalPages],
    );

    const nextPage = useCallback(() => {
        if (currentPage < totalPages) goToPage(currentPage + 1);
    }, [currentPage, totalPages, goToPage]);

    const prevPage = useCallback(() => {
        if (currentPage > 1) goToPage(currentPage - 1);
    }, [currentPage, goToPage]);

    useEffect(() => {
        document.title = "VODs — Entertainment";

        // Fetch countries
        if (!countriesFetchedRef.current) {
            countriesFetchedRef.current = true;
            fetchCountries();
        }

        // Fetch categories
        if (!categoriesFetchedRef.current) {
            categoriesFetchedRef.current = true;
            fetchCategories();
        }

        const onKey = (e) => {
            // Skip if user is typing in input/textarea
            if (
                document.activeElement.tagName === "INPUT" ||
                document.activeElement.tagName === "TEXTAREA" ||
                document.activeElement.contentEditable === "true"
            ) {
                return;
            }
            if (e.key === "ArrowRight") nextPage();
            if (e.key === "ArrowLeft") prevPage();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [nextPage, prevPage]);

    // no-op: primary-only source

    // Sync URL khi state thay đổi
    useEffect(() => {
        const params = new URLSearchParams();
        params.set("page", currentPage);
        if (searchKeyword.trim() !== "") params.set("keyword", searchKeyword);
        if (country.trim() !== "") params.set("country", country);
        if (category.trim() !== "") params.set("category", category);
        if (source !== SOURCES.SOURCE_C) params.set("source", source);
        window.history.replaceState({}, "", `?${params.toString()}`);
    }, [currentPage, searchKeyword, country, category, source]);

    // Reset page index to 1 whenever user changes search or filters (but not on initial mount)
    const _didMountResetPageRef = useRef(false);
    useEffect(() => {
        if (!_didMountResetPageRef.current) {
            _didMountResetPageRef.current = true;
            return;
        }

        // When searchKeyword, country, category or source change we want to go back to page 1
        if (currentPage !== 1) setCurrentPage(1);
    }, [searchKeyword, country, category, source]);

    // Sync searchInputValue with searchKeyword
    useEffect(() => {
        setSearchInputValue(searchKeyword);
    }, [searchKeyword]);

    const prevStateRef = useRef(null);

    // Auto-fetch khi keyword, country, page, hoặc source thay đổi (với debounce)
    useEffect(() => {
        const prev = prevStateRef.current;
        const stateChanged =
            !prev ||
            searchKeyword !== prev.keyword ||
            country !== prev.country ||
            category !== prev.category ||
            currentPage !== prev.page ||
            source !== prev.source;

        if (stateChanged) {
            prevStateRef.current = {
                keyword: searchKeyword,
                country,
                category,
                page: currentPage,
                source,
            };

            // Fetch ngay khi state thay đổi
            const params = {
                page: currentPage,
                limit: 12,
                sort_field: "year",
                sort_type: "desc",
            };

            if (searchKeyword.trim() !== "") {
                params.keyword = searchKeyword;
                if (source === SOURCES.SOURCE_C) {
                    fetchSourceCData({ ...params, type: "search" });
                } else if (source === SOURCES.SOURCE_K) {
                    let sourceKParams = { ...params };
                    sourceKParams.sort_field = "modified.time";
                    sourceKParams.sort_type = "desc";
                    fetchSourceKData({ ...sourceKParams, type: "search" });
                } else if (source === SOURCES.SOURCE_O) {
                    let sourceOParams = { ...params };
                    sourceOParams.sort_field = "modified.time";
                    sourceOParams.sort_type = "desc";
                    fetchSourceOData({ ...sourceOParams, type: "search" });
                }
            } else if (category.trim() !== "") {
                // Ưu tiên category nếu có
                params.category = category;
                if (source === SOURCES.SOURCE_C) {
                    fetchSourceCData({ ...params, type: "category" });
                } else if (source === SOURCES.SOURCE_K) {
                    let sourceKParams = { ...params };
                    sourceKParams.sort_field = "modified.time";
                    sourceKParams.sort_type = "desc";
                    fetchSourceKData({ ...sourceKParams, type: "category" });
                } else if (source === SOURCES.SOURCE_O) {
                    let sourceOParams = { ...params };
                    sourceOParams.sort_field = "modified.time";
                    sourceOParams.sort_type = "desc";
                    fetchSourceOData({ ...sourceOParams, type: "category" });
                }
            } else {
                // Nếu country rỗng, fetch danh sách phim mới
                const effectiveCountry = country || "viet-nam";

                if (source === SOURCES.SOURCE_C) {
                    const paramsSourceC = {
                        page: params.page || 1,
                        limit: 12,
                    };
                    fetchSourceCData({
                        ...paramsSourceC,
                        country: effectiveCountry,
                    });
                } else if (source === SOURCES.SOURCE_K) {
                    fetchSourceKData({ ...params, country: effectiveCountry });
                } else if (source === SOURCES.SOURCE_O) {
                    const paramsSourceO = {
                        page: params.page || 1,
                        limit: 12,
                    };
                    fetchSourceOData({
                        ...paramsSourceO,
                        country: effectiveCountry,
                    });
                }
            }
        }

        // Cleanup on unmount
        return () => {
            if (pageInputTimerRef.current) {
                clearTimeout(pageInputTimerRef.current);
            }
        };
    }, [searchKeyword, country, category, currentPage, source]);

    // Khi người dùng đổi `source` (A / C / ALL) — reset page và refetch ngay
    // Removed: now handled by the main useEffect above

    function buildQuery(params) {
        return Object.keys(params)
            .map((k) => `${k}=${encodeURIComponent(params[k])}`)
            .join("&");
    }

    // Hỗ trợ serialize params nâng cao: array hoặc object -> bracket notation
    function buildQueryExtended(params) {
        const parts = [];

        function add(key, value) {
            parts.push(
                `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
            );
        }

        Object.keys(params).forEach((k) => {
            const v = params[k];
            if (v == null) return; // skip null/undefined

            if (Array.isArray(v)) {
                v.forEach((item, idx) => {
                    add(`${k}[${idx}]`, item == null ? "" : item);
                });
            } else if (typeof v === "object") {
                // support object map -> cats: {1: '', 6: '', 47: '52'} => cats[1]=&cats[6]=...
                Object.keys(v).forEach((sub) => {
                    add(`${k}[${sub}]`, v[sub] == null ? "" : v[sub]);
                });
            } else {
                add(k, v);
            }
        });

        return parts.join("&");
    }

    async function fetchData(url, params = {}, source = SOURCES.SOURCE_C) {
        setIsLoading(true);
        setIsSearching(false); // Clear searching state khi bắt đầu fetch thực sự
        try {
            const qs = buildQuery(params);
            const fullUrl = `${url}?${qs}`;

            // Nếu gọi tới source_c, dùng fetchFromUrl + parseApiJson để chấp nhận nhiều kiểu response
            if (fullUrl.indexOf(CONFIG.APP_DOMAIN_SOURCE_C) !== -1) {
                const result = await fetchFromUrl(fullUrl);
                const { items, totalPages, cat } = result;
                let normalizedItems = items.map((it) =>
                    normalizeMovieForSource(it, "source_c"),
                );
                if (cat) {
                    normalizedItems = normalizedItems.map((m) => ({
                        ...m,
                        country: [{ name: cat.title, slug: cat.slug }],
                    }));
                }
                setMovies(normalizedItems);
                setTotalPages(totalPages);
                return;
            }

            // Nếu gọi tới source_o, dùng fetchFromUrl + parseApiJson
            if (fullUrl.indexOf(CONFIG.APP_DOMAIN_SOURCE_O) !== -1) {
                const result = await fetchFromUrl(fullUrl);
                const { items, totalPages } = result;
                const normalizedItems = items.map((it) =>
                    normalizeMovieForSource(it, SOURCES.SOURCE_O),
                );
                setMovies(normalizedItems);
                setTotalPages(totalPages);
                return;
            }

            const res = await fetch(fullUrl);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }

            // Thử parse JSON; nếu parsing error, in ra text để debug
            let json;
            try {
                json = await res.json();
            } catch (parseErr) {
                const txt = await res.text();
                console.error(
                    "fetchData: failed to parse JSON from:",
                    fullUrl,
                    "body:",
                    txt,
                );
                throw parseErr;
            }

            if (!json || !json.data) {
                setMovies([]);
                setTotalPages(1);
            } else {
                const itemsRaw = json.data.items || [];
                const items = itemsRaw.map((it) =>
                    normalizeMovieForSource(it, source),
                );
                setMovies(items);
                setTotalPages(json.data.params?.pagination?.totalPages || 1);
            }
        } catch (err) {
            console.error("fetchData error:", err);
            setMovies([]);
            setTotalPages(1);
        } finally {
            setIsLoading(false);
        }
    }

    // Hàm fetch riêng cho Source O
    async function fetchSourceOData(params = {}) {
        setIsLoading(true);
        setIsSearching(false);
        try {
            const qsParts = [];
            if (params.page) qsParts.push(`page=${params.page}`);
            if (params.limit) qsParts.push(`limit=${params.limit}`);
            qsParts.push(`sort_field=modified.time`);
            qsParts.push(`sort_type=desc`);
            const qs = qsParts.join("&");
            const isSearch = params.type === "search";
            const isCategory = params.type === "category";
            let basePath;
            if (isSearch) {
                basePath = `tim-kiem?keyword=${encodeURIComponent(params.keyword || "")}`;
            } else if (isCategory) {
                basePath = `danh-sach/${params.category || ""}`;
            } else {
                basePath = `quoc-gia/${params.country || "viet-nam"}`;
            }
            const fullUrl = `${CONFIG.APP_DOMAIN_SOURCE_O}/v1/api/${basePath}${qs ? `${isSearch ? "&" : "?"}${qs}` : ""}`;
            const res = await fetch(fullUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            const items = json.data?.items || [];
            const totalItems = json.data?.params?.pagination?.totalItems || 0;
            const totalItemsPerPage =
                json.data?.params?.pagination?.totalItemsPerPage || 10;
            const totalPages = Math.ceil(totalItems / totalItemsPerPage);
            const normalizedItems = items.map((it) =>
                normalizeMovieForSource(it, SOURCES.SOURCE_O),
            );
            setMovies(normalizedItems);
            setTotalPages(totalPages);
        } catch (err) {
            console.error("fetchSourceOData error:", err);
            setMovies([]);
            setTotalPages(1);
        } finally {
            setIsLoading(false);
        }
    }

    // Hàm fetch riêng cho Source K
    async function fetchSourceKData(params = {}) {
        setIsLoading(true);
        setIsSearching(false);
        try {
            // Build query string - loại bỏ type và category khỏi params
            const queryParams = { ...params };
            delete queryParams.type;
            delete queryParams.category;
            delete queryParams.country;

            queryParams.sort_field = "modified.time";
            queryParams.sort_type = "desc";

            const qs = buildQuery(queryParams);
            let endpoint;
            if (params.type === "search") {
                endpoint = "tim-kiem";
            } else if (params.type === "category") {
                endpoint = `danh-sach/${params.category || ""}`;
            } else {
                endpoint = `quoc-gia/${params.country || "viet-nam"}`;
            }
            const fullUrl = `${CONFIG.APP_DOMAIN_SOURCE_K}/v1/api/${endpoint}?${qs}`;
            const res = await fetch(fullUrl);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            const json = await res.json();
            if (!json || !json.data) {
                setMovies([]);
                setTotalPages(1);
            } else {
                const itemsRaw = json.data.items || [];
                const items = itemsRaw.map((it) =>
                    normalizeMovieForSource(it, SOURCES.SOURCE_K),
                );
                setMovies(items);
                setTotalPages(json.data.params?.pagination?.totalPages || 1);
            }
        } catch (err) {
            console.error("fetchSourceKData error:", err);
            setMovies([]);
            setTotalPages(1);
        } finally {
            setIsLoading(false);
        }
    }

    // Hàm fetch riêng cho Source C
    async function fetchSourceCData(params = {}) {
        setIsLoading(true);
        setIsSearching(false);
        try {
            const qs = buildQuery(params);
            let endpoint;
            if (params.type === "search") {
                endpoint = "search";
            } else if (params.type === "category") {
                endpoint = `danh-sach/${params.category || ""}`;
            } else {
                endpoint = `quoc-gia/${params.country || "viet-nam"}`;
            }
            const fullUrl = `${CONFIG.APP_DOMAIN_SOURCE_C}/api/films/${endpoint}?${qs}`;
            const result = await fetchFromUrl(fullUrl);
            const { items, totalPages, cat } = result;
            let normalizedItems = items.map((it) =>
                normalizeMovieForSource(it, SOURCES.SOURCE_C),
            );
            if (cat) {
                normalizedItems = normalizedItems.map((m) => ({
                    ...m,
                    country: [{ name: cat.title, slug: cat.slug }],
                }));
            }
            setMovies(normalizedItems);
            setTotalPages(totalPages);
        } catch (err) {
            console.error("fetchSourceCData error:", err);
            setMovies([]);
            setTotalPages(1);
        } finally {
            setIsLoading(false);
        }
    }

    // Helper: parse nhiều kiểu response từ các nguồn khác nhau
    function parseApiJson(json) {
        let items = [];
        let totalPages = 1;
        let cat = null;

        if (!json) return { items, totalPages, cat };

        if (json.paginate && Array.isArray(json.items)) {
            // source_c response
            items = json.items;
            totalPages = json.paginate.total_page || totalPages;
            cat = json.cat || null;
        } else if (json.data && Array.isArray(json.data.items)) {
            // primary response
            items = json.data.items;
            totalPages = json.data.params?.pagination?.totalPages || totalPages;
        } else if (
            json.data &&
            json.data.items &&
            json.data.params &&
            json.data.params.pagination
        ) {
            // Source O response
            items = json.data.items;
            totalPages = Math.ceil(
                json.data.params.pagination.totalItems /
                    json.data.params.pagination.totalItemsPerPage,
            );
        } else if (Array.isArray(json)) {
            items = json;
        } else if (Array.isArray(json.items)) {
            items = json.items;
        } else if (Array.isArray(json.films)) {
            items = json.films;
        } else if (Array.isArray(json.data)) {
            items = json.data;
        } else if (json.results && Array.isArray(json.results)) {
            items = json.results;
        }

        // try to find common pagination fields if not set
        if (!totalPages || totalPages === 1) {
            totalPages =
                json?.meta?.last_page ||
                json?.pagination?.totalPages ||
                json?.total_pages ||
                json?.totalPages ||
                totalPages;
        }

        return { items, totalPages, cat };
    }

    // Normalize movie fields depending on source
    function normalizeMovieForSource(item, source) {
        if (!item) return item;
        // Ensure we don't mutate unexpected prototypes
        const m = { ...item };

        // source_c: use thumb_url as poster_url for display
        if (source === SOURCES.SOURCE_C) {
            // Swap: poster_url <- thumb_url, thumbnail <- poster_url
            m.poster_url = m.thumb_url || m.poster_url;
            m.thumbnail = m.poster_url || m.thumb_url;

            // Additional mappings for source_c
            m.episode_current = m.current_episode;
            m.lang = m.language;
            // Keep other fields like director, casts if needed
        } else if (source === SOURCES.SOURCE_O) {
            // Source O: use thumb_url as poster_url, thêm prefix uploads/movies/ nếu cần
            let posterPath = m.thumb_url || m.poster_url;
            if (posterPath && !posterPath.startsWith("uploads/movies/")) {
                posterPath = `uploads/movies/${posterPath}`;
            }
            m.poster_url = posterPath;
            m.thumbnail = m.poster_url || m.thumb_url;

            // Additional mappings for source_o
            m.episode_current = m.episode_current;
            m.lang = m.lang;
        } else {
            // primary: ensure poster_url exists
            if (!m.poster_url)
                m.poster_url = m.poster || m.thumbnail || m.image || "";
        }

        // Ensure poster field exists for history/list usage
        if (!m.poster) m.poster = m.poster_url || m.thumbnail || "";

        // Thêm trường source
        m.source = source;

        return m;
    }

    async function fetchFromUrl(fullUrl) {
        try {
            const res = await fetch(fullUrl);
            if (!res.ok) return { items: [], totalPages: 1, cat: null };
            const json = await res.json();
            return parseApiJson(json);
        } catch (e) {
            return { items: [], totalPages: 1, cat: null };
        }
    }

    // Gọi song song 2 nguồn, gộp kết quả và loại trùng theo `slug`
    async function fetchCombined(type, params = {}) {
        setIsLoading(true);
        setIsSearching(false);

        try {
            const qs = buildQuery(params);
            const page = params.page || 1;
            const limit = params.limit || 12;

            const urls = [];

            if (type === "search") {
                // nguồn chính (source_k)
                urls.push(
                    `${CONFIG.APP_DOMAIN_SOURCE_K}/v1/api/tim-kiem?${qs}`,
                );

                // nguồn phụ (source_c) - chỉ gửi các param hiện có: keyword, page, limit, sort_field, sort_type
                const paramsSourceC = {
                    keyword: params.keyword || "",
                    page,
                    limit,
                    sort_field: params.sort_field || params.sortField || "",
                    sort_type: params.sort_type || params.sortType || "",
                };
                const q2 = buildQuery(paramsSourceC);
                urls.push(
                    `${CONFIG.APP_DOMAIN_SOURCE_C}/api/films/search?${q2}`,
                );
            } else {
                // type === 'country'
                const countrySlug = params.country || "viet-nam";
                urls.push(
                    `${CONFIG.APP_DOMAIN_SOURCE_K}/v1/api/quoc-gia/${countrySlug}?${qs}`,
                );

                // source_c country endpoint: chỉ page (và nếu có sort_field/sort_type gửi thêm)
                const paramsSourceC = {
                    page,
                    sort_field: params.sort_field || params.sortField || "",
                    sort_type: params.sort_type || params.sortType || "",
                };
                const q3 = buildQuery(paramsSourceC);
                urls.push(
                    `${CONFIG.APP_DOMAIN_SOURCE_C}/api/films/quoc-gia/${countrySlug}?${q3}`,
                );
            }

            const results = await Promise.allSettled(
                urls.map((u) => fetchFromUrl(u)),
            );

            let combinedItems = [];
            let maxPages = 1;

            results.forEach((r, idx) => {
                if (r.status === "fulfilled" && r.value) {
                    // Determine source by URL order
                    const url = urls[idx] || "";
                    const src =
                        url.indexOf(CONFIG.APP_DOMAIN_SOURCE_C) !== -1
                            ? "source_c"
                            : "primary";
                    const { items, totalPages, cat } = r.value;
                    const normalized = items.map((it) => {
                        const m = normalizeMovieForSource(it, src);
                        if (src === "source_c" && cat) {
                            m.country = [{ name: cat.title, slug: cat.slug }];
                        }
                        return m;
                    });
                    combinedItems = combinedItems.concat(normalized);
                    maxPages = Math.max(maxPages, totalPages || 1);
                }
            });

            // dedupe theo slug (giữ item đầu tiên gặp)
            const map = new Map();
            combinedItems.forEach((it) => {
                if (!it) return;
                const key = it.slug || it.id || it._id || JSON.stringify(it);
                if (!map.has(key)) {
                    // Thêm trường source
                    it.source = it.source || it._normalizedSource || "A"; // giả sử normalize đã set
                    map.set(key, it);
                }
            });

            const items = Array.from(map.values());
            setMovies(items);
            setTotalPages(1); // Không phân trang cho ALL
        } catch (err) {
            setMovies([]);
            setTotalPages(1);
        } finally {
            setIsLoading(false);
        }
    }

    // Gọi riêng nguồn source_c và đặt kết quả
    // fetchSourceC removed — primary-only source

    function searchMoviesKey(e) {
        if (e.key === "Enter") {
            // Update searchKeyword immediately on Enter
            setSearchKeyword(searchInputValue);
            setCurrentPage(1); // useEffect sẽ auto fetch khi currentPage thay đổi
        }
    }

    function getMovieImage(imagePath) {
        // Helper: xác định nguồn hiện tại (primary là mặc định).
        function getSelectedSource() {
            try {
                const v = localStorage.getItem("selected_source");
                if (!v) return "source_k"; // default to source_k
                if (v === SOURCES.SOURCE_K) return "source_k";
                if (v === SOURCES.SOURCE_O) return "source_o";
                if (v === SOURCES.SOURCE_C) return "source_c";
                return "source_k";
            } catch (e) {
                return "source_k";
            }
        }

        // Nếu không có imagePath trả placeholder
        if (!imagePath)
            return `https://picsum.photos/2000/3000?random=${new Date().getTime()}`;

        const source = getSelectedSource();

        // Nếu là URL tuyệt đối
        if (
            imagePath.startsWith("http://") ||
            imagePath.startsWith("https://")
        ) {
            // Nếu source là source_k hoặc source_o thì proxy những domain của CDN/primary
            if (source === "source_k" || source === "source_o") {
                const hostname = (() => {
                    try {
                        return new URL(imagePath).hostname || "";
                    } catch (e) {
                        return "";
                    }
                })();

                if (
                    hostname.indexOf("phimimg.com") !== -1 ||
                    hostname.indexOf("phimapi.com") !== -1 ||
                    hostname.indexOf("img.ophim.live") !== -1
                ) {
                    const domain =
                        source === "source_k"
                            ? CONFIG.APP_DOMAIN_SOURCE_K
                            : CONFIG.APP_DOMAIN_SOURCE_O_FRONTEND;
                    if (source === "source_o") {
                        return `${domain}/_next/image?url=${encodeURIComponent(imagePath)}&w=1080&q=75`;
                    } else {
                        return `${domain}/image.php?url=${encodeURIComponent(imagePath)}`;
                    }
                }

                // Domain khác (ví dụ source_c) — vẫn trả nguyên URL
                return imagePath;
            }

            // Nếu không phải source_k hoặc source_o: giữ nguyên URL gốc
            return imagePath;
        }

        // Nếu là đường dẫn relative hoặc chỉ filename => gán CDN chính
        const cdnUrl = `${source === "source_k" ? CONFIG.APP_DOMAIN_SOURCE_K_CDN_IMAGE : CONFIG.APP_DOMAIN_SOURCE_O_CDN_IMAGE}/${imagePath}`;
        if (source === "source_k" || source === "source_o") {
            // Proxy khi source là source_k hoặc source_o
            const domain =
                source === "source_k"
                    ? CONFIG.APP_DOMAIN_SOURCE_K
                    : CONFIG.APP_DOMAIN_SOURCE_O_FRONTEND;
            if (source === "source_o") {
                return `${domain}/_next/image?url=${encodeURIComponent(cdnUrl)}&w=1080&q=75`;
            } else {
                return `${domain}/image.php?url=${encodeURIComponent(cdnUrl)}`;
            }
        }

        // Nguồn khác: trả URL CDN gốc (không proxy)
        return cdnUrl;
    }

    function toggleHistory(e) {
        if (e) e.stopPropagation();
        const h = JSON.parse(localStorage.getItem("viewHistory")) || [];
        setHistory(h.sort((a, b) => new Date(b.time) - new Date(a.time)));
        setIsHistoryOpen(!isHistoryOpen);
    }

    function closeHistory() {
        setIsHistoryOpen(false);
    }

    function toggleFavorites(e) {
        if (e) e.stopPropagation();
        const favs = JSON.parse(localStorage.getItem("favorites")) || [];
        setFavorites(
            favs.sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0)),
        );
        setIsFavoritesOpen(!isFavoritesOpen);
    }

    function closeFavorites() {
        setIsFavoritesOpen(false);
    }

    function deleteHistoryItem(slug, e) {
        if (e) e.stopPropagation();
        const itemToRemove = history.find((item) => item.slug === slug);
        const newHistory = history.filter((item) => item.slug !== slug);
        localStorage.setItem("viewHistory", JSON.stringify(newHistory));
        setHistory(newHistory);
        if (currentUser && itemToRemove) {
            removeHistoryFromFirestore(currentUser.uid, itemToRemove);
        }
    }

    function clearHistory() {
        localStorage.setItem("viewHistory", JSON.stringify([]));
        setHistory([]);
        setConfirmDelete(false);
        if (currentUser) {
            clearHistoryFromFirestore(currentUser.uid);
        }
    }

    function deleteFavoriteItem(slug, e) {
        if (e) e.stopPropagation();
        const itemToRemove = favorites.find((item) => item.slug === slug);
        const newFavorites = favorites.filter((item) => item.slug !== slug);
        localStorage.setItem("favorites", JSON.stringify(newFavorites));
        setFavorites(newFavorites);
        if (currentUser && itemToRemove) {
            removeFavoriteFromFirestore(currentUser.uid, itemToRemove);
        }
    }

    function clearFavorites() {
        localStorage.setItem("favorites", JSON.stringify([]));
        setFavorites([]);
        setConfirmDeleteFavorites(false);
        if (currentUser) {
            clearFavoritesFromFirestore(currentUser.uid);
        }
    }

    function toggleMovieFavorite(movie, e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        const cleanSlug = movie.slug.split("?")[0];
        const currentFavorites =
            JSON.parse(localStorage.getItem("favorites")) || [];
        const isFavorited = currentFavorites.some(
            (fav) => fav.slug === cleanSlug,
        );

        if (isFavorited) {
            // Xóa khỏi yêu thích
            const favoriteToRemove = currentFavorites.find(
                (fav) => fav.slug === cleanSlug,
            );
            const newFavorites = currentFavorites.filter(
                (fav) => fav.slug !== cleanSlug,
            );
            localStorage.setItem("favorites", JSON.stringify(newFavorites));
            setFavorites(newFavorites);
            if (currentUser && favoriteToRemove) {
                removeFavoriteFromFirestore(currentUser.uid, favoriteToRemove);
            }
        } else {
            // Thêm vào yêu thích
            const favorite = {
                slug: cleanSlug,
                name: movie.name,
                poster: getMovieImage(movie.poster_url || movie.thumb_url),
                year: movie.year,
                quality: movie.quality,
                time: new Date().toISOString(),
            };
            const newFavorites = [favorite, ...currentFavorites];
            localStorage.setItem("favorites", JSON.stringify(newFavorites));
            setFavorites(newFavorites);
            if (currentUser) {
                addFavoriteToFirestore(currentUser.uid, favorite);
            }
        }
    }

    function isMovieFavorited(slug) {
        const cleanSlug = slug.split("?")[0];
        return favorites.some((fav) => fav.slug === cleanSlug);
    }

    function generateVisiblePages(totalPages, currentPage) {
        const visiblePages = [];
        const range = 1;
        for (let i = currentPage - range; i <= currentPage + range; i++) {
            if (i >= 1 && i <= totalPages) visiblePages.push(i);
        }
        return visiblePages;
    }

    async function fetchCountries() {
        try {
            const res = await fetch(`${CONFIG.APP_DOMAIN_SOURCE_K}/quoc-gia`);
            const data = await res.json();
            // sort countries by localized name (if available)
            const sorted = (data || [])
                .slice()
                .sort((a, b) =>
                    (a.name || "").localeCompare(b.name || "", "vi"),
                );
            setCountries(sorted);
        } catch (err) {
            // Error fetching countries
        }
    }

    async function fetchCategories() {
        // Danh sách thể loại cố định, không fetch từ API
        const categories = [
            { slug: "hoat-hinh", name: "Hoạt Hình" },
            { slug: "phim-bo", name: "Phim Bộ" },
            { slug: "phim-bo-dang-chieu", name: "Phim Bộ Đang Chiếu" },
            { slug: "phim-bo-hoan-thanh", name: "Phim Bộ Đã Hoàn Thành" },
            { slug: "phim-chieu-rap", name: "Phim Chiếu Rạp" },
            { slug: "phim-le", name: "Phim Lẻ" },
            { slug: "phim-long-tieng", name: "Phim Lồng Tiếng" },
            { slug: "phim-moi", name: "Phim Mới" },
            { slug: "phim-sap-chieu", name: "Phim Sắp Chiếu" },
            { slug: "phim-thuyet-minh", name: "Phim Thuyết Minh" },
            { slug: "phim-vietsub", name: "Phim Vietsub" },
            { slug: "tv-shows", name: "Shows" },
            { slug: "subteam", name: "Subteam" },
        ];

        setCategories(categories);
    }
    // Using `react-select` package for the country dropdown (replaces the previous custom ReactSelect).

    // helper to compute badge classes like original Angular ng-class
    function langBadgeClass(lang) {
        if (!lang) return "";
        if (lang.indexOf("Vietsub") !== -1)
            return "bg-green-900/50 text-green-300 ring-green-700/50";
        if (lang.indexOf("Thuyết Minh") !== -1)
            return "bg-blue-900/50 text-blue-300 ring-blue-700/50";
        if (lang.indexOf("Lồng Tiếng") !== -1)
            return "bg-yellow-900/50 text-yellow-300 ring-yellow-700/50";
        return "bg-zinc-700 text-zinc-300";
    }

    const activeIndex = TABS.findIndex((tab) => tab.id === source);
    const tabWidthPercent = 100 / TABS.length;

    return (
        <div className="min-h-screen bg-zinc-900 font-sans text-zinc-200">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-zinc-800/80 shadow-md backdrop-blur-md">
                <div className="container mx-auto p-4 lg:px-32">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
                        {/* Left: Title + Source Selector */}
                        <div className="flex items-center justify-center gap-2 md:gap-4">
                            {/* Source Selector */}
                            <div
                                className="grid-items-center relative grid w-full grid-cols-3 rounded-full bg-zinc-700 p-1"
                                role="tablist"
                            >
                                {/* Animated indicator background */}
                                <div
                                    className="absolute bottom-1 top-1 cursor-pointer rounded-full bg-zinc-600 shadow transition-transform duration-300 ease-in-out"
                                    style={{
                                        transform: `translateX(calc(${activeIndex * 100}% + 0.25rem))`,
                                        left: 0,
                                        width: `calc((100% - 0.5rem) / ${TABS.length})`,
                                    }}
                                    aria-hidden="true"
                                />

                                {TABS.map((tab) => {
                                    const isActive = source === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            role="tab"
                                            aria-selected={isActive}
                                            aria-label={tab.label}
                                            title={tab.label}
                                            tabIndex={isActive ? 0 : -1}
                                            onClick={() => setSource(tab.id)}
                                            className={`relative z-10 flex flex-1 cursor-pointer items-center justify-center rounded-full p-2 transition-colors duration-200 ${
                                                isActive
                                                    ? "text-zinc-100"
                                                    : "text-zinc-400 hover:text-zinc-200"
                                            }`}
                                        >
                                            {tab.icon}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Center: Search Bar */}
                        <div className="relative flex-1 md:max-w-md">
                            <input
                                type="text"
                                placeholder={t("vods.searchPlaceholder")}
                                value={searchInputValue}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setSearchInputValue(value);
                                    setIsSearching(true);
                                    if (searchInputTimerRef.current) {
                                        clearTimeout(
                                            searchInputTimerRef.current,
                                        );
                                    }
                                    searchInputTimerRef.current = setTimeout(
                                        () => {
                                            setSearchKeyword(value);
                                            setIsSearching(false);
                                        },
                                        500,
                                    );
                                }}
                                onKeyDown={searchMoviesKey}
                                className="w-full rounded-full border border-zinc-600 bg-zinc-700 px-4 py-2 pr-10 text-sm text-zinc-200 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <svg
                                className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                ></path>
                            </svg>
                        </div>

                        {/* Right: User Actions */}
                        <div className="flex items-center justify-end gap-2 md:gap-4">
                            <button
                                onClick={() => setIsFilterOpen(true)}
                                className="relative rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
                                aria-label={t("common.filter")}
                            >
                                <svg
                                    className="h-5 w-5 md:h-6 md:w-6"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                                    ></path>
                                </svg>
                                {/* Badge hiển thị số filter đang active */}
                                {(country || category) && (
                                    <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-semibold leading-none text-white">
                                        {(() => {
                                            const count =
                                                (country ? 1 : 0) +
                                                (category ? 1 : 0);
                                            return count > 9 ? "9+" : count;
                                        })()}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={toggleFavorites}
                                className="relative rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
                                aria-label={t("vods.favorites")}
                            >
                                <svg
                                    className="h-5 w-5 md:h-6 md:w-6"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                                    ></path>
                                </svg>
                                {favorites.length > 0 && (
                                    <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                                        {favorites.length > 9
                                            ? "9+"
                                            : favorites.length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={toggleHistory}
                                className="relative rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
                                aria-label={t("vods.history")}
                            >
                                <svg
                                    className="h-5 w-5 md:h-6 md:w-6"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                    ></path>
                                </svg>
                            </button>
                            <UserProfile
                                onLogout={() => {
                                    setHistory([]);
                                    setFavorites([]);
                                }}
                            />
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto flex flex-1 flex-col p-4 lg:px-32">
                {/* Filter Modal */}
                {isFilterOpen && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
                        onClick={() => setIsFilterOpen(false)}
                    >
                        <div
                            className="flex max-h-[90vh] w-11/12 max-w-2xl flex-col overflow-hidden rounded-lg bg-zinc-800 shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="bg-linear-to-r flex items-center justify-between rounded-t-lg border-b border-zinc-700 from-zinc-800 to-zinc-700 px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-zinc-700 p-2 shadow-sm">
                                        <svg
                                            className="h-5 w-5 text-blue-400"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                                            ></path>
                                        </svg>
                                    </div>
                                    <h2 className="text-lg font-bold text-zinc-100">
                                        {t("vods.filterTitle")}
                                    </h2>
                                </div>
                                <button
                                    onClick={() => setIsFilterOpen(false)}
                                    className="text-2xl leading-none text-zinc-400 transition-colors hover:text-zinc-200"
                                >
                                    ×
                                </button>
                            </div>
                            <div className="flex-1 space-y-6 overflow-y-auto p-6">
                                {/* Country Filter */}
                                <div>
                                    <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-300">
                                        <svg
                                            className="h-4 w-4 text-blue-400"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
                                            />
                                        </svg>
                                        {t("vods.country")}
                                    </label>
                                    {countries.length === 0 ? (
                                        // Skeleton cho Country Select khi đang load
                                        <div className="h-[42px] w-full animate-pulse rounded-lg bg-zinc-600"></div>
                                    ) : (
                                        (() => {
                                            const countryOptions =
                                                countries.map((c) => ({
                                                    value: c.slug,
                                                    label: c.name,
                                                }));

                                            const filteredCountries =
                                                countryQuery === ""
                                                    ? countryOptions
                                                    : countryOptions.filter(
                                                          (c) =>
                                                              c.label
                                                                  .toLowerCase()
                                                                  .includes(
                                                                      countryQuery.toLowerCase(),
                                                                  ),
                                                      );

                                            const selectedCountry =
                                                countryOptions.find(
                                                    (o) => o.value === country,
                                                ) || null;

                                            return (
                                                <Combobox
                                                    value={selectedCountry} // null fallback để tránh controlled -> uncontrolled
                                                    onChange={(item) => {
                                                        // item là object {label, value}, xử lý lấy value để lưu state
                                                        setCountry(
                                                            item?.value || "",
                                                        );
                                                        setCurrentPage(1);
                                                        setSearchKeyword("");
                                                        setCategory("");
                                                    }}
                                                    onClose={() =>
                                                        setCountryQuery("")
                                                    }
                                                >
                                                    <div className="relative">
                                                        <ComboboxInput
                                                            className={clsx(
                                                                "w-full rounded-full border border-zinc-600 bg-zinc-700 py-2.5 pl-3 pr-10 text-sm leading-5 text-zinc-200",
                                                                "focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-700",
                                                                "transition duration-150 ease-in-out",
                                                            )}
                                                            displayValue={(
                                                                item,
                                                            ) =>
                                                                item?.label ||
                                                                ""
                                                            } // Sử dụng item trực tiếp
                                                            onChange={(event) =>
                                                                setCountryQuery(
                                                                    event.target
                                                                        .value,
                                                                )
                                                            }
                                                            placeholder={t(
                                                                "vods.selectCountry",
                                                            )}
                                                        />

                                                        <ComboboxButton className="group absolute inset-y-0 right-0 px-2.5">
                                                            {/* SVG Mũi tên xuống (Thay thế cho ChevronDownIcon) */}
                                                            <svg
                                                                className="size-5 text-zinc-400 group-hover:text-zinc-300"
                                                                viewBox="0 0 20 20"
                                                                fill="currentColor"
                                                                aria-hidden="true"
                                                            >
                                                                <path
                                                                    fillRule="evenodd"
                                                                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                                                                    clipRule="evenodd"
                                                                />
                                                            </svg>
                                                        </ComboboxButton>
                                                    </div>

                                                    <ComboboxOptions
                                                        anchor="bottom"
                                                        transition
                                                        className={clsx(
                                                            // w-[var(--input-width)] giúp dropdown rộng bằng đúng input
                                                            "w-(--input-width) max-h-60 overflow-y-auto rounded-xl border border-zinc-600 bg-zinc-700 p-1 shadow-lg",
                                                            "data-leave:data-closed:opacity-0 transition duration-100 ease-in",
                                                            "z-50 mt-1 empty:invisible",
                                                        )}
                                                    >
                                                        {filteredCountries.length ===
                                                            0 &&
                                                        countryQuery !== "" ? (
                                                            <div className="relative cursor-default select-none px-4 py-2 text-zinc-400">
                                                                {t(
                                                                    "vods.notFound",
                                                                )}
                                                            </div>
                                                        ) : (
                                                            filteredCountries.map(
                                                                (c) => (
                                                                    <ComboboxOption
                                                                        key={
                                                                            c.value
                                                                        }
                                                                        value={
                                                                            c
                                                                        }
                                                                        className="data-focus:bg-zinc-600 group flex cursor-default select-none items-center gap-2 rounded-lg px-3 py-1.5"
                                                                    >
                                                                        {/* SVG Dấu tích (Thay thế cho CheckIcon) */}
                                                                        <svg
                                                                            className="group-data-selected:visible invisible size-4 fill-blue-600"
                                                                            viewBox="0 0 20 20"
                                                                            fill="currentColor"
                                                                            aria-hidden="true"
                                                                        >
                                                                            <path
                                                                                fillRule="evenodd"
                                                                                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.052-.143z"
                                                                                clipRule="evenodd"
                                                                            />
                                                                        </svg>

                                                                        <div className="group-data-selected:font-semibold text-sm text-zinc-200">
                                                                            {
                                                                                c.label
                                                                            }
                                                                        </div>
                                                                    </ComboboxOption>
                                                                ),
                                                            )
                                                        )}
                                                    </ComboboxOptions>
                                                </Combobox>
                                            );
                                        })()
                                    )}
                                </div>
                                {/* Category Filter */}
                                <div>
                                    <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-300">
                                        <svg
                                            className="h-4 w-4 text-blue-400"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                                            />
                                        </svg>
                                        {t("vods.category")}
                                    </label>
                                    {categories.length === 0 ? (
                                        <div className="h-[42px] w-full animate-pulse rounded-lg bg-zinc-600"></div>
                                    ) : (
                                        (() => {
                                            const categoryOptions =
                                                categories.map((c) => ({
                                                    value: c.slug,
                                                    label: c.name,
                                                }));

                                            const filteredCategories =
                                                categoryQuery === ""
                                                    ? categoryOptions
                                                    : categoryOptions.filter(
                                                          (c) =>
                                                              c.label
                                                                  .toLowerCase()
                                                                  .includes(
                                                                      categoryQuery.toLowerCase(),
                                                                  ),
                                                      );

                                            const selectedCategory =
                                                categoryOptions.find(
                                                    (o) => o.value === category,
                                                ) || null;

                                            return (
                                                <Combobox
                                                    value={selectedCategory}
                                                    onChange={(option) => {
                                                        setCategory(
                                                            option?.value || "",
                                                        );
                                                        setCurrentPage(1);
                                                        setCountry("");
                                                        setSearchKeyword("");
                                                    }}
                                                    onClose={() =>
                                                        setCategoryQuery("")
                                                    }
                                                >
                                                    <div className="relative">
                                                        <ComboboxInput
                                                            className={clsx(
                                                                "w-full rounded-full border border-zinc-600 bg-zinc-700 py-2.5 pl-3 pr-10 text-sm leading-5 text-zinc-200",
                                                                "focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-700",
                                                                "transition duration-150 ease-in-out",
                                                            )}
                                                            displayValue={(
                                                                item,
                                                            ) =>
                                                                item?.label ||
                                                                ""
                                                            }
                                                            onChange={(event) =>
                                                                setCategoryQuery(
                                                                    event.target
                                                                        .value,
                                                                )
                                                            }
                                                            placeholder={t(
                                                                "vods.selectCategory",
                                                            )}
                                                        />

                                                        <ComboboxButton className="group absolute inset-y-0 right-0 px-2.5">
                                                            <svg
                                                                className="size-5 text-zinc-400 group-hover:text-zinc-300"
                                                                viewBox="0 0 20 20"
                                                                fill="currentColor"
                                                                aria-hidden="true"
                                                            >
                                                                <path
                                                                    fillRule="evenodd"
                                                                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                                                                    clipRule="evenodd"
                                                                />
                                                            </svg>
                                                        </ComboboxButton>
                                                    </div>

                                                    <ComboboxOptions
                                                        anchor="bottom"
                                                        transition
                                                        className={clsx(
                                                            "w-(--input-width) rounded-xl border border-zinc-600 bg-zinc-700 p-1 shadow-lg",
                                                            "max-h-60 overflow-y-auto",
                                                            "data-leave:data-closed:opacity-0 transition duration-100 ease-in",
                                                            "z-50 mt-1 empty:invisible",
                                                        )}
                                                    >
                                                        {filteredCategories.length ===
                                                            0 &&
                                                        categoryQuery !== "" ? (
                                                            <div className="relative cursor-default select-none px-4 py-2 text-zinc-400">
                                                                {t(
                                                                    "vods.notFound",
                                                                )}
                                                            </div>
                                                        ) : (
                                                            filteredCategories.map(
                                                                (c) => (
                                                                    <ComboboxOption
                                                                        key={
                                                                            c.value
                                                                        }
                                                                        value={
                                                                            c
                                                                        }
                                                                        className="data-focus:bg-zinc-600 group flex cursor-default select-none items-center gap-2 rounded-lg px-3 py-1.5"
                                                                    >
                                                                        <svg
                                                                            className="group-data-selected:visible invisible size-4 fill-blue-400"
                                                                            viewBox="0 0 20 20"
                                                                            fill="currentColor"
                                                                            aria-hidden="true"
                                                                        >
                                                                            <path
                                                                                fillRule="evenodd"
                                                                                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.052-.143z"
                                                                                clipRule="evenodd"
                                                                            />
                                                                        </svg>

                                                                        <div className="group-data-selected:font-semibold text-sm text-zinc-200">
                                                                            {
                                                                                c.label
                                                                            }
                                                                        </div>
                                                                    </ComboboxOption>
                                                                ),
                                                            )
                                                        )}
                                                    </ComboboxOptions>
                                                </Combobox>
                                            );
                                        })()
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-3 border-t border-zinc-700 bg-zinc-900 px-6 py-3">
                                <button
                                    onClick={() => {
                                        setCountry("");
                                        setCategory("");
                                        setCurrentPage(1);
                                    }}
                                    className="flex-1 rounded-full border border-zinc-600 bg-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-600"
                                >
                                    {t("vods.clearFilter")}
                                </button>
                                <button
                                    onClick={() => setIsFilterOpen(false)}
                                    className="flex-1 rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600"
                                >
                                    {t("common.apply")}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isHistoryOpen && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
                        onClick={closeHistory}
                    >
                        <div
                            className="max-h-100 flex w-11/12 max-w-2xl flex-col rounded-lg bg-zinc-800 shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="bg-linear-to-r flex items-center justify-between rounded-t-lg border-b border-zinc-700 from-zinc-800 to-zinc-700 px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-zinc-700 p-2 shadow-sm">
                                        <svg
                                            className="h-5 w-5 text-blue-400"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                            />
                                        </svg>
                                    </div>
                                    <h2 className="text-lg font-bold text-zinc-100">
                                        {t("vods.history")}
                                    </h2>
                                </div>
                                <button
                                    onClick={closeHistory}
                                    className="text-2xl leading-none text-zinc-400 transition-colors hover:text-zinc-200"
                                >
                                    ×
                                </button>
                            </div>
                            <ul className="flex-1 divide-y divide-zinc-700 overflow-y-auto">
                                {history.length === 0 && !isLoading && (
                                    <li className="flex items-center justify-center py-12 text-zinc-400">
                                        {t("vods.noHistory")}
                                    </li>
                                )}

                                {/* Skeleton Loading cho History */}
                                {isLoading &&
                                    Array.from({ length: 5 }).map(
                                        (_, index) => (
                                            <li
                                                key={`history-skeleton-${index}`}
                                                className="flex animate-pulse items-center gap-4 px-6 py-3"
                                            >
                                                {/* Skeleton Poster */}
                                                <div className="h-16 w-12 shrink-0 rounded-md bg-zinc-600"></div>

                                                {/* Skeleton Content */}
                                                <div className="min-w-0 flex-1">
                                                    <div className="mb-2 h-4 w-3/4 rounded bg-zinc-600"></div>
                                                    <div className="mb-1 flex gap-2">
                                                        <div className="h-3 w-20 rounded bg-zinc-700"></div>
                                                        <div className="h-3 w-1 rounded bg-zinc-700"></div>
                                                        <div className="h-3 w-16 rounded bg-zinc-700"></div>
                                                    </div>
                                                    <div className="h-3 w-24 rounded bg-zinc-700"></div>
                                                </div>

                                                {/* Skeleton Delete Button */}
                                                <div className="h-5 w-5 rounded bg-zinc-600"></div>
                                            </li>
                                        ),
                                    )}

                                {!isLoading &&
                                    history.map((item, idx) => (
                                        <li
                                            key={idx}
                                            className="group relative"
                                        >
                                            <a
                                                href={(() => {
                                                    const episodeKey =
                                                        item.current_episode
                                                            ?.key;
                                                    const serverSlug =
                                                        item.server;

                                                    let url = `/entertainment/vods/play/${item.slug}`;
                                                    if (
                                                        episodeKey ||
                                                        episodeKey === 0
                                                    ) {
                                                        // Coerce to string first so numeric keys won't throw
                                                        const episodeKeyStr =
                                                            String(episodeKey);
                                                        // Nếu episodeKey là slug đầy đủ (vd: "tap-4-vietsub"), extract số tập
                                                        const episodeNumber =
                                                            episodeKeyStr.match(
                                                                /\d+/,
                                                            )?.[0] ||
                                                            episodeKeyStr;
                                                        url += `?episode=${episodeNumber}`;
                                                    }
                                                    if (serverSlug) {
                                                        url += `${episodeKey ? "&" : "?"}server=${serverSlug}`;
                                                    }
                                                    return url;
                                                })()}
                                                className="flex cursor-pointer items-center gap-4 px-6 py-3 text-inherit no-underline transition-colors hover:bg-zinc-700"
                                            >
                                                <img
                                                    src={item.poster}
                                                    alt={item.name}
                                                    loading="lazy"
                                                    className="h-16 w-12 shrink-0 rounded-md object-cover shadow-md"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="truncate text-sm font-semibold text-zinc-100">
                                                        {item.name}
                                                    </h3>
                                                    <div className="mt-1 flex gap-2 text-xs text-zinc-400">
                                                        <span>
                                                            {new Date(
                                                                item.timestamp ||
                                                                    item.time,
                                                            ).toLocaleDateString(
                                                                "vi-VN",
                                                            )}
                                                        </span>
                                                        <span>•</span>
                                                        <span>
                                                            {new Date(
                                                                item.timestamp ||
                                                                    item.time,
                                                            ).toLocaleTimeString(
                                                                "vi-VN",
                                                            )}
                                                        </span>
                                                    </div>
                                                    <div className="mt-1 text-xs font-medium text-blue-600">
                                                        {t("vods.watched")}:{" "}
                                                        {(() => {
                                                            const value =
                                                                item
                                                                    .current_episode
                                                                    ?.value;
                                                            const key =
                                                                item
                                                                    .current_episode
                                                                    ?.key;

                                                            // Helper: Format episode display
                                                            const formatEpisode =
                                                                (val) => {
                                                                    if (
                                                                        !val &&
                                                                        val !==
                                                                            0
                                                                    )
                                                                        return null;
                                                                    const str =
                                                                        String(
                                                                            val,
                                                                        ).toLowerCase();
                                                                    // Nếu đã có format "Tập X" thì giữ nguyên
                                                                    if (
                                                                        /^tập\s/i.test(
                                                                            String(
                                                                                val,
                                                                            ),
                                                                        )
                                                                    )
                                                                        return val;
                                                                    // Nếu là "full" hoặc "trailer"
                                                                    if (
                                                                        str ===
                                                                        "full"
                                                                    )
                                                                        return "Full";
                                                                    if (
                                                                        str ===
                                                                        "trailer"
                                                                    )
                                                                        return "Trailer";
                                                                    // Nếu là số thuần, format thành "Tập X"
                                                                    if (
                                                                        /^\d+$/.test(
                                                                            str,
                                                                        )
                                                                    )
                                                                        return `Tập ${val}`;
                                                                    // Tìm số trong string
                                                                    const match =
                                                                        String(
                                                                            val,
                                                                        ).match(
                                                                            /\d+/,
                                                                        );
                                                                    if (match)
                                                                        return `Tập ${match[0]}`;
                                                                    return val;
                                                                };

                                                            // Ưu tiên value, fallback key
                                                            const formatted =
                                                                formatEpisode(
                                                                    value,
                                                                ) ||
                                                                formatEpisode(
                                                                    key,
                                                                );
                                                            return (
                                                                formatted ||
                                                                t(
                                                                    "vods.notWatched",
                                                                )
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </a>
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    deleteHistoryItem(
                                                        item.slug,
                                                        e,
                                                    );
                                                }}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 opacity-0 transition-all hover:bg-red-900/50 hover:text-red-400 group-hover:opacity-100"
                                            >
                                                <svg
                                                    className="h-5 w-5"
                                                    fill="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                                                </svg>
                                            </button>
                                        </li>
                                    ))}
                            </ul>
                            {history.length > 0 && (
                                <div className="rounded-b-lg border-t border-zinc-700 bg-zinc-900 px-6 py-3 text-right">
                                    <button
                                        onClick={() => setConfirmDelete(true)}
                                        className="rounded-full bg-red-500 px-4 py-2 text-white shadow transition hover:bg-red-600"
                                    >
                                        {t("vods.clearHistory")}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <ConfirmDialog
                    isOpen={confirmDelete}
                    title={t("vods.confirmDelete")}
                    message={t("vods.confirmClearHistory")}
                    confirmText={t("common.delete")}
                    cancelText={t("common.cancel")}
                    isDangerous={true}
                    onConfirm={clearHistory}
                    onCancel={() => setConfirmDelete(false)}
                />

                {isFavoritesOpen && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
                        onClick={closeFavorites}
                    >
                        <div
                            className="max-h-100 flex w-11/12 max-w-2xl flex-col rounded-lg bg-zinc-800 shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="bg-linear-to-r flex items-center justify-between rounded-t-lg border-b border-zinc-700 from-zinc-800 to-zinc-700 px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-zinc-700 p-2 shadow-sm">
                                        <svg
                                            className="h-5 w-5 text-red-400"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 21.364l-7.682-7.682a4.5 4.5 0 010-6.364z"
                                            />
                                        </svg>
                                    </div>
                                    <h2 className="text-lg font-bold text-zinc-100">
                                        {t("vods.favorites")}
                                    </h2>
                                </div>
                                <button
                                    onClick={closeFavorites}
                                    className="text-2xl leading-none text-zinc-400 transition-colors hover:text-zinc-200"
                                >
                                    ×
                                </button>
                            </div>
                            <ul className="flex-1 divide-y divide-zinc-700 overflow-y-auto">
                                {favorites.length === 0 && !isLoading && (
                                    <li className="flex items-center justify-center py-12 text-zinc-400">
                                        {t("vods.noFavorites")}
                                    </li>
                                )}

                                {!isLoading &&
                                    favorites.map((item, idx) => (
                                        <li
                                            key={idx}
                                            className="group relative"
                                        >
                                            <a
                                                href={`/entertainment/vods/play/${item.slug}`}
                                                className="flex cursor-pointer items-center gap-4 px-6 py-3 text-inherit no-underline transition-colors hover:bg-zinc-700"
                                            >
                                                <img
                                                    src={item.poster}
                                                    alt={item.name}
                                                    loading="lazy"
                                                    className="h-16 w-12 shrink-0 rounded-md object-cover shadow-md"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="truncate text-sm font-semibold text-zinc-100">
                                                        {item.name}
                                                    </h3>
                                                    <div className="mt-1 flex gap-2 text-xs text-zinc-400">
                                                        {item.year && (
                                                            <>
                                                                <span>
                                                                    {item.year}
                                                                </span>
                                                                <span>•</span>
                                                            </>
                                                        )}
                                                        {item.quality && (
                                                            <span className="font-medium text-red-400">
                                                                {item.quality}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </a>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteFavoriteItem(
                                                        item.slug,
                                                        e,
                                                    );
                                                }}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-2 text-zinc-400 opacity-0 transition-all hover:bg-red-900/50 hover:text-red-400 group-hover:opacity-100"
                                            >
                                                <svg
                                                    className="h-5 w-5"
                                                    fill="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                                                </svg>
                                            </button>
                                        </li>
                                    ))}
                            </ul>
                            {favorites.length > 0 && (
                                <div className="rounded-b-lg border-t border-zinc-700 bg-zinc-900 px-6 py-3 text-right">
                                    <button
                                        onClick={() =>
                                            setConfirmDeleteFavorites(true)
                                        }
                                        className="rounded-full bg-red-500 px-4 py-2 text-white shadow transition hover:bg-red-600"
                                    >
                                        {t("vods.clearFavorites")}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <ConfirmDialog
                    isOpen={confirmDeleteFavorites}
                    title={t("vods.confirmDelete")}
                    message={t("vods.confirmClearFavorites")}
                    confirmText={t("common.delete")}
                    cancelText={t("common.cancel")}
                    isDangerous={true}
                    onConfirm={clearFavorites}
                    onCancel={() => setConfirmDeleteFavorites(false)}
                />

                <div className="flex-1">
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                        {/* Skeleton Loading */}
                        {isLoading &&
                            Array.from({ length: 12 }).map((_, index) => (
                                <div
                                    key={`skeleton-${index}`}
                                    className="group relative flex transform animate-pulse cursor-pointer flex-col overflow-hidden rounded-lg bg-zinc-800 shadow"
                                >
                                    {/* Skeleton Image */}
                                    <div className="relative bg-zinc-700">
                                        <div className="aspect-2/3 w-full bg-zinc-600" />
                                        {/* Skeleton badges */}
                                        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
                                            <div className="h-5 w-8 rounded-md bg-zinc-500"></div>
                                            <div className="h-5 w-6 rounded-md bg-zinc-500"></div>
                                        </div>
                                    </div>
                                    {/* Skeleton Content */}
                                    <div className="flex grow flex-col p-3">
                                        <div className="mb-2 h-4 rounded bg-zinc-600"></div>
                                        <div className="mt-auto flex justify-between">
                                            <div className="h-3 w-16 rounded bg-zinc-700"></div>
                                            <div className="h-3 w-12 rounded bg-zinc-700"></div>
                                        </div>
                                    </div>
                                    {/* Skeleton Quality Badge */}
                                    <div className="absolute right-2 top-2 h-5 w-12 rounded-md bg-zinc-500"></div>
                                </div>
                            ))}

                        {!isLoading && movies.length === 0 && (
                            <div className="col-span-full py-4 text-center text-zinc-400">
                                {t("vods.noMovies")}
                            </div>
                        )}

                        {!isLoading &&
                            movies.map((movie) => (
                                <div
                                    key={movie.slug}
                                    className="group/tip relative"
                                >
                                    <a
                                        href={`/entertainment/vods/play/${movie.slug}`}
                                        className="group relative flex transform cursor-pointer flex-col overflow-hidden rounded-lg bg-zinc-800 text-inherit no-underline shadow transition-transform hover:scale-105 hover:shadow-lg"
                                    >
                                        <div className="relative bg-zinc-700">
                                            <img
                                                src={getMovieImage(
                                                    movie.poster_url,
                                                )}
                                                alt={movie.name}
                                                loading="lazy"
                                                className="aspect-2/3 w-full bg-contain bg-center bg-no-repeat object-cover transition-opacity duration-300"
                                                onLoad={(e) => {
                                                    const loader =
                                                        e.target
                                                            .nextElementSibling;
                                                    if (loader) loader.remove();
                                                }}
                                            />
                                            <div className="bg-linear-to-b aspect-2/3 absolute inset-0 flex items-center justify-center from-zinc-700 to-zinc-600">
                                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-600 border-t-blue-500"></div>
                                            </div>
                                            {/* Nút yêu thích nhanh */}
                                            <button
                                                onClick={(e) =>
                                                    toggleMovieFavorite(
                                                        movie,
                                                        e,
                                                    )
                                                }
                                                className={`absolute left-2 top-2 rounded-full bg-red-900/50 p-1.5 shadow-md transition-all duration-200 ${
                                                    isMovieFavorited(movie.slug)
                                                        ? "opacity-100"
                                                        : "opacity-0 group-hover:opacity-100"
                                                } hover:scale-110`}
                                                title={
                                                    isMovieFavorited(movie.slug)
                                                        ? t("vodPlay.liked")
                                                        : t("vodPlay.like")
                                                }
                                            >
                                                <svg
                                                    className="h-5 w-5 text-red-300"
                                                    fill={
                                                        isMovieFavorited(
                                                            movie.slug,
                                                        )
                                                            ? "currentColor"
                                                            : "none"
                                                    }
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                                                    />
                                                </svg>
                                            </button>
                                            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
                                                {movie.lang
                                                    ?.split("+")
                                                    .map((lang, i) => (
                                                        <span
                                                            key={i}
                                                            className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${langBadgeClass(lang)}`}
                                                        >
                                                            {lang
                                                                .trim()
                                                                .replace(
                                                                    "Thuyết Minh",
                                                                    "TM",
                                                                )
                                                                .replace(
                                                                    "Lồng Tiếng",
                                                                    "LT",
                                                                )
                                                                .replace(
                                                                    "Vietsub",
                                                                    "PĐ",
                                                                )}
                                                        </span>
                                                    ))}
                                            </div>
                                        </div>
                                        <div className="flex grow flex-col p-3">
                                            <h3 className="line-clamp-1 text-sm font-semibold text-zinc-100">
                                                {movie.name}
                                            </h3>
                                            <div className="flex justify-between">
                                                {movie.episode_current?.toLowerCase() ===
                                                "trailer" ? (
                                                    <span className="mt-2 text-xs font-medium text-red-400">
                                                        {movie.episode_current}
                                                    </span>
                                                ) : (
                                                    <span className="mt-2 text-xs text-zinc-400">
                                                        {movie.episode_current ||
                                                            "N/A"}
                                                    </span>
                                                )}
                                                <span className="mt-2 text-xs text-zinc-400">
                                                    {movie.year}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="absolute right-2 top-2 inline-flex items-center rounded-md bg-red-900/50 px-2 py-1 text-xs font-medium text-red-300 ring-1 ring-inset ring-red-600/30">
                                            {movie.quality}
                                        </span>
                                    </a>

                                    {/* Hover Tooltip - CSS only, desktop only */}
                                    <div className="invisible absolute left-1/2 top-1/2 z-50 w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-700/60 bg-zinc-800/95 opacity-0 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md transition-[opacity,visibility] delay-0 duration-200 lg:group-hover/tip:visible lg:group-hover/tip:opacity-100 lg:group-hover/tip:delay-300">
                                        <div className="flex overflow-hidden rounded-t-xl">
                                            {/* Thumbnail */}
                                            <div className="aspect-2/3 relative w-44 shrink-0 overflow-hidden">
                                                <img
                                                    src={getMovieImage(
                                                        movie.poster_url,
                                                    )}
                                                    alt={movie.name}
                                                    className="absolute inset-0 h-full w-full object-cover"
                                                />
                                                <div className="bg-linear-to-r absolute inset-0 from-transparent to-zinc-800/30"></div>
                                            </div>

                                            {/* Details */}
                                            <div className="flex flex-1 flex-col gap-2.5 p-4">
                                                {/* Title */}
                                                <div>
                                                    <h3 className="line-clamp-2 text-sm font-bold leading-snug text-zinc-50">
                                                        {movie.name}
                                                    </h3>
                                                    {movie.origin_name &&
                                                        movie.origin_name !==
                                                            movie.name && (
                                                            <p className="mt-0.5 line-clamp-1 text-xs italic text-zinc-500">
                                                                {
                                                                    movie.origin_name
                                                                }
                                                            </p>
                                                        )}
                                                </div>

                                                {/* Quick Info Badges */}
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    {movie.quality && (
                                                        <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-red-400 ring-1 ring-red-500/30">
                                                            {movie.quality}
                                                        </span>
                                                    )}
                                                    {movie.episode_current && (
                                                        <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[11px] font-semibold text-blue-400 ring-1 ring-blue-500/30">
                                                            {
                                                                movie.episode_current
                                                            }
                                                        </span>
                                                    )}
                                                    {movie.year &&
                                                        movie.year !== 0 && (
                                                            <span className="rounded bg-zinc-600/50 px-1.5 py-0.5 text-[11px] font-medium text-zinc-300">
                                                                {movie.year}
                                                            </span>
                                                        )}
                                                    {movie.tmdb?.vote_average >
                                                        0 && (
                                                        <span className="flex items-center gap-0.5 rounded bg-amber-500/20 px-1.5 py-0.5 text-[11px] font-semibold text-amber-400 ring-1 ring-amber-500/30">
                                                            <svg
                                                                className="h-3 w-3 fill-current"
                                                                viewBox="0 0 24 24"
                                                            >
                                                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                                            </svg>
                                                            {movie.tmdb.vote_average.toFixed?.(
                                                                1,
                                                            ) ||
                                                                movie.tmdb
                                                                    .vote_average}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Categories */}
                                                {movie.category &&
                                                    movie.category.length >
                                                        0 && (
                                                        <div>
                                                            <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                                                                {t(
                                                                    "tooltip.genre",
                                                                )}
                                                            </h4>
                                                            <div className="flex flex-wrap gap-1">
                                                                {movie.category
                                                                    .slice(0, 4)
                                                                    .map(
                                                                        (
                                                                            cat,
                                                                            i,
                                                                        ) => (
                                                                            <span
                                                                                key={
                                                                                    i
                                                                                }
                                                                                className="rounded bg-zinc-700/60 px-1.5 py-0.5 text-[11px] text-zinc-300"
                                                                            >
                                                                                {
                                                                                    cat.name
                                                                                }
                                                                            </span>
                                                                        ),
                                                                    )}
                                                                {movie.category
                                                                    .length >
                                                                    4 && (
                                                                    <span className="px-1 text-[11px] text-zinc-500">
                                                                        +
                                                                        {movie
                                                                            .category
                                                                            .length -
                                                                            4}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                {/* Country & Language */}
                                                <div className="flex items-start gap-4 text-[11px]">
                                                    {movie.country &&
                                                        movie.country.length >
                                                            0 && (
                                                            <div>
                                                                <div className="mb-0.5 font-semibold uppercase tracking-wider text-zinc-500">
                                                                    {t(
                                                                        "tooltip.country",
                                                                    )}
                                                                </div>
                                                                <div className="text-zinc-300">
                                                                    {
                                                                        movie
                                                                            .country[0]
                                                                            ?.name
                                                                    }
                                                                </div>
                                                            </div>
                                                        )}
                                                    {movie.lang && (
                                                        <div className="flex-1">
                                                            <div className="mb-0.5 font-semibold uppercase tracking-wider text-zinc-500">
                                                                {t(
                                                                    "tooltip.language",
                                                                )}
                                                            </div>
                                                            <div className="flex flex-wrap gap-1">
                                                                {movie.lang
                                                                    .split("+")
                                                                    .slice(0, 2)
                                                                    .map(
                                                                        (
                                                                            lang,
                                                                            i,
                                                                        ) => (
                                                                            <span
                                                                                key={
                                                                                    i
                                                                                }
                                                                                className="rounded bg-teal-500/15 px-1.5 py-0.5 text-[11px] font-medium text-teal-400"
                                                                            >
                                                                                {lang
                                                                                    .trim()
                                                                                    .replace(
                                                                                        "Thuyết Minh",
                                                                                        "TM",
                                                                                    )
                                                                                    .replace(
                                                                                        "Lồng Tiếng",
                                                                                        "LT",
                                                                                    )
                                                                                    .replace(
                                                                                        "Vietsub",
                                                                                        "PĐ",
                                                                                    )}
                                                                            </span>
                                                                        ),
                                                                    )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Duration & TMDb */}
                                                {((movie.time &&
                                                    movie.time.trim() !== "" &&
                                                    movie.time !== "0") ||
                                                    movie.tmdb?.id) && (
                                                    <div className="flex items-start gap-4 text-[11px]">
                                                        {movie.time &&
                                                            movie.time.trim() !==
                                                                "" &&
                                                            movie.time !==
                                                                "0" && (
                                                                <div>
                                                                    <div className="mb-0.5 font-semibold uppercase tracking-wider text-zinc-500">
                                                                        {t(
                                                                            "tooltip.duration",
                                                                        )}
                                                                    </div>
                                                                    <div className="text-zinc-300">
                                                                        {
                                                                            movie.time
                                                                        }
                                                                    </div>
                                                                </div>
                                                            )}
                                                        {movie.tmdb?.id && (
                                                            <div>
                                                                <div className="mb-0.5 font-semibold uppercase tracking-wider text-zinc-500">
                                                                    {t(
                                                                        "tooltip.tmdb",
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <svg
                                                                        className="h-3 w-3 fill-amber-400"
                                                                        viewBox="0 0 24 24"
                                                                    >
                                                                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                                                    </svg>
                                                                    <span className="text-zinc-300">
                                                                        {movie
                                                                            .tmdb
                                                                            .vote_average >
                                                                        0
                                                                            ? movie.tmdb.vote_average.toFixed?.(
                                                                                  1,
                                                                              ) ||
                                                                              movie
                                                                                  .tmdb
                                                                                  .vote_average
                                                                            : "N/A"}
                                                                    </span>
                                                                    {movie.tmdb
                                                                        .vote_count >
                                                                        0 && (
                                                                        <span className="text-zinc-500">
                                                                            (
                                                                            {movie.tmdb.vote_count.toLocaleString?.() ||
                                                                                movie
                                                                                    .tmdb
                                                                                    .vote_count}
                                                                            )
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex gap-2 border-t border-zinc-700/60 px-4 py-3">
                                            <a
                                                href={`/entertainment/vods/play/${movie.slug}`}
                                                className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-blue-600 px-3 py-2 text-xs font-semibold text-white no-underline shadow-sm transition-colors hover:bg-blue-500"
                                            >
                                                <svg
                                                    className="h-4 w-4"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                                                    />
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                                    />
                                                </svg>
                                                {t("tooltip.watchNow")}
                                            </a>
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    toggleMovieFavorite(
                                                        movie,
                                                        e,
                                                    );
                                                }}
                                                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                                                    isMovieFavorited(movie.slug)
                                                        ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/30 hover:bg-red-500/30"
                                                        : "bg-zinc-700/60 text-zinc-300 hover:bg-zinc-600/60"
                                                }`}
                                                title={
                                                    isMovieFavorited(movie.slug)
                                                        ? t("vodPlay.liked")
                                                        : t("vodPlay.like")
                                                }
                                            >
                                                <svg
                                                    className="h-4 w-4"
                                                    fill={
                                                        isMovieFavorited(
                                                            movie.slug,
                                                        )
                                                            ? "currentColor"
                                                            : "none"
                                                    }
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                                                    />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleCopyLink(movie.slug);
                                                }}
                                                className={`flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700/60 text-zinc-300 transition-colors hover:bg-zinc-600/60 ${
                                                    copiedMovieSlug ===
                                                    movie.slug
                                                        ? "!bg-green-500/20 !text-green-400 ring-1 ring-green-500/30"
                                                        : ""
                                                }`}
                                                title={
                                                    copiedMovieSlug ===
                                                    movie.slug
                                                        ? "Đã sao chép"
                                                        : "Sao chép liên kết"
                                                }
                                            >
                                                {copiedMovieSlug ===
                                                movie.slug ? (
                                                    <svg
                                                        className="h-4 w-4"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                        strokeWidth={2}
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            d="M5 13l4 4L19 7"
                                                        />
                                                    </svg>
                                                ) : (
                                                    <svg
                                                        className="h-4 w-4"
                                                        viewBox="0 0 32 32"
                                                        fill="none"
                                                    >
                                                        <rect
                                                            x="13"
                                                            y="9"
                                                            width="14"
                                                            height="18"
                                                            stroke="currentColor"
                                                            strokeWidth={2}
                                                            strokeMiterlimit={
                                                                10
                                                            }
                                                        />
                                                        <polyline
                                                            points="11,23 5,23 5,5 19,5 19,7"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth={2}
                                                            strokeMiterlimit={
                                                                10
                                                            }
                                                        />
                                                    </svg>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>

                {/* Skeleton Pagination khi đang loading */}
                {isLoading && (
                    <nav className="mt-8 flex w-full flex-col items-center justify-center gap-4 sm:flex-row">
                        {/* Skeleton Pagination buttons */}
                        <div className="flex h-11 animate-pulse items-center rounded-lg border border-zinc-700 bg-zinc-800 p-1 shadow-sm">
                            <ul className="flex items-center">
                                {Array.from({ length: 7 }).map((_, index) => (
                                    <li key={`pagination-skeleton-${index}`}>
                                        <div className="mx-0.5 h-9 w-9 rounded-md bg-zinc-600"></div>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Skeleton Page input */}
                        <div className="flex h-11 animate-pulse items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-800 px-4 shadow-sm">
                            <div className="flex items-center gap-2">
                                <div className="h-4 w-8 rounded bg-zinc-600"></div>{" "}
                                {/* "Trang:" */}
                                <div className="h-7 w-16 rounded-md bg-zinc-600"></div>{" "}
                                {/* Input */}
                                <div className="h-4 w-6 rounded bg-zinc-600"></div>{" "}
                                {/* "/ X" */}
                            </div>
                        </div>
                    </nav>
                )}

                {!isLoading && movies.length > 0 && (
                    <nav className="mt-3 flex w-full flex-col items-center justify-center gap-4 sm:flex-row">
                        {/* Pagination buttons */}
                        <div className="flex h-11 items-center rounded-lg border border-zinc-700 bg-zinc-800 p-1 shadow-sm">
                            <ul className="flex items-center">
                                {currentPage > 1 && (
                                    <>
                                        <li>
                                            <button
                                                onClick={() => goToPage(1)}
                                                className="mx-0.5 flex h-9 w-9 items-center justify-center rounded-md text-zinc-400 transition-all duration-200 hover:bg-zinc-700 hover:text-blue-400"
                                                title={t("vods.firstPage")}
                                            >
                                                <svg
                                                    className="h-4 w-4"
                                                    fill="currentColor"
                                                    viewBox="0 0 20 20"
                                                >
                                                    <path
                                                        fillRule="evenodd"
                                                        d="M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 010 1.414zm-6 0a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 1.414L5.414 10l4.293 4.293a1 1 0 010 1.414z"
                                                        clipRule="evenodd"
                                                    />
                                                </svg>
                                            </button>
                                        </li>
                                        <li>
                                            <button
                                                onClick={prevPage}
                                                className="mx-0.5 flex h-9 w-9 items-center justify-center rounded-md text-zinc-400 transition-all duration-200 hover:bg-zinc-700 hover:text-blue-400"
                                                title={t("vods.prevPage")}
                                            >
                                                <svg
                                                    className="h-4 w-4"
                                                    fill="currentColor"
                                                    viewBox="0 0 20 20"
                                                >
                                                    <path
                                                        fillRule="evenodd"
                                                        d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                                                        clipRule="evenodd"
                                                    />
                                                </svg>
                                            </button>
                                        </li>
                                    </>
                                )}

                                {generateVisiblePages(
                                    totalPages,
                                    currentPage,
                                ).map((page) => (
                                    <li key={page}>
                                        <button
                                            onClick={() =>
                                                page !== currentPage &&
                                                goToPage(page)
                                            }
                                            disabled={page === currentPage}
                                            className={`mx-0.5 flex h-9 w-9 items-center justify-center rounded-md font-medium transition-all duration-200 ${
                                                page === currentPage
                                                    ? "bg-blue-600 text-white shadow-md"
                                                    : "text-zinc-300 hover:bg-zinc-700 hover:text-blue-400"
                                            }`}
                                        >
                                            {page}
                                        </button>
                                    </li>
                                ))}

                                {currentPage < totalPages && (
                                    <>
                                        <li>
                                            <button
                                                onClick={nextPage}
                                                className="mx-0.5 flex h-9 w-9 items-center justify-center rounded-md text-zinc-400 transition-all duration-200 hover:bg-zinc-700 hover:text-blue-400"
                                                title={t("vods.nextPage")}
                                            >
                                                <svg
                                                    className="h-4 w-4"
                                                    fill="currentColor"
                                                    viewBox="0 0 20 20"
                                                >
                                                    <path
                                                        fillRule="evenodd"
                                                        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                                                        clipRule="evenodd"
                                                    />
                                                </svg>
                                            </button>
                                        </li>
                                        <li>
                                            <button
                                                onClick={() =>
                                                    goToPage(totalPages)
                                                }
                                                className="mx-0.5 flex h-9 w-9 items-center justify-center rounded-md text-zinc-400 transition-all duration-200 hover:bg-zinc-700 hover:text-blue-400"
                                                title={t("vods.lastPage")}
                                            >
                                                <svg
                                                    className="h-4 w-4"
                                                    fill="currentColor"
                                                    viewBox="0 0 20 20"
                                                >
                                                    <path
                                                        fillRule="evenodd"
                                                        d="M10.293 15.707a1 1 0 010-1.414L14.586 10l-4.293-4.293a1 1 0 111.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z"
                                                        clipRule="evenodd"
                                                    />
                                                    <path
                                                        fillRule="evenodd"
                                                        d="M4.293 15.707a1 1 0 010-1.414L8.586 10 4.293 5.707a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z"
                                                        clipRule="evenodd"
                                                    />
                                                </svg>
                                            </button>
                                        </li>
                                    </>
                                )}
                            </ul>
                        </div>

                        {/* Page input */}
                        <div className="flex h-11 items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-800 px-4 shadow-sm">
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-zinc-300">
                                    {t("vods.pageLabel")}:
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="1"
                                        placeholder={currentPage.toString()}
                                        onKeyUp={(e) => {
                                            if (e.key === "Enter") {
                                                // Clear debounce khi nhấn Enter để xử lý ngay lập tức
                                                if (pageInputTimerRef.current) {
                                                    clearTimeout(
                                                        pageInputTimerRef.current,
                                                    );
                                                }

                                                const value = parseInt(
                                                    e.target.value,
                                                );
                                                if (
                                                    !isNaN(value) &&
                                                    value >= 1 &&
                                                    value <= totalPages
                                                ) {
                                                    goToPage(value);
                                                    e.target.value = ""; // Clear input sau khi nhảy thành công
                                                    // Reset style
                                                    e.target.style.borderColor =
                                                        "";
                                                    e.target.style.backgroundColor =
                                                        "";
                                                } else if (
                                                    !isNaN(value) &&
                                                    value >= 1
                                                ) {
                                                    // Số hợp lệ nhưng vượt quá totalPages
                                                    e.target.style.borderColor =
                                                        "#ef4444";
                                                    e.target.style.backgroundColor =
                                                        "#7f1d1d";
                                                    e.target.select(); // Chọn hết text để dễ sửa
                                                } else {
                                                    // Số không hợp lệ (< 1 hoặc NaN)
                                                    e.target.style.borderColor =
                                                        "#ef4444";
                                                    e.target.style.backgroundColor =
                                                        "#7f1d1d";
                                                    e.target.select();
                                                }
                                            }
                                        }}
                                        onInput={(e) => {
                                            // Reset style khi đang gõ
                                            e.target.style.borderColor = "";
                                            e.target.style.backgroundColor = "";

                                            // Debounce auto navigation
                                            if (pageInputTimerRef.current) {
                                                clearTimeout(
                                                    pageInputTimerRef.current,
                                                );
                                            }

                                            const value = parseInt(
                                                e.target.value,
                                            );
                                            if (
                                                !isNaN(value) &&
                                                value >= 1 &&
                                                value <= totalPages
                                            ) {
                                                // Set debounce timer cho valid input
                                                pageInputTimerRef.current =
                                                    setTimeout(() => {
                                                        goToPage(value);
                                                        e.target.value = ""; // Clear input sau khi nhảy
                                                    }, 800); // 800ms delay
                                            }
                                        }}
                                        onFocus={(e) => {
                                            // Reset style khi focus
                                            e.target.style.borderColor = "";
                                            e.target.style.backgroundColor = "";
                                        }}
                                        className="w-16 rounded-md border border-zinc-600 bg-zinc-700 px-2 py-1.5 text-center text-sm font-medium text-zinc-100 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-700"
                                    />
                                </div>
                                <span className="text-sm text-zinc-400">
                                    /{" "}
                                    <span className="font-medium text-zinc-300">
                                        {totalPages}
                                    </span>
                                </span>
                            </div>
                        </div>
                    </nav>
                )}
            </main>
        </div>
    );
}
