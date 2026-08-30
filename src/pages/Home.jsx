import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Select from "react-select";
import LoadingSpinner from "../components/LoadingSpinner";

// Lấy API endpoint từ biến môi trường
const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT;

const compareMatchPriority = (a, b) => {
    if (a.is_hot !== b.is_hot) return a.is_hot ? -1 : 1;
    if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
    const aTournamentFeatured = a.tournament?.is_featured ? 1 : 0;
    const bTournamentFeatured = b.tournament?.is_featured ? 1 : 0;
    return bTournamentFeatured - aTournamentFeatured;
};

const compareMatches = (a, b) => {
    const timeA = a.timestamp || new Date(a.date).getTime();
    const timeB = b.timestamp || new Date(b.date).getTime();
    const timeDiff = timeA - timeB;
    if (timeDiff !== 0) return timeDiff;
    return compareMatchPriority(a, b);
};

const compareTournaments = (a, b) => {
    const featuredA = a.is_featured ? 1 : 0;
    const featuredB = b.is_featured ? 1 : 0;
    if (featuredA !== featuredB) return featuredB - featuredA;

    const priorityA = a.priority || 0;
    const priorityB = b.priority || 0;
    if (priorityA !== priorityB) return priorityB - priorityA;

    if (b.match_count !== a.match_count) return b.match_count - a.match_count;
    return (a.name || "").localeCompare(b.name || "");
};

const MatchStatusBadge = ({ match }) => {
    if (match.match_status === "live") {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white shadow-lg">
                <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                Live
            </span>
        );
    }
    if (match.match_status === "pending" && match.timestamp) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-600 px-3 py-1 text-xs font-bold text-white shadow-lg">
                Sắp diễn ra
            </span>
        );
    }
    return null;
};

const extractTournamentList = (allMatches) => {
    const tournamentMap = new Map();
    allMatches.forEach((match) => {
        if (match.tournament?.id) {
            if (!tournamentMap.has(match.tournament.id)) {
                tournamentMap.set(match.tournament.id, {
                    ...match.tournament,
                    match_count: 0,
                });
            }
            tournamentMap.get(match.tournament.id).match_count++;
        }
    });

    const tournamentList = Array.from(tournamentMap.values());
    tournamentList.sort(compareTournaments);
    return tournamentList;
};

const MatchTournamentHeader = ({ tournament }) => {
    if (!tournament) return null;
    return (
        <div className="flex items-center gap-2 border-b border-zinc-700 bg-zinc-700/50 px-4 py-2">
            {tournament.logo && (
                <img
                    loading="lazy"
                    src={tournament.logo}
                    alt={tournament.name}
                    className="h-7 w-7 shrink-0 object-contain"
                    onError={(e) => { e.target.style.visibility = "hidden"; e.target.onerror = null; }}
                />
            )}
            <span className="line-clamp-1 text-xs font-bold text-zinc-100">
                {tournament.name}
            </span>
        </div>
    );
};

const MatchDateTimeBlock = ({ match }) => (
    <div className="flex flex-col items-center justify-center">
        {match._isHotMatch && match.date && match.date.length === 8 && (
            <span className="mb-0.5 text-xs font-semibold text-zinc-400">
                {`${match.date.substring(6, 8)}/${match.date.substring(4, 6)}`}
            </span>
        )}
        <div className="text-sm font-bold text-blue-400">
            {match.date_txt ? (
                <span dangerouslySetInnerHTML={{ __html: match.date_txt }} />
            ) : (
                <span>{match.date}</span>
            )}
        </div>
    </div>
);

