import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";

// Plugin tự động tạo 404.html từ index.html cho các nền tảng hosting SPA dạng root domain
const copyIndexTo404 = () => ({
    name: "copy-index-to-404",
    closeBundle() {
        if (fs.existsSync("dist/index.html")) {
            fs.copyFileSync("dist/index.html", "dist/404.html");
        }
    },
});

export default defineConfig(({ mode }) => {
    const isPagesMode = mode === "pages";
    return {
        // Mode 'pages' phục vụ triển khai root domain, mặc định là subpath GitHub Pages
        base: isPagesMode ? "/" : "/entertainment/",
        plugins: [
            react(),
            ...(isPagesMode ? [copyIndexTo404()] : []),
        ],
        server: {
            host: true,
            headers: {
                "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet, noimageindex",
                "Referrer-Policy": "no-referrer",
            },
        },
        preview: {
            headers: {
                "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet, noimageindex",
                "Referrer-Policy": "no-referrer",
            },
        },
        // Loại bỏ console.log và debugger khi build production
        esbuild: {
            drop: (mode === "production" || isPagesMode) ? ["console", "debugger"] : [],
        },
    };
});
