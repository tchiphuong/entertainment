import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
    ArrowLeftIcon,
    Bars3Icon,
    HomeIcon,
    FilmIcon,
    VideoCameraIcon,
    MagnifyingGlassIcon,
    TvIcon,
    SparklesIcon,
    ArrowUturnLeftIcon,
    UsersIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import { Button } from "../../ui";
import { ROUTES, getVodCategoryPath, getVodPlayPath } from "../../../constants";

const NavMenuItem = ({ to, icon: Icon, label, subtitle, onClick, isHighlight = false }) => (
    <Link
        to={to}
        onClick={onClick}
        className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs transition-colors ${
            isHighlight
                ? "bg-red-950/40 text-red-300 hover:bg-red-950/70 hover:text-white border border-red-900/40"
                : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
        }`}
    >
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${isHighlight ? "bg-red-600/20 text-red-400" : "bg-zinc-800 text-zinc-400"}`}>
            <Icon className="h-4 w-4 stroke-2" />
        </div>
        <div className="flex flex-col min-w-0">
            <span className="font-semibold truncate">{label}</span>
            {subtitle && <span className="text-[10px] text-zinc-500 truncate">{subtitle}</span>}
        </div>
    </Link>
);

const NavDropdownMenu = ({ isOpen, onClose, menuRef, movie, t }) => {
    if (!isOpen) return null;

    const movieSlug = movie?.slug;
    const movieName = movie?.name || movie?.origin_name;

    return (
        <div
            ref={menuRef}
            className="absolute left-0 top-full mt-2 w-72 rounded-2xl border border-zinc-800 bg-zinc-950/98 p-2 text-white shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150"
        >
            <div className="flex items-center justify-between border-b border-zinc-800/80 px-2.5 pb-2 pt-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    {t("watchParty.nav.menuTitle", { defaultValue: "Điều hướng & Quay về" })}
                </span>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                    aria-label="Đóng menu"
                >
                    <XMarkIcon className="h-4 w-4 stroke-2" />
                </button>
            </div>

            <div className="mt-1.5 space-y-1 max-h-96 overflow-y-auto">
                {movieSlug && (
                    <NavMenuItem
                        to={getVodPlayPath(movieSlug)}
                        icon={ArrowUturnLeftIcon}
                        label={t("watchParty.nav.backToMovie", { defaultValue: "Về trang phim này" })}
                        subtitle={movieName}
                        onClick={onClose}
                        isHighlight={true}
                    />
                )}

                <NavMenuItem
                    to={ROUTES.VOD.ROOT}
                    icon={HomeIcon}
                    label={t("watchParty.nav.vodHome", { defaultValue: "Trang chủ VOD" })}
                    subtitle={t("watchParty.nav.vodHomeDesc", { defaultValue: "Kho phim & thịnh hành" })}
                    onClick={onClose}
                />

                <NavMenuItem
                    to={ROUTES.VOD.WATCH_PARTY}
                    icon={UsersIcon}
                    label={t("watchParty.nav.lobby", { defaultValue: "Sảnh Xem Chung" })}
                    subtitle={t("watchParty.nav.lobbyDesc", { defaultValue: "Danh sách phòng đang mở" })}
                    onClick={onClose}
                />

                <div className="my-1 border-t border-zinc-800/60" />

                <NavMenuItem
                    to={getVodCategoryPath("phim-bo")}
                    icon={FilmIcon}
                    label={t("vods.series", { defaultValue: "Phim Bộ" })}
                    onClick={onClose}
                />

                <NavMenuItem
                    to={getVodCategoryPath("phim-le")}
                    icon={VideoCameraIcon}
                    label={t("vods.movies", { defaultValue: "Phim Lẻ" })}
                    onClick={onClose}
                />

                <NavMenuItem
                    to={ROUTES.VOD.SEARCH}
                    icon={MagnifyingGlassIcon}
                    label={t("common.search", { defaultValue: "Tìm kiếm phim" })}
                    onClick={onClose}
                />

                <div className="my-1 border-t border-zinc-800/60" />

                <NavMenuItem
                    to={ROUTES.TV}
                    icon={TvIcon}
                    label={t("tv.navTitle", { defaultValue: "Truyền hình TV" })}
                    onClick={onClose}
                />

                <NavMenuItem
                    to={ROUTES.HOME}
                    icon={SparklesIcon}
                    label={t("common.homeHub", { defaultValue: "Trang chủ Entertainment" })}
                    onClick={onClose}
                />
            </div>
        </div>
    );
};

