import { useRef, useState, useEffect, memo, useCallback } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { HeartIcon as HeartSolidIcon } from "@heroicons/react/24/solid";
import {
    HeartIcon as HeartOutlineIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { useVodContext } from "../../contexts/VodContext";
import MovieLanguageBadges from "./MovieLanguageBadges";
import { Button, Tabs } from "../ui";
import { useHorizontalScrollState } from "../../hooks/useHorizontalScrollState";
import { tmdbService } from "../../services/vod/tmdbService";
import { vodCache } from "../../utils/vodCache";
import { getQualityBadge, getMoviePlayUrl } from "../../utils/vodHelpers";

/**
 * Component hiển thị số thứ tự Top Rank chuẩn Đèn Neon Ống Uốn Thủy Tinh (Real Neon Glass Tube)
 * Cấu trúc 2 lớp chân thực: Ruột trong suốt + Thành ống màu Neon phát quang + Lõi ánh sáng trắng chạy dọc ống
 */
const RankNumber = memo(({ rank }) => {
    const getNeonColor = (rankNum) => {
        if (rankNum === 1) return { stroke: "#ef4444", glow: "rgba(239,68,68,0.65)", bloom: "rgba(239,68,68,0.3)" };
        if (rankNum === 2) return { stroke: "#eab308", glow: "rgba(234,179,8,0.65)", bloom: "rgba(234,179,8,0.3)" };
        if (rankNum === 3) return { stroke: "#10b981", glow: "rgba(16,185,129,0.65)", bloom: "rgba(16,185,129,0.3)" };
        if (rankNum === 4) return { stroke: "#06b6d4", glow: "rgba(6,182,212,0.65)", bloom: "rgba(6,182,212,0.3)" };
        if (rankNum === 5) return { stroke: "#a855f7", glow: "rgba(168,85,247,0.65)", bloom: "rgba(168,85,247,0.3)" };
        if (rankNum === 6) return { stroke: "#f97316", glow: "rgba(249,115,22,0.65)", bloom: "rgba(249,115,22,0.3)" };
        if (rankNum === 7) return { stroke: "#ec4899", glow: "rgba(236,72,153,0.65)", bloom: "rgba(236,72,153,0.3)" };
        if (rankNum === 8) return { stroke: "#3b82f6", glow: "rgba(59,130,246,0.65)", bloom: "rgba(59,130,246,0.3)" };
        if (rankNum === 9) return { stroke: "#84cc16", glow: "rgba(132,204,22,0.65)", bloom: "rgba(132,204,22,0.3)" };
        if (rankNum === 10) return { stroke: "#f43f5e", glow: "rgba(244,63,94,0.65)", bloom: "rgba(244,63,94,0.3)" };
        if (rankNum <= 15) return { stroke: "#14b8a6", glow: "rgba(20,184,166,0.65)", bloom: "rgba(20,184,166,0.3)" };
        return { stroke: "#e4e4e7", glow: "rgba(228,228,231,0.65)", bloom: "rgba(255,255,255,0.3)" };
    };

    const color = getNeonColor(rank);

    return (
        <div
            className="relative pointer-events-none select-none font-neon-tube font-black tracking-normal leading-none text-6xl md:text-7xl lg:text-8xl transition-all duration-300"
            style={{ fontFamily: "'Sacramento', cursive" }}
        >
            {/* Lớp 1: Thành ống thủy tinh Neon phát sáng màu êm dịu */}
            <span
                className="inline-block text-transparent transition-all duration-300"
                style={{
                    fontFamily: "'Sacramento', cursive",
                    WebkitTextStroke: `0.135rem ${color.stroke}`,
                    filter: `drop-shadow(0 0 2px ${color.stroke}) drop-shadow(0 0 8px ${color.stroke}) drop-shadow(0 0 20px ${color.glow})`,
                }}
            >
                {rank}
            </span>

            {/* Lớp 2: Lõi dây sáng thanh thoát chạy dọc giữa tâm ống Neon uốn */}
            <span
                aria-hidden="true"
                className="absolute inset-0 inline-block text-transparent opacity-75 transition-all duration-300"
                style={{
                    fontFamily: "'Sacramento', cursive",
                    WebkitTextStroke: "0.035rem rgba(255,255,255,0.85)",
                    filter: "drop-shadow(0 0 2px rgba(255,255,255,0.6))",
                }}
            >
                {rank}
            </span>
        </div>
    );
});

/**
 * Top View Movie Card đồng bộ 100% với VodMovieCard của hệ thống
 */
const TopViewMovieCard = memo(
    ({ movie, rank, source, getImageUrl, onImageError }) => {
        const { t } = useTranslation();
        const { isFavorite, toggleFavorite } = useVodContext();

        if (!movie) return null;

        const favorite = isFavorite(movie.slug);
        const qualityBadge = getQualityBadge(movie.quality);
        const currentSource = movie.source || source || "source_tmdb";
        const playUrl = getMoviePlayUrl(movie, currentSource);

        const handleToggleFavorite = (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFavorite(movie);
        };

        return (
            <div className="group relative flex flex-col shrink-0 pl-2 md:pl-3 lg:pl-4 w-[13.75rem] md:w-[15rem] lg:w-[16.25rem] xl:w-[17.5rem] transition-all duration-300 hover:z-40 hover:scale-[1.02]">
                <Link to={playUrl} className="block">
                    {/* Khung Poster kèm Số Rank lồng góc đáy của chính Poster này */}
                    <div className="relative">
                        <div className="aspect-2/3 relative overflow-hidden rounded-lg border border-white/5 bg-zinc-900 shadow-2xl transition-all duration-300 group-hover:border-white/20">
                            <img
                                loading="lazy"
                                src={getImageUrl(movie, "poster")}
                                alt={movie.name}
                                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                                onError={onImageError}
                            />

                            {/* Nút Yêu thích chuẩn VodMovieCard */}
                            <div className="absolute left-2 top-2 z-40">
                                <Button
                                    onPress={handleToggleFavorite}
                                    variant={favorite ? "danger" : "secondary"}
                                    size="sm"
                                    isIconOnly
                                    aria-label={favorite ? t("common.remove") : t("common.add")}
                                >
                                    {favorite ? (
                                        <HeartSolidIcon className="h-4 w-4" />
                                    ) : (
                                        <HeartOutlineIcon className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>

                            {/* Badge chuẩn hệ thống (Ngôn ngữ, Chất lượng, Năm) */}
                            <div className="absolute right-2 top-2 z-30 flex flex-col items-end gap-1">
                                {movie.isTrailer ? (
                                    <div className="rounded-full bg-red-600/90 px-2 py-0.5 text-[0.625rem] font-black uppercase tracking-wider text-white shadow-lg backdrop-blur-sm">
                                        {t("vods.comingSoon")}
                                    </div>
                                ) : (
                                    <>
                                        <MovieLanguageBadges
                                            lang={movie.lang}
                                            className="flex-col items-end"
                                        />
                                        {qualityBadge && (
                                            <div className="rounded-full border border-white/20 bg-black/80 px-2.5 py-0.5 text-[0.625rem] font-black uppercase tracking-wider text-white shadow-lg ring-1 ring-white/10 backdrop-blur-sm">
                                                {qualityBadge}
                                            </div>
                                        )}
                                        {movie.year && (
                                            <div className="rounded-full border border-white/20 bg-black/80 px-2.5 py-0.5 text-[0.625rem] font-black uppercase tracking-wider text-white shadow-lg ring-1 ring-white/10 backdrop-blur-sm">
                                                {movie.year || "N/A"}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Số thứ tự Rank nghệ thuật: Gắn liền với góc đáy bên trái của chính Poster */}
                        <div className="pointer-events-none absolute -bottom-1 -left-2 md:-bottom-2 md:-left-3 lg:-bottom-2 lg:-left-3 z-20 select-none transition-transform duration-500 group-hover:scale-110">
                            <RankNumber rank={rank} />
                        </div>
                    </div>

                    {/* Title & Metadata chuẩn 100% VodMovieCard */}
                    <div className="mt-2 px-1">
                        <p className="line-clamp-1 text-sm font-black transition-colors group-hover:text-red-500">
                            {movie.name}
                        </p>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                            <p className="line-clamp-1 text-[0.625rem] font-bold uppercase tracking-widest text-zinc-500">
                                {movie.origin_name || ""}
                            </p>
                            {movie.current_episode?.value && (
                                <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[0.5625rem] font-black uppercase text-red-500 ring-1 ring-white/5">
                                    {movie.current_episode.value}
                                </span>
                            )}
                        </div>
                    </div>
                </Link>
            </div>
        );
    },
);

const useTopViewTimeframe = ({ initialItems, rowRef, i18n }) => {
    const [activeTimeframe, setActiveTimeframe] = useState("week");
    const [currentItems, setCurrentItems] = useState(initialItems);
    const [loadingTimeframe, setLoadingTimeframe] = useState(false);

    useEffect(() => {
        if (activeTimeframe === "week" && initialItems && initialItems.length > 0) {
            setCurrentItems(initialItems);
        }
    }, [initialItems, activeTimeframe]);

    const handleTimeframeChange = useCallback(
        async (timeframe) => {
            if (timeframe === activeTimeframe) return;
            setActiveTimeframe(timeframe);

            const language =
                i18n?.language?.startsWith("en") ? "en-US" : "vi-VN";
            const cacheKey = `tmdb_top_view_${timeframe}_${language}`;
            const cached = vodCache.get(cacheKey);

            if (cached && Array.isArray(cached) && cached.length > 0) {
                setCurrentItems(cached);
                if (rowRef.current) rowRef.current.scrollTo({ left: 0, behavior: "smooth" });
                return;
            }

            setLoadingTimeframe(true);
            try {
                const res = await tmdbService.fetchTMDBTopViewByTimeframe({ timeframe, language });
                const fetchedItems = res?.items || [];
                if (fetchedItems.length > 0) {
                    setCurrentItems(fetchedItems);
                    vodCache.set(cacheKey, fetchedItems, vodCache.TTL.LISTING);
                }
            } catch (err) {
                console.error("Error changing TMDB timeframe:", err);
            } finally {
                setLoadingTimeframe(false);
                if (rowRef.current) rowRef.current.scrollTo({ left: 0, behavior: "smooth" });
            }
        },
        [activeTimeframe, i18n?.language, rowRef],
    );

    return { activeTimeframe, currentItems, loadingTimeframe, handleTimeframeChange };
};

const TimeframeTabs = ({ activeTimeframe, onChange, t }) => (
    <Tabs
        selectedKey={activeTimeframe}
        onSelectionChange={onChange}
    >
        <Tabs.ListContainer>
            <Tabs.List aria-label="Top View Timeframe">
                <Tabs.Tab id="day">
                    <span className="font-bold text-xs">{t("vods.today") || "Hôm nay"}</span>
                    <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="week">
                    <span className="font-bold text-xs">{t("vods.thisWeek") || "Tuần này"}</span>
                    <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="month">
                    <span className="font-bold text-xs">{t("vods.thisMonth") || "Tháng này"}</span>
                    <Tabs.Indicator />
                </Tabs.Tab>
            </Tabs.List>
        </Tabs.ListContainer>
    </Tabs>
);

const TopViewHeader = ({
    title,
    t,
    activeTimeframe,
    handleTimeframeChange,
    finalLink,
    hasOverflow,
    canScrollLeft,
    canScrollRight,
    scrollLeft,
    scrollRight,
}) => (
    <div className="group/title -mb-4 flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between md:px-12 lg:px-20">
        <div className="flex items-center gap-3">
            <h2 className="flex items-center gap-3 text-2xl font-black text-zinc-100 md:text-3xl">
                <span className="h-8 w-1.5 rounded-full bg-red-600" />
                {title || t("vods.topViews") || "Top Lượt Xem"}
            </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
            <TimeframeTabs
                activeTimeframe={activeTimeframe}
                onChange={handleTimeframeChange}
                t={t}
            />

            {finalLink && (
                <Link
                    to={finalLink}
                    className="flex items-center gap-1 text-sm font-bold text-zinc-500 transition-all duration-300 hover:text-red-500 focus:opacity-100"
                >
                    {t("common.seeMore") || "Xem tất cả"}
                    <ChevronRightIcon className="h-4 w-4 stroke-3" />
                </Link>
            )}

            {hasOverflow && (
                <div className="flex items-center gap-2">
                    {canScrollLeft && (
                        <Button
                            onPress={() => scrollLeft(0.75)}
                            variant="secondary"
                            size="sm"
                            isIconOnly
                            aria-label="Cuộn sang trái"
                        >
                            <ChevronLeftIcon className="h-4 w-4 stroke-2" />
                        </Button>
                    )}
                    {canScrollRight && (
                        <Button
                            onPress={() => scrollRight(0.75)}
                            variant="secondary"
                            size="sm"
                            isIconOnly
                            aria-label="Cuộn sang phải"
                        >
                            <ChevronRightIcon className="h-4 w-4 stroke-2" />
                        </Button>
                    )}
                </div>
            )}
        </div>
    </div>
);

const TopViewSkeletonList = () => (
    <div className="no-scrollbar flex gap-4 overflow-x-auto px-6 py-6 transition-all md:gap-6 md:px-14 lg:px-24">
        {Array.from({ length: 6 }).map((_, idx) => (
            <div
                key={`top-view-skeleton-${idx}`}
                className="relative flex items-start pt-2 pb-2"
            >
                <div className="h-44 w-16 shrink-0 -mr-6 animate-pulse rounded bg-zinc-900/40 md:h-56 md:w-20 md:-mr-8 lg:h-64 lg:w-24" />
                <div className="h-64 w-[11.5rem] shrink-0 animate-pulse rounded-xl border border-white/5 bg-zinc-900/80 md:h-80 md:w-[13.5rem] lg:h-96 lg:w-[15rem]" />
            </div>
        ))}
    </div>
);

/**
 * Component Hàng Phim Top View với Tabs lựa chọn Day/Week/Month, thanh tiêu đề VIP & cơ chế cuộn mượt
 */
export default function VodTopViewRow({
    title,
    items: initialItems = [],
    source,
    link,
    getImageUrl,
    handleImageError,
}) {
    const { t, i18n } = useTranslation();
    const rowRef = useRef(null);

    const { activeTimeframe, currentItems, loadingTimeframe, handleTimeframeChange } =
        useTopViewTimeframe({ initialItems, rowRef, i18n });

    const { scrollRef, canScrollLeft, canScrollRight, hasOverflow, scrollLeft, scrollRight } =
        useHorizontalScrollState([currentItems?.length, loadingTimeframe], rowRef);

    let finalLink = "";
    if (link) {
        const querySeparator = link.includes("?") ? "&" : "?";
        finalLink = `${link}${querySeparator}timeframe=${activeTimeframe}`;
    }

    if (!currentItems || (currentItems.length === 0 && !loadingTimeframe))
        return null;

    return (
        <div className="group/row relative space-y-4 py-2">
            <TopViewHeader
                title={title}
                t={t}
                activeTimeframe={activeTimeframe}
                handleTimeframeChange={handleTimeframeChange}
                finalLink={finalLink}
                hasOverflow={hasOverflow}
                canScrollLeft={canScrollLeft}
                canScrollRight={canScrollRight}
                scrollLeft={scrollLeft}
                scrollRight={scrollRight}
            />

            {/* Carousel Container */}
            <div className="relative">
                {/* Loading Shimmer khi đổi timeframe */}
                {loadingTimeframe ? (
                    <TopViewSkeletonList />
                ) : (
                    /* Danh sách Phim Top View với Số thứ tự */
                    <div
                        ref={scrollRef}
                        className="no-scrollbar flex gap-4 overflow-x-auto scroll-smooth px-6 py-6 transition-all md:gap-6 md:px-14 lg:px-24"
                    >
                        {currentItems.map((item, index) => (
                            <TopViewMovieCard
                                key={item.slug || item.id || index}
                                movie={item}
                                rank={index + 1}
                                source={source}
                                getImageUrl={getImageUrl}
                                onImageError={handleImageError}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

