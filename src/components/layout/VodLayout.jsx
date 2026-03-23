import React from "react";
import { useNavigate } from "react-router-dom";
import VodNavbar from "./VodNavbar";
import VodFilterModal from "../vod/VodFilterModal";
import { useVodContext } from "../../contexts/VodContext";

export default function VodLayout({ children }) {
    const navigate = useNavigate();
    const { isFilterOpen, setIsFilterOpen, initialFilters } = useVodContext();

    const handleFilterApply = (filters) => {
        const params = new URLSearchParams();
        if (filters.source && filters.source !== "all")
            params.set("source", filters.source);
        if (filters.country) params.set("country", filters.country);
        if (filters.category) params.set("category", filters.category);
        if (filters.year) params.set("year", filters.year);

        navigate(`/vod/search?${params.toString()}`);
        setIsFilterOpen(false);
    };

    return (
        <div className="min-h-screen bg-zinc-950 font-sans text-white selection:bg-red-600 selection:text-white">
            <VodNavbar />
            <main>{children}</main>

            <VodFilterModal
                isOpen={isFilterOpen}
                onClose={() => setIsFilterOpen(false)}
                onApply={handleFilterApply}
                initialFilters={initialFilters}
            />

            <style
                dangerouslySetInnerHTML={{
                    __html: `
                @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                .no-scrollbar::-webkit-scrollbar,
                .scrollbar-hide::-webkit-scrollbar,
                .scrollbar-none::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar,
                .scrollbar-hide,
                .scrollbar-none {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #27272a;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #3f3f46;
                }
            `,
                }}
            />
        </div>
    );
}
