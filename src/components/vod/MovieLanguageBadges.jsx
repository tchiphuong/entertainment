import React from "react";
import { useMovieLanguage } from "../../hooks/useMovieLanguage";

export default function MovieLanguageBadges({
    lang,
    useLight = false,
    className = "",
}) {
    const badges = useMovieLanguage(lang);
    if (!badges || badges.length === 0) return null;

    return (
        <div className={`flex flex-wrap gap-1 ${className}`}>
            {badges.map((b) => (
                <span
                    key={b.id}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold shadow-lg ${
                        useLight
                            ? `${b.bgLight} ${b.textLight} ring-1 ${b.ring}`
                            : `${b.color} ${b.textColor}`
                    }`}
                >
                    {b.label}
                </span>
            ))}
        </div>
    );
}
