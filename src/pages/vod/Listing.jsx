import { useState, useEffect, useRef, useCallback } from "react";
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
import VodLayout from "../../components/layout/VodLayout";
import clsx from "clsx";
import { useVodContext } from "../../contexts/VodContext";
import {
    SOURCES,
    SOURCE_C_COUNTRIES,
    SOURCE_C_CATEGORIES,
    FILTER_YEARS,
    FILTER_SOURCES,
    FILTER_TYPE_LIST,
} from "../../constants/vodConstants";
import { useAuth } from "../../contexts/AuthContext";
import {
    fetchHistoryFromFirestore,
    dedupeHistory,
} from "../../services/firebaseHelpers";
import { getMovieUniqueKey } from "../../utils/vodHelpers";
import { tmdbService } from "../../services/vod/tmdbService";
import ActorAvatar from "../../components/vod/ActorAvatar";

const filterMetadataCache = new Map();

const generateVisiblePages = (totalPages, currentPage) => {
    const pages = [];
    if (totalPages <= 5) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else if (currentPage <= 3) {
        for (let i = 1; i <= 5; i++) pages.push(i);
    } else if (currentPage >= totalPages - 2) {
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
        for (let i = currentPage - 2; i <= currentPage + 2; i++)
            pages.push(i);
    }
    return pages;
};

const fetchWithFallback = async (url) => {
    try {
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            return data?.items || data?.data?.items || data?.result || [];
        }
    } catch (e) {
        console.error("Fetch merged filter failed:", e);
    }
    return [];
};

const mergeLists = (list1, list2, list3) => {
    const map = new Map();
    for (const item of [...list1, ...list2, ...list3]) {
        if (item?.slug && item?.name) {
            map.set(item.slug, {
                slug: item.slug,
                name: item.name,
            });
        }
    }
    return Array.from(map.values()).sort((a, b) =>
        a.name.localeCompare(b.name, "vi")
    );
};

const fetchFallbackMetadata = async (setAvailableCategories, setAvailableCountries) => {
    try {
        const [gRes, cRes] = await Promise.all([
            fetch(`${import.meta.env.VITE_SOURCE_K_API}/the-loai`),
            fetch(`${import.meta.env.VITE_SOURCE_K_API}/quoc-gia`),
        ]);
        const [gData, cData] = await Promise.all([gRes.json(), cRes.json()]);
        if (gData?.items) setAvailableCategories(gData.items);
        if (cData?.items) setAvailableCountries(cData.items);
    } catch (fallbackError) {
        console.error("Fallback metadata fetch failed:", fallbackError);
    }
};

const getMergedMetadata = async () => {
    const [kGenres, kCountries, oGenres, oCountries] = await Promise.all([
        fetchWithFallback(`${import.meta.env.VITE_SOURCE_K_API}/the-loai`),
        fetchWithFallback(`${import.meta.env.VITE_SOURCE_K_API}/quoc-gia`),
        fetchWithFallback(`${import.meta.env.VITE_SOURCE_O_API}/v1/api/the-loai`),
        fetchWithFallback(`${import.meta.env.VITE_SOURCE_O_API}/v1/api/quoc-gia`),
    ]);

    return {
        genres: mergeLists(SOURCE_C_CATEGORIES, kGenres, oGenres),
        countries: mergeLists(SOURCE_C_COUNTRIES, kCountries, oCountries),
    };
};

const getSourceCMetadata = () => {
    const sortedCat = [...SOURCE_C_CATEGORIES].sort((a, b) =>
        a.name.localeCompare(b.name, "vi")
    );
    const sortedCou = [...SOURCE_C_COUNTRIES].sort((a, b) =>
        a.name.localeCompare(b.name, "vi")
    );
    return { genres: sortedCat, countries: sortedCou };
};

const getSingleSourceMetadata = async (sourceId) => {
    let domain = "";
    let genresPath = "/v1/api/the-loai";
    let countriesPath = "/v1/api/quoc-gia";

    if (sourceId === SOURCES.SOURCE_K) {
        domain = import.meta.env.VITE_SOURCE_K_API;
        genresPath = "/the-loai";
        countriesPath = "/quoc-gia";
    } else if (sourceId === SOURCES.SOURCE_O) {
        domain = import.meta.env.VITE_SOURCE_O_API;
    }

    if (!domain) throw new Error("No domain for source");

    const [gRes, cRes] = await Promise.all([
        fetch(`${domain}${genresPath}`),
        fetch(`${domain}${countriesPath}`),
    ]);

    const gData = gRes.ok ? await gRes.json() : null;
    const cData = cRes.ok ? await cRes.json() : null;

    const genreItems = gData?.items || gData?.data?.items || gData?.result || [];
    const countryItems = cData?.items || cData?.data?.items || cData?.result || [];

    const newGenres = genreItems
        .map((i) => ({ slug: i.slug, name: i.name }))
        .sort((a, b) => a.name.localeCompare(b.name, "vi"));
    const newCountries = countryItems
        .map((i) => ({ slug: i.slug, name: i.name }))
        .sort((a, b) => a.name.localeCompare(b.name, "vi"));

    return { genres: newGenres, countries: newCountries };
};

