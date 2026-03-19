import { useMemo } from "react";
import { useTranslation } from "react-i18next";

export const useMovieLanguage = (langString) => {
    const { t } = useTranslation();
    return useMemo(() => {
        if (!langString) return [];
        const normalized = langString.toLowerCase();
        const badges = [];

        if (normalized.includes("vietsub") || normalized.includes("pđ")) {
            badges.push({
                id: "sub",
                label: t("vods.sub"),
                full: t("vods.subFull"),
                color: "bg-red-600",
                textColor: "text-white",
                bgLight: "bg-red-600/20",
                textLight: "text-red-500",
                ring: "ring-red-600/30",
            });
        }
        if (normalized.includes("thuyết minh") || normalized.includes("tm")) {
            badges.push({
                id: "tm",
                label: t("vods.tm"),
                full: t("vods.tmFull"),
                color: "bg-blue-600",
                textColor: "text-white",
                bgLight: "bg-blue-600/20",
                textLight: "text-blue-400",
                ring: "ring-blue-600/30",
            });
        }
        if (normalized.includes("lồng tiếng") || normalized.includes("lt")) {
            badges.push({
                id: "lt",
                label: t("vods.lt"),
                full: t("vods.ltFull"),
                color: "bg-emerald-600",
                textColor: "text-white",
                bgLight: "bg-emerald-600/20",
                textLight: "text-emerald-400",
                ring: "ring-emerald-600/30",
            });
        }

        return badges;
    }, [langString]);
};
