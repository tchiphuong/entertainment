import { memo } from "react";
import MatchCard from "./MatchCard";
import { useTranslation } from "react-i18next";

const LeagueSection = memo(({ league, events, onSelectMatch }) => {
    const { t } = useTranslation();

    if (!events || events.length === 0) return null;

    const leagueBadge = events[0]?.strLeagueBadge;

    return (
        <section className="space-y-4">
            {/* League Section Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-3">
                    <span className="h-6 w-1 rounded-full bg-red-600"></span>
                    {leagueBadge && (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-zinc-800 bg-zinc-950 p-0.5">
                            <img
                                loading="lazy"
                                src={leagueBadge}
                                alt={league}
                                className="h-full w-full object-contain"
                                onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                }}
                            />
                        </div>
                    )}
                    <h2 className="text-lg font-black uppercase tracking-tight text-white md:text-xl">
                        {league}
                    </h2>
                </div>

                <span className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-0.5 text-xs font-black text-zinc-400">
                    {events.length} {t("schedule.matches") || "Trận đấu"}
                </span>
            </div>

            {/* Grid Matches */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {events.map((event) => (
                    <MatchCard
                        key={event.idEvent}
                        event={event}
                        onSelectMatch={onSelectMatch}
                    />
                ))}
            </div>
        </section>
    );
});

export default LeagueSection;