export const buildSourceKOConfig = (sourceId, paramsContext) => {
    const {
        currentQuery,
        currentYear,
        currentCategory,
        currentCountry,
        activeListContext,
    } = paramsContext;

    let typeVal;
    let useV1Val = false;
    let urlParams = {};

    if (currentQuery) {
        typeVal = "tim-kiem";
        useV1Val = true;
        urlParams = {
            keyword: currentQuery,
            year: currentYear,
            category: currentCategory,
            country: currentCountry,
        };
    } else if (activeListContext) {
        const isNonV1 = [
            "phim-bo-dang-chieu",
            "phim-bo-hoan-thanh",
            "phim-sap-chieu",
        ].includes(activeListContext);
        typeVal = `danh-sach/${activeListContext}`;
        useV1Val = !isNonV1;
        if (!isNonV1) {
            urlParams = {
                year: currentYear,
                country: currentCountry,
                category: currentCategory,
            };
        }
    } else if (currentCategory) {
        typeVal = `the-loai/${currentCategory}`;
        useV1Val = true;
        urlParams = { year: currentYear, country: currentCountry };
    } else if (currentCountry) {
        typeVal = `quoc-gia/${currentCountry}`;
        useV1Val = true;
        urlParams = { year: currentYear };
    } else if (currentYear) {
        typeVal =
            sourceId === SOURCES.SOURCE_O
                ? `nam-phat-hanh/${currentYear}`
                : `nam/${currentYear}`;
        useV1Val = true;
    } else {
        typeVal = "danh-sach/phim-moi-cap-nhat";
    }

    return { typeVal, useV1Val, urlParams };
};

export const buildSourceCConfig = (paramsContext) => {
    const {
        currentQuery,
        currentYear,
        currentCategory,
        currentCountry,
        activeListContext,
    } = paramsContext;

    if (
        currentCountry &&
        !SOURCE_C_COUNTRIES.some((c) => c.slug === currentCountry)
    ) {
        return null;
    }
    if (
        currentCategory &&
        !SOURCE_C_CATEGORIES.some((c) => c.slug === currentCategory)
    ) {
        return null;
    }

    const activeFiltersCount = [
        activeListContext,
        currentCategory,
        currentCountry,
        currentYear,
        currentQuery,
    ].filter(Boolean).length;
    if (activeFiltersCount > 1) {
        return null;
    }

    let typeVal;
    let urlParams = {};

    if (currentQuery) {
        typeVal = "search";
        urlParams = { keyword: currentQuery };
    } else if (activeListContext) {
        typeVal = `danh-sach/${activeListContext}`;
    } else if (currentCategory) {
        typeVal = `the-loai/${currentCategory}`;
    } else if (currentCountry) {
        typeVal = `quoc-gia/${currentCountry}`;
    } else if (currentYear) {
        typeVal = `nam-phat-hanh/${currentYear}`;
    } else {
        typeVal = "phim-moi-cap-nhat";
    }

    return { typeVal, useV1Val: false, urlParams };
};

export const buildSourceConfig = (sourceId, paramsContext, overrides = {}) => {
    const { currentPage, pageSize } = paramsContext;

    let configResult = null;

    if (sourceId === SOURCES.SOURCE_K || sourceId === SOURCES.SOURCE_O) {
        configResult = buildSourceKOConfig(sourceId, paramsContext);
    } else if (sourceId === SOURCES.SOURCE_C) {
        configResult = buildSourceCConfig(paramsContext);
    } else if (sourceId === SOURCES.SOURCE_TMDB) {
        const timeframe = paramsContext.timeframe || "week";
        let tmdbTypeVal = "trending/all/week";
        if (timeframe === "day") tmdbTypeVal = "trending/all/day";
        else if (timeframe === "month") tmdbTypeVal = "movie/popular";

        configResult = {
            typeVal: tmdbTypeVal,
            useV1Val: false,
            urlParams: { region: "VN" },
        };
    }

    if (!configResult) return null;

    const { typeVal, useV1Val, urlParams } = configResult;

    const cleanParams = {};
    Object.entries(urlParams).forEach(([k, v]) => {
        if (v && v.toString().trim() !== "") cleanParams[k] = v;
    });

    return {
        id: overrides.id || sourceId,
        title: overrides.title || sourceId,
        type: typeVal,
        source: sourceId,
        useV1: useV1Val,
        page: currentPage,
        limit: pageSize,
        params: cleanParams,
    };
};

