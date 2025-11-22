import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Select from "react-select";
import LoadingSpinner from "../components/LoadingSpinner";
import ConfirmDialog from "../components/ConfirmDialog";

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
        try {
            localStorage.setItem(key, JSON.stringify(state));
        } catch (e) {}
    }, [key, state]);
    return [state, setState];
}

export default function Vods() {
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

    const [movies, setMovies] = useState([]);
    const [currentPage, setCurrentPage] = useState(getInitialPage);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [searchKeyword, setSearchKeyword] = useState(getInitialKeyword);
    const [searchInputValue, setSearchInputValue] = useState(getInitialKeyword);
    const [country, setCountry] = useState(getInitialCountry);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [history, setHistory] = useLocalStorage("viewHistory", []);
    const [countries, setCountries] = useState([]);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [isSearching, setIsSearching] = useState(false); // Track khi đang search/debounce
    const navigate = useNavigate();

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

    const countriesFetchedRef = useRef(false);
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
        if (source !== SOURCES.NGUONC) params.set("source", source);
        window.history.replaceState({}, "", `?${params.toString()}`);
    }, [currentPage, searchKeyword, country, source]);

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
            currentPage !== prev.page ||
            source !== prev.source;

        if (stateChanged) {
            prevStateRef.current = {
                keyword: searchKeyword,
                country,
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
                    fetchKKPhimData({ ...params, type: "search" });
                } else if (source === SOURCES.OPHIM) {
                    const ophimParams = { ...params };
                    delete ophimParams.sort_field;
                    delete ophimParams.sort_type;
                    fetchOphimData({ ...ophimParams, type: "search" });
                }
            } else {
                if (source === SOURCES.NGUONC) {
                    const paramsNguonc = {
                        page: params.page || 1,
                        limit: 12,
                    };
                    fetchNguoncData({ ...paramsNguonc, country });
                } else if (source === SOURCES.KKPHIM) {
                    fetchKKPhimData({ ...params, country });
                } else if (source === SOURCES.OPHIM) {
                    const paramsOphim = {
                        page: params.page || 1,
                        limit: 12,
                    };
                    fetchOphimData({ ...paramsOphim, country });
                }
            }
        }

        // Cleanup on unmount
        return () => {
            if (pageInputTimerRef.current) {
                clearTimeout(pageInputTimerRef.current);
            }
        };
    }, [searchKeyword, country, currentPage, source]);

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
            const qs = qsParts.join("&");
            const isSearch = params.type === "search";
            const basePath = isSearch
                ? `tim-kiem?keyword=${encodeURIComponent(params.keyword || "")}`
                : `quoc-gia/${params.country || "viet-nam"}`;
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
            const qs = buildQuery(params);
            const fullUrl = `${CONFIG.APP_DOMAIN_KKPHIM}/v1/api/${params.type === "search" ? "tim-kiem" : `quoc-gia/${params.country || "viet-nam"}`}?${qs}`;
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
            const fullUrl = `${CONFIG.APP_DOMAIN_NGUONC}/api/films/${params.type === "search" ? "search" : `quoc-gia/${params.country || "viet-nam"}`}?${qs}`;
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

    function deleteHistoryItem(slug, e) {
        if (e) e.stopPropagation();
        const newHistory = history.filter((item) => item.slug !== slug);
        localStorage.setItem("viewHistory", JSON.stringify(newHistory));
        setHistory(newHistory);
    }

    function clearHistory() {
        localStorage.setItem("viewHistory", JSON.stringify([]));
        setHistory([]);
        setConfirmDelete(false);
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

    return (
        <div>
            <LoadingSpinner isLoading={isLoading} />

            <main className="container mx-auto flex flex-1 flex-col px-4 py-6 lg:px-32">
                <div className="mb-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
                        <div className="relative flex-1">
                            <input
                                value={searchInputValue}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setSearchInputValue(value); // Update input value immediately
                                    setIsSearching(true); // Bắt đầu debounce
                                    if (searchInputTimerRef.current) {
                                        clearTimeout(
                                            searchInputTimerRef.current,
                                        );
                                    }
                                    searchInputTimerRef.current = setTimeout(
                                        () => {
                                            setSearchKeyword(value);
                                            setIsSearching(false); // Kết thúc debounce
                                        },
                                        500,
                                    ); // 500ms debounce
                                }}
                                onKeyUp={searchMoviesKey}
                                type="text"
                                placeholder="Nhập tên phim..."
                                className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-500 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 ${
                                    (isLoading || isSearching) &&
                                    searchKeyword.trim() !== "" &&
                                    searchInputValue.trim() !== ""
                                        ? "pr-20"
                                        : (isLoading || isSearching) &&
                                            searchKeyword.trim() !== ""
                                          ? "pr-10"
                                          : searchInputValue.trim() !== ""
                                            ? "pr-10"
                                            : ""
                                }`}
                            />
                            {/* Loading indicator cho search */}
                            {(isLoading || isSearching) &&
                                searchKeyword.trim() !== "" && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500"></div>
                                    </div>
                                )}
                            {/* Clear button */}
                            {searchInputValue.trim() !== "" && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchInputValue("");
                                        setSearchKeyword("");
                                        setIsSearching(false);
                                        if (searchInputTimerRef.current) {
                                            clearTimeout(
                                                searchInputTimerRef.current,
                                            );
                                        }
                                    }}
                                    className={`absolute top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                        (isLoading || isSearching) &&
                                        searchKeyword.trim() !== ""
                                            ? "right-10"
                                            : "right-3"
                                    }`}
                                    title="Xóa tìm kiếm"
                                >
                                    <svg
                                        className="h-4 w-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            )}
                        </div>
                        <div className="flex-1 sm:w-48 sm:flex-none">
                            {countries.length === 0 ? (
                                // Skeleton cho Country Select khi đang load
                                <div className="h-[42px] w-full animate-pulse rounded-lg bg-gray-300"></div>
                            ) : (
                                (() => {
                                    const countryOptions = countries.map(
                                        (c) => ({
                                            value: c.slug,
                                            label: c.name,
                                        }),
                                    );
                                    return (
                                        <Select
                                            options={countryOptions}
                                            value={
                                                countryOptions.find(
                                                    (o) => o.value === country,
                                                ) || null
                                            }
                                            onChange={(opt) => {
                                                const val = opt
                                                    ? opt.value
                                                    : "";
                                                const newCountry =
                                                    val || "viet-nam";
                                                setCountry(newCountry);
                                                setCurrentPage(1);
                                                setSearchKeyword("");
                                            }}
                                            placeholder="Chọn quốc gia"
                                            isClearable
                                            styles={{
                                                control: (provided, state) => ({
                                                    ...provided,
                                                    minHeight: "42px", // Match với input py-2.5
                                                    borderColor: state.isFocused
                                                        ? "#3b82f6"
                                                        : "#d1d5db", // border-gray-300 & focus:border-blue-500
                                                    borderRadius: "0.5rem", // rounded-lg
                                                    boxShadow: state.isFocused
                                                        ? "0 0 0 2px rgba(59, 130, 246, 0.2)" // focus:ring-2 focus:ring-blue-200
                                                        : "none", // Không có shadow
                                                    "&:hover": {
                                                        borderColor:
                                                            state.isFocused
                                                                ? "#3b82f6"
                                                                : "#d1d5db",
                                                    },
                                                    fontSize: "0.875rem", // text-sm
                                                    transition:
                                                        "all 0.15s ease-in-out",
                                                }),
                                                valueContainer: (provided) => ({
                                                    ...provided,
                                                    padding: "0 12px", // px-3
                                                    minHeight: "38px",
                                                }),
                                                input: (provided) => ({
                                                    ...provided,
                                                    margin: 0,
                                                    padding: 0,
                                                    color: "#111827", // text-gray-900
                                                    fontSize: "0.875rem", // text-sm
                                                }),
                                                placeholder: (provided) => ({
                                                    ...provided,
                                                    color: "#6b7280", // placeholder-gray-500
                                                    fontSize: "0.875rem", // text-sm
                                                }),
                                                singleValue: (provided) => ({
                                                    ...provided,
                                                    color: "#111827", // text-gray-900
                                                    fontSize: "0.875rem", // text-sm
                                                }),
                                                indicatorSeparator: () => ({
                                                    display: "none",
                                                }),
                                                dropdownIndicator: (
                                                    provided,
                                                ) => ({
                                                    ...provided,
                                                    color: "#6b7280", // text-gray-500
                                                    "&:hover": {
                                                        color: "#6b7280",
                                                    },
                                                }),
                                                clearIndicator: (provided) => ({
                                                    ...provided,
                                                    color: "#6b7280", // text-gray-500
                                                    "&:hover": {
                                                        color: "#ef4444", // text-red-500
                                                    },
                                                }),
                                            }}
                                        />
                                    );
                                })()
                            )}
                        </div>
                        {/* Nguon selector: chọn nguồn A, C, ALL */}
                        <div className="w-44">
                            {/** Sử dụng react-select để có giao diện đồng nhất với country select */}
                            <Select
                                options={[
                                    { value: SOURCES.OPHIM, label: "Ophim" },
                                    { value: SOURCES.KKPHIM, label: "KKPhim" },
                                    { value: SOURCES.NGUONC, label: "Nguonc" },
                                ]}
                                value={
                                    [
                                        {
                                            value: SOURCES.OPHIM,
                                            label: "Ophim",
                                        },
                                        {
                                            value: SOURCES.KKPHIM,
                                            label: "KKPhim",
                                        },
                                        {
                                            value: SOURCES.NGUONC,
                                            label: "Nguonc",
                                        },
                                    ].find((o) => o.value === source) || null
                                }
                                onChange={(opt) => {
                                    if (!opt) return;
                                    setSource(opt.value);
                                }}
                                placeholder="Nguồn"
                                isClearable={false}
                                styles={{
                                    control: (provided, state) => ({
                                        ...provided,
                                        minHeight: "42px",
                                        borderColor: state.isFocused
                                            ? "#3b82f6"
                                            : "#d1d5db",
                                        borderRadius: "0.5rem",
                                        boxShadow: state.isFocused
                                            ? "0 0 0 2px rgba(59, 130, 246, 0.08)"
                                            : "none",
                                    }),
                                    valueContainer: (provided) => ({
                                        ...provided,
                                        padding: "0 12px",
                                        minHeight: "38px",
                                    }),
                                    input: (provided) => ({
                                        ...provided,
                                        margin: 0,
                                        padding: 0,
                                    }),
                                    placeholder: (provided) => ({
                                        ...provided,
                                        color: "#6b7280",
                                    }),
                                }}
                            />
                        </div>
                        <button
                            onClick={toggleHistory}
                            className="flex transform items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-medium text-white transition-all duration-300 ease-in-out hover:bg-blue-700 active:scale-95"
                        >
                            <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8v4l3 2m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                            <span>Lịch sử</span>
                        </button>
                    </div>
                </div>

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
                                <h2 className="text-lg font-bold text-gray-900">
                                    Lịch sử xem
                                </h2>
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

                                                    let url = `vods/play/${item.slug}`;
                                                    if (episodeKey) {
                                                        // Nếu episodeKey là slug đầy đủ (vd: "tap-4-vietsub"), extract số tập
                                                        const episodeNumber =
                                                            episodeKey.match(
                                                                /\d+/,
                                                            )?.[0] ||
                                                            episodeKey;
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
                                                    src={getMovieImage(
                                                        item.poster,
                                                    )}
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
                                        className="rounded-md bg-red-500 px-4 py-2 text-white shadow transition hover:bg-red-600"
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
                                        href={`vods/play/${movie.slug}`}
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
