module.exports = {
    content: ["./**/*.{html,js}"],
    darkMode: "class",
    theme: {
        fontFamily: {
            sans: ["Inter", "sans-serif"],
            serif: ["Inter", "serif"],
        },
        extend: {},
    },
    plugins: [
        require("@tailwindcss/line-clamp"), // chỉ cần plugin Tailwind ở đây
    ],
};
