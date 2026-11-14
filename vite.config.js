import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
    // Base path cho Cloudflare Pages (vodprime.pages.dev)
    base: "/",
    plugins: [react()],
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
