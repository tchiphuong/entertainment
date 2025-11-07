import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Select from "react-select";
import moment from "moment";
import LoadingSpinner from "../components/LoadingSpinner";

const API_ENDPOINT = "https://br.vebo.xyz/api/match/vb/featured";

export default function Home() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [matches, setMatches] = useState([]);
    const [groupedMatches, setGroupedMatches] = useState({}); // Group matches by date
    const [tournaments, setTournaments] = useState([]); // List of tournaments
    const [selectedTournaments, setSelectedTournaments] = useState([]); // Selected tournament filters
    const [showScrollButton, setShowScrollButton] = useState(false); // Show/hide scroll to top button
    const [countdown, setCountdown] = useState({}); // Countdown state
    const refreshIntervalRef = React.useRef(null); // Store interval ID for cleanup
    const countdownIntervalRef = React.useRef(null); // Store countdown interval ID

    useEffect(() => {
        document.title = "Trang chủ - Entertainment";

        // Fetch dữ liệu lần đầu
        fetchData();

        // Listen for scroll to show/hide button
        const handleScroll = () => {
            setShowScrollButton(window.scrollY > 300);
        };

        window.addEventListener("scroll", handleScroll); // Setup countdown update (mỗi giây)
        countdownIntervalRef.current = setInterval(() => {
            const newCountdown = {};
            matches.forEach((match) => {
                if (match.match_status === "pending" && match.timestamp) {
                    // timestamp có thể là seconds hoặc milliseconds
                    const matchTime = moment(
                        match.timestamp > 10000000000
                            ? match.timestamp
                            : match.timestamp * 1000,
                    );

                    const now = moment();
                    const diff = matchTime.diff(now);

                    if (diff > 0) {
                        let timeStr = "";
                        const totalSeconds = Math.floor(diff / 1000);

                        // Nếu > 24h: hiển thị "X ngày Y giờ tới"
                        if (totalSeconds >= 86400) {
                            // 86400 = 24 giờ
                            const days = Math.floor(totalSeconds / 86400);
                            const hours = Math.floor(
                                (totalSeconds % 86400) / 3600,
                            );

                            if (hours > 0) {
                                timeStr = `${days} ngày ${hours} giờ tới`;
                            } else {
                                timeStr = `${days} ngày tới`;
                            }
                        }
                        // Nếu 1h-24h: hiển thị "X giờ Y phút tới"
                        else if (totalSeconds >= 3600) {
                            // 3600 = 1 giờ
                            const hours = Math.floor(totalSeconds / 3600);
                            const minutes = Math.floor(
                                (totalSeconds % 3600) / 60,
                            );
                            timeStr = `${hours} giờ ${minutes} phút tới`;
                        }
                        // Nếu < 1h: đếm ngược "Y phút Z giây tới"
                        else if (totalSeconds >= 60) {
                            const minutes = Math.floor(totalSeconds / 60);
                            const seconds = totalSeconds % 60;
                            timeStr = `${minutes} phút ${seconds} giây tới`;
                        } else {
                            timeStr = `${totalSeconds} giây tới`;
                        }

                        newCountdown[match.id] = timeStr;
                    }
                }
            });
            setCountdown(newCountdown);
        }, 1000); // Update mỗi giây        // Setup auto-refresh (cập nhật score mỗi 5 giây)
        const interval = setInterval(async () => {
            try {
                const response = await fetch(API_ENDPOINT);
                if (!response.ok) return;
                const data = await response.json();

                const allNewMatches = [
                    ...(data.hot || []).filter(
                        (m) => m.sport_type === "football",
                    ),
                    ...(data.featured || []).filter(
                        (m) => m.sport_type === "football",
                    ),
                ];

                setMatches((prevMatches) => {
                    return prevMatches.map((oldMatch) => {
                        const newMatchData = allNewMatches.find(
                            (m) => m.id === oldMatch.id,
                        );
                        if (newMatchData) {
                            return {
                                ...oldMatch,
                                scores: newMatchData.scores,
                                match_status: newMatchData.match_status,
                                date_txt: newMatchData.date_txt,
                                timestamp: newMatchData.timestamp,
                            };
                        }
                        return oldMatch;
                    });
                });

                setGroupedMatches((prevGrouped) => {
                    const updated = { ...prevGrouped };
                    Object.keys(updated).forEach((dateKey) => {
                        updated[dateKey] = updated[dateKey].map((match) => {
                            const newMatchData = allNewMatches.find(
                                (m) => m.id === match.id,
                            );
                            if (newMatchData) {
                                return {
                                    ...match,
                                    scores: newMatchData.scores,
                                    match_status: newMatchData.match_status,
                                    date_txt: newMatchData.date_txt,
                                    timestamp: newMatchData.timestamp,
                                };
                            }
                            return match;
                        });
                    });
                    return updated;
                });
            } catch (err) {
                console.error("Error updating scores:", err);
            }
        }, 30000); // 30 seconds

        refreshIntervalRef.current = interval;

        // Cleanup interval khi component unmount
        return () => {
            window.removeEventListener("scroll", handleScroll);
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
            }
        };
    }, [matches.length]);

    const fetchData = async () => {
        setLoading(true);
        await performFetch();
        setLoading(false);
    };

    const performFetch = async () => {
        try {
            // Fetch data từ API mới
            const response = await fetch(API_ENDPOINT);
            if (!response.ok) throw new Error("Failed to fetch data");
            const data = await response.json();

            // Parse dữ liệu từ API
            // data.hot và data.featured chứa danh sách trận đấu
            // Kết hợp cả hot và featured, chỉ lấy sport_type: "football"
            const allMatches = [
                ...(data.hot || []).filter((m) => m.sport_type === "football"),
                ...(data.featured || []).filter(
                    (m) => m.sport_type === "football",
                ),
            ];

            // Sắp xếp trận diễn ra sớm nằm trên cùng (tính cả giờ phút)
            allMatches.sort((a, b) => {
                // 1. Ưu tiên theo giờ (trận sớm nhất)
                const timeA = a.timestamp || new Date(a.date).getTime();
                const timeB = b.timestamp || new Date(b.date).getTime();
                const timeDiff = timeA - timeB;
                if (timeDiff !== 0) return timeDiff;

                // 2. Nếu cùng giờ, ưu tiên is_hot
                if (a.is_hot && !b.is_hot) return -1;
                if (!a.is_hot && b.is_hot) return 1;

                // 3. Nếu cùng is_hot, ưu tiên is_featured (match)
                if (a.is_featured && !b.is_featured) return -1;
                if (!a.is_featured && b.is_featured) return 1;

                // 4. Nếu cùng is_featured, ưu tiên is_featured của giải đấu
                const aTournamentFeatured = a.tournament?.is_featured ? 1 : 0;
                const bTournamentFeatured = b.tournament?.is_featured ? 1 : 0;
                return bTournamentFeatured - aTournamentFeatured;
            });

            // Group matches theo ngày
            const grouped = {};
            allMatches.forEach((match) => {
                // Parse date từ format "20251101" (YYYYMMDD)
                let dateKey = match.date;
                if (dateKey && dateKey.length === 8) {
                    // Format: YYYYMMDD → YYYY-MM-DD
                    dateKey = `${dateKey.substring(0, 4)}-${dateKey.substring(4, 6)}-${dateKey.substring(6, 8)}`;
                }

                if (!grouped[dateKey]) {
                    grouped[dateKey] = [];
                }
                grouped[dateKey].push(match);
            });

            setMatches(allMatches);
            setGroupedMatches(grouped);

            // Lấy danh sách unique tournaments
            const tournamentList = [];
            const seenTournaments = new Set();
            allMatches.forEach((match) => {
                if (
                    match.tournament?.id &&
                    !seenTournaments.has(match.tournament.id)
                ) {
                    seenTournaments.add(match.tournament.id);
                    tournamentList.push(match.tournament);
                }
            });

            // Sort tournaments by is_featured (featured first)
            tournamentList.sort((a, b) => {
                if (a.is_featured && !b.is_featured) return -1;
                if (!a.is_featured && b.is_featured) return 1;
                return 0;
            });

            setTournaments(tournamentList);
        } catch (err) {
            console.error("Error fetching data:", err);
        }
    };

    // Filter matches based on selected tournaments
    const getFilteredMatches = () => {
        if (selectedTournaments.length === 0) {
            return groupedMatches;
        }

        const filtered = {};
        Object.keys(groupedMatches).forEach((dateKey) => {
            const filteredMatches = groupedMatches[dateKey].filter(
                (match) =>
                    match.tournament?.id &&
                    selectedTournaments.includes(match.tournament.id),
            );
            if (filteredMatches.length > 0) {
                filtered[dateKey] = filteredMatches;
            }
        });
        return filtered;
    };

    // Render Match Card từ dữ liệu API
    const MatchCard = ({ match, countdown }) => {
        // Xác định status badge
        const getStatusBadge = () => {
            if (match.match_status === "live") {
                return (
                    <span className="bg-linear-to-r inline-flex animate-pulse items-center gap-1 rounded-full from-red-600 to-red-500 px-3 py-1.5 text-xs font-bold text-white shadow-lg">
                        🔴 Live
                    </span>
                );
            } else if (match.match_status === "pending" && match.timestamp) {
                // Kiểm tra xem có countdown cho match này không
                if (countdown[match.id]) {
                    return (
                        <span className="bg-linear-to-r inline-flex items-center gap-1 rounded-full from-amber-500 to-amber-400 px-3 py-1.5 text-xs font-bold text-white shadow-lg">
                            ⏱️ {countdown[match.id]}
                        </span>
                    );
                }

                // Mặc định: "Sắp diễn ra"
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
                onClick={() => navigate(`/match/${match.id}`)}
                className="group relative h-full cursor-pointer"
            >
                {/* Card container */}
                <div className="relative h-full overflow-hidden rounded-lg bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                    {/* Status badge - dính vào góc phải trên */}
                    <div className="absolute right-2 top-2 z-0">
                        {getStatusBadge()}
                    </div>

                    {/* Tournament badge */}
                    {match.tournament && (
                        <div className="bg-linear-to-r flex items-center gap-2 border-b border-blue-200 from-blue-50 to-blue-100 px-4 py-2">
                            {match.tournament.logo && (
                                <img
                                    key={match.tournament.id}
                                    src={match.tournament.logo}
                                    alt={match.tournament.name}
                                    className="h-7 w-7 shrink-0 object-contain"
                                    loading="lazy"
                                    onError={(e) =>
                                        (e.target.style.display = "none")
                                    }
                                />
                            )}
                            <span className="line-clamp-1 text-xs font-bold text-gray-800">
                                {match.tournament.name}
                            </span>
                        </div>
                    )}

                    {/* Match info */}
                    <div className="space-y-4 p-5">
                        {/* Time & Date */}
                        <div className="flex items-center justify-center">
                            <div className="text-sm font-bold text-blue-600">
                                {match.date_txt ? (
                                    <span
                                        dangerouslySetInnerHTML={{
                                            __html: match.date_txt,
                                        }}
                                    />
                                ) : (
                                    <span>{match.date}</span>
                                )}
                            </div>
                        </div>

                        {/* Teams with logos */}
                        <div className="space-y-3">
                            {/* Home team */}
                            <div className="bg-linear-to-r hover:bg-linear-to-r flex items-center justify-between gap-3 rounded-xl from-blue-50 to-transparent p-3 transition-colors hover:from-blue-100 hover:to-transparent">
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                    {match.home?.logo && (
                                        <img
                                            key={`home-${match.id}`}
                                            src={match.home.logo}
                                            alt={match.home.name}
                                            className="h-10 w-10 shrink-0 object-contain"
                                            loading="lazy"
                                            onError={(e) =>
                                                (e.target.style.display =
                                                    "none")
                                            }
                                        />
                                    )}
                                    <p className="line-clamp-2 text-sm font-bold text-gray-800">
                                        {match.home?.name_short ||
                                            match.home?.name}
                                    </p>
                                </div>
                                {match.scores &&
                                    match.match_status === "live" && (
                                        <span className="min-w-fit shrink-0 text-2xl font-black text-blue-600">
                                            {match.scores.home}
                                        </span>
                                    )}
                            </div>

                            {/* Score separator */}
                            <div className="flex items-center justify-center px-2 py-0.5">
                                <span className="rounded-full bg-gray-400 px-3 py-0.5 text-xs font-bold text-white">
                                    VS
                                </span>
                            </div>

                            {/* Away team */}
                            {match.away && (
                                <div className="bg-linear-to-r hover:bg-linear-to-r flex items-center justify-between gap-3 rounded-xl from-red-50 to-transparent p-3 transition-colors hover:from-red-100 hover:to-transparent">
                                    <div className="flex min-w-0 flex-1 items-center gap-3">
                                        {match.away.logo && (
                                            <img
                                                key={`away-${match.id}`}
                                                src={match.away.logo}
                                                alt={match.away.name}
                                                className="h-10 w-10 shrink-0 object-contain"
                                                loading="lazy"
                                                onError={(e) =>
                                                    (e.target.style.display =
                                                        "none")
                                                }
                                            />
                                        )}
                                        <p className="line-clamp-2 text-sm font-bold text-gray-800">
                                            {match.away.name_short ||
                                                match.away.name}
                                        </p>
                                    </div>
                                    {match.scores &&
                                        match.match_status === "live" && (
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
    };

    return (
        <div className="min-h-screen bg-white">
            {/* Loading overlay */}
            <LoadingSpinner isLoading={loading} />

            {/* Main content */}
            <main className="container mx-auto px-4 py-10">
                {/* Tournament Filter - React Select Multi */}
                {tournaments.length > 0 && (
                    <div className="mb-8">
                        <h3 className="mb-3 text-sm font-bold text-gray-700">
                            Lọc theo giải đấu:
                        </h3>
                        <div className="max-w-md">
                            <Select
                                isMulti
                                options={tournaments.map((t) => ({
                                    value: t.id,
                                    label: t.name,
                                    logo: t.logo,
                                }))}
                                value={selectedTournaments.map((id) => {
                                    const tournament = tournaments.find(
                                        (t) => t.id === id,
                                    );
                                    return {
                                        value: id,
                                        label: tournament?.name,
                                        logo: tournament?.logo,
                                    };
                                })}
                                onChange={(selected) => {
                                    setSelectedTournaments(
                                        selected
                                            ? selected.map((s) => s.value)
                                            : [],
                                    );
                                }}
                                classNamePrefix="react-select"
                                placeholder="Chọn giải đấu..."
                                formatOptionLabel={(option) => (
                                    <div className="flex items-center gap-2">
                                        {option.logo && (
                                            <img
                                                key={option.value}
                                                src={option.logo}
                                                alt={option.label}
                                                className="h-5 w-5 shrink-0 object-contain"
                                                loading="lazy"
                                                onError={(e) =>
                                                    (e.target.style.display =
                                                        "none")
                                                }
                                            />
                                        )}
                                        <span>{option.label}</span>
                                    </div>
                                )}
                            />
                        </div>
                    </div>
                )}

                {/* Hiển thị danh sách trận đấu */}
                {matches && matches.length > 0 ? (
                    <div className="space-y-8">
                        {Object.keys(getFilteredMatches())
                            .sort()
                            .map((dateKey) => (
                                <div key={dateKey}>
                                    {/* Date header */}
                                    <div className="mb-4">
                                        <h2 className="border-b-2 border-blue-600 pb-2 text-lg font-bold text-gray-800">
                                            📅{" "}
                                            {new Date(
                                                dateKey + "T00:00:00",
                                            ).toLocaleDateString("vi-VN", {
                                                weekday: "long",
                                                year: "numeric",
                                                month: "long",
                                                day: "numeric",
                                            })}
                                        </h2>
                                    </div>

                                    {/* Grid for matches on this date */}
                                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                        {getFilteredMatches()[dateKey].map(
                                            (match) => (
                                                <MatchCard
                                                    key={match.id}
                                                    match={match}
                                                    countdown={countdown}
                                                />
                                            ),
                                        )}
                                    </div>
                                </div>
                            ))}
                    </div>
                ) : (
                    <div className="py-20 text-center">
                        <p className="mb-2 text-xl font-semibold text-gray-600">
                            😔 Không có trận đấu để hiển thị
                        </p>
                        <p className="text-sm text-gray-500">
                            Vui lòng quay lại sau
                        </p>
                    </div>
                )}
            </main>

            {/* Scroll to Top Button */}
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