export const aggregateItems = ({
    isHistoryCategory,
    historyItems,
    isFavoritesCategory,
    favoriteItems,
    currentActor,
    actorMovies,
    currentPage = 1,
    pageSize = 24,
    isMergedView,
    sections,
    SOURCES,
}) => {
    let items;
    let totalPages = 1;
    let totalItemsCount;

    if (isHistoryCategory) {
        items = historyItems;
        totalItemsCount = historyItems.length;
    } else if (isFavoritesCategory) {
        items = favoriteItems;
        totalItemsCount = favoriteItems.length;
    } else if (currentActor && actorMovies && actorMovies.length > 0) {
        totalItemsCount = actorMovies.length;
        totalPages = Math.ceil(actorMovies.length / pageSize) || 1;
        const startIndex = (currentPage - 1) * pageSize;
        items = actorMovies.slice(startIndex, startIndex + pageSize);
    } else if (isMergedView) {
        const mergedItems = [];
        const seenKeys = new Set();

        [SOURCES.SOURCE_O, SOURCES.SOURCE_K, SOURCES.SOURCE_C].forEach((id) => {
            const section = sections[id];
            if (section?.items) {
                section.items.forEach((item) => {
                    const uniqueKey = getMovieUniqueKey(item);
                    if (uniqueKey && !seenKeys.has(uniqueKey)) {
                        seenKeys.add(uniqueKey);
                        mergedItems.push({
                            ...item,
                            source: item.source || id,
                        });
                    }
                });
            }
        });
        items = mergedItems;
        const sectionValues = Object.values(sections);
        totalPages =
            sectionValues.length > 0
                ? Math.max(...sectionValues.map((s) => s.totalPages || 1))
                : 1;
        totalItemsCount =
            sectionValues.length > 0
                ? Math.max(...sectionValues.map((s) => s.totalItems || 0))
                : 0;
    } else {
        const section = sections["listing"] || {};
        items = section.items || [];
        totalPages = section.totalPages || 1;
        totalItemsCount = section.totalItems || 0;
    }

    return { items, totalPages, totalItemsCount };
};

const SKELETON_COUNTRIES = Array.from({ length: 8 }, (_, i) => `country-skel-${i}`);
const SKELETON_CATEGORIES = Array.from({ length: 10 }, (_, i) => `category-skel-${i}`);

