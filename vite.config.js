import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";

const copyIndexTo404 = () => ({
    name: "copy-index-to-404",
    closeBundle() {
        if (fs.existsSync("dist/index.html")) {
            fs.copyFileSync("dist/index.html", "dist/404.html");
        }
    },
});

export default defineConfig(({ mode }) => ({
    // Base path cho Cloudflare Pages (vodprime.pages.dev)
    base: "/",
    plugins: [react(), copyIndexTo404()],
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
        drop: mode === "production" ? ["console", "debugger"] : [],
    },
}));
