import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDebounce } from "../../hooks/useDebounce";
import { useAuth } from "../../contexts/AuthContext";
import { auth, googleProvider } from "../../services/firebase";
import { signInWithPopup, signOut } from "firebase/auth";

// Icon SVG tái sử dụng
const IconSearch = ({ className = "h-5 w-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);

const IconFilter = ({ className = "h-4 w-4" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
);

const IconClose = ({ className = "h-5 w-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const IconMenu = ({ className = "h-6 w-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
);

const IconChevronDown = ({ className = "h-3 w-3" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
    </svg>
);

const IconBack = ({ className = "h-5 w-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
);

// Danh sách links điều hướng
const NAV_LINKS = [
    {
        to: "/vod",
        icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
        labelKey: "common.home",
    },
    {
        to: "/tv",
        icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
        labelKey: "tv.title",
    },
];

// Links bổ sung cho mobile drawer
const MOBILE_EXTRA_LINKS = [
    {
        to: "/vod/category/phim-bo",
        icon: "M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z",
        labelKey: "vods.series",
        fallback: "Phim Bộ",
    },
    {
        to: "/vod/category/phim-le",
        icon: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
        labelKey: "vods.movies",
        fallback: "Phim Lẻ",
    },
];

// Menu items cho dropdown user
const getUserMenuItems = (t) => [
    {
        to: "/profile",
        icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
        label: t("auth.userMenu") || "Trang cá nhân",
    },
    {
        to: "/vod/category/favorites",
        icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
        label: t("vods.favorites"),
    },
    {
        to: "/vod/category/history",
        icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
        label: t("vods.history") || "Lịch sử xem",
    },
];

export default function VodNavbar() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { currentUser } = useAuth();
    const [searchParams] = useSearchParams();

    // State quản lý
    const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
    const [isScrolled, setIsScrolled] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [showLangDropdown, setShowLangDropdown] = useState(false);
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Refs
    const dropdownRef = useRef(null);
    const langRef = useRef(null);
    const searchInputRef = useRef(null);

    // Debounce search
    const debouncedSearchTerm = useDebounce(searchTerm, 500);

    // Đổi ngôn ngữ
    const changeLanguage = useCallback((lng) => {
        i18n.changeLanguage(lng);
        setShowLangDropdown(false);
        localStorage.setItem("i18nextLng", lng);
    }, [i18n]);

    // Sync search term từ URL
    useEffect(() => {
        const query = searchParams.get("q") || "";
        if (query !== searchTerm) {
            setSearchTerm(query);
        }
    }, [searchParams]);

    // Scroll listener
    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 50);
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Click outside handler
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
            if (langRef.current && !langRef.current.contains(event.target)) {
                setShowLangDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Auto-focus mobile search input
    useEffect(() => {
        if (isMobileSearchOpen && searchInputRef.current) {
            // Delay nhỏ để đảm bảo animation hoàn tất
            const timer = setTimeout(() => searchInputRef.current?.focus(), 100);
            return () => clearTimeout(timer);
        }
    }, [isMobileSearchOpen]);

    // Đóng menu khi chuyển route
    useEffect(() => {
        setIsMenuOpen(false);
        setIsMobileSearchOpen(false);
    }, [location.pathname]);

    // Khoá scroll body khi drawer mở
    useEffect(() => {
        if (isMenuOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => { document.body.style.overflow = ""; };
    }, [isMenuOpen]);

    // Xử lý tìm kiếm
    const handleSearch = useCallback((term) => {
        const cleanTerm = term?.trim();
        if (cleanTerm) {
            navigate(`/vod/search?q=${encodeURIComponent(cleanTerm)}`);
            setIsMobileSearchOpen(false);
        }
    }, [navigate]);

    // Auto search khi debounce
    useEffect(() => {
        if (debouncedSearchTerm.trim()) {
            handleSearch(debouncedSearchTerm);
        }
    }, [debouncedSearchTerm, handleSearch]);

    // Auth handlers
    const handleLogin = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error("Login failed:", error);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            setShowDropdown(false);
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

    const getUserInitial = () => {
        if (currentUser?.displayName) return currentUser.displayName[0].toUpperCase();
        if (currentUser?.email) return currentUser.email[0].toUpperCase();
        return "V";
    };

    // Kiểm tra link active
    const isActiveLink = (to) => {
        if (to === "/vod") return location.pathname === "/vod" || location.pathname === "/vod/";
        return location.pathname.startsWith(to);
    };

    return (
        <>
            <nav
                className={`fixed top-0 z-50 flex w-full items-center justify-between px-3 py-3 transition-all duration-500 md:px-8 lg:px-12 ${
                    isScrolled
                        ? "bg-zinc-950/95 shadow-2xl shadow-black/20 backdrop-blur-xl"
                        : "bg-linear-to-b from-black/80 to-transparent"
                } ${isMobileSearchOpen ? "bg-zinc-950/98 backdrop-blur-xl" : ""}`}
            >
                {/* === BÊN TRÁI === */}
                <div className="flex items-center gap-2 md:gap-6 lg:gap-10">
                    {/* Nút Hamburger - Chỉ hiện trên mobile/tablet (<lg) */}
                    {!isMobileSearchOpen && (
                        <button
                            onClick={() => setIsMenuOpen(true)}
                            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition-all active:scale-90 hover:bg-zinc-800/60 hover:text-white lg:hidden"
                            aria-label="Mở menu"
                        >
                            <IconMenu />
                        </button>
                    )}

                    {/* Desktop Navigation Links - Chỉ hiện ≥lg */}
                    <div className="hidden items-center gap-1 lg:flex">
                        {NAV_LINKS.map((link) => (
                            <Link
                                key={link.to}
                                to={link.to}
                                className={`group relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all ${
                                    isActiveLink(link.to)
                                        ? "bg-white/10 text-white"
                                        : "text-zinc-400 hover:bg-white/5 hover:text-white"
                                }`}
                            >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={link.icon} />
                                </svg>
                                {t(link.labelKey)}
                                {isActiveLink(link.to) && (
                                    <span className="absolute -bottom-0.5 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-red-600" />
                                )}
                            </Link>
                        ))}
                    </div>
                </div>

                {/* === BÊN PHẢI === */}
                <div className="flex flex-1 items-center justify-end gap-2 md:flex-none md:gap-3">
                    {/* ---- Desktop Search ---- (≥md) */}
                    <div className="hidden items-center gap-2 md:flex">
                        {/* Nút mở bộ lọc nâng cao */}
                        <button
                            onClick={() => navigate('/vod/search')}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700/50 bg-zinc-900/40 text-zinc-400 transition-all hover:border-red-600/50 hover:bg-red-600/10 hover:text-red-500"
                            title={t("vods.advancedSearch") || "Tìm kiếm nâng cao"}
                        >
                            <IconFilter />
                        </button>

                        {/* Ô tìm kiếm desktop */}
                        <div className="relative">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSearch(searchTerm)}
                                placeholder={t("vods.searchPlaceholder")}
                                className="h-9 w-44 rounded-full border border-zinc-700/50 bg-zinc-900/40 pl-4 pr-10 text-xs text-white transition-all duration-300 placeholder:text-zinc-600 focus:w-64 focus:border-red-600/50 focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-red-600/30"
                            />
                            <button
                                onClick={() => handleSearch(searchTerm)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-red-500"
                            >
                                <IconSearch className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* ---- Mobile Search Toggle ---- (<md) */}
                    <div className={`flex items-center md:hidden ${isMobileSearchOpen ? "flex-1" : ""}`}>
                        {isMobileSearchOpen ? (
                            /* Ô search mobile mở rộng toàn bộ */
                            <div className="flex w-full items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-200">
                                <button
                                    onClick={() => {
                                        setIsMobileSearchOpen(false);
                                        setSearchTerm(searchParams.get("q") || "");
                                    }}
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-all active:scale-90 hover:text-white"
                                >
                                    <IconBack />
                                </button>
                                <div className="relative flex-1">
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleSearch(searchTerm)}
                                        placeholder={t("vods.searchPlaceholder")}
                                        className="h-10 w-full rounded-full border border-zinc-700/50 bg-zinc-900 px-4 pr-10 text-sm text-white transition-all placeholder:text-zinc-600 focus:border-red-600/50 focus:outline-none focus:ring-1 focus:ring-red-600/30"
                                    />
                                    {searchTerm && (
                                        <button
                                            onClick={() => setSearchTerm("")}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-zinc-500 transition-colors hover:text-white"
                                        >
                                            <IconClose className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* Nút mở search trên mobile */
                            <button
                                onClick={() => setIsMobileSearchOpen(true)}
                                className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition-all active:scale-90 hover:bg-zinc-800/60 hover:text-red-500"
                                aria-label="Tìm kiếm"
                            >
                                <IconSearch />
                            </button>
                        )}
                    </div>

                    {/* ---- Các nút Action (ẩn khi mobile search mở) ---- */}
                    <div className={`items-center gap-2 md:flex md:gap-3 ${isMobileSearchOpen ? "hidden" : "flex"}`}>
                        {/* Nút bộ lọc mobile (<md) */}
                        <button
                            onClick={() => navigate('/vod/search')}
                            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition-all active:scale-90 hover:bg-zinc-800/60 hover:text-red-500 md:hidden"
                            aria-label="Bộ lọc"
                        >
                            <IconFilter className="h-5 w-5" />
                        </button>

                        {/* Selector ngôn ngữ */}
                        <div className="relative" ref={langRef}>
                            <button
                                onClick={() => setShowLangDropdown(!showLangDropdown)}
                                className={`flex h-9 items-center justify-center gap-1.5 rounded-full border px-2.5 text-[10px] font-black uppercase transition-all duration-300 md:h-10 md:gap-2 md:px-3 md:text-xs ${
                                    showLangDropdown
                                        ? "border-red-600 bg-red-600/10 text-white shadow-[0_0_15px_rgba(220,38,38,0.3)]"
                                        : "border-zinc-700/50 bg-zinc-900/40 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800/60 hover:text-white"
                                }`}
                            >
                                <span className="h-3 w-4 overflow-hidden rounded-[2px] ring-1 ring-white/10 md:h-3.5 md:w-5">
                                    <img
                                        src={`https://flagcdn.com/${i18n.language === "vi" ? "vn" : "us"}.svg`}
                                        alt={i18n.language}
                                        className="h-full w-full object-cover"
                                    />
                                </span>
                                <span className="hidden leading-none sm:inline">
                                    {i18n.language === "vi" ? "Vie" : "Eng"}
                                </span>
                                <IconChevronDown className={`h-2.5 w-2.5 transition-transform duration-200 ${showLangDropdown ? "rotate-180" : ""}`} />
                            </button>

                            {/* Dropdown ngôn ngữ */}
                            {showLangDropdown && (
                                <div className="absolute right-0 mt-2 w-44 origin-top-right overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
                                    <div className="p-1.5">
                                        {["vi", "en"].map((lang) => (
                                            <button
                                                key={lang}
                                                onClick={() => changeLanguage(lang)}
                                                className={`flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-xs font-bold transition-all ${
                                                    i18n.language === lang
                                                        ? "bg-red-600/15 text-red-500"
                                                        : "text-zinc-400 hover:bg-white/5 hover:text-white"
                                                }`}
                                            >
                                                <img
                                                    src={`https://flagcdn.com/${lang === "vi" ? "vn" : "us"}.svg`}
                                                    className="h-3.5 w-5 rounded-[2px] object-cover"
                                                    alt={lang}
                                                />
                                                <span>{lang === "vi" ? "Tiếng Việt" : "English"}</span>
                                                {i18n.language === lang && (
                                                    <svg className="ml-auto h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Profile / Đăng nhập */}
                        <div className="relative" ref={dropdownRef}>
                            {currentUser ? (
                                <button
                                    onClick={() => setShowDropdown(!showDropdown)}
                                    className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-zinc-700 bg-zinc-800 text-sm font-black text-red-500 shadow-inner transition-all hover:border-red-600 hover:shadow-red-600/20 active:scale-95"
                                >
                                    {currentUser.photoURL ? (
                                        <img src={currentUser.photoURL} alt="Avatar" className="h-full w-full object-cover" />
                                    ) : (
                                        getUserInitial()
                                    )}
                                </button>
                            ) : (
                                <button
                                    onClick={handleLogin}
                                    className="rounded-full bg-red-600 px-4 py-1.5 text-[10px] font-black uppercase text-white transition-all hover:bg-red-500 hover:shadow-lg hover:shadow-red-600/20 active:scale-95 md:px-5 md:text-xs"
                                >
                                    {t("common.login")}
                                </button>
                            )}

                            {/* Dropdown user menu */}
                            {showDropdown && currentUser && (
                                <div className="absolute right-0 mt-2 w-56 origin-top-right overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/95 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
                                    {/* User info */}
                                    <div className="border-b border-zinc-800 px-4 py-3">
                                        <p className="truncate text-xs font-bold text-zinc-100">
                                            {currentUser.displayName || "User"}
                                        </p>
                                        <p className="truncate text-[10px] text-zinc-500">
                                            {currentUser.email}
                                        </p>
                                    </div>

                                    {/* Menu links */}
                                    <div className="py-1">
                                        {getUserMenuItems(t).map((item, idx) => (
                                            <Link
                                                key={idx}
                                                to={item.to}
                                                className="flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-zinc-300 transition-all hover:bg-white/5 hover:text-white"
                                                onClick={() => setShowDropdown(false)}
                                            >
                                                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                                                </svg>
                                                {item.label}
                                            </Link>
                                        ))}
                                    </div>

                                    {/* Nút đăng xuất */}
                                    <div className="border-t border-zinc-800 p-1.5">
                                        <button
                                            onClick={handleLogout}
                                            className="flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-left text-xs font-bold text-red-500 transition-all hover:bg-red-500/10"
                                        >
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                            </svg>
                                            {t("common.logout")}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            {/* === MOBILE DRAWER MENU === */}
            {/* Overlay nền mờ */}
            <div
                className={`fixed inset-0 z-60 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
                    isMenuOpen ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
                onClick={() => setIsMenuOpen(false)}
            />

            {/* Drawer panel */}
            <div
                className={`fixed inset-y-0 left-0 z-70 w-[280px] bg-zinc-950 shadow-2xl shadow-black/50 transition-transform duration-300 ease-out lg:hidden ${
                    isMenuOpen ? "translate-x-0" : "-translate-x-full"
                }`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header drawer */}
                <div className="flex items-center justify-between p-5">
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-zinc-600">
                        Menu
                    </span>
                    <button
                        onClick={() => setIsMenuOpen(false)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-zinc-400 transition-all active:scale-90 hover:bg-zinc-800 hover:text-white"
                        aria-label="Đóng menu"
                    >
                        <IconClose />
                    </button>
                </div>

                {/* Điều hướng */}
                <div className="flex flex-col gap-1 px-3">
                    {[...NAV_LINKS, ...MOBILE_EXTRA_LINKS].map((link, idx) => (
                        <Link
                            key={idx}
                            to={link.to}
                            onClick={() => setIsMenuOpen(false)}
                            className={`flex items-center gap-4 rounded-2xl px-4 py-3.5 text-sm font-bold transition-all active:scale-[0.98] ${
                                isActiveLink(link.to)
                                    ? "bg-red-600/10 text-white"
                                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                            }`}
                        >
                            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={link.icon} />
                            </svg>
                            {t(link.labelKey) || link.fallback || link.labelKey}
                            {isActiveLink(link.to) && (
                                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.6)]" />
                            )}
                        </Link>
                    ))}
                </div>

                {/* User info trong drawer (nếu đã đăng nhập) */}
                {currentUser && (
                    <div className="mx-3 mt-6 rounded-2xl border border-zinc-800/50 bg-zinc-900/30 p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-zinc-700 bg-zinc-800 text-sm font-black text-red-500">
                                {currentUser.photoURL ? (
                                    <img src={currentUser.photoURL} alt="Avatar" className="h-full w-full object-cover" />
                                ) : (
                                    getUserInitial()
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-bold text-white">
                                    {currentUser.displayName || "User"}
                                </p>
                                <p className="truncate text-[10px] text-zinc-500">
                                    {currentUser.email}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Phần dưới cùng: chọn ngôn ngữ */}
                <div className="absolute bottom-0 left-0 right-0 border-t border-zinc-800/50 p-5">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                        {t("common.language") || "Ngôn ngữ"}
                    </p>
                    <div className="flex gap-2">
                        {["vi", "en"].map((lang) => (
                            <button
                                key={lang}
                                onClick={() => changeLanguage(lang)}
                                className={`flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-xs font-black uppercase transition-all active:scale-95 ${
                                    i18n.language === lang
                                        ? "bg-red-600 text-white shadow-lg shadow-red-600/20"
                                        : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                                }`}
                            >
                                <img
                                    src={`https://flagcdn.com/${lang === "vi" ? "vn" : "us"}.svg`}
                                    alt={lang}
                                    className="h-3 w-4 rounded-[2px] object-cover"
                                />
                                {lang === "vi" ? "Vie" : "Eng"}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}