export const normalizeLibraryItems = (rawItems, t) => {
    return (Array.isArray(rawItems) ? rawItems : [])
        .filter((item) => item?.slug)
        .map((item) => {
            const poster =
                item.poster || item.poster_url || item.thumb_url || "";

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

export const getSlugName = (slug, list) => {
    if (!slug) return "";
    const item = list?.find((i) => i.slug === slug);
    return item
        ? item.name
        : slug
              .split("-")
              .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
              .join(" ");
};

const getCategoryAndTypeParts = (activeListContext, currentCategory, availableCategories, t) => {
    if (currentCategory === "top-view" || activeListContext === "top-view") {
        return [t("vods.topViews") || "Top Lượt Xem"];
    }
    const parts = [];
    if (activeListContext) {
        parts.push(getSlugName(activeListContext, FILTER_TYPE_LIST));
    }
    if (currentCategory) {
        parts.push(`Thể loại: ${getSlugName(currentCategory, availableCategories)}`);
    }
    return parts;
};

export const generateListingTitle = ({
    currentQuery,
    currentActor,
    activeListContext,
    currentCategory,
    currentCountry,
    currentYear,
    isHistoryCategory,
    isFavoritesCategory,
    availableCategories,
    availableCountries,
    t,
}) => {
    if (currentActor) {
        return t("vods.actorResults", { name: currentActor }) || `Diễn viên: ${currentActor}`;
    }
    if (currentQuery) {
        return t("vods.resultsFor", { query: currentQuery }) || `Tìm kiếm: ${currentQuery}`;
    }
    if (isHistoryCategory) {
        return t("vods.history") || "Lịch sử xem phim";
    }
    if (isFavoritesCategory) {
        return t("vods.favorites") || "Phim yêu thích";
    }

    const titleParts = [
        ...getCategoryAndTypeParts(activeListContext, currentCategory, availableCategories, t),
    ];

    if (currentCountry) {
        titleParts.push(`Quốc gia: ${getSlugName(currentCountry, availableCountries)}`);
    }
    if (currentYear) {
        titleParts.push(`Năm: ${currentYear}`);
    }

    if (titleParts.length === 0) {
        titleParts.push(t("vods.newMovies") || "Phim mới cập nhật");
    }

    return titleParts.join(" • ");
};

export const getUpdatedSearchParams = (currentParams, key, value) => {
    const params = new URLSearchParams(currentParams);
    const current = params.get(key) || "";
    if (current === value && key !== "source") {
        params.delete(key);
    } else if (key === "source" && value === "all") {
        params.delete(key);
    } else if (!value) {
        params.delete(key);
    } else {
        params.set(key, value);
    }
    params.set("page", "1");
    return params;
};

export const useVodMetadata = (activeSource, filterMetadataCache) => {
    const [availableCategories, setAvailableCategories] = useState([]);
    const [availableCountries, setAvailableCountries] = useState([]);
    const [metadataLoading, setMetadataLoading] = useState(false);

    useEffect(() => {
        const fetchMetadata = async () => {
            const cacheKey = activeSource || "all";
            if (filterMetadataCache.has(cacheKey)) {
                const cachedData = filterMetadataCache.get(cacheKey);
                if (!cachedData.isError) {
                    setAvailableCategories(cachedData.genres);
                    setAvailableCountries(cachedData.countries);
                }
                setMetadataLoading(false);
                return;
            }

            setMetadataLoading(true);
            try {
                let metadata;
                if (activeSource === "all" || !activeSource) {
                    metadata = await getMergedMetadata();
                } else if (activeSource === SOURCES.SOURCE_C) {
                    metadata = getSourceCMetadata();
                } else {
                    metadata = await getSingleSourceMetadata(activeSource);
                }

                const isError = metadata.genres.length === 0 && metadata.countries.length === 0;
                filterMetadataCache.set(cacheKey, { 
                    genres: metadata.genres, 
                    countries: metadata.countries,
                    isError
                });

                setAvailableCategories(metadata.genres);
                setAvailableCountries(metadata.countries);
            } catch (error) {
                console.error("Error fetching source metadata:", error);
                filterMetadataCache.set(activeSource || "all", { 
                    genres: [], 
                    countries: [],
                    isError: true 
                });

                if (activeSource !== SOURCES.SOURCE_K) {
                    await fetchFallbackMetadata(setAvailableCategories, setAvailableCountries);
                }
            } finally {
                setMetadataLoading(false);
            }
        };

        fetchMetadata();
    }, [activeSource, filterMetadataCache]);

    return { availableCategories, availableCountries, metadataLoading };
};

export const useVodHistory = (isHistoryCategory, currentUser, t) => {
    const [historyItems, setHistoryItems] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    useEffect(() => {
        const loadHistory = async () => {
            if (!isHistoryCategory) return;

            setHistoryLoading(true);
            try {
                let rawHistory = [];
                if (currentUser?.uid) {
                    rawHistory = await fetchHistoryFromFirestore(currentUser.uid);
                } else {
                    const localHistory = localStorage.getItem("viewHistory");
                    rawHistory = localHistory ? JSON.parse(localHistory) : [];
                }

                const dedupedHistory = dedupeHistory(rawHistory);
                setHistoryItems(normalizeLibraryItems(dedupedHistory, t));
            } catch (error) {
                console.error("Load history category error:", error);
                setHistoryItems([]);
            } finally {
                setHistoryLoading(false);
            }
        };

        loadHistory();
    }, [isHistoryCategory, currentUser?.uid, t]);

    return { historyItems, historyLoading };
};

export const useVodFavorites = (isFavoritesCategory, rawFavorites, t) => {
    const [favoriteItems, setFavoriteItems] = useState([]);
    const [favoriteLoading, setFavoriteLoading] = useState(false);

    useEffect(() => {
        if (!isFavoritesCategory) return;
        setFavoriteItems(normalizeLibraryItems(rawFavorites, t));
        setFavoriteLoading(false);
    }, [isFavoritesCategory, rawFavorites, t]);

    return { favoriteItems, favoriteLoading };
};

export const useActorDetail = (currentActor, searchParams) => {
    const [actorDetail, setActorDetail] = useState(null);
    const [actorMovies, setActorMovies] = useState([]);
    const [actorLoading, setActorLoading] = useState(false);

    useEffect(() => {
        if (!currentActor) {
            setActorDetail(null);
            setActorMovies([]);
            return;
        }

        const isNumericId = /^\d+$/.test(currentActor);
        setActorLoading(true);

        const loadData = async () => {
            try {
                let personId = isNumericId ? currentActor : null;

                if (!personId) {
                    const baseUrl = import.meta.env.VITE_TMDB_BASE_URL;
                    const apiKey = import.meta.env.VITE_TMDB_API_KEY;
                    const searchUrl = `${baseUrl}/search/person?api_key=${apiKey}&query=${encodeURIComponent(currentActor)}&language=vi-VN`;
                    const sRes = await fetch(searchUrl);
                    if (sRes.ok) {
                        const sData = await sRes.json();
                        if (sData.results?.[0]?.id) {
                            personId = sData.results[0].id;
                        }
                    }
                }

                if (personId) {
                    const [detail, credits] = await Promise.all([
                        tmdbService.fetchTMDBPersonDetail(personId),
                        tmdbService.fetchTMDBPersonCredits(personId),
                    ]);
                    if (detail) setActorDetail(detail);
                    if (credits?.items?.length) setActorMovies(credits.items);
                } else {
                    setActorDetail({
                        name: currentActor,
                        profile_path: null,
                    });
                }
            } catch (err) {
                console.error("Error loading actor data:", err);
            } finally {
                setActorLoading(false);
            }
        };

        loadData();
    }, [currentActor]);

    const actorName = actorDetail?.name || searchParams.get("name") || currentActor || "";

    return { actorDetail, actorMovies, actorLoading, actorName };
};

export const useSearchInput = (currentQuery, searchParams, setSearchParams) => {
    const [searchInput, setSearchInput] = useState(currentQuery || "");
    const searchTimerRef = useRef(null);
    const searchInputRef = useRef(null);

    useEffect(() => {
        setSearchInput(currentQuery || "");
    }, [currentQuery]);

    const clearAllFilters = useCallback(() => {
        const params = new URLSearchParams();
        if (searchInput.trim()) params.set("q", searchInput.trim());
        params.set("page", "1");
        setSearchParams(params);
    }, [searchInput, setSearchParams]);

    const handleSearchChange = useCallback(
        (value) => {
            setSearchInput(value);
            if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

            searchTimerRef.current = setTimeout(() => {
                const params = new URLSearchParams(searchParams);
                if (value.trim()) {
                    params.set("q", value.trim());
                } else {
                    params.delete("q");
                }
                params.set("page", "1");
                params.delete("source");
                setSearchParams(params);
            }, 600);
        },
        [searchParams, setSearchParams],
    );

    const handleSearchSubmit = useCallback(
        (e) => {
            e.preventDefault();
            if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
            const params = new URLSearchParams(searchParams);
            if (searchInput.trim()) {
                params.set("q", searchInput.trim());
            } else {
                params.delete("q");
            }
            params.set("page", "1");
            params.delete("source");
            setSearchParams(params);
        },
        [searchInput, searchParams, setSearchParams],
    );

    const clearSearch = useCallback(() => {
        setSearchInput("");
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        const params = new URLSearchParams(searchParams);
        params.delete("q");
        params.set("page", "1");
        setSearchParams(params);
        searchInputRef.current?.focus();
    }, [searchParams, setSearchParams]);

    useEffect(() => {
        return () => {
            if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        };
    }, []);

    return {
        searchInput,
        searchInputRef,
        handleSearchChange,
        handleSearchSubmit,
        clearSearch,
        clearAllFilters,
    };
};

const DANH_SACH_TYPES = new Set([
    "phim-bo",
    "phim-le",
    "hoat-hinh",
    "tv-shows",
    "phim-vietsub",
    "phim-thuyet-minh",
    "phim-long-tieng",
    "phim-bo-dang-chieu",
    "phim-bo-hoan-thanh",
    "phim-sap-chieu",
]);

export const useListingParams = (category, country, searchParams, actor = "") => {
    const getUrlParam = (name) => {
        const fromParams = searchParams.get(name);
        if (fromParams) return fromParams;
        return new URLSearchParams(window.location.search).get(name) || "";
    };

    const currentActor = getUrlParam("actor") || actor || "";
    const rawQuery = getUrlParam("q");
    const currentQuery = rawQuery || currentActor;
    const currentPage = Number.parseInt(getUrlParam("page") || "1");
    const currentYear = getUrlParam("year");
    const activeSource = getUrlParam("source") || "all";
    const currentCountry = getUrlParam("country") || country || "";

    const isListType = category && DANH_SACH_TYPES.has(category);
    const activeListContext = getUrlParam("type_list") || (isListType ? category : "");
    const currentCategory = getUrlParam("category") || (isListType ? "" : category) || "";

    const isHistoryCategory = category === "history";
    const isFavoritesCategory = category === "favorites";
    const isLibraryCategory = isHistoryCategory || isFavoritesCategory;
    
    const isMergedView = activeSource === "all" || (!activeSource && currentQuery);
    const currentTimeframe = getUrlParam("timeframe") || "week";

    return {
        currentQuery,
        currentActor,
        currentPage,
        currentYear,
        activeSource,
        currentCountry,
        activeListContext,
        currentCategory,
        isHistoryCategory,
        isFavoritesCategory,
        isLibraryCategory,
        isMergedView,
        currentTimeframe,
    };
};

export const getRawSearchCategories = ({
    currentActor,
    isMergedView,
    isLibraryCategory,
    activeSource,
    paramsContext,
    finalTitle,
    SOURCES,
}) => {
    if (currentActor) return [];
    if (isMergedView) {
        return [
            buildSourceConfig(SOURCES.SOURCE_K, paramsContext, { title: "Source K" }),
            buildSourceConfig(SOURCES.SOURCE_C, paramsContext, { title: "Source C" }),
            // buildSourceConfig(SOURCES.SOURCE_O, paramsContext, { title: "Source O" }), // Tạm disabled
        ];
    }
    if (!isLibraryCategory) {
        return [
            buildSourceConfig(activeSource || SOURCES.SOURCE_K, paramsContext, {
                id: "listing",
                title: finalTitle,
            }),
        ];
    }
    return [];
};

export const computeListingLoading = ({
    isHistoryCategory,
    historyLoading,
    isFavoritesCategory,
    favoriteLoading,
    currentActor,
    actorLoading,
    apiLoading,
}) => {
    if (isHistoryCategory) return historyLoading;
    if (isFavoritesCategory) return favoriteLoading;
    if (currentActor) return actorLoading;
    return apiLoading;
};

export default function Listing() {
    const { country, category, actor } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();

    const pageSize = 24;
    const { getImageUrl, handleImageError } = useImageFallback();
    const { currentUser } = useAuth();
    const { favorites: rawFavorites } = useVodContext();
    const [showFilters, setShowFilters] = useState(false);

    const {
        currentQuery,
        currentActor,
        currentPage,
        currentYear,
        activeSource,
        currentCountry,
        activeListContext,
        currentCategory,
        isHistoryCategory,
        isFavoritesCategory,
        isLibraryCategory,
        isMergedView,
        currentTimeframe,
    } = useListingParams(category, country, searchParams, actor);

    // Hooks thay thế logic tải Lịch sử và Yêu thích
    const { availableCategories, availableCountries, metadataLoading } = useVodMetadata(activeSource, filterMetadataCache);
    const { historyItems, historyLoading } = useVodHistory(isHistoryCategory, currentUser, t);
    const { favoriteItems, favoriteLoading } = useVodFavorites(isFavoritesCategory, rawFavorites, t);
    const { actorDetail, actorMovies, actorLoading, actorName } = useActorDetail(currentActor, searchParams);

    const effectiveQuery = currentActor ? (actorName || currentQuery) : currentQuery;

    const finalTitle = generateListingTitle({
        currentQuery: effectiveQuery,
        currentActor: actorName || currentActor,
        activeListContext,
        currentCategory,
        currentCountry,
        currentYear,
        isHistoryCategory,
        isFavoritesCategory,
        availableCategories,
        availableCountries,
        t,
    });

    // Xử lý chọn filter inline (toggle)
    const handleFilterSelect = useCallback(
        (key, value) => {
            setSearchParams(getUpdatedSearchParams(searchParams, key, value));
        },
        [searchParams, setSearchParams],
    );

    const paramsContext = {
        currentQuery: effectiveQuery,
        currentYear,
        currentCategory,
        currentCountry,
        activeListContext,
        currentPage,
        pageSize,
        timeframe: currentTimeframe,
    };

    const rawSearchCategories = getRawSearchCategories({
        currentActor,
        isMergedView,
        isLibraryCategory,
        activeSource,
        paramsContext,
        finalTitle,
        SOURCES,
    });
    const searchCategories = rawSearchCategories.filter(Boolean);

    const { sections, loading: apiLoading } = useVodData(searchCategories);

    // Aggregate items
    const { items, totalPages, totalItemsCount } = aggregateItems({
        isHistoryCategory,
        historyItems,
        isFavoritesCategory,
        favoriteItems,
        currentActor,
        actorMovies,
        currentPage,
        pageSize,
        isMergedView,
        sections,
        SOURCES,
    });

    // Scroll to top on page change
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, [currentPage]);

    // Cập nhật tiêu đề trang động
    useEffect(() => {
        document.title = `${finalTitle || "Danh Mục"} • VOD Hub`;
    }, [finalTitle]);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            const newParams = new URLSearchParams(searchParams);
            newParams.set("page", newPage);
            setSearchParams(newParams);
        }
    };

    const isLoading = computeListingLoading({
        isHistoryCategory,
        historyLoading,
        isFavoritesCategory,
        favoriteLoading,
        currentActor,
        actorLoading,
        apiLoading,
    });

    // Thanh tìm kiếm inline với debounce
    const {
        searchInput,
        searchInputRef,
        handleSearchChange,
        handleSearchSubmit,
        clearSearch,
        clearAllFilters,
    } = useSearchInput(currentQuery, searchParams, setSearchParams);

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

                    {/* Header thông tin diễn viên nếu đang xem theo diễn viên */}
                    {currentActor && (
                        <div className="mb-8 flex flex-col items-center gap-6 rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 md:flex-row md:items-center md:gap-8">
                            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-red-600/60 shadow-xl md:h-28 md:w-28">
                                <ActorAvatar
                                    name={actorName}
                                    profilePath={actorDetail?.profile_path}
                                />
                            </div>
                            <div className="flex-1 text-center md:text-left space-y-2">
                                <div className="flex flex-wrap items-center justify-center gap-3 md:justify-start">
                                    <span className="rounded-full bg-red-600 px-3 py-0.5 text-xs font-black uppercase tracking-wider text-white">
                                        {t("vods.actor") || "Diễn viên"}
                                    </span>
                                    {actorDetail?.place_of_birth && (
                                        <span className="text-xs font-medium text-zinc-400">
                                            {actorDetail.place_of_birth}
                                        </span>
                                    )}
                                </div>
                                <h1 className="text-2xl font-black text-white md:text-3xl">
                                    {actorName}
                                </h1>
                            </div>
                        </div>
                    )}

                    {/* Thanh tìm kiếm inline (chỉ hiển thị khi không phải trang actor profile) */}
                    {!currentActor && (
                        <form onSubmit={handleSearchSubmit} className="mb-8">
                            <div className="relative flex items-center">
                                {/* Icon search */}
                                <svg
                                    className="pointer-events-none absolute left-4 h-5 w-5 text-zinc-500"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                    />
                                </svg>
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchInput}
                                    onChange={(e) =>
                                        handleSearchChange(e.target.value)
                                    }
                                    placeholder={t("common.search") + "..."}
                                    className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/80 py-3.5 pl-12 pr-12 text-base font-medium text-white placeholder-zinc-600 outline-none transition-all focus:border-red-600/50 focus:ring-1 focus:ring-red-600/30 md:text-lg"
                                />
                                {/* Nút xóa */}
                                {searchInput && (
                                    <button
                                        type="button"
                                        onClick={clearSearch}
                                        className="absolute right-4 rounded-full p-1 text-zinc-500 transition-colors hover:text-white"
                                    >
                                        <svg
                                            className="h-5 w-5"
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
                        </form>
                    )}

                    <div className="flex flex-col gap-6 border-b border-zinc-900 pb-6 md:flex-row md:items-end md:justify-between">
                        <div>
                            <h1 className="text-3xl font-black uppercase tracking-tighter text-white md:text-5xl">
                                {currentActor ? (t("vods.actorFilmography") || "Danh sách tác phẩm đã tham gia") : finalTitle}
                            </h1>
                            <div className="mt-2 flex items-center gap-4">
                                <p className="text-sm text-zinc-500">
                                    {t("vods.foundMovies", {
                                        count: totalItemsCount,
                                    })}
                                </p>
                                {!isLibraryCategory && !currentActor && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowFilters(!showFilters)
                                        }
                                        className={clsx(
                                            "flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition-all",
                                            showFilters
                                                ? "border-red-600 bg-red-600/10 text-red-500"
                                                : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white",
                                        )}
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
                                            currentYear ||
                                            (activeSource &&
                                                activeSource !==
                                                    SOURCES.SOURCE_K)) && (
                                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] text-white">
                                                {
                                                    [
                                                        currentCountry,
                                                        currentCategory,
                                                        currentYear,
                                                        activeSource &&
                                                        activeSource !==
                                                            SOURCES.SOURCE_K
                                                            ? activeSource
                                                            : null,
                                                    ].filter(Boolean).length
                                                }
                                            </span>
                                        )}
                                        <svg
                                            className={clsx(
                                                "h-3 w-3 transition-transform",
                                                showFilters && "rotate-180",
                                            )}
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2.5}
                                                d="M19 9l-7 7-7-7"
                                            />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                            {/* Thanh tab chọn timeframe cho Top View */}
                            {currentCategory === "top-view" && (
                                <div className="flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950 p-1">
                                    {[
                                        { id: "day", label: t("vods.timeframeToday") || "Hôm nay" },
                                        { id: "week", label: t("vods.timeframeWeek") || "Tuần này" },
                                        { id: "month", label: t("vods.timeframeMonth") || "Tháng này" },
                                    ].map((tab) => {
                                        const isActive = currentTimeframe === tab.id;
                                        return (
                                            <button
                                                key={tab.id}
                                                type="button"
                                                onClick={() => handleFilterSelect("timeframe", tab.id)}
                                                className={clsx(
                                                    "rounded-full px-3.5 py-1 text-xs font-bold transition-all",
                                                    isActive
                                                        ? "bg-red-600 text-white shadow-sm"
                                                        : "text-zinc-400 hover:text-white"
                                                )}
                                            >
                                                {tab.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                                {t("vods.pageOf", {
                                    page: currentPage,
                                    totalPages,
                                })}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Inline Filter Panel */}
                {showFilters && !isLibraryCategory && (
                    <div className="animate-in fade-in slide-in-from-top-2 mb-8 space-y-6 rounded-2xl border border-zinc-800/50 bg-zinc-900/30 p-6 duration-300">
                        {/* Nguồn phim */}
                        <section>
                            <h4 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                                {t("vods.source") || "Nguồn phim"}
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {FILTER_SOURCES.map((src) => (
                                    <button
                                        key={src.id}
                                        type="button"
                                        onClick={() =>
                                            handleFilterSelect("source", src.id)
                                        }
                                        className={clsx(
                                            "rounded-full border px-4 py-1.5 text-xs font-bold transition-all active:scale-95",
                                            activeSource === src.id
                                                ? "border-red-600 bg-red-600 text-white shadow-lg shadow-red-600/20"
                                                : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500 hover:text-white",
                                        )}
                                    >
                                        {src.name}
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section>
                            <h4 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                                Định dạng
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {FILTER_TYPE_LIST.map((type) => (
                                    <button
                                        key={type.slug}
                                        type="button"
                                        onClick={() =>
                                            handleFilterSelect(
                                                "type_list",
                                                activeListContext === type.slug
                                                    ? ""
                                                    : type.slug,
                                            )
                                        }
                                        className={clsx(
                                            "rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95",
                                            activeListContext === type.slug
                                                ? "border-white bg-white text-zinc-900 shadow-lg"
                                                : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500 hover:text-white",
                                        )}
                                    >
                                        {type.name}
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* Quốc gia */}
                        <section>
                            <h4 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                                {t("vods.country") || "Quốc gia"}
                            </h4>
                            {metadataLoading ? (
                                <div className="flex animate-pulse flex-wrap gap-2">
                                    {SKELETON_COUNTRIES.map((id) => (
                                        <div
                                            key={id}
                                            className="h-7 w-20 rounded-full bg-zinc-800"
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {availableCountries.map((c) => (
                                        <button
                                            key={c.slug}
                                            type="button"
                                            onClick={() =>
                                                handleFilterSelect(
                                                    "country",
                                                    c.slug,
                                                )
                                            }
                                            className={clsx(
                                                "rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95",
                                                currentCountry === c.slug
                                                    ? "border-white bg-white text-zinc-900 shadow-lg"
                                                    : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500 hover:text-white",
                                            )}
                                        >
                                            {c.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </section>

                        {/* Thể loại */}
                        <section>
                            <h4 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                                {t("vods.category") || "Thể loại"}
                            </h4>
                            {metadataLoading ? (
                                <div className="flex animate-pulse flex-wrap gap-2">
                                    {SKELETON_CATEGORIES.map((id) => (
                                        <div
                                            key={id}
                                            className="h-7 w-24 rounded-full bg-zinc-800"
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {availableCategories.map((cat) => (
                                        <button
                                            key={cat.slug}
                                            type="button"
                                            onClick={() =>
                                                handleFilterSelect(
                                                    "category",
                                                    cat.slug,
                                                )
                                            }
                                            className={clsx(
                                                "rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95",
                                                currentCategory === cat.slug
                                                    ? "border-white bg-white text-zinc-900 shadow-lg"
                                                    : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500 hover:text-white",
                                            )}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </section>

                        {/* Năm */}
                        <section>
                            <h4 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                                {t("vods.year") || "Năm phát hành"}
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {FILTER_YEARS.map((y) => (
                                    <button
                                        key={y}
                                        type="button"
                                        onClick={() =>
                                            handleFilterSelect("year", y)
                                        }
                                        className={clsx(
                                            "rounded-full border px-2.5 py-1 text-xs font-medium transition-all active:scale-95",
                                            currentYear === y
                                                ? "border-white bg-white text-zinc-900 shadow-lg"
                                                : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500 hover:text-white",
                                        )}
                                    >
                                        {y}
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* Nút xóa filter */}
                        {(currentCountry ||
                            currentCategory ||
                            currentYear ||
                            (activeSource &&
                                activeSource !== SOURCES.SOURCE_K)) && (
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={clearAllFilters}
                                    className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800 px-5 py-2 text-xs font-bold text-zinc-400 transition-all hover:border-red-600 hover:text-white active:scale-95"
                                >
                                    <svg
                                        className="h-3.5 w-3.5"
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
                                    Xóa bộ lọc
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {isLoading ? (
                    <MovieGridSkeleton count={pageSize} />
                ) : (
                    <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6 2xl:grid-cols-8">
                        {items.map((movie) => (
                            <VodMovieCard
                                key={movie.slug}
                                movie={movie}
                                source={activeSource}
                                getImageUrl={getImageUrl}
                                onImageError={handleImageError}
                            />
                        ))}
                    </div>
                )}

                {/* Pagination UI */}
                {!isLibraryCategory && totalPages > 1 && (
                    <div className="mt-16 flex flex-col items-center gap-6">
                        <div className="flex items-center justify-center gap-2">
                            <button
                                type="button"
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
                                        type="button"
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
                                type="button"
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
                                            const val = Number.parseInt(
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
                                type="button"
                                onClick={(e) => {
                                    const input =
                                        e.currentTarget.parentElement.querySelector(
                                            "input",
                                        );
                                    const val = Number.parseInt(input.value);
                                    if (val >= 1 && val <= totalPages) {
                                        handlePageChange(val);
                                    }
                                }}
                                className="ml-1 rounded-full bg-zinc-800 px-3 py-1 text-[10px] font-black uppercase text-zinc-400 transition-colors hover:bg-red-600 hover:text-white"
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
                            type="button"
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
