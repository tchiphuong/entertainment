import tailwindScrollbarHide from "tailwind-scrollbar-hide";

export default {
    content: ["./index.html", "./src/**/*.{js,jsx}"],
    theme: {
        extend: {},
    },
    plugins: [tailwindScrollbarHide],
};
