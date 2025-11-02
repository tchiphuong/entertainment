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
    const navigate = useNavigate();

    const countriesFetchedRef = useRef(false);
    const isInitialMount = useRef(true);

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

            // Set new debounce timer (500ms delay)
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
            }, 500);
        }

        // Cleanup on unmount
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
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
        try {
            const qs = buildQuery(params);
            const fullUrl = `${url}?${qs}`;
            console.log("Fetching:", fullUrl);

            const res = await fetch(fullUrl);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }

            const json = await res.json();
            console.log("Response:", json);

            if (!json || !json.data) {
                console.warn("No data in response:", json);
                setMovies([]);
                setTotalPages(1);
            } else {
                setMovies(json.data.items || []);
                setTotalPages(json.data.params?.pagination?.totalPages || 1);
            }
        } catch (err) {
            console.error("Error fetching data:", err);
            setMovies([]);
            setTotalPages(1);
        } finally {
            setIsLoading(false);
        }
    }

    function searchMoviesKey(e) {
        if (e.key === "Enter") {
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
        setHistory(
            h.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
        );
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

    function openMovie(slug) {
        navigate(`/vods/play?slug=${slug}`);
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
            console.error("Error fetching countries:", err);
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
                        <div className="flex-1">
                            <input
                                value={searchKeyword}
                                onChange={(e) =>
                                    setSearchKeyword(e.target.value)
                                }
                                onKeyUp={searchMoviesKey}
                                type="text"
                                placeholder="Nhập tên phim..."
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-500 shadow-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                        </div>
                        <div className="flex-1 sm:w-48 sm:flex-none">
                            {(() => {
                                const countryOptions = countries.map((c) => ({
                                    value: c.slug,
                                    label: c.name,
                                }));
                                return (
                                    <Select
                                        options={countryOptions}
                                        value={
                                            countryOptions.find(
                                                (o) => o.value === country,
                                            ) || null
                                        }
                                        onChange={(opt) => {
                                            const val = opt ? opt.value : "";
                                            const newCountry =
                                                val || "viet-nam";
                                            setCountry(newCountry);
                                            setCurrentPage(1);
                                            setSearchKeyword("");
                                        }}
                                        placeholder="Chọn"
                                        isClearable
                                    />
                                );
                            })()}
                        </div>
                        <button
                            onClick={toggleHistory}
                            className="flex transform items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow transition-all duration-300 ease-in-out hover:bg-blue-700 hover:shadow-lg active:scale-95"
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
                                {history.length === 0 && (
                                    <li className="flex items-center justify-center py-12 text-gray-400">
                                        Oops~ Bạn chưa xem phim nào cả! 🥺
                                    </li>
                                )}
                                {history.map((item, idx) => (
                                    <li
                                        key={idx}
                                        className="group flex cursor-pointer items-center gap-4 px-6 py-3 transition-colors hover:bg-blue-50"
                                        onClick={() =>
                                            navigate(
                                                `/vods/play?slug=${item.slug}&episode=${item.lastWatchedEpisode?.key}`,
                                            )
                                        }
                                    >
                                        <img
                                            src={`https://phimapi.com/image.php?url=${item.poster}`}
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
                                                        item.timestamp,
                                                    ).toLocaleDateString(
                                                        "vi-VN",
                                                    )}
                                                </span>
                                                <span>•</span>
                                                <span>
                                                    {new Date(
                                                        item.timestamp,
                                                    ).toLocaleTimeString(
                                                        "vi-VN",
                                                    )}
                                                </span>
                                            </div>
                                            <div className="mt-1 text-xs font-medium text-blue-600">
                                                Đã xem:{" "}
                                                {item.lastWatchedEpisode
                                                    ?.value || "N/A"}
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteHistoryItem(item.slug, e);
                                            }}
                                            className="rounded p-1 text-gray-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
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
                        {!isLoading && movies.length === 0 && (
                            <div className="col-span-full py-4 text-center text-gray-500">
                                Oops~ Không có phim nào trong danh sách của bạn!
                                🥺
                            </div>
                        )}

                        {movies.map((movie) => (
                            <div
                                key={movie.slug}
                                title={movie.name}
                                className="group relative flex transform cursor-pointer flex-col overflow-hidden rounded-lg bg-white shadow transition-transform hover:scale-105 hover:shadow-lg"
                                onClick={() => openMovie(movie.slug)}
                            >
                                <div className="relative bg-gray-200">
                                    <img
                                        src={getMovieImage(movie.poster_url)}
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
                                    <p className="mt-2 text-xs text-gray-500">
                                        {movie.episode_current || "N/A"}
                                    </p>
                                </div>
                                <span className="absolute right-2 top-2 inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
                                    {movie.quality}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {movies.length > 0 && (
                    <nav className="mt-4 flex w-full items-center justify-center">
                        <ul className="flex h-10 items-center text-base">
                            {currentPage > 1 && (
                                <li>
                                    <button
                                        onClick={() => goToPage(1)}
                                        className="mx-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border text-gray-500 hover:bg-gray-50"
                                    >
                                        «
                                    </button>
                                </li>
                            )}

                            {currentPage > 1 && (
                                <li>
                                    <button
                                        onClick={prevPage}
                                        className="mx-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border text-gray-500 hover:bg-gray-50"
                                    >
                                        ‹
                                    </button>
                                </li>
                            )}

                            {generateVisiblePages(totalPages, currentPage).map(
                                (page) => (
                                    <li key={page}>
                                        <button
                                            onClick={() =>
                                                page !== currentPage &&
                                                goToPage(page)
                                            }
                                            disabled={page === currentPage}
                                            className={`mx-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border ${page === currentPage ? "scale-110 border-blue-500 bg-blue-500 text-white shadow-md" : "text-gray-500 hover:bg-gray-50"}`}
                                        >
                                            {page}
                                        </button>
                                    </li>
                                ),
                            )}

                            {currentPage < totalPages && (
                                <li>
                                    <button
                                        onClick={nextPage}
                                        className="mx-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border text-gray-500 hover:bg-gray-50"
                                    >
                                        ›
                                    </button>
                                </li>
                            )}

                            {currentPage < totalPages && (
                                <li>
                                    <button
                                        onClick={() => goToPage(totalPages)}
                                        className="mx-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border text-gray-500 hover:bg-gray-50"
                                    >
                                        »
                                    </button>
                                </li>
                            )}
                        </ul>
                    </nav>
                )}
            </main>
        </div>
    );
}
