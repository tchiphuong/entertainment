import React from "react";
import VodNavbar from "./VodNavbar";

export default function VodLayout({ children }) {
    return (
        <div className="min-h-screen bg-zinc-950 font-sans text-white selection:bg-red-600 selection:text-white">
            <VodNavbar />
            <main>{children}</main>
            {/* Có thể thêm shared Footer ở đây nếu cần */}
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
            `,
                }}
            />
        </div>
    );
}
