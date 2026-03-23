import { useState, useEffect, useMemo, useRef } from "react";
import {
    useParams,
    useNavigate,
    Link,
    useSearchParams,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useVodData } from "../../hooks/useVodData";
import { MovieGridSkeleton } from "../../components/vod/VodSkeletons";
import { useImageFallback } from "../../hooks/useImageFallback";
import VodMovieCard from "../../components/vod/VodMovieCard";
import VodCategoryMenu from "../../components/vod/VodCategoryMenu";
import VodLayout from "../../components/layout/VodLayout";
import {
    SOURCES,
    TMDB_IMAGE_BASE_URL,
    TMDB_IMAGE_SIZES,
} from "../../constants/vodConstants";
import { useAuth } from "../../contexts/AuthContext";
import {
    fetchHistoryFromFirestore,
    fetchFavoritesFromFirestore,
} from "../../services/firebaseHelpers";
import VodFilterModal from "../../components/vod/VodFilterModal";
import { useVodContext } from "../../contexts/VodContext";

const generateVisiblePages = (totalPages, currentPage) => {
    const pages = [];
    if (totalPages <= 5) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
        if (currentPage <= 3) {
            for (let i = 1; i <= 5; i++) pages.push(i);
        } else if (currentPage >= totalPages - 2) {
            for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
        } else {
            for (let i = currentPage - 2; i <= currentPage + 2; i++)
                pages.push(i);
        }
    }
    return pages;
};

