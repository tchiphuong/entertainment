import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
    // Đặt base để build đúng đường dẫn khi deploy lên GitHub Pages
    base: "/entertainment/",
    plugins: [react()],
    // Loại bỏ console.log và debugger khi build production
    esbuild: {
        drop: mode === "production" ? ["console", "debugger"] : [],
    },
}));
