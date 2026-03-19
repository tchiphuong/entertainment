import { useEffect } from "react";
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
import { useState } from "react";

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

    const query = searchParams.get("q") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const year = searchParams.get("year") || "";
    const source = searchParams.get("source") || "source_k";
    const isHistoryCategory = category === "history";
    const isFavoritesCategory = category === "favorites";
    const isLibraryCategory = isHistoryCategory || isFavoritesCategory;

    const normalizeLibraryItems = (rawItems) => {
        return (Array.isArray(rawItems) ? rawItems : [])
            .filter((item) => item?.slug)
            .map((item) => {
                const poster =
                    item.poster || item.poster_url || item.thumb_url || "";
                const server = String(item.server || "").toLowerCase();

                let itemSource = SOURCES.SOURCE_K;
                if (server.includes(SOURCES.SOURCE_O))
                    itemSource = SOURCES.SOURCE_O;
                if (server.includes(SOURCES.SOURCE_C))
                    itemSource = SOURCES.SOURCE_C;

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
    let filterValue = category || country || (query ? t("common.search") : "");
    let type = filterValue;
    let useV1 = false;

    if (isHistoryCategory) {
        filterType = t("vods.category");
        filterValue = t("vods.history");
        type = "";
        useV1 = false;
    } else if (isFavoritesCategory) {
        filterType = t("vods.category");
        filterValue = t("vods.favorites");
        type = "";
        useV1 = false;
    } else if (query || year) {
        filterType = query ? t("common.search") : t("vods.filterByYear");
        filterValue = query || year;
        // PhimAPI/Ophim cần dùng endpoint tim-kiem để filter được theo năm
        type = "tim-kiem";
        useV1 = true;
    } else if (country) {
        filterType = t("vods.country");
        filterValue = country;
        type =
            source === SOURCES.SOURCE_C
                ? `quoc-gia/${country}`
                : `quoc-gia/${country}`;
        useV1 = true;
    } else if (category) {
        filterType = t("vods.category");
        filterValue = category;
        type =
            source === SOURCES.SOURCE_C
                ? `the-loai/${category}`
                : `the-loai/${category}`;
        useV1 = true;
    } else if (year && !query) {
        filterType = t("vodPlay.year");
        filterValue = year;
        type =
            source === SOURCES.SOURCE_C ? `nam-phat-hanh/${year}` : "tim-kiem";
        useV1 = true;
    } else {
        // Mặc định cho trang listing chung (không dùng V1 prefix cho phim mới cập nhật)
        type = "danh-sach/phim-moi-cap-nhat";
        useV1 = false;
    }

    // Mapping for user-friendly titles
    const displayTitle = query
        ? t("vods.resultsFor", { query })
        : year
          ? t("vods.moviesInYear", { year })
          : filterValue
            ? filterValue.charAt(0).toUpperCase() +
              filterValue.slice(1).replace(/-/g, " ")
            : t("vods.newMovies");

    const finalTitle =
        query || year ? displayTitle : `${filterType}: ${displayTitle}`;

    // Helper to clean params
    const cleanParams = (p) => {
        const cleaned = {};
        Object.entries(p).forEach(([k, v]) => {
            if (v) cleaned[k] = v;
        });
        return cleaned;
    };

    // Aggregated data fetching for search
    const searchCategories =
        query || (year && !category && !country)
            ? [
                  {
                      id: "source_k",
                      title: "Source K",
                      type: "tim-kiem",
                      source: SOURCES.SOURCE_K,
                      useV1: true,
                      page: page,
                      limit: 24,
                      params: cleanParams({ keyword: query, year: year }),
                  },
                  {
                      id: "source_o",
                      title: "Source O",
                      type: "tim-kiem",
                      source: SOURCES.SOURCE_O,
                      useV1: true,
                      page: page,
                      limit: 24,
                      params: cleanParams({ keyword: query, year: year }),
                  },
                  {
                      id: "source_c",
                      title: "Source C",
                      // NguonC: Nếu chỉ có year -> dùng endpoint nam-phat-hanh, có query -> dùng search
                      type: !query && year ? `nam-phat-hanh/${year}` : "search",
                      source: SOURCES.SOURCE_C,
                      page: page,
                      limit: 24,
                      // NguonC không hỗ trợ param year trong search endpoint
                      params: query
                          ? cleanParams({ keyword: query })
                          : cleanParams({ keyword: query, year: year }),
                  },
              ]
            : isLibraryCategory
              ? []
              : [
                    {
                        id: "listing",
                        title: displayTitle,
                        type: type,
                        source: source,
                        useV1: useV1,
                        page: page,
                        limit: 24,
                        params: cleanParams({ year: year, keyword: query }),
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
        const loadFavorites = async () => {
            if (!isFavoritesCategory) return;

            setFavoriteLoading(true);
            try {
                let rawFavorites = [];

                if (currentUser?.uid) {
                    rawFavorites = await fetchFavoritesFromFirestore(
                        currentUser.uid,
                    );
                } else {
                    const localFavorites = localStorage.getItem("favorites");
                    rawFavorites = localFavorites
                        ? JSON.parse(localFavorites)
                        : [];
                }

                const normalizedFavorites = normalizeLibraryItems(rawFavorites);
                setFavoriteItems(normalizedFavorites);
            } catch (error) {
                console.error("Load favorites category error:", error);
                setFavoriteItems([]);
            } finally {
                setFavoriteLoading(false);
            }
        };

        loadFavorites();
    }, [isFavoritesCategory, currentUser?.uid]);

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
    } else if (query) {
        // Merge items from all sections and deduplicate by slug
        const mergedItems = [];
        const seenSlugs = new Set();

        Object.values(sections).forEach((section) => {
            if (section.items) {
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
    }, [page]);

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

    const handleYearChange = (year) => {
        const newParams = new URLSearchParams(searchParams);
        if (year === "all") {
            newParams.delete("year");
        } else {
            newParams.set("year", year);
        }
        newParams.delete("q"); // Xóa từ khóa tìm kiếm khi chọn năm
        newParams.set("page", 1);
        setSearchParams(newParams);
    };

    const currentYear = searchParams.get("year") || "all";
    const years = [
        "all",
        ...Array.from({ length: 10 }, (_, i) => (2025 - i).toString()),
    ];
    const loading = isHistoryCategory
        ? historyLoading
        : isFavoritesCategory
          ? favoriteLoading
          : apiLoading;

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
                            <p className="mt-2 text-sm text-zinc-500">
                                {t("vods.foundMovies", { count: totalItemsCount })}
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                            <div className="space-y-2">
                                {!isLibraryCategory && (
                                    <>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                                            {t("vods.filterByYear")}
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {years.map((y) => (
                                                <button
                                                    key={y}
                                                    onClick={() =>
                                                        handleYearChange(y)
                                                    }
                                                    className={`rounded px-3 py-1 text-[10px] font-bold transition-all ${
                                                        currentYear === y
                                                            ? "bg-white text-black"
                                                            : "bg-zinc-900 text-zinc-500 hover:bg-zinc-800 hover:text-white"
                                                    }`}
                                                >
                                                    {y === "all" ? t("common.all") : y}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="hidden text-right md:block">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                                    {t("vods.pageOf", { page, totalPages })}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <MovieGridSkeleton count={24} />
                ) : (
                    <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                        {items.map((movie) => (
                            <VodMovieCard
                                key={movie.slug}
                                movie={movie}
                                source={source}
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
                                onClick={() => handlePageChange(page - 1)}
                                disabled={page === 1}
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
                                {[...Array(Math.min(5, totalPages))].map(
                                    (_, i) => {
                                        let pageNum;
                                        if (totalPages <= 5) {
                                            pageNum = i + 1;
                                        } else if (page <= 3) {
                                            pageNum = i + 1;
                                        } else if (page >= totalPages - 2) {
                                            pageNum = totalPages - 4 + i;
                                        } else {
                                            pageNum = page - 2 + i;
                                        }

                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() =>
                                                    handlePageChange(pageNum)
                                                }
                                                className={`h-10 w-10 rounded-full text-sm font-bold transition-all ${
                                                    page === pageNum
                                                        ? "bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]"
                                                        : "text-zinc-500 hover:bg-zinc-800 hover:text-white"
                                                }`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    },
                                )}
                            </div>

                            <button
                                onClick={() => handlePageChange(page + 1)}
                                disabled={page === totalPages}
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
                                    defaultValue={page}
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
                                    {totalPages.toLocaleString(i18n.language === "vi" ? "vi-VN" : "en-US")}
                                </span>
                            </div>
                            <button
                                onClick={(e) => {
                                    const input =
                                        e.currentTarget.previousSibling.querySelector(
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
            </div>
        </VodLayout>
    );
}
