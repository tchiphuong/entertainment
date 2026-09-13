import { memo } from "react";
import { useTranslation } from "react-i18next";
import { formatMatchDateTime } from "../../utils/dateUtils";
import { Button, Chip } from "../ui";

const TeamBadgeCol = ({ badge, name, fallbackChar }) => (
    <div className="flex min-w-0 flex-1 flex-col items-center text-center">
        <div className="mb-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 p-1.5 shadow-inner">
            {badge ? (
                <img
                    loading="lazy"
                    src={badge}
                    alt={name}
                    className="h-full w-full object-contain"
                    onError={(e) => {
                        e.currentTarget.style.display = "none";
                    }}
                />
            ) : (
                <span className="text-sm font-black text-zinc-600">
                    {name?.charAt(0) || fallbackChar}
                </span>
            )}
        </div>
        <h3 className="line-clamp-2 text-xs font-bold uppercase leading-snug text-zinc-100">
            {name}
        </h3>
    </div>
);

const MatchScoreCenter = ({ hasScore, isHomeWinner, isAwayWinner, homeScore, awayScore }) => (
    <div className="flex shrink-0 flex-col items-center justify-center px-2">
        {hasScore ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1 text-lg font-black tracking-tight">
                <span className={isHomeWinner ? "text-red-500" : "text-zinc-400"}>
                    {homeScore}
                </span>
                <span className="text-zinc-600">-</span>
                <span className={isAwayWinner ? "text-red-500" : "text-zinc-400"}>
                    {awayScore}
                </span>
            </div>
        ) : (
            <div className="rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs font-black uppercase text-zinc-500">
                VS
            </div>
        )}
    </div>
);

const MatchCard = memo(({ event, onSelectMatch }) => {
    const { t } = useTranslation();

    if (!event) return null;

    const formattedTime = formatMatchDateTime(event.dateEvent, event.strTime, "DD/MM HH:mm");

    const hasScore = event.intHomeScore !== null && event.intAwayScore !== null;
    const isHomeWinner = hasScore && Number(event.intHomeScore) > Number(event.intAwayScore);
    const isAwayWinner = hasScore && Number(event.intAwayScore) > Number(event.intHomeScore);

    return (
        <div className="group relative flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/90 p-4 transition-all duration-300 hover:border-zinc-700 hover:shadow-xl">
            {/* Header: Match Time & Details Link */}
            <div className="mb-4 flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
                <div className="flex items-center gap-1.5">
                    <Chip
                        variant="secondary"
                        size="sm"
                        className="font-black text-xs tracking-wider text-zinc-300"
                    >
                        {formattedTime}
                    </Chip>
                </div>

                <Button
                    variant="ghost"
                    size="sm"
                    onPress={() => onSelectMatch(event)}
                    className="flex items-center gap-1 text-xs font-bold text-zinc-400 hover:text-red-500 h-auto p-0"
                >
                    <span>{t("schedule.matchDetails") || "Chi tiết"}</span>
                    <span className="transition-transform group-hover:translate-x-0.5">→</span>
                </Button>
            </div>

            {/* Teams & Score Matrix */}
            <div className="my-2 flex items-center justify-between gap-3">
                <TeamBadgeCol
                    badge={event.strHomeTeamBadge}
                    name={event.strHomeTeam}
                    fallbackChar="H"
                />

                <MatchScoreCenter
                    hasScore={hasScore}
                    isHomeWinner={isHomeWinner}
                    isAwayWinner={isAwayWinner}
                    homeScore={event.intHomeScore}
                    awayScore={event.intAwayScore}
                />

                <TeamBadgeCol
                    badge={event.strAwayTeamBadge}
                    name={event.strAwayTeam}
                    fallbackChar="A"
                />
            </div>

            {/* Footer League Info & Stadium */}
            <div className="mt-3 flex items-center justify-between border-t border-zinc-800/80 pt-2 text-xs text-zinc-500 font-bold">
                <span className="truncate max-w-36">{event.strLeague}</span>
                {event.strVenue && (
                    <span className="flex items-center gap-1 truncate max-w-32 text-right" title={event.strVenue}>
                        <svg className="h-3 w-3 shrink-0 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="truncate">{event.strVenue}</span>
                    </span>
                )}
            </div>
        </div>
    );
});

export default MatchCard;
