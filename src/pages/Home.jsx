import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Select from "react-select";
import moment from "moment";
import LoadingSpinner from "../components/LoadingSpinner";

// Lấy API endpoint từ biến môi trường
const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT;

export default function Home() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [matches, setMatches] = useState([]);
    const [tournaments, setTournaments] = useState([]);
    const [selectedTournaments, setSelectedTournaments] = useState([]);
    const [showScrollButton, setShowScrollButton] = useState(false);

    // ✅ OPTIMIZATION: Filter matches by tournament FIRST
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

    // ✅ OPTIMIZATION: Split into Hot and Normal matches based on API source
    const { hotMatches, groupedNormalMatches } = useMemo(() => {
        const hot = [];
        const normal = [];

        filteredMatchesList.forEach((match) => {
            // Check source tag assigned during fetch
            if (match._isHotMatch) {
                hot.push(match);
            } else {
                normal.push(match);
            }
        });

        // Group normal matches by date
        const grouped = {};
        normal.forEach((match) => {
            let dateKey = match.date;
            if (dateKey && dateKey.length === 8) {
                dateKey = `${dateKey.substring(0, 4)}-${dateKey.substring(4, 6)}-${dateKey.substring(6, 8)}`;
            }
            if (!grouped[dateKey]) {
                grouped[dateKey] = [];
            }
            grouped[dateKey].push(match);
        });

        return { hotMatches: hot, groupedNormalMatches: grouped };
    }, [filteredMatchesList]);

    // ✅ OPTIMIZATION: Memoize tournament select options
    const tournamentOptions = useMemo(() => 
        tournaments.map((t) => ({
            value: t.id,
            label: t.name,
            logo: t.logo,
        })),
        [tournaments]
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

    // ✅ OPTIMIZATION: Separate useEffect for initial setup (runs once)
    useEffect(() => {
        document.title = "Trang chủ - Entertainment";
        fetchData();

        const handleScroll = () => {
            setShowScrollButton(window.scrollY > 300);
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []); // Runs only once on mount

    // Real-time score refresh removed to improve performance

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

            // Tag matches to distinguish source
            const hotSource = (data.hot || [])
                .filter((m) => m.sport_type === "football")
                .map(m => ({ ...m, _isHotMatch: true })); // Tag as Hot
                
            const featuredSource = (data.featured || [])
                .filter((m) => m.sport_type === "football")
                .map(m => ({ ...m, _isHotMatch: false })); // Tag as Normal/Featured

            // Combine for processing but keep tags
            const allMatches = [...hotSource, ...featuredSource];

            // Sort matches by time and priority
            allMatches.sort((a, b) => {
                const timeA = a.timestamp || new Date(a.date).getTime();
                const timeB = b.timestamp || new Date(b.date).getTime();
                const timeDiff = timeA - timeB;
                if (timeDiff !== 0) return timeDiff;

                // Priority sort within same time
                // 1. Hot matches first
                if (a.is_hot && !b.is_hot) return -1;
                if (!a.is_hot && b.is_hot) return 1;

                // 2. Featured matches second
                if (a.is_featured && !b.is_featured) return -1;
                if (!a.is_featured && b.is_featured) return 1;

                // 3. Featured tournament matches third
                const aTournamentFeatured = a.tournament?.is_featured ? 1 : 0;
                const bTournamentFeatured = b.tournament?.is_featured ? 1 : 0;
                return bTournamentFeatured - aTournamentFeatured;
            });

            setMatches(allMatches);

            // Extract unique tournaments and count matches
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

            // Sort tournaments by popularity: Featured -> Priority -> Most matches -> Name
            tournamentList.sort((a, b) => {
                // 1. Featured first
                const featuredA = a.is_featured ? 1 : 0;
                const featuredB = b.is_featured ? 1 : 0;
                if (featuredA !== featuredB) return featuredB - featuredA;

                // 2. Priority descending (Higher = Better)
                const priorityA = a.priority || 0;
                const priorityB = b.priority || 0;
                if (priorityA !== priorityB) {
                    return priorityB - priorityA;
                }

                // 3. More matches = Higher popularity
                if (b.match_count !== a.match_count) {
                    return b.match_count - a.match_count;
                }

                // 4. Alphabetical name
                return a.name.localeCompare(b.name);
            });

            setTournaments(tournamentList);
        } catch (err) {
            console.error("Error fetching data:", err);
        }
    };

    // ✅ OPTIMIZATION: Memoize MatchCard component
    const MatchCard = React.memo(({ match }) => {
        const getStatusBadge = () => {
            if (match.match_status === "live") {
                return (
                    <span className="bg-linear-to-r inline-flex animate-pulse items-center gap-1 rounded-full from-red-600 to-red-500 px-3 py-1.5 text-xs font-bold text-white shadow-lg">
                        🔴 Live
                    </span>
                );
            } else if (match.match_status === "pending" && match.timestamp) {
                return (
                    <span className="bg-linear-to-r inline-flex items-center gap-1 rounded-full from-amber-500 to-amber-400 px-3 py-1.5 text-xs font-bold text-white shadow-lg">
                        ⏱️ Sắp diễn ra
                    </span>
                );
            }
            return null;
        };

        return (
            <div
                // onClick={() => navigate(`/match/${match.id}`)}
                className="group relative h-full cursor-pointer"
            >
                <div className="relative h-full overflow-hidden rounded-2xl bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                    <div className="absolute right-2 top-2 z-0">
                        {getStatusBadge()}
                    </div>

                    {match.tournament && (
                        <div className="bg-linear-to-r flex items-center gap-2 border-b border-blue-200 from-blue-50 to-blue-100 px-4 py-2">
                            {match.tournament.logo && (
                                <img
                                    src={match.tournament.logo}
                                    alt={match.tournament.name}
                                    className="h-7 w-7 shrink-0 object-contain"
                                    onError={(e) => { e.target.style.visibility = 'hidden'; e.target.onerror = null; }}
                                />
                            )}
                            <span className="line-clamp-1 text-xs font-bold text-gray-800">
                                {match.tournament.name}
                            </span>
                        </div>
                    )}

                    <div className="space-y-4 p-5">
                        <div className="flex flex-col items-center justify-center">
                            {match._isHotMatch && match.date && match.date.length === 8 && (
                                <span className="mb-0.5 text-xs font-semibold text-gray-500">
                                    {`${match.date.substring(6, 8)}/${match.date.substring(4, 6)}`}
                                </span>
                            )}
                            <div className="text-sm font-bold text-blue-600">
                                {match.date_txt ? (
                                    <span dangerouslySetInnerHTML={{ __html: match.date_txt }} />
                                ) : (
                                    <span>{match.date}</span>
                                )}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="bg-linear-to-r hover:bg-linear-to-r flex items-center justify-between gap-3 rounded-lg from-blue-50 to-transparent p-3 transition-colors hover:from-blue-100 hover:to-transparent">
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                    {match.home?.logo && (
                                        <img
                                            src={match.home.logo}
                                            alt={match.home.name}
                                            className="h-10 w-10 shrink-0 object-contain"
                                            onError={(e) => { e.target.style.visibility = 'hidden'; e.target.onerror = null; }}
                                        />
                                    )}
                                    <p className="line-clamp-2 text-sm font-bold text-gray-800">
                                        {match.home?.name_short || match.home?.name}
                                    </p>
                                </div>
                                {match.scores && match.match_status === "live" && (
                                    <span className="min-w-fit shrink-0 text-2xl font-black text-blue-600">
                                        {match.scores.home}
                                    </span>
                                )}
                            </div>

                            {match.home && match.away && (
                                <div className="flex items-center justify-center px-2 py-0.5">
                                    <span className="rounded-full bg-gray-400 px-3 py-0.5 text-xs font-bold text-white">
                                        VS
                                    </span>
                                </div>
                            )}

                            {match.away && (
                                <div className="bg-linear-to-r hover:bg-linear-to-r flex items-center justify-between gap-3 rounded-lg from-red-50 to-transparent p-3 transition-colors hover:from-red-100 hover:to-transparent">
                                    <div className="flex min-w-0 flex-1 items-center gap-3">
                                        {match.away.logo && (
                                            <img
                                                src={match.away.logo}
                                                alt={match.away.name}
                                                className="h-10 w-10 shrink-0 object-contain"
                                                onError={(e) => { e.target.style.visibility = 'hidden'; e.target.onerror = null; }}
                                            />
                                        )}
                                        <p className="line-clamp-2 text-sm font-bold text-gray-800">
                                            {match.away.name_short || match.away.name}
                                        </p>
                                    </div>
                                    {match.scores && match.match_status === "live" && (
                                        <span className="min-w-fit shrink-0 text-2xl font-black text-red-600">
                                            {match.scores.away}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    });

    return (
        <div className="min-h-screen bg-white">
            <LoadingSpinner isLoading={loading} />

            <main className="container mx-auto px-4 py-10">
                {tournaments.length > 0 && (
                    <div className="mb-8">
                        <h3 className="mb-3 text-sm font-bold text-gray-700">
                            Lọc theo giải đấu:
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
                                placeholder="Chọn giải đấu..."
                                formatOptionLabel={(option) => (
                                    <div className="flex items-center gap-2">
                                        {option.logo && (
                                            <img
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
                            <h2 className="border-b-2 border-blue-600 pb-2 text-lg font-bold text-gray-800">
                                🔥 TRẬN HOT
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
                                        <h2 className="border-b-2 border-blue-600 pb-2 text-lg font-bold text-gray-800">
                                            📅{" "}
                                            {new Date(dateKey + "T00:00:00").toLocaleDateString("vi-VN", {
                                                weekday: "long",
                                                year: "numeric",
                                                month: "long",
                                                day: "numeric",
                                            })}
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
                        <p className="mb-2 text-xl font-semibold text-gray-600">
                            😔 Không có trận đấu để hiển thị
                        </p>
                        <p className="text-sm text-gray-500">Vui lòng quay lại sau</p>
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