const QuickNavTabs = ({ movieSlug, t }) => (
    <div className="hidden md:flex items-center gap-1 border-l border-zinc-800 pl-2.5">
        <Link
            to={ROUTES.VOD.ROOT}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors"
            title="Về Trang chủ VOD"
        >
            <HomeIcon className="h-3.5 w-3.5 stroke-2" />
            <span>{t("common.home", { defaultValue: "Trang chủ" })}</span>
        </Link>

        <Link
            to={getVodCategoryPath("phim-bo")}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors"
            title="Xem Phim Bộ"
        >
            <FilmIcon className="h-3.5 w-3.5 stroke-2" />
            <span>{t("vods.series", { defaultValue: "Phim Bộ" })}</span>
        </Link>

        <Link
            to={getVodCategoryPath("phim-le")}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors"
            title="Xem Phim Lẻ"
        >
            <VideoCameraIcon className="h-3.5 w-3.5 stroke-2" />
            <span>{t("vods.movies", { defaultValue: "Phim Lẻ" })}</span>
        </Link>

        {movieSlug && (
            <Link
                to={getVodPlayPath(movieSlug)}
                className="flex items-center gap-1 rounded-lg border border-red-900/50 bg-red-950/30 px-2 py-1 text-xs font-semibold text-red-400 hover:bg-red-900/50 hover:text-white transition-colors"
                title="Quay lại trang xem phim này"
            >
                <ArrowUturnLeftIcon className="h-3.5 w-3.5 stroke-2" />
                <span>{t("watchParty.nav.backToMovieShort", { defaultValue: "Về phim" })}</span>
            </Link>
        )}
    </div>
);

export const WatchPartyNavMenu = ({ movie }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);
    const movieSlug = movie?.slug;

    const handleBack = useCallback(() => {
        if (window.history.length > 2) {
            navigate(-1);
            return;
        }
        if (movieSlug) {
            navigate(getVodPlayPath(movieSlug));
            return;
        }
        navigate(ROUTES.VOD.ROOT);
    }, [movieSlug, navigate]);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);

    return (
        <div className="relative flex items-center gap-1.5 shrink-0">
            {/* Nút Quay lại nhanh */}
            <Button
                onPress={handleBack}
                variant="secondary"
                size="sm"
                className="h-8 gap-1 px-2 sm:px-2.5 text-zinc-300 hover:text-white border-zinc-800 bg-zinc-900 hover:bg-zinc-800"
                title={t("common.back", { defaultValue: "Quay lại" })}
            >
                <ArrowLeftIcon className="h-4 w-4 stroke-2" />
                <span className="hidden sm:inline text-xs font-semibold">
                    {t("common.back", { defaultValue: "Quay lại" })}
                </span>
            </Button>

            {/* Nút Hamburger Menu: CHỈ hiển thị trên mobile (< md), ẩn trên desktop để tránh trùng lặp với Navbar */}
            <Button
                onPress={() => setIsOpen((prev) => !prev)}
                variant="secondary"
                size="sm"
                className={`h-8 gap-1 px-2 border-zinc-800 transition-colors md:hidden ${
                    isOpen
                        ? "bg-zinc-800 text-white border-zinc-700"
                        : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                }`}
                title={t("watchParty.nav.openMenuTitle", { defaultValue: "Mở menu điều hướng hệ thống" })}
                aria-expanded={isOpen}
            >
                <Bars3Icon className="h-4 w-4 stroke-2" />
                <span className="text-xs font-semibold">
                    {t("common.menu", { defaultValue: "Menu" })}
                </span>
            </Button>

            {/* Dropdown Menu điều hướng chi tiết (chỉ dùng khi mở hamburger trên mobile/tablet) */}
            <NavDropdownMenu
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                menuRef={menuRef}
                movie={movie}
                t={t}
            />

            {/* Thanh Navbar Tabs trực tiếp trên Desktop (>= lg) */}
            <QuickNavTabs movieSlug={movieSlug} t={t} />
        </div>
    );
};

export default WatchPartyNavMenu;
