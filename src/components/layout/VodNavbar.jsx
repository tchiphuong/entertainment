import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDebounce } from "../../hooks/useDebounce";
import { useAuth } from "../../contexts/AuthContext";
import { auth, googleProvider } from "../../services/firebase";
import { signInWithPopup, signOut } from "firebase/auth";
import { vodCache } from "../../utils/vodCache";

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

const IconChevronDown = ({ className = "h-3 w-3" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
    </svg>
);

// Tab bar icons (Filled solid khi active, Outline khi inactive)
const TabHomeIcon = ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? 0 : 2}>
        {active ? (
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
        ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        )}
    </svg>
);

const TabSeriesIcon = ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? 0 : 2}>
        {active ? (
            <path d="M4 6h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2zm0 2v10h16V8H4zm4-5h8v2H8V3z" />
        ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
        )}
    </svg>
);

const TabMoviesIcon = ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? 0 : 2}>
        {active ? (
            <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
        ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        )}
    </svg>
);

const TabSearchIcon = ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.8 : 2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);

const TabMenuIcon = ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
);

// Danh sách links điều hướng desktop
const NAV_LINKS = [
    {
        to: "/vod",
        icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
        labelKey: "common.home",
    },
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

// Dropdown chọn ngôn ngữ
function LanguageDropdown({ i18n, showLangDropdown, setShowLangDropdown, changeLanguage, langRef }) {
    return (
        <div className="relative" ref={langRef}>
            <button
                type="button"
                onClick={() => setShowLangDropdown(!showLangDropdown)}
                className={`flex h-9 items-center justify-center gap-1.5 rounded-full border px-2.5 text-[10px] font-black uppercase transition-all duration-300 md:h-10 md:gap-2 md:px-3 md:text-xs cursor-pointer ${
                    showLangDropdown
                        ? "border-red-600 bg-red-600/10 text-white shadow-[0_0_15px_rgba(220,38,38,0.3)]"
                        : "border-zinc-700/50 bg-zinc-900/40 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800/60 hover:text-white"
                }`}
            >
                <span className="h-3 w-4 overflow-hidden rounded-xs ring-1 ring-white/10 md:h-3.5 md:w-5">
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

            {showLangDropdown && (
                <div className="absolute right-0 mt-2 w-44 origin-top-right overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 z-50">
                    <div className="p-1.5">
                        {["vi", "en"].map((lang) => (
                            <button
                                key={lang}
                                type="button"
                                onClick={() => changeLanguage(lang)}
                                className={`flex w-full cursor-pointer items-center gap-3 rounded-full px-4 py-2.5 text-xs font-bold transition-all ${
                                    i18n.language === lang
                                        ? "bg-red-600/15 text-red-500"
                                        : "text-zinc-400 hover:bg-white/5 hover:text-white"
                                }`}
                            >
                                <img
                                    src={`https://flagcdn.com/${lang === "vi" ? "vn" : "us"}.svg`}
                                    className="h-3.5 w-5 rounded-xs object-cover"
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
    );
}

// Dropdown Menu User trên Desktop
function UserDropdown({ currentUser, showDropdown, setShowDropdown, handleLogin, handleLogout, dropdownRef, getUserInitial, t }) {
    return (
        <div className="relative" ref={dropdownRef}>
            {currentUser ? (
                <button
                    type="button"
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-zinc-700 bg-zinc-800 text-sm font-black text-red-500 shadow-inner transition-all hover:border-red-600 hover:shadow-red-600/20 active:scale-95 cursor-pointer"
                >
                    {currentUser.photoURL ? (
                        <img src={currentUser.photoURL} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                        getUserInitial()
                    )}
                </button>
            ) : (
                <button
                    type="button"
                    onClick={handleLogin}
                    className="rounded-full bg-red-600 px-4 py-1.5 text-[10px] font-black uppercase text-white transition-all hover:bg-red-500 hover:shadow-lg hover:shadow-red-600/20 active:scale-95 md:px-5 md:text-xs cursor-pointer"
                >
                    {t("common.login")}
                </button>
            )}

            {showDropdown && currentUser && (
                <div className="absolute right-0 mt-2 w-56 origin-top-right overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/95 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 z-50">
                    <div className="border-b border-zinc-800 px-4 py-3">
                        <p className="truncate text-xs font-bold text-zinc-100">
                            {currentUser.displayName || "User"}
                        </p>
                        <p className="truncate text-[10px] text-zinc-500">
                            {currentUser.email}
                        </p>
                    </div>

                    <div className="py-1">
                        {getUserMenuItems(t).map((item, idx) => (
                            <Link
                                key={item.to || idx}
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

                    <div className="border-t border-zinc-800 p-1.5">
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="flex w-full cursor-pointer items-center gap-3 rounded-full px-4 py-2.5 text-left text-xs font-bold text-red-500 transition-all hover:bg-red-500/10"
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
    );
}

const BottomSheetUserCard = ({ currentUser, getUserInitial, t, setIsMenuOpen, handleLogin }) => {
    if (currentUser) {
        return (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="flex items-center gap-3.5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-red-600/40 bg-zinc-800 text-base font-black text-red-500 shadow-md">
                        {currentUser.photoURL ? (
                            <img src={currentUser.photoURL} alt="Avatar" className="h-full w-full object-cover" />
                        ) : (
                            getUserInitial()
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-bold text-white">
                                {currentUser.displayName || "User"}
                            </p>
                            <span className="rounded bg-red-600/20 px-1.5 py-0.5 text-[9px] font-extrabold text-red-500">
                                VIP
                            </span>
                        </div>
                        <p className="truncate text-xs text-zinc-500">{currentUser.email}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 text-center">
            <p className="mb-1 text-xs font-bold text-white">
                {t("auth.loginPrompt") || "Đăng nhập để đồng bộ lịch sử và danh sách yêu thích"}
            </p>
            <button
                type="button"
                onClick={() => {
                    setIsMenuOpen(false);
                    handleLogin();
                }}
                className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-red-600 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-red-600/20 transition-all hover:bg-red-500 active:scale-95"
            >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                {t("common.login")}
            </button>
        </div>
    );
};

const BottomSheetNavLinks = ({ isActiveLink, setIsMenuOpen, t }) => (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden divide-y divide-zinc-900">
        <Link
            to="/vod/category/favorites"
            onClick={() => setIsMenuOpen(false)}
            className={`flex items-center gap-3.5 px-4 py-3.5 text-xs font-bold transition-all active:scale-[0.98] ${
                isActiveLink("/vod/category/favorites")
                    ? "bg-red-600/10 text-red-500"
                    : "text-zinc-300 hover:bg-white/5 hover:text-white"
            }`}
        >
            <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span>{t("vods.favorites") || "Phim yêu thích"}</span>
            <svg className="ml-auto h-4 w-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
        </Link>

        <Link
            to="/vod/category/history"
            onClick={() => setIsMenuOpen(false)}
            className={`flex items-center gap-3.5 px-4 py-3.5 text-xs font-bold transition-all active:scale-[0.98] ${
                isActiveLink("/vod/category/history")
                    ? "bg-red-600/10 text-red-500"
                    : "text-zinc-300 hover:bg-white/5 hover:text-white"
            }`}
        >
            <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{t("vods.history") || "Lịch sử xem"}</span>
            <svg className="ml-auto h-4 w-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
        </Link>

        <Link
            to="/tv"
            onClick={() => setIsMenuOpen(false)}
            className="flex items-center gap-3.5 px-4 py-3.5 text-xs font-bold text-zinc-300 transition-all hover:bg-white/5 hover:text-white active:scale-[0.98]"
        >
            <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>{t("footer.liveTv") || "Truyền hình trực tuyến"}</span>
            <svg className="ml-auto h-4 w-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
        </Link>

        <Link
            to="/schedule"
            onClick={() => setIsMenuOpen(false)}
            className="flex items-center gap-3.5 px-4 py-3.5 text-xs font-bold text-zinc-300 transition-all hover:bg-white/5 hover:text-white active:scale-[0.98]"
        >
            <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{t("footer.schedule") || "Lịch phát sóng thể thao"}</span>
            <svg className="ml-auto h-4 w-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
        </Link>
    </div>
);

// Mobile Bottom Sheet Menu (iOS / Android Native App Style)
function MobileBottomSheet({
    isMenuOpen,
    setIsMenuOpen,
    currentUser,
    t,
    isActiveLink,
    changeLanguage,
    i18n,
    getUserInitial,
    handleLogin,
    handleLogout,
}) {
    return (
        <>
            {/* Backdrop Overlay */}
            <div
                aria-hidden="true"
                className={`fixed inset-0 z-60 bg-black/75 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
                    isMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                }`}
                onClick={() => setIsMenuOpen(false)}
            />

            {/* Bottom Sheet Modal */}
            <div
                className={`fixed inset-x-0 bottom-0 z-70 flex max-h-[85vh] flex-col rounded-t-[1.75rem] border-t border-zinc-800 bg-zinc-950 pb-[calc(1rem+env(safe-area-inset-bottom,1rem))] shadow-[0_-10px_35px_rgba(0,0,0,0.8)] transition-transform duration-300 ease-out md:hidden ${
                    isMenuOpen ? "translate-y-0" : "translate-y-full"
                }`}
            >
                {/* Drag Handle Indicator */}
                <div className="flex w-full items-center justify-center pt-3 pb-1">
                    <span className="h-1.5 w-12 rounded-full bg-zinc-700/80" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-900">
                    <span className="text-sm font-black tracking-wide text-zinc-100">
                        {t("auth.userMenu") || "Tài khoản & Cài đặt"}
                    </span>
                    <button
                        type="button"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-zinc-400 transition-all hover:bg-zinc-800 hover:text-white active:scale-90"
                        aria-label="Đóng"
                    >
                        <IconClose />
                    </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                    <BottomSheetUserCard
                        currentUser={currentUser}
                        getUserInitial={getUserInitial}
                        t={t}
                        setIsMenuOpen={setIsMenuOpen}
                        handleLogin={handleLogin}
                    />

                    <BottomSheetNavLinks
                        isActiveLink={isActiveLink}
                        setIsMenuOpen={setIsMenuOpen}
                        t={t}
                    />

                    {/* Language Selector */}
                    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-3.5">
                        <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-zinc-500">
                            {t("common.language") || "Ngôn ngữ hiển thị"}
                        </p>
                        <div className="flex gap-2">
                            {["vi", "en"].map((lang) => (
                                <button
                                    key={lang}
                                    type="button"
                                    onClick={() => changeLanguage(lang)}
                                    className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black uppercase transition-all active:scale-95 ${
                                        i18n.language === lang
                                            ? "bg-red-600 text-white shadow-md shadow-red-600/20"
                                            : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                                    }`}
                                >
                                    <img
                                        src={`https://flagcdn.com/${lang === "vi" ? "vn" : "us"}.svg`}
                                        alt={lang}
                                        className="h-3 w-4 rounded-xs object-cover"
                                    />
                                    <span>{lang === "vi" ? "Tiếng Việt" : "English"}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Logout Button */}
                    {currentUser && (
                        <button
                            type="button"
                            onClick={() => {
                                setIsMenuOpen(false);
                                handleLogout();
                            }}
                            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-red-600/30 bg-red-600/10 py-3 text-xs font-bold text-red-500 transition-all hover:bg-red-600/20 active:scale-95"
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span>{t("common.logout")}</span>
                        </button>
                    )}
                </div>
            </div>
        </>
    );
}

const MobileNavItem = ({ to, isActive, icon, label }) => (
    <Link
        to={to}
        className={`relative flex flex-1 flex-col items-center justify-center py-1 transition-transform duration-150 active:scale-[0.82] ${
            isActive
                ? "text-red-500 font-extrabold"
                : "text-zinc-400 hover:text-zinc-200 font-medium"
        }`}
    >
        {isActive && (
            <span className="absolute -top-1.5 h-1 w-6 rounded-b-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.8)]" />
        )}
        {icon}
        <span className="mt-1 text-[10px] tracking-tight">{label}</span>
    </Link>
);

// Native App Bottom Navigation Bar (< lg)
function MobileBottomNav({
    isActiveLink,
    t,
    currentUser,
    getUserInitial,
    isMenuOpen,
    setIsMenuOpen,
}) {
    const isMoreActive =
        isMenuOpen ||
        isActiveLink("/vod/category/favorites") ||
        isActiveLink("/vod/category/history");

    return (
        <nav
            aria-label="Mobile Navigation"
            className="fixed bottom-0 left-0 right-0 z-50 flex h-[calc(3.75rem+env(safe-area-inset-bottom,0rem))] items-start justify-around border-t border-zinc-800/80 bg-zinc-950/95 px-1 pt-1.5 pb-[env(safe-area-inset-bottom,0.25rem)] shadow-[0_-8px_30px_rgba(0,0,0,0.6)] backdrop-blur-2xl md:hidden select-none"
        >
            <MobileNavItem
                to="/vod"
                isActive={isActiveLink("/vod")}
                icon={<TabHomeIcon active={isActiveLink("/vod")} />}
                label={t("common.home") || "Trang chủ"}
            />
            <MobileNavItem
                to="/vod/category/phim-bo"
                isActive={isActiveLink("/vod/category/phim-bo")}
                icon={<TabSeriesIcon active={isActiveLink("/vod/category/phim-bo")} />}
                label={t("vods.series") || "Phim Bộ"}
            />
            <MobileNavItem
                to="/vod/category/phim-le"
                isActive={isActiveLink("/vod/category/phim-le")}
                icon={<TabMoviesIcon active={isActiveLink("/vod/category/phim-le")} />}
                label={t("vods.movies") || "Phim Lẻ"}
            />
            <MobileNavItem
                to="/vod/search"
                isActive={isActiveLink("/vod/search")}
                icon={<TabSearchIcon active={isActiveLink("/vod/search")} />}
                label={t("common.search") || "Tìm kiếm"}
            />

            {/* Menu / Cá nhân */}
            <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`relative flex flex-1 cursor-pointer flex-col items-center justify-center py-1 transition-transform duration-150 active:scale-[0.82] ${
                    isMoreActive
                        ? "text-red-500 font-extrabold"
                        : "text-zinc-400 hover:text-zinc-200 font-medium"
                }`}
            >
                {isMoreActive && (
                    <span className="absolute -top-1.5 h-1 w-6 rounded-b-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.8)]" />
                )}
                {currentUser ? (
                    <div className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full border border-red-500/50 bg-zinc-800 text-[10px] font-bold text-red-500 shadow-sm">
                        {currentUser.photoURL ? (
                            <img
                                src={currentUser.photoURL}
                                alt="Avatar"
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            getUserInitial()
                        )}
                    </div>
                ) : (
                    <TabMenuIcon active={isMoreActive} />
                )}
                <span className="mt-1 text-[10px] tracking-tight">
                    {t("nav.more") || "Thêm"}
                </span>
            </button>
        </nav>
    );
}

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
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Refs
    const dropdownRef = useRef(null);
    const langRef = useRef(null);

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
    }, [searchParams, searchTerm]);

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

    // Đóng menu khi chuyển route
    useEffect(() => {
        setIsMenuOpen(false);
    }, [location.pathname]);

    // Khoá scroll body khi bottom sheet mở
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
            vodCache.clear();
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
            {/* Desktop Top Navbar (Hoàn toàn ẩn trên mobile) */}
            <nav
                className={`hidden md:flex fixed top-0 z-50 w-full items-center justify-between px-8 py-3.5 transition-all duration-500 select-none ${
                    isScrolled
                        ? "bg-zinc-950/95 shadow-2xl shadow-black/30 backdrop-blur-2xl border-b border-zinc-800/50"
                        : "bg-zinc-950/80 backdrop-blur-md"
                }`}
            >
                {/* === BÊN TRÁI: Các tab điều hướng trực tiếp (Không có Logo / VOD HUB) === */}
                <div className="flex items-center gap-1.5">
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

                {/* === BÊN PHẢI: Search, Language, User === */}
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/vod/search')}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700/50 bg-zinc-900/40 text-zinc-400 transition-all hover:border-red-600/50 hover:bg-red-600/10 hover:text-red-500 cursor-pointer"
                        title={t("vods.advancedSearch") || "Tìm kiếm nâng cao"}
                    >
                        <IconFilter />
                    </button>

                    <div className="relative">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSearch(searchTerm)}
                            placeholder={t("vods.searchPlaceholder")}
                            className="h-9 w-48 rounded-full border border-zinc-700/50 bg-zinc-900/40 pl-4 pr-10 text-xs text-white transition-all duration-300 placeholder:text-zinc-600 focus:w-64 focus:border-red-600/50 focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-red-600/30"
                        />
                        <button
                            type="button"
                            onClick={() => handleSearch(searchTerm)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-red-500 cursor-pointer"
                        >
                            <IconSearch className="h-4 w-4" />
                        </button>
                    </div>

                    <LanguageDropdown
                        i18n={i18n}
                        showLangDropdown={showLangDropdown}
                        setShowLangDropdown={setShowLangDropdown}
                        changeLanguage={changeLanguage}
                        langRef={langRef}
                    />

                    <UserDropdown
                        currentUser={currentUser}
                        showDropdown={showDropdown}
                        setShowDropdown={setShowDropdown}
                        handleLogin={handleLogin}
                        handleLogout={handleLogout}
                        dropdownRef={dropdownRef}
                        getUserInitial={getUserInitial}
                        t={t}
                    />
                </div>
            </nav>

            {/* Mobile Native Bottom Navigation Bar (< lg) */}
            <MobileBottomNav
                isActiveLink={isActiveLink}
                t={t}
                currentUser={currentUser}
                getUserInitial={getUserInitial}
                isMenuOpen={isMenuOpen}
                setIsMenuOpen={setIsMenuOpen}
            />

            {/* Mobile Bottom Sheet Drawer */}
            <MobileBottomSheet
                isMenuOpen={isMenuOpen}
                setIsMenuOpen={setIsMenuOpen}
                currentUser={currentUser}
                t={t}
                isActiveLink={isActiveLink}
                changeLanguage={changeLanguage}
                i18n={i18n}
                getUserInitial={getUserInitial}
                handleLogin={handleLogin}
                handleLogout={handleLogout}
            />
        </>
    );
}
