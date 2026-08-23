// prettier.config.js
export default {
    plugins: [
        "@trivago/prettier-plugin-sort-imports",
        "prettier-plugin-tailwindcss",
    ],
    importOrder: [
        "^react",
        "^react-router-dom",
        "<THIRD_PARTY_MODULES>",
        "^@/(.*)$",
        "^[./]",
    ],
    importOrderSeparation: true,
    importOrderSortSpecifiers: true,
    tabWidth: 4,
};
