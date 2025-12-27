import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
                        className="bg-linear-to-br flex h-9 w-9 items-center justify-center rounded-full border border-white/70 from-blue-50 to-indigo-50 shadow-sm ring-2 ring-blue-200 transition hover:scale-105 hover:ring-blue-400"
                        type="button"
                    >
                        {avatarError || !currentUser.photoURL ? (
                            <span className="text-sm font-semibold text-blue-700">
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
                            "absolute right-0 top-full mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg transition-all duration-200 ease-in-out",
                            isMenuOpen
                                ? "pointer-events-auto scale-100 opacity-100"
                                : "pointer-events-none scale-95 opacity-0",
                        )}
                    >
                        <div className="py-1">
                            <div className="border-b border-gray-200 px-4 py-2">
                                <p className="text-sm font-semibold text-gray-900">
                                    {currentUser.displayName}
                                </p>
                                <p className="truncate text-xs text-gray-500">
                                    {currentUser.email}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="block w-full cursor-pointer px-4 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100"
                            >
                                Đăng xuất
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
                    <span>Đăng nhập</span>
                </button>
            )}
            {authError && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-md bg-red-100 p-3 text-sm text-red-800 shadow-lg">
                    <p className="font-bold">Lỗi xác thực</p>
                    <p className="mt-1 text-xs">{authError.message}</p>
                </div>
            )}
        </div>
    );
}

// Global config for domains
const CONFIG = {
    APP_DOMAIN_KKPHIM: "https://phimapi.com",
    APP_DOMAIN_KKPHIM_CDN_IMAGE: "https://phimimg.com",
    APP_DOMAIN_NGUONC: "https://phim.nguonc.com",
    APP_DOMAIN_OPHIM: "https://ophim1.com",
    APP_DOMAIN_OPHIM_FRONTEND: "https://ophim17.cc",
    APP_DOMAIN_OPHIM_CDN_IMAGE: "https://img.ophim.live",
};

// Source constants
const SOURCES = {
    NGUONC: "nguonc",
    KKPHIM: "kkphim",
    OPHIM: "ophim",
};

// Helper để tính URL ảnh phù hợp theo nguồn đã lưu
function getMovieImage(imagePath) {
    function getSelectedSource() {
        try {
            const v = localStorage.getItem("selected_source");
            if (!v) return "kkphim"; // default to kkphim
            if (v === SOURCES.KKPHIM) return "kkphim";
            if (v === SOURCES.OPHIM) return "ophim";
            if (v === SOURCES.NGUONC) return "nguonc";
            return "kkphim";
        } catch (e) {
            return "kkphim";
        }
    }

    if (!imagePath)
        return `https://picsum.photos/2000/3000?random=${new Date().getTime()}`;

    const source = getSelectedSource();

    if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
        if (source === "kkphim" || source === "ophim") {
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
                    source === "kkphim"
                        ? CONFIG.APP_DOMAIN_KKPHIM
                        : CONFIG.APP_DOMAIN_OPHIM_FRONTEND;
                if (source === "ophim") {
                    return `${domain}/_next/image?url=${encodeURIComponent(imagePath)}&w=1080&q=75`;
                } else {
                    return `${domain}/image.php?url=${encodeURIComponent(imagePath)}`;
                }
            }

            return imagePath;
        }

        return imagePath;
    }

    const cdnUrl = `${source === "kkphim" ? CONFIG.APP_DOMAIN_KKPHIM_CDN_IMAGE : CONFIG.APP_DOMAIN_OPHIM_CDN_IMAGE}/${imagePath}`;
    if (source === "kkphim" || source === "ophim") {
        const domain =
            source === "kkphim"
                ? CONFIG.APP_DOMAIN_KKPHIM
                : CONFIG.APP_DOMAIN_OPHIM_FRONTEND;
        if (source === "ophim") {
            return `${domain}/_next/image?url=${encodeURIComponent(cdnUrl)}&w=1080&q=75`;
        } else {
            return `${domain}/image.php?url=${encodeURIComponent(cdnUrl)}`;
        }
    }

    return cdnUrl;
}

