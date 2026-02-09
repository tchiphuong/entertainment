import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import vi from "./locales/vi.json";
import en from "./locales/en.json";

// Các ngôn ngữ hỗ trợ
export const LANGUAGES = [
    { code: "vi", name: "Tiếng Việt", flag: "🇻🇳" },
    { code: "en", name: "English", flag: "🇺🇸" },
];

// Cấu hình i18n
i18n.use(LanguageDetector) // Tự động detect ngôn ngữ từ browser
    .use(initReactI18next) // Tích hợp với React
    .init({
        resources: {
            vi: { translation: vi },
            en: { translation: en },
        },
        fallbackLng: "vi", // Ngôn ngữ mặc định
        debug: import.meta.env.DEV, // Chỉ debug trong development

        interpolation: {
            escapeValue: false, // React đã tự escape XSS
        },

        detection: {
            // Thứ tự detect ngôn ngữ
            order: ["localStorage", "navigator", "htmlTag"],
            // Lưu ngôn ngữ vào localStorage
            caches: ["localStorage"],
            lookupLocalStorage: "i18nextLng",
        },
    });

export default i18n;