const MatchTeamRow = ({ team, score, isLive, isHome }) => {
    if (!team) return null;
    const bgClass = isHome ? "bg-blue-900/20 hover:bg-blue-900/30" : "bg-red-900/20 hover:bg-red-900/30";
    const textScoreClass = isHome ? "text-blue-400" : "text-red-400";

    return (
        <div className={`flex items-center justify-between gap-3 rounded-lg p-3 transition-colors ${bgClass}`}>
            <div className="flex min-w-0 flex-1 items-center gap-3">
                {team.logo && (
                    <img
                        loading="lazy"
                        src={team.logo}
                        alt={team.name}
                        className="h-10 w-10 shrink-0 object-contain"
                        onError={(e) => { e.target.style.visibility = "hidden"; e.target.onerror = null; }}
                    />
                )}
                <p className="line-clamp-2 text-sm font-bold text-zinc-100">
                    {team.name_short || team.name}
                </p>
            </div>
            {score !== undefined && isLive && (
                <span className={`min-w-fit shrink-0 text-2xl font-black ${textScoreClass}`}>
                    {score}
                </span>
            )}
        </div>
    );
};

const MatchCard = React.memo(({ match }) => {
    const isLive = match.match_status === "live";

    return (
        <div className="group relative h-full cursor-pointer">
            <div className="relative h-full overflow-hidden rounded-2xl bg-zinc-800 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                <div className="absolute right-2 top-2 z-0">
                    <MatchStatusBadge match={match} />
                </div>

                <MatchTournamentHeader tournament={match.tournament} />

                <div className="space-y-4 p-5">
                    <MatchDateTimeBlock match={match} />

                    <div className="space-y-3">
                        <MatchTeamRow
                            team={match.home}
                            score={match.scores?.home}
                            isLive={isLive}
                            isHome={true}
                        />

                        {match.home && match.away && (
                            <div className="flex items-center justify-center px-2 py-0.5">
                                <span className="rounded-full bg-zinc-600 px-3 py-0.5 text-xs font-bold text-white">
                                    VS
                                </span>
                            </div>
                        )}

                        <MatchTeamRow
                            team={match.away}
                            score={match.scores?.away}
                            isLive={isLive}
                            isHome={false}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
});

export default function Home() {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [matches, setMatches] = useState([]);
    const [tournaments, setTournaments] = useState([]);
    const [selectedTournaments, setSelectedTournaments] = useState([]);
    const [showScrollButton, setShowScrollButton] = useState(false);

    // OPTIMIZATION: Filter matches by tournament FIRST
    const filteredMatchesList = useMemo(() => {
        if (selectedTournaments.length === 0) {
            return matches;
        }
        return matches.filter(
            (match) =>
                match.tournament?.id &&
                selectedTournaments.includes(match.tournament.id),
        );
    }, [matches, selectedTournaments]);

    // OPTIMIZATION: Split into Hot and Normal matches based on API source
    const { hotMatches, groupedNormalMatches } = useMemo(() => {
        const hot = [];
        const normal = [];

        filteredMatchesList.forEach((match) => {
            if (match._isHotMatch) {
                hot.push(match);
            } else {
                normal.push(match);
            }
        });

        // Group normal matches by date
        const grouped = normal.reduce((acc, match) => {
            const date = match.date;
            if (!acc[date]) {
                acc[date] = [];
            }
            acc[date].push(match);
            return acc;
        }, {});

        return { hotMatches: hot, groupedNormalMatches: grouped };
    }, [filteredMatchesList]);

    // Format tournament options for react-select
    const tournamentOptions = useMemo(
        () =>
            tournaments.map((tournament) => ({
                value: tournament.id,
                label: tournament.name,
                logo: tournament.logo,
            })),
        [tournaments],
    );

    const tournamentValues = useMemo(() => 
        selectedTournaments.map((id) => {
            const tournament = tournaments.find((t) => t.id === id);
            return {
                value: id,
                label: tournament?.name,
                logo: tournament?.logo,
            };
        }),
        [selectedTournaments, tournaments]
    );

    useEffect(() => {
        document.title = t("home.title");
        fetchData();

        const handleScroll = () => {
            setShowScrollButton(window.scrollY > 300);
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const fetchData = async () => {
        setLoading(true);
        await performFetch();
        setLoading(false);
    };

    const performFetch = async () => {
        try {
            const response = await fetch(API_ENDPOINT);
            if (!response.ok) throw new Error("Failed to fetch data");
            const data = await response.json();

            const hotSource = (data.hot || [])
                .filter((m) => m.sport_type === "football")
                .map((m) => ({ ...m, _isHotMatch: true }));

            const featuredSource = (data.featured || [])
                .filter((m) => m.sport_type === "football")
                .map((m) => ({ ...m, _isHotMatch: false }));

            const allMatches = [...hotSource, ...featuredSource];
            allMatches.sort(compareMatches);
            setMatches(allMatches);

            const tournamentList = extractTournamentList(allMatches);
            setTournaments(tournamentList);
        } catch (err) {
            console.error("Error fetching data:", err);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-900">
            <LoadingSpinner isLoading={loading} />

            <main className="container mx-auto px-4 py-10">
                {tournaments.length > 0 && (
                    <div className="mb-8">
                        <h3 className="mb-3 text-sm font-bold text-zinc-300">
                            {t("tv.filterByTournament")}:
                        </h3>
                        <div className="max-w-md">
                            <Select
                                isMulti
                                options={tournamentOptions}
                                value={tournamentValues}
                                onChange={(selected) => {
                                    setSelectedTournaments(
                                        selected ? selected.map((s) => s.value) : [],
                                    );
                                }}
                                classNamePrefix="react-select"
                                placeholder={t("tv.selectTournament")}
                                formatOptionLabel={(option) => (
                                    <div className="flex items-center gap-2">
                                        {option.logo && (
                                            <img
                                                loading="lazy"
                                                src={option.logo}
                                                alt={option.label}
                                                className="h-5 w-5 shrink-0 object-contain"
                                                onError={(e) => { e.target.style.visibility = 'hidden'; e.target.onerror = null; }}
                                            />
                                        )}
                                        <span>{option.label}</span>
                                    </div>
                                )}
                            />
                        </div>
                    </div>
                )}

                {/* Hot Matches Block */}
                {hotMatches.length > 0 && (
                    <div className="mb-10">
                        <div className="mb-4">
                            <h2 className="border-b-2 border-blue-500 pb-2 text-lg font-bold text-zinc-100">
                                {t("tv.hotMatches")}
                            </h2>
                        </div>
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {hotMatches.map((match) => (
                                <MatchCard key={match.id} match={match} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Normal Matches Grouped by Date */}
                {Object.keys(groupedNormalMatches).length > 0 ? (
                    <div className="space-y-8">
                        {Object.keys(groupedNormalMatches)
                            .sort()
                            .map((dateKey) => (
                                <div key={dateKey}>
                                    <div className="mb-4">
                                        <h2 className="border-b-2 border-blue-500 pb-2 text-lg font-bold text-zinc-100 flex items-center gap-2">
                                            <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <span>
                                                {new Date(dateKey + "T00:00:00").toLocaleDateString("vi-VN", {
                                                    weekday: "long",
                                                    year: "numeric",
                                                    month: "long",
                                                    day: "numeric",
                                                })}
                                            </span>
                                        </h2>
                                    </div>

                                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                        {groupedNormalMatches[dateKey].map((match) => (
                                            <MatchCard
                                                key={match.id}
                                                match={match}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                    </div>
                ) : matches.length > 0 && hotMatches.length === 0 ? ( // Only show "empty" if truly empty (no hot, no normal)
                    <div className="py-20 text-center">
                        <p className="mb-2 text-xl font-semibold text-zinc-400">
                            {t("tv.noMatches")}
                        </p>
                        <p className="text-sm text-zinc-500">{t("tv.checkBackLater")}</p>
                    </div>
                ) : null}
            </main>

            <button
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className={`fixed bottom-8 right-8 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 p-4 text-lg font-bold text-white shadow-lg transition-all duration-300 hover:scale-110 hover:bg-blue-700 hover:shadow-xl ${
                    showScrollButton
                        ? "pointer-events-auto opacity-100"
                        : "pointer-events-none opacity-0"
                }`}
            >
                ↑
            </button>
        </div>
    );
}
