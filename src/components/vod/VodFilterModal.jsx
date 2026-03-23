import { useState, useEffect, useRef } from "react";
import {
    Dialog,
    DialogPanel,
    DialogTitle,
    Transition,
    TransitionChild,
} from "@headlessui/react";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { SOURCES } from "../../constants/vodConstants";
import clsx from "clsx";

const YEARS = Array.from({ length: 26 }, (_, i) => (2025 - i).toString());

const COUNTRIES = [
    { slug: "anh", name: "Anh" },
    { slug: "an-do", name: "Ấn Độ" },
    { slug: "ba-lan", name: "Ba Lan" },
    { slug: "bi", name: "Bỉ" },
    { slug: "brazil", name: "Brazil" },
    { slug: "canada", name: "Canada" },
    { slug: "dai-loan", name: "Đài Loan" },
    { slug: "dan-mach", name: "Đan Mạch" },
    { slug: "duc", name: "Đức" },
    { slug: "ha-lan", name: "Hà Lan" },
    { slug: "han-quoc", name: "Hàn Quốc" },
    { slug: "hong-kong", name: "Hồng Kông" },
    { slug: "indonesia", name: "Indonesia" },
    { slug: "malaysia", name: "Malaysia" },
    { slug: "mexico", name: "Mexico" },
    { slug: "my", name: "Mỹ" },
    { slug: "na-uy", name: "Na Uy" },
    { slug: "nga", name: "Nga" },
    { slug: "nhat-ban", name: "Nhật Bản" },
    { slug: "phap", name: "Pháp" },
    { slug: "philippin", name: "Philippin" },
    { slug: "singapore", name: "Singapore" },
    { slug: "tay-ban-nha", name: "Tây Ban Nha" },
    { slug: "thai-lan", name: "Thái Lan" },
    { slug: "tho-nhi-ky", name: "Thổ Nhĩ Kỳ" },
    { slug: "thuy-dien", name: "Thụy Điển" },
    { slug: "thuy-si", name: "Thụy Sĩ" },
    { slug: "trung-quoc", name: "Trung Quốc" },
    { slug: "uc", name: "Úc" },
    { slug: "viet-nam", name: "Việt Nam" },
    { slug: "y", name: "Ý" },
];

const CATEGORIES = [
    { slug: "chien-tranh", name: "Chiến Tranh" },
    { slug: "co-trang", name: "Cổ Trang" },
    { slug: "hai-huoc", name: "Hài Hước" },
    { slug: "hanh-dong", name: "Hành Động" },
    { slug: "hinh-su", name: "Hình Sự" },
    { slug: "hoat-hinh", name: "Hoạt Hình" },
    { slug: "kinh-di", name: "Kinh Dị" },
    { slug: "phim-bo", name: "Phim Bộ" },
    { slug: "phim-bo-dang-chieu", name: "Phim Bộ Đang Chiếu" },
    { slug: "phim-bo-hoan-thanh", name: "Phim Bộ Đã Hoàn Thành" },
    { slug: "phim-chieu-rap", name: "Phim Chiếu Rạp" },
    { slug: "phim-le", name: "Phim Lẻ" },
    { slug: "phim-long-tieng", name: "Phim Lồng Tiếng" },
    { slug: "phim-moi", name: "Phim Mới" },
    { slug: "phim-sap-chieu", name: "Phim Sắp Chiếu" },
    { slug: "phim-thuyet-minh", name: "Phim Thuyết Minh" },
    { slug: "phim-vietsub", name: "Phim Vietsub" },
    { slug: "phong-su", name: "Phóng Sự" },
    { slug: "tv-shows", name: "Shows" },
    { slug: "subteam", name: "Subteam" },
    { slug: "tam-ly", name: "Tâm Lý" },
    { slug: "than-thoai", name: "Thần Thoại" },
    { slug: "tinh-cam", name: "Tình Cảm" },
    { slug: "vien-tuong", name: "Viễn Tưởng" },
    { slug: "vo-thuat", name: "Võ Thuật" },
];

