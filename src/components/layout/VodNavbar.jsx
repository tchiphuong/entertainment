import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useDebounce } from "../../hooks/useDebounce";
import { useAuth } from "../../contexts/AuthContext";
import { auth, googleProvider } from "../../services/firebase";
import { signInWithPopup, signOut } from "firebase/auth";

export default function VodNavbar() {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [searchParams] = useSearchParams();
    const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
    const [isScrolled, setIsScrolled] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);

    // Sử dụng custom hook useDebounce
    const debouncedSearchTerm = useDebounce(searchTerm, 500);

    // Đồng bộ search term từ URL (để clear textbox khi chọn danh mục/năm)
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

    // Đóng dropdown khi click bên ngoài
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target)
            ) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Điều hướng khi giá trị debounced thay đổi
    useEffect(() => {
        if (debouncedSearchTerm.trim()) {
            navigate(
                `/vod/search?q=${encodeURIComponent(debouncedSearchTerm.trim())}`,
            );
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
                <Link
                    to="/vod"
                    className="flex items-center gap-1 text-3xl font-black uppercase tracking-tighter text-red-600 transition-transform hover:scale-105 active:scale-95"
                >
                    <span className="mr-0.5 rounded-sm bg-red-600 px-1.5 text-white">
                        M
                    </span>
                    Hub
                </Link>
                <div className="hidden items-center gap-7 text-sm font-bold text-zinc-300 lg:flex">
                    <Link
                        to="/vod"
                        className="group relative transition-colors hover:text-white"
                    >
                        Trang chủ
                        <span className="absolute -bottom-1 left-0 h-0.5 w-0 bg-red-600 transition-all group-hover:w-full"></span>
                    </Link>
                    <Link
                        to="/tv"
                        className="group relative transition-colors hover:text-white"
                    >
                        Truyền hình
                        <span className="absolute -bottom-1 left-0 h-0.5 w-0 bg-red-600 transition-all group-hover:w-full"></span>
                    </Link>
                </div>
            </div>

            <div className="flex items-center gap-5">
                {/* Thanh tìm kiếm */}
                <div className="relative flex items-center gap-2">
                    <div className="relative">
                        <input
                            name="search"
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Tìm kiếm phim..."
                            className="h-9 w-40 rounded-full border border-zinc-700 bg-zinc-900/50 pl-4 pr-10 text-xs transition-all focus:w-60 focus:border-red-600 focus:bg-zinc-900 focus:outline-none"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">
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
                        </div>
                    </div>
                </div>

                {/* User Profile / Icon Placeholder */}
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
                            Đăng nhập
                        </button>
                    )}

                    {/* Dropdown Menu */}
                    {showDropdown && currentUser && (
                        <div className="absolute right-0 mt-3 w-56 origin-top-right overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/95 shadow-2xl backdrop-blur-xl transition-all">
                            <div className="border-b border-zinc-800 px-4 py-3">
                                <p className="truncate text-xs font-bold text-zinc-100">
                                    {currentUser.displayName || "Người dùng"}
                                </p>
                                <p className="truncate text-[10px] text-zinc-500">
                                    {currentUser.email}
                                </p>
                            </div>
                            <div className="py-1">
                                <Link
                                    to="/profile"
                                    className="block px-4 py-2.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
                                    onClick={() => setShowDropdown(false)}
                                >
                                    Trang cá nhân
                                </Link>
                                <Link
                                    to="/vod/category/favorites"
                                    className="block px-4 py-2.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
                                    onClick={() => setShowDropdown(false)}
                                >
                                    Phim đã thích
                                </Link>
                                <Link
                                    to="/vod/category/history"
                                    className="block px-4 py-2.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
                                    onClick={() => setShowDropdown(false)}
                                >
                                    Lịch sử xem
                                </Link>
                            </div>
                            <div className="border-t border-zinc-800 py-1">
                                <button
                                    onClick={handleLogout}
                                    className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left text-xs font-bold text-red-500 transition-colors hover:bg-red-500/10"
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
                                    Đăng xuất
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}