export default function Listing() {
    const { country, category } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { getImageUrl } = useImageFallback();
    const { currentUser } = useAuth();
    const [historyItems, setHistoryItems] = useState([]);
    const [favoriteItems, setFavoriteItems] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [favoriteLoading, setFavoriteLoading] = useState(false);
    const {
        isFilterOpen,
        setIsFilterOpen,
        openFilter,
        favorites: rawFavorites,
    } = useVodContext();

    const isHistoryCategory = category === "history";
    const isFavoritesCategory = category === "favorites";
    const isLibraryCategory = isHistoryCategory || isFavoritesCategory;

    // Get filters from URL - Use a more robust way to get params
    const getUrlParam = (name) => {
        const fromParams = searchParams.get(name);
        if (fromParams) return fromParams;
        // Backup: parse directly from window.location in case searchParams is laggy
        return new URLSearchParams(window.location.search).get(name) || "";
    };

    const currentQuery = getUrlParam("q");
    const currentPage = parseInt(getUrlParam("page") || "1");
    const currentYear = getUrlParam("year");
    const activeSource = getUrlParam("source") || SOURCES.SOURCE_K;
    const currentCountry = getUrlParam("country") || country || "";
    const currentCategory = getUrlParam("category") || category || "";

    const normalizeLibraryItems = (rawItems) => {
        return (Array.isArray(rawItems) ? rawItems : [])
            .filter((item) => item?.slug)
            .map((item) => {
                const poster =
                    item.poster || item.poster_url || item.thumb_url || "";

                // Ưu tiên dùng trường source có sẵn, nếu không mới đoán từ server
                let itemSource = item.source;
                if (!itemSource) {
                    const server = String(item.server || "").toLowerCase();
                    itemSource = SOURCES.SOURCE_K;
                    if (
                        server.includes(SOURCES.SOURCE_O) ||
                        server.includes("source_o")
                    )
                        itemSource = SOURCES.SOURCE_O;
                    else if (
                        server.includes(SOURCES.SOURCE_C) ||
                        server.includes("source_c")
                    )
                        itemSource = SOURCES.SOURCE_C;
                }

                return {
                    ...item,
                    source: itemSource,
                    name: item.name || t("vods.unknownTitle"),
                    poster_url: poster,
                    thumb_url: poster,
                    poster,
                    thumbnail: poster,
                    quality: item.current_episode?.value || "",
                    lang: item.lang || "",
                };
            });
    };

    // Determine type and context
    let filterType = t("vods.category");
    let filterValue =
        currentCategory ||
        currentCountry ||
        (currentQuery ? t("common.search") : "");
    let type = "";
    let useV1 = false;

    if (isHistoryCategory) {
        filterType = t("vods.category");
        filterValue = t("vods.history");
    } else if (isFavoritesCategory) {
        filterType = t("vods.category");
        filterValue = t("vods.favorites");
    } else if (currentQuery) {
        // Tìm kiếm tổng hợp (Merged Search)
        filterType = t("common.search");
        filterValue = currentQuery;
        type = "tim-kiem"; // Note: Search components use their own searchCategories logic
        useV1 = true;
    } else if (currentCategory || currentCountry) {
        // Lọc theo Danh mục/Quốc gia (Single Source - có thể kèm Year)
        filterType = currentCategory ? t("vods.category") : t("vods.country");
        filterValue = currentCategory || currentCountry;
        type = currentCategory
            ? `the-loai/${currentCategory}`
            : `quoc-gia/${currentCountry}`;
        // NguonC không dùng v1/api prefix
        useV1 = activeSource !== SOURCES.SOURCE_C;
    } else if (currentYear) {
        // Lọc theo Năm (Merged Search - dùng endpoint tìm kiếm)
        filterType = t("vods.filterByYear");
        filterValue = currentYear;
        type = "tim-kiem";
        useV1 = true;
    } else {
        // Mặc định: Phim mới cập nhật
        filterType = t("vods.category");
        filterValue = t("vods.newMovies");
        type = "danh-sach/phim-moi-cap-nhat";
        useV1 = false;
    }

    // Mapping for user-friendly titles
    const displayTitle = currentQuery
        ? t("vods.resultsFor", { query: currentQuery })
        : currentYear
          ? t("vods.moviesInYear", { year: currentYear })
          : filterValue
            ? filterValue.charAt(0).toUpperCase() +
              filterValue.slice(1).replace(/-/g, " ")
            : t("vods.newMovies");

    const finalTitle =
        currentQuery || currentYear
            ? displayTitle
            : `${filterType}: ${displayTitle}`;

    // Helper to clean params - Fix: ensure no empty values go to API
    const cleanParamsForApi = (p, currentType) => {
        const cleaned = {};
        Object.entries(p).forEach(([k, v]) => {
            // Quy tắc: Nếu đã dùng endpoint chuyên biệt (the-loai, quoc-gia), không gửi lại chính nó trong params
            if (currentType?.includes("the-loai") && k === "category") return;
            if (currentType?.includes("quoc-gia") && k === "country") return;
            if (v && v.toString().trim() !== "") cleaned[k] = v;
        });
        return cleaned;
    };

    // Aggregated data fetching for filters (Search, Year, Category, Country)
    const handleFilterApply = (newFilters) => {
        const params = new URLSearchParams(searchParams);
        if (newFilters.source) params.set("source", newFilters.source);
        else params.delete("source");

        if (newFilters.country) params.set("country", newFilters.country);
        else params.delete("country");

        if (newFilters.category) params.set("category", newFilters.category);
        else params.delete("category");

        if (newFilters.year) params.set("year", newFilters.year);
        else params.delete("year");

        if (newFilters.keyword !== undefined) {
          if (newFilters.keyword.trim()) params.set("q", newFilters.keyword.trim());
          else params.delete("q");
        }

        params.set("page", "1");
        setSearchParams(params);
        setIsFilterOpen(false);
    };

    const isMergedView =
        activeSource === "all" || (!activeSource && currentQuery);

    const searchCategories = isMergedView
        ? [
              {
                  id: SOURCES.SOURCE_O,
                  title: "OPhim",
                  type: currentCategory
                      ? `the-loai/${currentCategory}`
                      : currentCountry
                        ? `quoc-gia/${currentCountry}`
                        : currentQuery || currentYear
                          ? "tim-kiem"
                          : "danh-sach/phim-moi-cap-nhat",
                  source: SOURCES.SOURCE_O,
                  useV1: !!(
                      currentQuery ||
                      currentYear ||
                      currentCategory ||
                      currentCountry
                  ),
                  page: currentPage,
                  limit: 24,
                  params: cleanParamsForApi(
                      {
                          keyword: currentQuery || currentYear, // KKPhim/OPhim often use keyword for year too in search
                          year: currentYear,
                          country: currentCountry,
                          category: currentCategory,
                      },
                      currentCategory
                          ? `the-loai/${currentCategory}`
                          : currentCountry
                            ? `quoc-gia/${currentCountry}`
                            : "",
                  ),
              },
              {
                  id: SOURCES.SOURCE_K,
                  title: "KKPhim",
                  type: currentCategory
                      ? `the-loai/${currentCategory}`
                      : currentCountry
                        ? `quoc-gia/${currentCountry}`
                        : currentQuery || currentYear
                          ? "tim-kiem"
                          : "danh-sach/phim-moi-cap-nhat",
                  source: SOURCES.SOURCE_K,
                  useV1: !!(
                      currentQuery ||
                      currentYear ||
                      currentCategory ||
                      currentCountry
                  ),
                  page: currentPage,
                  limit: 24,
                  params: cleanParamsForApi(
                      {
                          keyword: currentQuery || currentYear,
                          year: currentYear,
                          country: currentCountry,
                          category: currentCategory,
                      },
                      currentCategory
                          ? `the-loai/${currentCategory}`
                          : currentCountry
                            ? `quoc-gia/${currentCountry}`
                            : "",
                  ),
              },
              {
                  id: SOURCES.SOURCE_C,
                  title: "NguonC",
                  type: currentCategory
                      ? `the-loai/${currentCategory}`
                      : currentCountry
                        ? `quoc-gia/${currentCountry}`
                        : currentQuery
                          ? "search"
                          : currentYear
                            ? `nam-phat-hanh/${currentYear}`
                            : "phim-moi-cap-nhat",
                  source: SOURCES.SOURCE_C,
                  page: currentPage,
                  limit: 24,
                  params: cleanParamsForApi(
                      {
                          keyword: currentQuery,
                          country: currentCountry,
                      },
                      currentCategory
                          ? `the-loai/${currentCategory}`
                          : currentCountry
                            ? `quoc-gia/${currentCountry}`
                            : "",
                  ),
              },
          ]
        : isLibraryCategory
          ? []
          : [
                {
                    id: "listing",
                    title: displayTitle,
                    type: currentCategory
                        ? `the-loai/${currentCategory}`
                        : currentCountry
                          ? `quoc-gia/${currentCountry}`
                          : currentQuery || currentYear
                            ? "tim-kiem"
                            : "danh-sach/phim-moi-cap-nhat",
                    source: activeSource || SOURCES.SOURCE_K,
                    useV1: !!(
                        currentQuery ||
                        currentYear ||
                        currentCategory ||
                        currentCountry
                    ),
                    page: currentPage,
                    limit: 24,
                    params: cleanParamsForApi(
                        {
                            year: currentYear,
                            keyword: currentQuery || currentYear,
                            country: currentCountry,
                            category: currentCategory,
                        },
                        currentCategory
                            ? `the-loai/${currentCategory}`
                            : currentCountry
                              ? `quoc-gia/${currentCountry}`
                              : "",
                    ),
                },
            ];

    const { sections, loading: apiLoading } = useVodData(searchCategories);

    useEffect(() => {
        const loadHistory = async () => {
            if (!isHistoryCategory) return;

            setHistoryLoading(true);
            try {
                let rawHistory = [];

                if (currentUser?.uid) {
                    rawHistory = await fetchHistoryFromFirestore(
                        currentUser.uid,
                    );
                } else {
                    const localHistory = localStorage.getItem("viewHistory");
                    rawHistory = localHistory ? JSON.parse(localHistory) : [];
                }

                const normalizedHistory = normalizeLibraryItems(rawHistory);

                setHistoryItems(normalizedHistory);
            } catch (error) {
                console.error("Load history category error:", error);
                setHistoryItems([]);
            } finally {
                setHistoryLoading(false);
            }
        };

        loadHistory();
    }, [isHistoryCategory, currentUser?.uid]);

    useEffect(() => {
        if (!isFavoritesCategory) return;
        const normalizedFavorites = normalizeLibraryItems(rawFavorites);
        setFavoriteItems(normalizedFavorites);
        setFavoriteLoading(false);
    }, [isFavoritesCategory, rawFavorites]);

    // Aggregate items
    let items = [];
    let totalPages = 1;
    let totalItemsCount = 0;

    if (isHistoryCategory) {
        items = historyItems;
        totalPages = 1;
        totalItemsCount = historyItems.length;
    } else if (isFavoritesCategory) {
        items = favoriteItems;
        totalPages = 1;
        totalItemsCount = favoriteItems.length;
    } else if (isMergedView) {
        // Merge items from all sections and deduplicate by slug
        const mergedItems = [];
        const seenSlugs = new Set();

        // Thứ tự ưu tiên: OPhim (Source O) > KKPhim (Source K) > NguonC (Source C)
        [SOURCES.SOURCE_O, SOURCES.SOURCE_K, SOURCES.SOURCE_C].forEach((id) => {
            const section = sections[id];
            if (section && section.items) {
                section.items.forEach((item) => {
                    if (!seenSlugs.has(item.slug)) {
                        seenSlugs.add(item.slug);
                        mergedItems.push(item);
                    }
                });
            }
        });
        items = mergedItems;
        // For multi-source search, pagination is complex, take the max as a hint
        totalPages = Math.max(
            ...Object.values(sections).map((s) => s.totalPages || 1),
        );
        totalItemsCount = Math.max(
            ...Object.values(sections).map((s) => s.totalItems || 0),
        );
    } else {
        const section = sections["listing"] || {};
        items = section.items || [];
        totalPages = section.totalPages || 1;
        totalItemsCount = section.totalItems || 0;
    }

    // Scroll to top on page change
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, [currentPage]);

    // Xóa LoadingSpinner toàn trang để render Layout ngay lập tức
    // if (loading) return <LoadingSpinner isLoading={true} />;

    const section = sections["listing"] || {};
    // const items = section.items || []; // Removed, handled above
    // const totalPages = section.totalPages || 1; // Removed, handled above
    const apiMetadata = section.cat || null;

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            const newParams = new URLSearchParams(searchParams);
            newParams.set("page", newPage);
            setSearchParams(newParams);
        }
    };

    const isLoading = isHistoryCategory
        ? historyLoading
        : isFavoritesCategory
          ? favoriteLoading
          : apiLoading;

    const urlFilters = useMemo(() => ({
        source: activeSource,
        country: currentCountry,
        category: currentCategory,
        year: currentYear,
        keyword: currentQuery,
    }), [activeSource, currentCountry, currentCategory, currentYear, currentQuery]);

    // Tự động mở bộ lọc nếu là trang search
    useEffect(() => {
        const isSearchPage = window.location.pathname.endsWith("/vod/search");
        // Mở nếu là trang search (có thể mở kể cả khi có params nếu người dùng muốn search thêm)
        // Hoặc chỉ mở nếu chưa có query/filter chính
        if (isSearchPage) {
            openFilter(urlFilters);
        }
    }, []); // Chỉ chạy 1 lần duy nhất khi mount

    return (
        <VodLayout>
            <div className="px-4 pb-20 pt-24 md:px-12 lg:px-20">
                <div className="mb-12">
                    <nav className="mb-8 flex items-center gap-2 text-sm text-zinc-500">
                        <Link
                            to="/vod"
                            className="transition-colors hover:text-white"
                        >
                            VOD Hub
                        </Link>
                        <span>/</span>
                        <span className="font-bold text-white">
                            {finalTitle}
                        </span>
                    </nav>

                    <div className="mb-10">
                        <p className="mb-4 text-[10px] font-black uppercase tracking-[0.3em] text-red-600">
                            {t("vods.exploreByCategory")}
                        </p>
                        <VodCategoryMenu />
                    </div>

                    <div className="flex flex-col gap-6 border-b border-zinc-900 pb-6 md:flex-row md:items-end md:justify-between">
                        <div>
                            <h1 className="text-3xl font-black uppercase tracking-tighter text-white md:text-5xl">
                                {finalTitle}
                            </h1>
                            <div className="mt-2 flex items-center gap-4">
                                <p className="text-sm text-zinc-500">
                                    {t("vods.foundMovies", {
                                        count: totalItemsCount,
                                    })}
                                </p>
                                {!isLibraryCategory && (
                                    <button
                                        onClick={() =>
                                            openFilter({
                                                source: activeSource,
                                                country: currentCountry,
                                                category: currentCategory,
                                                year: currentYear,
                                            })
                                        }
                                        className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-bold text-zinc-400 transition-all hover:border-zinc-700 hover:text-white"
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
                                                strokeWidth="2"
                                                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                                            />
                                        </svg>
                                        {t("common.filter") || "Bộ lọc"}
                                        {(currentCountry ||
                                            currentCategory ||
                                            currentYear) && (
                                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] text-white">
                                                {
                                                    [
                                                        currentCountry,
                                                        currentCategory,
                                                        currentYear,
                                                    ].filter(Boolean).length
                                                }
                                            </span>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                                {t("vods.pageOf", {
                                    page: currentPage,
                                    totalPages,
                                })}
                            </p>
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <MovieGridSkeleton count={24} />
                ) : (
                    <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                        {items.map((movie) => (
                            <VodMovieCard
                                key={movie.slug}
                                movie={movie}
                                source={activeSource}
                                getImageUrl={getImageUrl}
                            />
                        ))}
                    </div>
                )}

                {/* Pagination UI */}
                {!isLibraryCategory && totalPages > 1 && (
                    <div className="mt-16 flex flex-col items-center gap-6">
                        <div className="flex items-center justify-center gap-2">
                            <button
                                onClick={() =>
                                    handlePageChange(currentPage - 1)
                                }
                                disabled={currentPage === 1}
                                className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 transition-all hover:border-red-600 hover:text-white disabled:opacity-30"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15 19l-7-7 7-7"
                                    />
                                </svg>
                            </button>

                            <div className="flex items-center gap-1">
                                {generateVisiblePages(
                                    totalPages,
                                    currentPage,
                                ).map((pageNum) => (
                                    <button
                                        key={pageNum}
                                        onClick={() =>
                                            handlePageChange(pageNum)
                                        }
                                        className={`h-10 w-10 rounded-full text-sm font-bold transition-all ${
                                            currentPage === pageNum
                                                ? "bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]"
                                                : "text-zinc-500 hover:bg-zinc-800 hover:text-white"
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={() =>
                                    handlePageChange(currentPage + 1)
                                }
                                disabled={currentPage === totalPages}
                                className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 transition-all hover:border-red-600 hover:text-white disabled:opacity-30"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 5l7 7-7 7"
                                    />
                                </svg>
                            </button>
                        </div>

                        {/* Quick Jump Input */}
                        <div className="flex items-center gap-3 rounded-full border border-zinc-800 bg-zinc-950/50 px-5 py-2.5 backdrop-blur-sm">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                                {t("vods.jumpTo")}
                            </span>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min="1"
                                    max={totalPages}
                                    defaultValue={currentPage}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            const val = parseInt(
                                                e.target.value,
                                            );
                                            if (val >= 1 && val <= totalPages) {
                                                handlePageChange(val);
                                            }
                                        }
                                    }}
                                    className="w-12 bg-transparent text-center text-sm font-bold text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                />
                                <span className="text-zinc-700">/</span>
                                <span className="text-sm font-bold text-zinc-500">
                                    {totalPages.toLocaleString(
                                        i18n.language === "vi"
                                            ? "vi-VN"
                                            : "en-US",
                                    )}
                                </span>
                            </div>
                            <button
                                onClick={(e) => {
                                    const input =
                                        e.currentTarget.parentElement.querySelector(
                                            "input",
                                        );
                                    const val = parseInt(input.value);
                                    if (val >= 1 && val <= totalPages) {
                                        handlePageChange(val);
                                    }
                                }}
                                className="ml-1 rounded-sm bg-zinc-800 px-2 py-1 text-[10px] font-black uppercase text-zinc-400 transition-colors hover:bg-red-600 hover:text-white"
                            >
                                {t("vods.go")}
                            </button>
                        </div>
                    </div>
                )}

                {items.length === 0 && (
                    <div className="space-y-6 py-32 text-center">
                        <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-zinc-900 text-4xl text-zinc-700">
                            !
                        </div>
                        <div className="space-y-2">
                            <p className="text-xl font-bold text-zinc-400">
                                {t("vods.noMoviesFound")}
                            </p>
                            <p className="mx-auto max-w-xs text-sm text-zinc-600">
                                Rất tiếc, chúng tôi không tìm thấy nội dung nào
                                trong danh mục này hiện tại.
                            </p>
                        </div>
                        <button
                            onClick={() => navigate("/vod")}
                            className="rounded-full bg-zinc-800 px-6 py-2 text-sm font-bold text-white transition-all hover:bg-zinc-700"
                        >
                            {t("vods.backToVodHub")}
                        </button>
                    </div>
                )}
                <VodFilterModal
                    isOpen={isFilterOpen}
                    onClose={() => setIsFilterOpen(false)}
                    onApply={handleFilterApply}
                    initialFilters={urlFilters}
                />
            </div>
        </VodLayout>
    );
}