// Tooltip Component cho movie details
function MovieTooltip({ movie, children }) {
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [showBelow, setShowBelow] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const tooltipRef = useRef(null);
    const timeoutRef = useRef(null);
    const containerRef = useRef(null);
    const mountedRef = useRef(true);

    // Detect mobile device
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 1024); // lg breakpoint
        };

        checkMobile();
        window.addEventListener("resize", checkMobile);

        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    const showTooltip = (e) => {
        // Disable tooltip trên mobile
        if (isMobile) return;

        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        timeoutRef.current = setTimeout(() => {
            // Kiểm tra component còn mounted không
            if (!mountedRef.current) return;

            // Sử dụng containerRef thay vì event target để tránh lỗi null
            const element = containerRef.current;
            if (!element) return;

            try {
                const rect = element.getBoundingClientRect();
                if (!mountedRef.current) return; // Kiểm tra lần nữa sau khi gọi getBoundingClientRect

                // Kiểm tra xem có đủ chỗ để hiển thị tooltip ở phía trên không
                const tooltipHeight = 200; // Ước tính chiều cao tooltip
                const spaceAbove = rect.top;
                const spaceBelow = window.innerHeight - rect.bottom;

                // Quyết định hiển thị ở trên hay dưới
                const shouldShowBelow =
                    spaceAbove < tooltipHeight && spaceBelow > spaceAbove;

                setShowBelow(shouldShowBelow);
                setPosition({
                    x: rect.left + rect.width / 2,
                    y: shouldShowBelow ? rect.bottom + 10 : rect.top - 10,
                });
                setIsVisible(true);
            } catch (error) {
                console.warn("Lỗi khi tính toán vị trí tooltip:", error);
            }
        }, 500); // Delay 500ms trước khi hiện tooltip
    };

    const hideTooltip = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setIsVisible(false);
    };

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
    }, []);

    return (
        <>
            <div
                ref={containerRef}
                onMouseEnter={showTooltip}
                onMouseLeave={hideTooltip}
                className="relative"
            >
                {children}
            </div>

            {isVisible && (
                <div
                    ref={tooltipRef}
                    className="fixed z-50 w-[450px] overflow-hidden rounded-xl shadow-2xl backdrop-blur-sm"
                    style={{
                        left: `${position.x}px`,
                        top: `${position.y}px`,
                        transform: showBelow
                            ? "translate(-50%, 0%)"
                            : "translate(-50%, -100%)",
                        pointerEvents: "none",
                    }}
                >
                    {/* Arrow - Thay đổi hướng tùy theo vị trí tooltip */}
                    {showBelow ? (
                        // Arrow pointing up (khi tooltip ở dưới)
                        <>
                            <div className="absolute -top-2 left-1/2 h-0 w-0 -translate-x-1/2 border-b-8 border-l-8 border-r-8 border-b-gray-200 border-l-transparent border-r-transparent"></div>
                            <div className="absolute -top-2 left-1/2 h-0 w-0 -translate-x-1/2 translate-y-px border-b-8 border-l-8 border-r-8 border-b-white border-l-transparent border-r-transparent"></div>
                        </>
                    ) : (
                        // Arrow pointing down (khi tooltip ở trên)
                        <>
                            <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-gray-200"></div>
                            <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 -translate-y-px border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white"></div>
                        </>
                    )}

                    <div className="flex rounded-xl bg-white/95">
                        {/* Thumbnail */}
                        <div className="w-32 shrink-0 self-stretch">
                            <img
                                src={getMovieImage(movie.poster_url)}
                                alt={movie.name}
                                className="h-full w-full rounded-l-xl object-cover"
                            />
                        </div>

                        {/* Details */}
                        <div className="flex-1 space-y-2 px-4 py-3">
                            {/* Title & Quick Info */}
                            <div>
                                <h3 className="mb-1 text-sm font-bold leading-tight text-gray-900">
                                    {movie.name}
                                </h3>

                                {/* Original Name */}
                                {movie.origin_name &&
                                    movie.origin_name !== movie.name && (
                                        <p className="mb-1.5 text-xs italic text-gray-600">
                                            {movie.origin_name}
                                        </p>
                                    )}

                                {/* Quick Info Row */}
                                <div className="mb-2 flex items-center gap-2 text-xs">
                                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                                        {movie.quality}
                                    </span>
                                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                                        {movie.episode_current || "N/A"}
                                    </span>
                                    <span className="text-gray-600">
                                        {movie.year || "N/A"}
                                    </span>
                                </div>
                            </div>

                            {/* Metadata */}
                            <div className="space-y-2">
                                {/* Categories */}
                                {movie.category &&
                                    movie.category.length > 0 && (
                                        <div>
                                            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                Thể loại
                                            </h4>
                                            <div className="flex flex-wrap gap-1">
                                                {movie.category
                                                    .slice(0, 3)
                                                    .map((cat, i) => (
                                                        <span
                                                            key={i}
                                                            className="rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200/50"
                                                        >
                                                            {cat.name}
                                                        </span>
                                                    ))}
                                                {movie.category.length > 3 && (
                                                    <span className="text-xs text-gray-500">
                                                        +
                                                        {movie.category.length -
                                                            3}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                {/* Country & Language Info */}
                                <div className="flex items-start gap-4 text-xs">
                                    {movie.country &&
                                        movie.country.length > 0 && (
                                            <div>
                                                <div className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                    Quốc gia
                                                </div>
                                                <div className="text-gray-700">
                                                    {movie.country[0]?.name}
                                                </div>
                                            </div>
                                        )}

                                    {movie.lang && (
                                        <div className="flex-1">
                                            <div className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                Ngôn ngữ
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {movie.lang
                                                    .split("+")
                                                    .slice(0, 2)
                                                    .map((lang, i) => (
                                                        <span
                                                            key={i}
                                                            className="rounded bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-200/50"
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
                                    )}
                                </div>
                            </div>

                            {/* Additional Info */}
                            {((movie.time &&
                                movie.time.trim() !== "" &&
                                movie.time !== "0") ||
                                (movie.tmdb?.vote_average &&
                                    movie.tmdb.vote_average > 0)) && (
                                <div className="flex items-center gap-4 text-xs">
                                    {/* Duration */}
                                    {movie.time &&
                                        movie.time.trim() !== "" &&
                                        movie.time !== "0" && (
                                            <div>
                                                <div className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                    Thời lượng
                                                </div>
                                                <div className="text-gray-700">
                                                    {movie.time}
                                                </div>
                                            </div>
                                        )}

                                    {/* TMDB Rating */}
                                    {movie.tmdb?.id && (
                                        <div>
                                            <div className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                TMDB
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-yellow-600">
                                                    ★
                                                </span>
                                                <span className="text-gray-700">
                                                    {movie.tmdb.vote_average}
                                                </span>
                                                {movie.tmdb.vote_count &&
                                                    movie.tmdb.vote_count >
                                                        0 && (
                                                        <span className="text-gray-500">
                                                            (
                                                            {
                                                                movie.tmdb
                                                                    .vote_count
                                                            }
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
                </div>
            )}
        </>
    );
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
    // Define tabs
    const TABS = [
        { id: SOURCES.OPHIM, label: "OPhim" },
        { id: SOURCES.KKPHIM, label: "KKPhim" },
        { id: SOURCES.NGUONC, label: "NguonC" },
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

    // Thêm state cho source: nguonc, kkphim, all
    const [source, setSource] = useState(() => {
        try {
            return localStorage.getItem("selected_source") || SOURCES.OPHIM;
        } catch (e) {
            return SOURCES.OPHIM;
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
        if (source !== SOURCES.NGUONC) params.set("source", source);
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
                if (source === SOURCES.NGUONC) {
                    fetchNguoncData({ ...params, type: "search" });
                } else if (source === SOURCES.KKPHIM) {
                    let kkphimParams = { ...params };
                    kkphimParams.sort_field = "modified.time";
                    kkphimParams.sort_type = "desc";
                    fetchKKPhimData({ ...kkphimParams, type: "search" });
                } else if (source === SOURCES.OPHIM) {
                    let ophimParams = { ...params };
                    ophimParams.sort_field = "modified.time";
                    ophimParams.sort_type = "desc";
                    fetchOphimData({ ...ophimParams, type: "search" });
                }
            } else if (category.trim() !== "") {
                // Ưu tiên category nếu có
                params.category = category;
                if (source === SOURCES.NGUONC) {
                    fetchNguoncData({ ...params, type: "category" });
                } else if (source === SOURCES.KKPHIM) {
                    let kkphimParams = { ...params };
                    kkphimParams.sort_field = "modified.time";
                    kkphimParams.sort_type = "desc";
                    fetchKKPhimData({ ...kkphimParams, type: "category" });
                } else if (source === SOURCES.OPHIM) {
                    let ophimParams = { ...params };
                    ophimParams.sort_field = "modified.time";
                    ophimParams.sort_type = "desc";
                    fetchOphimData({ ...ophimParams, type: "category" });
                }
            } else {
                // Nếu country rỗng, fetch danh sách phim mới
                const effectiveCountry = country || "viet-nam";

                if (source === SOURCES.NGUONC) {
                    const paramsNguonc = {
                        page: params.page || 1,
                        limit: 12,
                    };
                    fetchNguoncData({
                        ...paramsNguonc,
                        country: effectiveCountry,
                    });
                } else if (source === SOURCES.KKPHIM) {
                    fetchKKPhimData({ ...params, country: effectiveCountry });
                } else if (source === SOURCES.OPHIM) {
                    const paramsOphim = {
                        page: params.page || 1,
                        limit: 12,
                    };
                    fetchOphimData({
                        ...paramsOphim,
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

    async function fetchData(url, params = {}, source = SOURCES.NGUONC) {
        setIsLoading(true);
        setIsSearching(false); // Clear searching state khi bắt đầu fetch thực sự
        try {
            const qs = buildQuery(params);
            const fullUrl = `${url}?${qs}`;

            // Nếu gọi tới nguonc, dùng fetchFromUrl + parseApiJson để chấp nhận nhiều kiểu response
            if (fullUrl.indexOf(CONFIG.APP_DOMAIN_NGUONC) !== -1) {
                const result = await fetchFromUrl(fullUrl);
                const { items, totalPages, cat } = result;
                let normalizedItems = items.map((it) =>
                    normalizeMovieForSource(it, "nguonc"),
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

            // Nếu gọi tới ophim, dùng fetchFromUrl + parseApiJson
            if (fullUrl.indexOf(CONFIG.APP_DOMAIN_OPHIM) !== -1) {
                const result = await fetchFromUrl(fullUrl);
                const { items, totalPages } = result;
                const normalizedItems = items.map((it) =>
                    normalizeMovieForSource(it, SOURCES.OPHIM),
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

    // Hàm fetch riêng cho Ophim
    async function fetchOphimData(params = {}) {
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
            const fullUrl = `${CONFIG.APP_DOMAIN_OPHIM}/v1/api/${basePath}${qs ? `${isSearch ? "&" : "?"}${qs}` : ""}`;
            const res = await fetch(fullUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            const items = json.data?.items || [];
            const totalItems = json.data?.params?.pagination?.totalItems || 0;
            const totalItemsPerPage =
                json.data?.params?.pagination?.totalItemsPerPage || 10;
            const totalPages = Math.ceil(totalItems / totalItemsPerPage);
            const normalizedItems = items.map((it) =>
                normalizeMovieForSource(it, SOURCES.OPHIM),
            );
            setMovies(normalizedItems);
            setTotalPages(totalPages);
        } catch (err) {
            console.error("fetchOphimData error:", err);
            setMovies([]);
            setTotalPages(1);
        } finally {
            setIsLoading(false);
        }
    }

    // Hàm fetch riêng cho KKPhim
    async function fetchKKPhimData(params = {}) {
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
            const fullUrl = `${CONFIG.APP_DOMAIN_KKPHIM}/v1/api/${endpoint}?${qs}`;
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
                    normalizeMovieForSource(it, SOURCES.KKPHIM),
                );
                setMovies(items);
                setTotalPages(json.data.params?.pagination?.totalPages || 1);
            }
        } catch (err) {
            console.error("fetchKKPhimData error:", err);
            setMovies([]);
            setTotalPages(1);
        } finally {
            setIsLoading(false);
        }
    }

    // Hàm fetch riêng cho Nguonc
    async function fetchNguoncData(params = {}) {
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
            const fullUrl = `${CONFIG.APP_DOMAIN_NGUONC}/api/films/${endpoint}?${qs}`;
            const result = await fetchFromUrl(fullUrl);
            const { items, totalPages, cat } = result;
            let normalizedItems = items.map((it) =>
                normalizeMovieForSource(it, SOURCES.NGUONC),
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
            console.error("fetchNguoncData error:", err);
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
            // nguonc response
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
            // Ophim response
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

        // nguonc: use thumb_url as poster_url for display
        if (source === SOURCES.NGUONC) {
            // Swap: poster_url <- thumb_url, thumbnail <- poster_url
            m.poster_url = m.thumb_url || m.poster_url;
            m.thumbnail = m.poster_url || m.thumb_url;

            // Additional mappings for nguonc
            m.episode_current = m.current_episode;
            m.lang = m.language;
            // Keep other fields like director, casts if needed
        } else if (source === SOURCES.OPHIM) {
            // Ophim: use thumb_url as poster_url, thêm prefix uploads/movies/ nếu cần
            let posterPath = m.thumb_url || m.poster_url;
            if (posterPath && !posterPath.startsWith("uploads/movies/")) {
                posterPath = `uploads/movies/${posterPath}`;
            }
            m.poster_url = posterPath;
            m.thumbnail = m.poster_url || m.thumb_url;

            // Additional mappings for ophim
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
                // nguồn chính (phimapi)
                urls.push(`${CONFIG.APP_DOMAIN_KKPHIM}/v1/api/tim-kiem?${qs}`);

                // nguồn phụ (nguonc) - chỉ gửi các param hiện có: keyword, page, limit, sort_field, sort_type
                const paramsNguonc = {
                    keyword: params.keyword || "",
                    page,
                    limit,
                    sort_field: params.sort_field || params.sortField || "",
                    sort_type: params.sort_type || params.sortType || "",
                };
                const q2 = buildQuery(paramsNguonc);
                urls.push(`${CONFIG.APP_DOMAIN_NGUONC}/api/films/search?${q2}`);
            } else {
                // type === 'country'
                const countrySlug = params.country || "viet-nam";
                urls.push(
                    `${CONFIG.APP_DOMAIN_KKPHIM}/v1/api/quoc-gia/${countrySlug}?${qs}`,
                );

                // nguonc country endpoint: chỉ page (và nếu có sort_field/sort_type gửi thêm)
                const paramsNguonc = {
                    page,
                    sort_field: params.sort_field || params.sortField || "",
                    sort_type: params.sort_type || params.sortType || "",
                };
                const q3 = buildQuery(paramsNguonc);
                urls.push(
                    `${CONFIG.APP_DOMAIN_NGUONC}/api/films/quoc-gia/${countrySlug}?${q3}`,
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
                        url.indexOf(CONFIG.APP_DOMAIN_NGUONC) !== -1
                            ? "nguonc"
                            : "primary";
                    const { items, totalPages, cat } = r.value;
                    const normalized = items.map((it) => {
                        const m = normalizeMovieForSource(it, src);
                        if (src === "nguonc" && cat) {
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

    // Gọi riêng nguồn Nguonc và đặt kết quả
    // fetchNguonc removed — primary-only source

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
                if (!v) return "kkphim"; // default to kkphim
                if (v === SOURCES.KKPHIM) return "kkphim";
                if (v === SOURCES.OPHIM) return "ophim";
                if (v === SOURCES.NGUONC) return "nguonc";
                return "kkphim";
            } catch (e) {
                return "kkphim";
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
            // Nếu source là kkphim hoặc ophim thì proxy những domain của CDN/primary
            if (source === "kkphim" || source === "ophim") {
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
                        source === "kkphim"
                            ? CONFIG.APP_DOMAIN_KKPHIM
                            : CONFIG.APP_DOMAIN_OPHIM_FRONTEND;
                    if (source === "ophim") {
                        return `${domain}/_next/image?url=${encodeURIComponent(imagePath)}&w=1080&q=75`;
                    } else {
                        return `${domain}/image.php?url=${encodeURIComponent(imagePath)}`;
                    }
                }

                // Domain khác (ví dụ nguonc) — vẫn trả nguyên URL
                return imagePath;
            }

            // Nếu không phải kkphim hoặc ophim: giữ nguyên URL gốc
            return imagePath;
        }

        // Nếu là đường dẫn relative hoặc chỉ filename => gán CDN chính
        const cdnUrl = `${source === "kkphim" ? CONFIG.APP_DOMAIN_KKPHIM_CDN_IMAGE : CONFIG.APP_DOMAIN_OPHIM_CDN_IMAGE}/${imagePath}`;
        if (source === "kkphim" || source === "ophim") {
            // Proxy khi source là kkphim hoặc ophim
            const domain =
                source === "kkphim"
                    ? CONFIG.APP_DOMAIN_KKPHIM
                    : CONFIG.APP_DOMAIN_OPHIM_FRONTEND;
            if (source === "ophim") {
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
            const res = await fetch(`${CONFIG.APP_DOMAIN_KKPHIM}/quoc-gia`);
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
            return "bg-green-50 text-green-700 ring-green-600/10";
        if (lang.indexOf("Thuyết Minh") !== -1)
            return "bg-blue-50 text-blue-700 ring-blue-600/10";
        if (lang.indexOf("Lồng Tiếng") !== -1)
            return "bg-yellow-50 text-yellow-700 ring-yellow-600/10";
        return "bg-gray-50 text-gray-700";
    }

    const activeIndex = TABS.findIndex((tab) => tab.id === source);
    const tabWidthPercent = 100 / TABS.length;

    return (
        <div className="min-h-screen bg-gray-100 font-sans text-gray-800">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white/80 shadow-md backdrop-blur-md">
                <div className="container mx-auto p-4 lg:px-32">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
                        {/* Left: Title + Source Selector */}
                        <div className="flex items-center justify-center gap-2 md:gap-4">
                            {/* Source Selector */}
                            <div
                                className="grid-items-center relative grid w-full grid-cols-3 rounded-full bg-gray-200 p-1"
                                role="tablist"
                            >
                                {/* Animated indicator background */}
                                <div
                                    className="absolute bottom-1 top-1 cursor-pointer rounded-full bg-white shadow transition-transform duration-300 ease-in-out"
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
                                            tabIndex={isActive ? 0 : -1} // Chỉ tab active mới nhận focus (tuỳ logic điều hướng)
                                            onClick={() => setSource(tab.id)}
                                            className={`relative z-10 flex-1 cursor-pointer rounded-full px-2 py-1 text-xs font-semibold transition-colors duration-200 md:px-3 md:text-sm ${
                                                isActive
                                                    ? "text-gray-900"
                                                    : "text-gray-600 hover:text-gray-800"
                                            }`}
                                        >
                                            {tab.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Center: Search Bar */}
                        <div className="relative flex-1 md:max-w-md">
                            <input
                                type="text"
                                placeholder="Tìm kiếm phim..."
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
                                className="w-full rounded-full border border-gray-300 bg-gray-50 px-4 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <svg
                                className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
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
                                className="relative rounded-full p-2 text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-900"
                                aria-label="Bộ lọc"
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
                                className="relative rounded-full p-2 text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-900"
                                aria-label="Phim yêu thích"
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
                                className="relative rounded-full p-2 text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-900"
                                aria-label="Lịch sử xem"
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
                            className="flex max-h-[90vh] w-11/12 max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="bg-linear-to-r flex items-center justify-between rounded-t-lg border-b border-gray-200 from-blue-50 to-indigo-50 px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-white p-2 shadow-sm">
                                        <svg
                                            className="h-5 w-5 text-blue-600"
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
                                    <h2 className="text-lg font-bold text-gray-900">
                                        Bộ lọc phim
                                    </h2>
                                </div>
                                <button
                                    onClick={() => setIsFilterOpen(false)}
                                    className="text-2xl leading-none text-gray-400 transition-colors hover:text-gray-600"
                                >
                                    ×
                                </button>
                            </div>
                            <div className="flex-1 space-y-6 overflow-y-auto p-6">
                                {/* Country Filter */}
                                <div>
                                    <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
                                        <svg
                                            className="h-4 w-4 text-blue-500"
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
                                        Quốc gia
                                    </label>
                                    {countries.length === 0 ? (
                                        // Skeleton cho Country Select khi đang load
                                        <div className="h-[42px] w-full animate-pulse rounded-lg bg-gray-300"></div>
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
                                                                "w-full rounded-full border border-gray-300 bg-white py-2.5 pl-3 pr-10 text-sm leading-5 text-gray-900",
                                                                "focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200",
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
                                                            placeholder="Chọn quốc gia"
                                                        />

                                                        <ComboboxButton className="group absolute inset-y-0 right-0 px-2.5">
                                                            {/* SVG Mũi tên xuống (Thay thế cho ChevronDownIcon) */}
                                                            <svg
                                                                className="size-5 text-gray-400 group-hover:text-gray-500"
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
                                                            "w-(--input-width) max-h-60 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-lg",
                                                            "data-leave:data-closed:opacity-0 transition duration-100 ease-in",
                                                            "z-50 mt-1 empty:invisible",
                                                        )}
                                                    >
                                                        {filteredCountries.length ===
                                                            0 &&
                                                        countryQuery !== "" ? (
                                                            <div className="relative cursor-default select-none px-4 py-2 text-gray-700">
                                                                Không tìm thấy.
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
                                                                        className="data-focus:bg-blue-100 group flex cursor-default select-none items-center gap-2 rounded-lg px-3 py-1.5"
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

                                                                        <div className="group-data-selected:font-semibold text-sm text-gray-700">
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
                                    <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
                                        <svg
                                            className="h-4 w-4 text-blue-500"
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
                                        Thể loại
                                    </label>
                                    {categories.length === 0 ? (
                                        <div className="h-[42px] w-full animate-pulse rounded-lg bg-gray-300"></div>
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
                                                                "w-full rounded-full border border-gray-300 bg-white py-2.5 pl-3 pr-10 text-sm leading-5 text-gray-900",
                                                                "focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200",
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
                                                            placeholder="Chọn thể loại"
                                                        />

                                                        <ComboboxButton className="group absolute inset-y-0 right-0 px-2.5">
                                                            <svg
                                                                className="size-5 text-gray-400 group-hover:text-gray-500"
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
                                                            "w-(--input-width) rounded-xl border border-gray-200 bg-white p-1 shadow-lg",
                                                            "max-h-60 overflow-y-auto",
                                                            "data-leave:data-closed:opacity-0 transition duration-100 ease-in",
                                                            "z-50 mt-1 empty:invisible",
                                                        )}
                                                    >
                                                        {filteredCategories.length ===
                                                            0 &&
                                                        categoryQuery !== "" ? (
                                                            <div className="relative cursor-default select-none px-4 py-2 text-gray-700">
                                                                Không tìm thấy.
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
                                                                        className="data-focus:bg-blue-100 group flex cursor-default select-none items-center gap-2 rounded-lg px-3 py-1.5"
                                                                    >
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

                                                                        <div className="group-data-selected:font-semibold text-sm text-gray-700">
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
                            <div className="flex gap-3 border-t border-gray-200 bg-gray-50 px-6 py-3">
                                <button
                                    onClick={() => {
                                        setCountry("");
                                        setCategory("");
                                        setCurrentPage(1);
                                    }}
                                    className="flex-1 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                                >
                                    Xóa bộ lọc
                                </button>
                                <button
                                    onClick={() => setIsFilterOpen(false)}
                                    className="flex-1 rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600"
                                >
                                    Áp dụng
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
                            className="flex max-h-96 w-11/12 max-w-2xl flex-col rounded-lg bg-white shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="bg-linear-to-r flex items-center justify-between rounded-t-lg border-b border-gray-200 from-blue-50 to-indigo-50 px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-white p-2 shadow-sm">
                                        <svg
                                            className="h-5 w-5 text-blue-600"
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
                                    <h2 className="text-lg font-bold text-gray-900">
                                        Lịch sử xem
                                    </h2>
                                </div>
                                <button
                                    onClick={closeHistory}
                                    className="text-2xl leading-none text-gray-400 transition-colors hover:text-gray-600"
                                >
                                    ×
                                </button>
                            </div>
                            <ul className="flex-1 divide-y divide-gray-100 overflow-y-auto">
                                {history.length === 0 && !isLoading && (
                                    <li className="flex items-center justify-center py-12 text-gray-400">
                                        Oops~ Bạn chưa xem phim nào cả! 🥺
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
                                                <div className="h-16 w-12 shrink-0 rounded-md bg-gray-300"></div>

                                                {/* Skeleton Content */}
                                                <div className="min-w-0 flex-1">
                                                    <div className="mb-2 h-4 w-3/4 rounded bg-gray-300"></div>
                                                    <div className="mb-1 flex gap-2">
                                                        <div className="h-3 w-20 rounded bg-gray-200"></div>
                                                        <div className="h-3 w-1 rounded bg-gray-200"></div>
                                                        <div className="h-3 w-16 rounded bg-gray-200"></div>
                                                    </div>
                                                    <div className="h-3 w-24 rounded bg-gray-200"></div>
                                                </div>

                                                {/* Skeleton Delete Button */}
                                                <div className="h-5 w-5 rounded bg-gray-300"></div>
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

                                                    let url = `/vods/play/${item.slug}`;
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
                                                className="flex cursor-pointer items-center gap-4 px-6 py-3 text-inherit no-underline transition-colors hover:bg-blue-50"
                                            >
                                                <img
                                                    src={item.poster}
                                                    alt={item.name}
                                                    loading="lazy"
                                                    className="h-16 w-12 shrink-0 rounded-md object-cover shadow-md"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="truncate text-sm font-semibold text-gray-900">
                                                        {item.name}
                                                    </h3>
                                                    <div className="mt-1 flex gap-2 text-xs text-gray-500">
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
                                                        Đã xem:{" "}
                                                        {(() => {
                                                            if (
                                                                item
                                                                    .current_episode
                                                                    ?.value
                                                            ) {
                                                                return item
                                                                    .current_episode
                                                                    .value;
                                                            }
                                                            if (
                                                                item
                                                                    .current_episode
                                                                    ?.key
                                                            ) {
                                                                // Tạo value từ key (vd: "tap-4" → "Tập 4")
                                                                const match =
                                                                    item.current_episode.key.match(
                                                                        /\d+/,
                                                                    );
                                                                return match
                                                                    ? `Tập ${match[0]}`
                                                                    : item
                                                                          .current_episode
                                                                          .key;
                                                            }
                                                            return "Chưa xem";
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
                                                className="absolute right-4 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
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
                                <div className="rounded-b-lg border-t border-gray-200 bg-gray-50 px-6 py-3 text-right">
                                    <button
                                        onClick={() => setConfirmDelete(true)}
                                        className="rounded-full bg-red-500 px-4 py-2 text-white shadow transition hover:bg-red-600"
                                    >
                                        Xóa lịch sử xem
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <ConfirmDialog
                    isOpen={confirmDelete}
                    title="Xác nhận xoá"
                    message="Bạn chắc chắn muốn xoá toàn bộ lịch sử xem? Hành động này không thể hoàn tác."
                    confirmText="Xoá"
                    cancelText="Huỷ"
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
                            className="flex max-h-96 w-11/12 max-w-2xl flex-col rounded-lg bg-white shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="bg-linear-to-r flex items-center justify-between rounded-t-lg border-b border-gray-200 from-red-50 to-rose-50 px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-white p-2 shadow-sm">
                                        <svg
                                            className="h-5 w-5 text-red-600"
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
                                    <h2 className="text-lg font-bold text-gray-900">
                                        Phim yêu thích
                                    </h2>
                                </div>
                                <button
                                    onClick={closeFavorites}
                                    className="text-2xl leading-none text-gray-400 transition-colors hover:text-gray-600"
                                >
                                    ×
                                </button>
                            </div>
                            <ul className="flex-1 divide-y divide-gray-100 overflow-y-auto">
                                {favorites.length === 0 && !isLoading && (
                                    <li className="flex items-center justify-center py-12 text-gray-400">
                                        Oops~ Bạn chưa có phim yêu thích nào! 💔
                                    </li>
                                )}

                                {!isLoading &&
                                    favorites.map((item, idx) => (
                                        <li
                                            key={idx}
                                            className="group relative"
                                        >
                                            <a
                                                href={`/vods/play/${item.slug}`}
                                                className="flex cursor-pointer items-center gap-4 px-6 py-3 text-inherit no-underline transition-colors hover:bg-red-50"
                                            >
                                                <img
                                                    src={item.poster}
                                                    alt={item.name}
                                                    loading="lazy"
                                                    className="h-16 w-12 shrink-0 rounded-md object-cover shadow-md"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="truncate text-sm font-semibold text-gray-900">
                                                        {item.name}
                                                    </h3>
                                                    <div className="mt-1 flex gap-2 text-xs text-gray-500">
                                                        {item.year && (
                                                            <>
                                                                <span>
                                                                    {item.year}
                                                                </span>
                                                                <span>•</span>
                                                            </>
                                                        )}
                                                        {item.quality && (
                                                            <span className="font-medium text-red-600">
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
                                                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-2 text-gray-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
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
                                <div className="rounded-b-lg border-t border-gray-200 bg-gray-50 px-6 py-3 text-right">
                                    <button
                                        onClick={() =>
                                            setConfirmDeleteFavorites(true)
                                        }
                                        className="rounded-full bg-red-500 px-4 py-2 text-white shadow transition hover:bg-red-600"
                                    >
                                        Xóa tất cả yêu thích
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <ConfirmDialog
                    isOpen={confirmDeleteFavorites}
                    title="Xác nhận xoá"
                    message="Bạn chắc chắn muốn xoá toàn bộ danh sách yêu thích? Hành động này không thể hoàn tác."
                    confirmText="Xoá"
                    cancelText="Huỷ"
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
                                    className="group relative flex transform animate-pulse cursor-pointer flex-col overflow-hidden rounded-lg bg-white shadow"
                                >
                                    {/* Skeleton Image */}
                                    <div className="relative bg-gray-200">
                                        <div className="aspect-2/3 w-full bg-gray-300" />
                                        {/* Skeleton badges */}
                                        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
                                            <div className="h-5 w-8 rounded-md bg-gray-400"></div>
                                            <div className="h-5 w-6 rounded-md bg-gray-400"></div>
                                        </div>
                                    </div>
                                    {/* Skeleton Content */}
                                    <div className="flex grow flex-col p-3">
                                        <div className="mb-2 h-4 rounded bg-gray-300"></div>
                                        <div className="mt-auto flex justify-between">
                                            <div className="h-3 w-16 rounded bg-gray-200"></div>
                                            <div className="h-3 w-12 rounded bg-gray-200"></div>
                                        </div>
                                    </div>
                                    {/* Skeleton Quality Badge */}
                                    <div className="absolute right-2 top-2 h-5 w-12 rounded-md bg-gray-400"></div>
                                </div>
                            ))}

                        {!isLoading && movies.length === 0 && (
                            <div className="col-span-full py-4 text-center text-gray-500">
                                Oops~ Không có phim nào trong danh sách của bạn!
                                🥺
                            </div>
                        )}

                        {!isLoading &&
                            movies.map((movie) => (
                                <MovieTooltip key={movie.slug} movie={movie}>
                                    <a
                                        href={`/vods/play/${movie.slug}`}
                                        className="group relative flex transform cursor-pointer flex-col overflow-hidden rounded-lg bg-white text-inherit no-underline shadow transition-transform hover:scale-105 hover:shadow-lg"
                                    >
                                        <div className="relative bg-gray-200">
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
                                            <div className="bg-linear-to-b aspect-2/3 absolute inset-0 flex items-center justify-center from-gray-200 to-gray-300">
                                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-500"></div>
                                            </div>
                                            {/* Nút yêu thích nhanh */}
                                            <button
                                                onClick={(e) =>
                                                    toggleMovieFavorite(
                                                        movie,
                                                        e,
                                                    )
                                                }
                                                className={`absolute left-2 top-2 rounded-full bg-red-200 p-1.5 shadow-md transition-all duration-200 ${
                                                    isMovieFavorited(movie.slug)
                                                        ? "opacity-100"
                                                        : "opacity-0 group-hover:opacity-100"
                                                } hover:scale-110`}
                                                title={
                                                    isMovieFavorited(movie.slug)
                                                        ? "Đã thích"
                                                        : "Thêm vào yêu thích"
                                                }
                                            >
                                                <svg
                                                    className="h-5 w-5 text-red-700"
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
                                            <h3 className="line-clamp-1 text-sm font-semibold text-gray-800">
                                                {movie.name}
                                            </h3>
                                            <div className="flex justify-between">
                                                <span className="mt-2 text-xs text-gray-500">
                                                    {movie.episode_current ||
                                                        "N/A"}
                                                </span>
                                                <span className="mt-2 text-xs  text-gray-500">
                                                    {movie.year}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="absolute right-2 top-2 inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
                                            {movie.quality}
                                        </span>
                                    </a>
                                </MovieTooltip>
                            ))}
                    </div>
                </div>

                {/* Skeleton Pagination khi đang loading */}
                {isLoading && (
                    <nav className="mt-8 flex w-full flex-col items-center justify-center gap-4 sm:flex-row">
                        {/* Skeleton Pagination buttons */}
                        <div className="flex h-11 animate-pulse items-center rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
                            <ul className="flex items-center">
                                {Array.from({ length: 7 }).map((_, index) => (
                                    <li key={`pagination-skeleton-${index}`}>
                                        <div className="mx-0.5 h-9 w-9 rounded-md bg-gray-300"></div>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Skeleton Page input */}
                        <div className="flex h-11 animate-pulse items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 shadow-sm">
                            <div className="flex items-center gap-2">
                                <div className="h-4 w-8 rounded bg-gray-300"></div>{" "}
                                {/* "Trang:" */}
                                <div className="h-7 w-16 rounded-md bg-gray-300"></div>{" "}
                                {/* Input */}
                                <div className="h-4 w-6 rounded bg-gray-300"></div>{" "}
                                {/* "/ X" */}
                            </div>
                        </div>
                    </nav>
                )}

                {!isLoading && movies.length > 0 && (
                    <nav className="mt-3 flex w-full flex-col items-center justify-center gap-4 sm:flex-row">
                        {/* Pagination buttons */}
                        <div className="flex h-11 items-center rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
                            <ul className="flex items-center">
                                {currentPage > 1 && (
                                    <>
                                        <li>
                                            <button
                                                onClick={() => goToPage(1)}
                                                className="mx-0.5 flex h-9 w-9 items-center justify-center rounded-md text-gray-500 transition-all duration-200 hover:bg-blue-50 hover:text-blue-600"
                                                title="Trang đầu"
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
                                                className="mx-0.5 flex h-9 w-9 items-center justify-center rounded-md text-gray-500 transition-all duration-200 hover:bg-blue-50 hover:text-blue-600"
                                                title="Trang trước"
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
                                                    : "text-gray-700 hover:bg-blue-50 hover:text-blue-600"
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
                                                className="mx-0.5 flex h-9 w-9 items-center justify-center rounded-md text-gray-500 transition-all duration-200 hover:bg-blue-50 hover:text-blue-600"
                                                title="Trang sau"
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
                                                className="mx-0.5 flex h-9 w-9 items-center justify-center rounded-md text-gray-500 transition-all duration-200 hover:bg-blue-50 hover:text-blue-600"
                                                title="Trang cuối"
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
                        <div className="flex h-11 items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 shadow-sm">
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-gray-700">
                                    Trang:
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
                                                        "#fef2f2";
                                                    e.target.select(); // Chọn hết text để dễ sửa
                                                } else {
                                                    // Số không hợp lệ (< 1 hoặc NaN)
                                                    e.target.style.borderColor =
                                                        "#ef4444";
                                                    e.target.style.backgroundColor =
                                                        "#fef2f2";
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
                                        className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-center text-sm font-medium text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                    />
                                </div>
                                <span className="text-sm text-gray-500">
                                    /{" "}
                                    <span className="font-medium text-gray-700">
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