export default function VodFilterModal({
    isOpen,
    onClose,
    onApply,
    initialFilters,
}) {
    const { t } = useTranslation();
    const [filters, setFilters] = useState({
        source: SOURCES.SOURCE_K,
        country: "",
        category: "",
        year: "",
        keyword: "",
        ...initialFilters,
    });

    const prevOpenRef = useRef(false);

    useEffect(() => {
        if (isOpen && !prevOpenRef.current) {
            setFilters({
                source: initialFilters?.source || SOURCES.SOURCE_K,
                country: (initialFilters?.country || "").toLowerCase(),
                category: (initialFilters?.category || "").toLowerCase(),
                year: initialFilters?.year || "",
                keyword: initialFilters?.keyword || "",
            });
        }
        prevOpenRef.current = isOpen;
    }, [isOpen, initialFilters]);

    const handleSelect = (key, value) => {
        setFilters((prev) => ({
            ...prev,
            [key]: prev[key] === value ? "" : value,
        }));
    };

    const handleApply = () => {
        onApply(filters);
    };

    const handleClear = () => {
        const cleared = {
            source: SOURCES.SOURCE_K,
            country: "",
            category: "",
            year: "",
            keyword: "",
        };
        setFilters(cleared);
    };

    return (
        <Transition show={isOpen} as={Fragment}>
            <Dialog as="div" className="z-100 relative" onClose={onClose}>
                <TransitionChild
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
                </TransitionChild>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <TransitionChild
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95 translate-y-4"
                            enterTo="opacity-100 scale-100 translate-y-0"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100 translate-y-0"
                            leaveTo="opacity-0 scale-95 translate-y-4"
                        >
                            <DialogPanel className="w-full max-w-2xl transform overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 p-6 text-left align-middle shadow-2xl transition-all">
                                <DialogTitle
                                    as="h3"
                                    className="flex items-center justify-between text-xl font-bold text-white"
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="h-6 w-1 rounded-full bg-red-600"></div>
                                        {t("vods.filterTitle") ||
                                            "Tìm kiếm nâng cao"}
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="text-zinc-400 transition-colors hover:text-white"
                                    >
                                        <svg
                                            className="h-6 w-6"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M6 18L18 6M6 6l12 12"
                                            />
                                        </svg>
                                    </button>
                                </DialogTitle>

                                <div className="custom-scrollbar mt-6 max-h-[70vh] space-y-8 overflow-y-auto pr-2">
                                    {/* Từ khóa */}
                                    <section>
                                        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                                            {t("common.search") ||
                                                "Từ khóa tìm kiếm"}
                                        </h4>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={filters.keyword}
                                                onChange={(e) =>
                                                    setFilters((prev) => ({
                                                        ...prev,
                                                        keyword: e.target.value,
                                                    }))
                                                }
                                                placeholder={
                                                    t(
                                                        "vods.searchPlaceholder",
                                                    ) ||
                                                    "Nhập tên phim, diễn viên..."
                                                }
                                                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 py-3 pl-12 pr-4 text-white outline-none transition-all placeholder:text-zinc-600 focus:border-transparent focus:ring-2 focus:ring-red-600"
                                            />
                                            <svg
                                                className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth="2"
                                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                                />
                                            </svg>
                                            {filters.keyword && (
                                                <button
                                                    onClick={() =>
                                                        setFilters((prev) => ({
                                                            ...prev,
                                                            keyword: "",
                                                        }))
                                                    }
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-white"
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
                                                            d="M6 18L18 6M6 6l12 12"
                                                        />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    </section>
                                    {/* Nguồn */}
                                    <section>
                                        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                                            {t("vods.source") || "Nguồn phim"}
                                        </h4>
                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                            {[
                                                {
                                                    id: SOURCES.SOURCE_K,
                                                    name: "KKPhim",
                                                },
                                                {
                                                    id: SOURCES.SOURCE_O,
                                                    name: "OPhim",
                                                },
                                                {
                                                    id: SOURCES.SOURCE_C,
                                                    name: "NguonC",
                                                },
                                                { id: "all", name: "Tất cả" },
                                            ].map((src) => (
                                                <button
                                                    key={src.id}
                                                    onClick={() =>
                                                        handleSelect(
                                                            "source",
                                                            src.id,
                                                        )
                                                    }
                                                    className={clsx(
                                                        "rounded-xl border px-4 py-2 text-sm font-medium transition-all duration-200",
                                                        filters.source ===
                                                            src.id
                                                            ? "border-red-600 bg-red-600 text-white shadow-lg shadow-red-600/20"
                                                            : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500 hover:text-white",
                                                    )}
                                                >
                                                    {src.name}
                                                </button>
                                            ))}
                                        </div>
                                    </section>

                                    {/* Quốc gia */}
                                    <section>
                                        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                                            {t("vods.country") || "Quốc gia"}
                                        </h4>
                                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                                            {COUNTRIES.map((c) => (
                                                <button
                                                    key={c.slug}
                                                    onClick={() =>
                                                        handleSelect(
                                                            "country",
                                                            c.slug,
                                                        )
                                                    }
                                                    className={clsx(
                                                        "truncate rounded-lg border px-2 py-1.5 text-center text-xs font-medium transition-all duration-200",
                                                        filters.country ===
                                                            c.slug
                                                            ? "border-white bg-white text-zinc-900 shadow-lg"
                                                            : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500",
                                                    )}
                                                >
                                                    {c.name}
                                                </button>
                                            ))}
                                        </div>
                                    </section>

                                    {/* Thể loại */}
                                    <section>
                                        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                                            {t("vods.category") || "Thể loại"}
                                        </h4>
                                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                                            {CATEGORIES.map((cat) => (
                                                <button
                                                    key={cat.slug}
                                                    onClick={() =>
                                                        handleSelect(
                                                            "category",
                                                            cat.slug,
                                                        )
                                                    }
                                                    className={clsx(
                                                        "truncate rounded-lg border px-2 py-1.5 text-center text-xs font-medium transition-all duration-200",
                                                        filters.category ===
                                                            cat.slug
                                                            ? "border-white bg-white text-zinc-900 shadow-lg"
                                                            : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500",
                                                    )}
                                                >
                                                    {cat.name}
                                                </button>
                                            ))}
                                        </div>
                                    </section>

                                    {/* Năm */}
                                    <section>
                                        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                                            {t("vods.year") || "Năm phát hành"}
                                        </h4>
                                        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                                            {YEARS.map((y) => (
                                                <button
                                                    key={y}
                                                    onClick={() =>
                                                        handleSelect("year", y)
                                                    }
                                                    className={clsx(
                                                        "rounded-lg border px-1 py-1.5 text-center text-xs font-medium transition-all duration-200",
                                                        filters.year === y
                                                            ? "border-white bg-white text-zinc-900 shadow-lg"
                                                            : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500",
                                                    )}
                                                >
                                                    {y}
                                                </button>
                                            ))}
                                        </div>
                                    </section>
                                </div>

                                <div className="mt-8 flex items-center gap-3">
                                    <button
                                        onClick={handleClear}
                                        className="flex-1 rounded-xl bg-zinc-800 py-3 font-semibold text-zinc-300 transition-colors hover:bg-zinc-700"
                                    >
                                        {t("vods.clearFilter") || "Xóa bộ lọc"}
                                    </button>
                                    <button
                                        onClick={handleApply}
                                        className="flex-2 rounded-xl bg-red-600 py-3 font-bold text-white shadow-lg shadow-red-600/30 transition-colors hover:bg-red-500"
                                    >
                                        {t("common.apply") || "Áp dụng"}
                                    </button>
                                </div>
                            </DialogPanel>
                        </TransitionChild>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}
