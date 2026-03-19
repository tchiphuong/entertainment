import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

const API_BASE = import.meta.env.VITE_SOURCE_O_API;

export default function VodCategoryMenu() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { country, category } = useParams();
    const [activeTab, setActiveTab] = useState(() => {
        if (location.pathname.includes("/country/")) return "countries";
        return "genres";
    });
    const currentPath = location.pathname;

    const [genres, setGenres] = useState([]);
    const [countries, setCountries] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMetadata = async () => {
            setLoading(true);
            try {
                const [gRes, cRes] = await Promise.all([
                    fetch(`${API_BASE}/v1/api/the-loai`),
                    fetch(`${API_BASE}/v1/api/quoc-gia`),
                ]);
                const gData = gRes.ok ? await gRes.json() : null;
                const cData = cRes.ok ? await cRes.json() : null;
                setGenres(gData?.data?.items || gData?.items || []);
                setCountries(cData?.data?.items || cData?.items || []);
            } catch (error) {
                console.error("Error fetching metadata:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchMetadata();
    }, []);

    useEffect(() => {
        if (location.pathname.includes("/country/")) {
            setActiveTab("countries");
        } else if (location.pathname.includes("/category/")) {
            setActiveTab("genres");
        }
    }, [location.pathname]);

    const items = activeTab === "genres" ? genres : countries;

    if (loading) {
        return (
            <div className="scrollbar-none flex items-center gap-2 overflow-x-auto pb-2">
                {[...Array(8)].map((_, i) => (
                    <div
                        key={i}
                        className="h-8 w-20 animate-pulse rounded-full bg-zinc-900"
                    ></div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Tab Switcher */}
            <div className="flex gap-4 border-b border-zinc-900 pb-2">
                <button
                    onClick={() => setActiveTab("genres")}
                    className={`text-[10px] font-black uppercase tracking-widest transition-colors ${
                        activeTab === "genres"
                            ? "text-red-600"
                            : "text-zinc-500 hover:text-zinc-300"
                    }`}
                >
                    {t("vods.category")}
                </button>
                <button
                    onClick={() => setActiveTab("countries")}
                    className={`text-[10px] font-black uppercase tracking-widest transition-colors ${
                        activeTab === "countries"
                            ? "text-red-600"
                            : "text-zinc-500 hover:text-zinc-300"
                    }`}
                >
                    {t("vods.country")}
                </button>
            </div>

            {/* Chips List */}
            <div className="flex flex-wrap items-center gap-2">
                {items.map((item) => {
                    const id = item.slug;
                    const isSelected =
                        activeTab === "countries"
                            ? country === id
                            : category === id;
                    const path =
                        activeTab === "countries"
                            ? `/vod/country/${id}?source=source_o`
                            : `/vod/category/${id}?source=source_o`;

                    return (
                        <Link
                            key={id}
                            to={path}
                            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                                isSelected
                                    ? "bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]"
                                    : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                            }`}
                        >
                            {item.name}
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
