import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Select from "react-select";
import LoadingSpinner from "../components/LoadingSpinner";
import ConfirmDialog from "../components/ConfirmDialog";

const CONFIG = {
    APP_DOMAIN_FRONTEND: "https://phimapi.com",
    APP_DOMAIN_CDN_IMAGE: "https://phimimg.com",
};

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
    const [country, setCountry] = useState(getInitialCountry);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [history, setHistory] = useLocalStorage("viewHistory", []);
    const [countries, setCountries] = useState([]);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [isSearching, setIsSearching] = useState(false); // Track khi đang search/debounce
    const navigate = useNavigate();

    const countriesFetchedRef = useRef(false);
    const isInitialMount = useRef(true);
    const pageInputTimerRef = useRef(null); // Debounce cho page input

    useEffect(() => {
        document.title = "VODs — Entertainment";

        // Fetch countries
        if (!countriesFetchedRef.current) {
            countriesFetchedRef.current = true;
            fetchCountries();
        }

        const onKey = (e) => {
            if (e.key === "ArrowRight") nextPage();
            if (e.key === "ArrowLeft") prevPage();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // Sync URL khi state thay đổi
    useEffect(() => {
        const params = new URLSearchParams();
        params.set("page", currentPage);
        if (searchKeyword.trim() !== "") params.set("keyword", searchKeyword);
        if (country.trim() !== "") params.set("country", country);
        window.history.replaceState({}, "", `?${params.toString()}`);
    }, [currentPage, searchKeyword, country]);

    const prevStateRef = useRef(null);
    const debounceTimerRef = useRef(null);

    // Auto-fetch khi keyword, country, hoặc page thay đổi (với debounce)
    useEffect(() => {
        // Skip fetch nếu đang initial mount (chưa có state từ URL)
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        const prev = prevStateRef.current;
        const stateChanged =
            !prev ||
            searchKeyword !== prev.keyword ||
            country !== prev.country ||
            currentPage !== prev.page;

        if (stateChanged) {
            prevStateRef.current = {
                keyword: searchKeyword,
                country,
                page: currentPage,
            };

            // Clear previous timer
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }

            // Set searching state khi user đang nhập
            if (searchKeyword.trim() !== "") {
                setIsSearching(true);
            }

            // Set new debounce timer (300ms delay để responsive hơn)
            debounceTimerRef.current = setTimeout(() => {
                const params = {
                    page: currentPage,
                    limit: 12,
                    sort_field: "year",
                    sort_type: "desc",
                };

                // Nếu có keyword, dùng /tim-kiem; không thì dùng /quoc-gia/{country}
                if (searchKeyword.trim() !== "") {
                    params.keyword = searchKeyword;
                    fetchData(
                        `${CONFIG.APP_DOMAIN_FRONTEND}/v1/api/tim-kiem`,
                        params,
                    );
                } else {
                    fetchData(
                        `${CONFIG.APP_DOMAIN_FRONTEND}/v1/api/quoc-gia/${country}`,
                        params,
                    );
                }
            }, 300);
        }

        // Cleanup on unmount
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            if (pageInputTimerRef.current) {
                clearTimeout(pageInputTimerRef.current);
            }
        };
    }, [searchKeyword, country, currentPage]);

    // Fetch initial data sau khi state được init từ URL
    useEffect(() => {
        const params = {
            page: currentPage,
            limit: 12,
            sort_field: "year",
            sort_type: "desc",
        };

        if (searchKeyword.trim() !== "") {
            params.keyword = searchKeyword;
            fetchData(`${CONFIG.APP_DOMAIN_FRONTEND}/v1/api/tim-kiem`, params);
        } else {
            fetchData(
                `${CONFIG.APP_DOMAIN_FRONTEND}/v1/api/quoc-gia/${country}`,
                params,
            );
        }
    }, []); // Chỉ chạy 1 lần sau khi mount

    function buildQuery(params) {
        return Object.keys(params)
            .map((k) => `${k}=${encodeURIComponent(params[k])}`)
            .join("&");
    }

    async function fetchData(url, params = {}) {
        setIsLoading(true);
        setIsSearching(false); // Clear searching state khi bắt đầu fetch thực sự
        try {
            const qs = buildQuery(params);
            const fullUrl = `${url}?${qs}`;

            const res = await fetch(fullUrl);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }

            const json = await res.json();

            if (!json || !json.data) {
                setMovies([]);
                setTotalPages(1);
            } else {
                setMovies(json.data.items || []);
                setTotalPages(json.data.params?.pagination?.totalPages || 1);
            }
        } catch (err) {
            setMovies([]);
            setTotalPages(1);
        } finally {
            setIsLoading(false);
        }
    }

    function searchMoviesKey(e) {
        if (e.key === "Enter") {
            // Clear debounce timer để search ngay lập tức
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            setCurrentPage(1); // useEffect sẽ auto fetch khi currentPage thay đổi
        }
    }

    function getMovieImage(imagePath) {
        if (!imagePath)
            return `https://picsum.photos/2000/3000?random=${new Date().getTime()}`;
        if (imagePath.includes("https://phimimg.com/")) {
            return `https://phimapi.com/image.php?url=${imagePath}`;
        }
        return `https://phimapi.com/image.php?url=${CONFIG.APP_DOMAIN_CDN_IMAGE}/${imagePath}`;
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

    function nextPage() {
        if (currentPage < totalPages) goToPage(currentPage + 1);
    }

    function prevPage() {
        if (currentPage > 1) goToPage(currentPage - 1);
    }

    function generateVisiblePages(totalPages, currentPage) {
        const visiblePages = [];
        const range = 1;
        for (let i = currentPage - range; i <= currentPage + range; i++) {
            if (i >= 1 && i <= totalPages) visiblePages.push(i);
        }
        return visiblePages;
    }

    function goToPage(page) {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    }

    async function fetchCountries() {
        try {
            const res = await fetch(`${CONFIG.APP_DOMAIN_FRONTEND}/quoc-gia`);
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
                                value={searchKeyword}
                                onChange={(e) =>
                                    setSearchKeyword(e.target.value)
                                }
                                onKeyUp={searchMoviesKey}
                                type="text"
                                placeholder="Nhập tên phim..."
                                className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-500 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 ${
                                    (isLoading || isSearching) &&
                                    searchKeyword.trim() !== ""
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

                                                    let url = `vods/play?slug=${item.slug}`;
                                                    if (episodeKey) {
                                                        // Nếu episodeKey là slug đầy đủ (vd: "tap-4-vietsub"), extract số tập
                                                        const episodeNumber =
                                                            episodeKey.match(
                                                                /\d+/,
                                                            )?.[0] ||
                                                            episodeKey;
                                                        url += `&episode=${episodeNumber}`;
                                                    }
                                                    if (serverSlug) {
                                                        url += `&server=${serverSlug}`;
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
                                        <div
                                            className="w-full bg-gray-300"
                                            style={{ aspectRatio: "2/3" }}
                                        />
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
                                <a
                                    key={movie.slug}
                                    href={`vods/play?slug=${movie.slug}`}
                                    title={movie.name}
                                    className="group relative flex transform cursor-pointer flex-col overflow-hidden rounded-lg bg-white text-inherit no-underline shadow transition-transform hover:scale-105 hover:shadow-lg"
                                >
                                    <div className="relative bg-gray-200">
                                        <img
                                            src={getMovieImage(
                                                movie.poster_url,
                                            )}
                                            alt={movie.name}
                                            loading="lazy"
                                            className="w-full object-cover transition-opacity duration-300"
                                            style={{
                                                aspectRatio: "2/3",
                                                backgroundPosition: "center",
                                                backgroundRepeat: "no-repeat",
                                                backgroundSize: "contain",
                                            }}
                                            onLoad={(e) => {
                                                const loader =
                                                    e.target.nextElementSibling;
                                                if (loader) loader.remove();
                                            }}
                                        />
                                        <div
                                            className="bg-linear-to-b absolute inset-0 flex items-center justify-center from-gray-200 to-gray-300"
                                            style={{ aspectRatio: "2/3" }}
                                        >
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
                                                {movie.episode_current || "N/A"}
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
                            ))}
                    </div>
                </div>

                {/* Skeleton Pagination khi đang loading */}
                {isLoading && (
                    <nav className="mt-8 flex w-full flex-col items-center justify-center gap-4 sm:flex-row">
                        {/* Skeleton Pagination buttons */}
                        <div className="flex h-11 animate-pulse items-center rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
                            <ul className="flex items-center">
                                {Array.from({ length: 5 }).map((_, index) => (
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
