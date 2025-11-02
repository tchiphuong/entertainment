import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    // Đặt base để build đúng đường dẫn khi deploy lên GitHub Pages
    // Giả sử repository sẽ được host tại: https://<user>.github.io/entertainment/
    base: '/entertainment/',
    plugins: [react()],
});
