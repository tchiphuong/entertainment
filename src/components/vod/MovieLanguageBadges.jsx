import { useMovieLanguage } from "../../hooks/useMovieLanguage";
import { Chip } from "../ui";

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
                <Chip
                    key={b.id}
                    size="sm"
                    variant="secondary"
                    className={`text-xs font-bold shadow-lg ${
                        useLight
                            ? `${b.bgLight} ${b.textLight} ring-1 ${b.ring}`
                            : `${b.color} ${b.textColor}`
                    }`}
                >
                    {b.label}
                </Chip>
            ))}
        </div>
    );
}
