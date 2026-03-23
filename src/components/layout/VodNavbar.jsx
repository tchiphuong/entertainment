import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDebounce } from "../../hooks/useDebounce";
import { useAuth } from "../../contexts/AuthContext";
import { auth, googleProvider } from "../../services/firebase";
import { signInWithPopup, signOut } from "firebase/auth";

import { useVodContext } from "../../contexts/VodContext";

export default function VodNavbar() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { openFilter } = useVodContext();
    const [searchParams] = useSearchParams();
    const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
    const [isScrolled, setIsScrolled] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [showLangDropdown, setShowLangDropdown] = useState(false);
    const dropdownRef = useRef(null);
    const langRef = useRef(null);

    // Sử dụng custom hook useDebounce
    const debouncedSearchTerm = useDebounce(searchTerm, 500);

    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng);
        setShowLangDropdown(false);
        localStorage.setItem("i18nextLng", lng);
    };

    useEffect(() => {
        const query = searchParams.get("q") || "";
        if (query !== searchTerm) {
            setSearchTerm(query);
        }
    }, [searchParams]);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target)
            ) {
                setShowDropdown(false);
            }
            if (langRef.current && !langRef.current.contains(event.target)) {
                setShowLangDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSearch = (term) => {
        const cleanTerm = term?.trim();
        if (cleanTerm) {
            navigate(`/vod/search?q=${encodeURIComponent(cleanTerm)}`);
        }
    };

    useEffect(() => {
        if (debouncedSearchTerm.trim()) {
            handleSearch(debouncedSearchTerm);
        }
    }, [debouncedSearchTerm, navigate]);

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
        if (currentUser?.displayName)
            return currentUser.displayName[0].toUpperCase();
        if (currentUser?.email) return currentUser.email[0].toUpperCase();
        return "V";
    };

    return (
        <nav
            className={`fixed top-0 z-50 flex w-full items-center justify-between px-4 py-4 transition-all duration-500 md:px-12 ${
                isScrolled
                    ? "bg-zinc-950/95 py-3 shadow-2xl backdrop-blur-xl"
                    : "bg-linear-to-b from-black/80 to-transparent"
            }`}
        >
            <div className="flex items-center gap-10">
                <div className="hidden items-center gap-7 text-sm font-bold text-zinc-300 lg:flex">
                    <Link
                        to="/vod"
                        className="group relative flex items-center gap-2 transition-colors hover:text-white"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                            />
                        </svg>
                        {t("common.home")}
                        <span className="absolute -bottom-1 left-0 h-0.5 w-0 bg-red-600 transition-all group-hover:w-full"></span>
                    </Link>
                    <Link
                        to="/tv"
                        className="group relative flex items-center gap-2 transition-colors hover:text-white"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                            />
                        </svg>
                        {t("tv.title")}
                        <span className="absolute -bottom-1 left-0 h-0.5 w-0 bg-red-600 transition-all group-hover:w-full"></span>
                    </Link>
                </div>
            </div>

            <div className="flex items-center gap-5">
                {/* Thanh tìm kiếm */}
                <div className="relative flex items-center gap-2">
                    <div className="relative hidden items-center gap-2 sm:flex">
                        <button
                            onClick={() => openFilter()}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/50 text-zinc-400 transition-all hover:border-red-600 hover:text-red-500"
                            title={
                                t("vods.advancedSearch") || "Tìm kiếm nâng cao"
                            }
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                                />
                            </svg>
                        </button>
                        <div className="relative">
                            <input
                                name="search"
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        handleSearch(searchTerm);
                                    }
                                }}
                                placeholder={t("vods.searchPlaceholder")}
                                className="h-9 w-40 rounded-full border border-zinc-700 bg-zinc-900/50 pl-4 pr-10 text-xs transition-all focus:w-60 focus:border-red-600 focus:bg-zinc-900 focus:outline-none"
                            />
                            <button
                                onClick={() => handleSearch(searchTerm)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-red-500"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2.5}
                                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Bộ chọn ngôn ngữ */}
                <div className="relative" ref={langRef}>
                    <button
                        onClick={() => setShowLangDropdown(!showLangDropdown)}
                        className={`flex h-9 items-center justify-center gap-2 rounded-full border px-3 text-[11px] font-black uppercase transition-all duration-300 md:h-10 md:min-w-[80px] md:text-xs ${
                            showLangDropdown
                                ? "border-red-600 bg-red-600/10 text-white shadow-[0_0_15px_rgba(220,38,38,0.3)]"
                                : "border-zinc-700/50 bg-zinc-900/40 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800/60 hover:text-white"
                        }`}
                    >
                        <span className="text-base leading-none md:text-lg">
                            {i18n.language === "vi" ? "🇻🇳" : "🇺🇸"}
                        </span>
                        <span className="hidden leading-none md:inline">
                            {i18n.language === "vi" ? "Tiếng Việt" : "English"}
                        </span>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className={`h-3 w-3 transition-transform duration-300 ${showLangDropdown ? "rotate-180" : ""}`}
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

                    {showLangDropdown && (
                        <div className="animate-in fade-in zoom-in-95 absolute right-0 mt-3 w-48 origin-top-right overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/90 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl transition-all duration-200">
                            <div className="p-1.5">
                                <button
                                    onClick={() => changeLanguage("vi")}
                                    className={`group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-xs font-bold transition-all duration-200 ${
                                        i18n.language === "vi"
                                            ? "bg-red-600/15 text-red-500"
                                            : "text-zinc-400 hover:bg-white/5 hover:text-white"
                                    }`}
                                >
                                    <span className="text-xl transition-transform group-hover:scale-110">
                                        🇻🇳
                                    </span>
                                    <div className="flex flex-col items-start leading-tight">
                                        <span>Tiếng Việt</span>
                                        <span className="text-[9px] font-medium opacity-50">
                                            Vietnamese
                                        </span>
                                    </div>
                                    {i18n.language === "vi" && (
                                        <div className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-600/20">
                                            <div className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                                        </div>
                                    )}
                                </button>

                                <button
                                    onClick={() => changeLanguage("en")}
                                    className={`group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-xs font-bold transition-all duration-200 ${
                                        i18n.language === "en"
                                            ? "bg-red-600/15 text-red-500"
                                            : "text-zinc-400 hover:bg-white/5 hover:text-white"
                                    }`}
                                >
                                    <span className="text-xl transition-transform group-hover:scale-110">
                                        🇺🇸
                                    </span>
                                    <div className="flex flex-col items-start leading-tight">
                                        <span>English</span>
                                        <span className="text-[9px] font-medium opacity-50">
                                            Tiếng Anh
                                        </span>
                                    </div>
                                    {i18n.language === "en" && (
                                        <div className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-600/20">
                                            <div className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                                        </div>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* User Profile */}
                <div className="relative" ref={dropdownRef}>
                    {currentUser ? (
                        <button
                            onClick={() => setShowDropdown(!showDropdown)}
                            className="flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-zinc-700 bg-zinc-800 text-sm font-black text-red-500 shadow-inner ring-red-600/50 transition-all hover:border-red-600 hover:ring-2 active:scale-95"
                        >
                            {currentUser.photoURL ? (
                                <img
                                    loading="lazy"
                                    src={currentUser.photoURL}
                                    alt="Avatar"
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                getUserInitial()
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={handleLogin}
                            className="cursor-pointer rounded-full bg-red-600 px-5 py-1.5 text-xs font-black uppercase tracking-wider text-white transition-all hover:bg-red-700 hover:shadow-lg hover:shadow-red-600/20 active:scale-95"
                        >
                            {t("common.login")}
                        </button>
                    )}

                    {/* Dropdown Menu */}
                    {showDropdown && currentUser && (
                        <div className="absolute right-0 mt-3 w-56 origin-top-right overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/95 shadow-2xl backdrop-blur-xl transition-all">
                            <div className="border-b border-zinc-800 px-4 py-3">
                                <p className="truncate text-xs font-bold text-zinc-100">
                                    {currentUser.displayName || "User"}
                                </p>
                                <p className="truncate text-[10px] text-zinc-500">
                                    {currentUser.email}
                                </p>
                            </div>
                            <div className="py-1">
                                <Link
                                    to="/profile"
                                    className="flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
                                    onClick={() => setShowDropdown(false)}
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-4 w-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                        />
                                    </svg>
                                    {t("auth.userMenu") || "Trang cá nhân"}
                                </Link>
                                <Link
                                    to="/vod/category/favorites"
                                    className="flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
                                    onClick={() => setShowDropdown(false)}
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-4 w-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                                        />
                                    </svg>
                                    {t("vods.favorites")}
                                </Link>
                                <Link
                                    to="/vod/category/history"
                                    className="flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
                                    onClick={() => setShowDropdown(false)}
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-4 w-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                    {t("vods.history") || "Lịch sử xem"}
                                </Link>
                            </div>
                            <div className="border-t border-zinc-800 py-1">
                                <button
                                    onClick={handleLogout}
                                    className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-xs font-bold text-red-500 transition-colors hover:bg-red-500/10"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-4 w-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                                        />
                                    </svg>
                                    {t("common.logout")}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}
