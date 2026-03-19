import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import moment from "moment";
import { useTranslation } from "react-i18next";
import LoadingSpinner from "../components/LoadingSpinner";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const API_KEY = import.meta.env.VITE_SPORTSDB_API_KEY || "3";
const API_URL = `${import.meta.env.VITE_SPORTSDB_BASE_URL}/${API_KEY}/eventsday.php`;

export default function Schedule() {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [events, setEvents] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [matchDetails, setMatchDetails] = useState({
        lineups: [],
        stats: [],
        tv: [],
        highlights: null,
    });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [hlsChannels, setHlsChannels] = useState([]);

    // Fetch HLS channels mapping from GitHub
    useEffect(() => {
        const fetchHlsMapping = async () => {
            try {
                const response = await axios.get(
                    "https://raw.githubusercontent.com/tchiphuong/miscmisc/refs/heads/master/hls.json",
                );
                if (Array.isArray(response.data)) {
                    // Flatten groups to channels list and pre-normalize for performance
                    const flattened = response.data
                        .flatMap((group) => group.channels || [])
                        .map((ch) => ({
                            ...ch,
                            normalizedName: ch.name
                                .toLowerCase()
                                .replace(/\s+/g, ""),
                            normalizedTags:
                                ch.tags?.map((tag) =>
                                    tag.toLowerCase().replace(/\s+/g, ""),
                                ) || [],
                        }));
                    setHlsChannels(flattened);
                }
            } catch (error) {
                console.error("Error fetching HLS mapping:", error);
            }
        };
        fetchHlsMapping();
    }, []);

    // Helper to find HLS channel by name or tags - Optimized
    const findHlsChannel = (tvName) => {
        if (!tvName || !hlsChannels.length) return null;
        const normalized = tvName.toLowerCase().replace(/\s+/g, "");

        return hlsChannels.find((ch) => {
            if (
                ch.normalizedName === normalized ||
                normalized.includes(ch.normalizedName) ||
                ch.normalizedName.includes(normalized)
            )
                return true;

            return ch.normalizedTags.some(
                (tagNorm) =>
                    tagNorm === normalized ||
                    normalized.includes(tagNorm) ||
                    tagNorm.includes(normalized),
            );
        });
    };

    useEffect(() => {
        document.title = "Lịch thi đấu - Flat Design";
        fetchEvents(selectedDate);
    }, [selectedDate]);

    const fetchEvents = async (localDate) => {
        setLoading(true);
        try {
            // Múi giờ Việt Nam là +7.
            // Một ngày Local (00:00 - 23:59) có thể nằm trong 2 ngày UTC.
            const dateStr = moment(localDate).format("YYYY-MM-DD");
            const prevDateStr = moment(localDate)
                .subtract(1, "days")
                .format("YYYY-MM-DD");

            // Fetch cả ngày hiện tại và ngày trước đó theo chuẩn UTC của API
            const [res1, res2] = await Promise.all([
                axios.get(`${API_URL}?d=${dateStr}&s=Soccer`),
                axios.get(`${API_URL}?d=${prevDateStr}&s=Soccer`),
            ]);

            const allEvents = [
                ...(res1.data?.events || []),
                ...(res2.data?.events || []),
            ];

            // Lọc: Chỉ lấy những trận mà khi chuyển sang GMT+7 thì đúng là ngày dateStr
            const filteredByLocalDate = allEvents.filter((event) => {
                if (!event.strTime) return event.dateEvent === dateStr;

                const eventLocalDay = moment
                    .utc(`${event.dateEvent}T${event.strTime}`)
                    .utcOffset(7)
                    .format("YYYY-MM-DD");

                return eventLocalDay === dateStr;
            });

            // Loại bỏ trùng lặp (nếu có) dựa trên idEvent
            const uniqueEvents = Array.from(
                new Map(
                    filteredByLocalDate.map((item) => [item.idEvent, item]),
                ).values(),
            );

            setEvents(uniqueEvents);
        } catch (error) {
            console.error("Error fetching sports events:", error);
            setEvents([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchMatchDetails = async (event) => {
        setSelectedMatch(event);
        setIsModalOpen(true);
        setLoadingDetails(true);
        setMatchDetails({ lineups: [], stats: [], tv: [], highlights: null });

        try {
            const baseUrl = `https://www.thesportsdb.com/api/v1/json/${API_KEY}`;

            const [lineupsRes, statsRes, tvRes, highlightsRes] =
                await Promise.all([
                    axios.get(
                        `${baseUrl}/lookuplineup.php?id=${event.idEvent}`,
                    ),
                    axios.get(
                        `${baseUrl}/lookupeventstats.php?id=${event.idEvent}`,
                    ),
                    axios.get(`${baseUrl}/lookuptv.php?id=${event.idEvent}`),
                    axios.get(
                        `${baseUrl}/eventshighlights.php?d=${event.dateEvent}`,
                    ),
                ]);

            const highlights = highlightsRes.data?.tvhighlights?.find(
                (h) =>
                    h.idEvent === event.idEvent ||
                    h.strEvent === event.strEvent,
            );

            setMatchDetails({
                lineups: lineupsRes.data?.lineup || [],
                stats: statsRes.data?.eventstats || [],
                tv: tvRes.data?.tvevent || [],
                highlights: highlights || null,
            });
        } catch (error) {
            console.error("Error fetching match details:", error);
        } finally {
            setLoadingDetails(false);
        }
    };

    const filteredEvents = useMemo(() => {
        if (!searchQuery) return events;
        return events.filter(
            (event) =>
                event.strEvent
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase()) ||
                event.strLeague
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase()),
        );
    }, [events, searchQuery]);

    const groupedEvents = useMemo(() => {
        // Danh sách các giải đấu ưu tiên hiển thị lên đầu
        const priorityLeagues = [
            "English Premier League",
            "Spanish La Liga",
            "Italian Serie A",
            "German Bundesliga",
            "French Ligue 1",
            "UEFA Champions League",
            "UEFA Europa League",
            "FIFA World Cup",
            "Copa America",
            "Euro",
        ];

        // Sắp xếp events theo thời gian sớm nhất trước khi group
        const sortedEvents = [...filteredEvents].sort((a, b) => {
            const timeA = a.strTime || "23:59:59";
            const timeB = b.strTime || "23:59:59";
            return timeA.localeCompare(timeB);
        });

        const groups = {};
        sortedEvents.forEach((event) => {
            if (!groups[event.strLeague]) {
                groups[event.strLeague] = [];
            }
            groups[event.strLeague].push(event);
        });

        // Sắp xếp các key (giải đấu) theo độ ưu tiên
        const sortedLeagues = Object.keys(groups).sort((a, b) => {
            const indexA = priorityLeagues.indexOf(a);
            const indexB = priorityLeagues.indexOf(b);

            // Nếu cả hai đều trong danh sách ưu tiên, so sánh index
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            // Nếu chỉ A ưu tiên, A lên đầu
            if (indexA !== -1) return -1;
            // Nếu chỉ B ưu tiên, B lên đầu
            if (indexB !== -1) return 1;
            // Nếu không cái nào ưu tiên, giữ nguyên hoặc sort alpha
            return a.localeCompare(b);
        });

        // Tạo object mới đã được sort keys
        const sortedGroups = {};
        sortedLeagues.forEach((league) => {
            sortedGroups[league] = groups[league];
        });

        return sortedGroups;
    }, [filteredEvents]);

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-200 selection:bg-zinc-800">
            <style>
                {`
                .react-datepicker-wrapper { width: 100%; }
                .react-datepicker {
                    background-color: #18181b !important;
                    border: 1px solid #27272a !important;
                    font-family: inherit !important;
                    border-radius: 0.5rem !important;
                }
                .react-datepicker__header {
                    background-color: #09090b !important;
                    border-bottom: 1px solid #27272a !important;
                }
                .react-datepicker__current-month, .react-datepicker__day-name {
                    color: #d4d4d8 !important;
                }
                .react-datepicker__day {
                    color: #a1a1aa !important;
                }
                .react-datepicker__day:hover {
                    background-color: #27272a !important;
                    color: white !important;
                }
                .react-datepicker__day--selected {
                    background-color: #e4e4e7 !important;
                    color: black !important;
                    font-weight: bold !important;
                }
                .react-datepicker__day--keyboard-selected {
                    background-color: transparent !important;
                }
                `}
            </style>
            <LoadingSpinner isLoading={loading} />

            <div className="container relative z-10 mx-auto max-w-7xl px-4 py-12">
                {/* Header Section */}
                <header className="mb-10 border-b border-zinc-800 pb-8">
                    <h1 className="mb-2 text-4xl font-bold uppercase tracking-tight text-white md:text-5xl">
                        Soccer 2026
                    </h1>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        Match Schedule / Results / Live Data
                    </p>
                </header>

                {/* Flat Filter Bar */}
                <div className="sticky top-4 z-50 mb-8">
                    <div className="flex flex-col items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3 shadow-lg md:flex-row">
                        {/* Date Picker */}
                        <div className="group relative w-full md:w-56">
                            <label className="absolute -top-2 left-3 z-10 bg-zinc-900 px-1 text-[10px] font-bold uppercase text-zinc-500">
                                Select Date
                            </label>
                            <DatePicker
                                selected={selectedDate}
                                onChange={(date) => setSelectedDate(date)}
                                dateFormat="yyyy-MM-dd"
                                className="w-full cursor-pointer rounded-md border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-white outline-none transition-all focus:border-zinc-500"
                            />
                        </div>

                        {/* Search Input */}
                        <div className="relative w-full flex-1">
                            <label className="absolute -top-2 left-3 z-10 bg-zinc-900 px-1 text-[10px] font-bold uppercase text-zinc-500">
                                Search Events
                            </label>
                            <input
                                type="text"
                                placeholder="League, Team..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-white outline-none transition-all focus:border-zinc-500"
                            />
                        </div>

                        <button
                            onClick={() => fetchEvents(selectedDate)}
                            className="w-full rounded-md bg-zinc-200 px-10 py-2.5 font-bold text-black transition-colors hover:bg-white md:w-auto"
                        >
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Content Sections */}
                {Object.keys(groupedEvents).length > 0 ? (
                    <div className="space-y-10">
                        {Object.entries(groupedEvents).map(
                            ([league, leagueEvents]) => (
                                <section
                                    key={league}
                                    className="animate-in fade-in duration-500"
                                >
                                    <div className="mb-5 flex items-center gap-3 border-l-4 border-zinc-500 px-1 pl-4">
                                        {leagueEvents?.[0]?.strLeagueBadge ? (
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded border border-zinc-800 bg-zinc-950">
                                                <img
                                                    loading="lazy"
                                                    src={
                                                        leagueEvents[0]
                                                            .strLeagueBadge
                                                    }
                                                    alt={league}
                                                    className="h-6 w-6 object-contain"
                                                />
                                            </div>
                                        ) : null}
                                        <h2 className="text-xl font-bold uppercase tracking-tight text-white">
                                            {league}
                                        </h2>
                                        <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-black text-zinc-400">
                                            {leagueEvents.length} MATCHES
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        {leagueEvents.map((event) => (
                                            <div
                                                key={event.idEvent}
                                                className="flex flex-col justify-between rounded-lg border border-zinc-800 bg-zinc-900 p-5 transition-colors hover:border-zinc-600"
                                            >
                                                {/* Header Event */}
                                                <div className="mb-5 flex items-center justify-between border-b border-zinc-800 pb-3">
                                                    <button
                                                        onClick={() =>
                                                            fetchMatchDetails(
                                                                event,
                                                            )
                                                        }
                                                        className="text-zinc-400 transition-colors hover:text-white"
                                                    >
                                                        Details →
                                                    </button>
                                                    <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-black uppercase text-zinc-300">
                                                        {event.strTime
                                                            ? moment
                                                                  .utc(
                                                                      `${event.dateEvent}T${event.strTime}`,
                                                                  )
                                                                  .utcOffset(7)
                                                                  .format(
                                                                      "DD/MM HH:mm",
                                                                  )
                                                            : "TBD"}
                                                    </span>
                                                </div>

                                                {/* Teams Matrix */}
                                                <div className="flex items-center justify-between gap-4 py-2">
                                                    {/* Home Team */}
                                                    <div className="flex min-w-0 flex-1 flex-col items-center text-center">
                                                        <div className="mb-2 flex h-12 w-12 shrink-0 items-center justify-center rounded border border-zinc-800 bg-zinc-950">
                                                            {event.strHomeTeamBadge ? (
                                                                <img
                                                                    loading="lazy"
                                                                    src={
                                                                        event.strHomeTeamBadge
                                                                    }
                                                                    alt={
                                                                        event.strHomeTeam
                                                                    }
                                                                    className="h-8 w-8 object-contain"
                                                                />
                                                            ) : (
                                                                <span className="text-lg font-bold text-zinc-700">
                                                                    {event.strHomeTeam.charAt(
                                                                        0,
                                                                    )}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <h3 className="line-clamp-2 text-balance text-[11px] font-bold uppercase leading-tight text-zinc-100">
                                                            {event.strHomeTeam}
                                                        </h3>
                                                    </div>

                                                    {/* Score Center */}
                                                    <div className="flex min-w-[40px] shrink-0 flex-col items-center justify-center">
                                                        {event.intHomeScore !==
                                                        null ? (
                                                            <div className="flex gap-1 rounded bg-zinc-800 px-3 py-1 text-xl font-black text-white">
                                                                <span
                                                                    className={
                                                                        event.intHomeScore >
                                                                        event.intAwayScore
                                                                            ? "text-white"
                                                                            : "text-zinc-500"
                                                                    }
                                                                >
                                                                    {
                                                                        event.intHomeScore
                                                                    }
                                                                </span>
                                                                <span className="px-1 text-zinc-600">
                                                                    -
                                                                </span>
                                                                <span
                                                                    className={
                                                                        event.intAwayScore >
                                                                        event.intHomeScore
                                                                            ? "text-white"
                                                                            : "text-zinc-500"
                                                                    }
                                                                >
                                                                    {
                                                                        event.intAwayScore
                                                                    }
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <div className="rounded border border-zinc-800 bg-zinc-950 px-3 py-1 text-[10px] font-black text-zinc-600">
                                                                VS
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Away Team */}
                                                    <div className="flex min-w-0 flex-1 flex-col items-center text-center">
                                                        <div className="mb-2 flex h-12 w-12 shrink-0 items-center justify-center rounded border border-zinc-800 bg-zinc-950">
                                                            {event.strAwayTeamBadge ? (
                                                                <img
                                                                    loading="lazy"
                                                                    src={
                                                                        event.strAwayTeamBadge
                                                                    }
                                                                    alt={
                                                                        event.strAwayTeam
                                                                    }
                                                                    className="h-8 w-8 object-contain"
                                                                />
                                                            ) : (
                                                                <span className="text-lg font-bold text-zinc-700">
                                                                    {event.strAwayTeam.charAt(
                                                                        0,
                                                                    )}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <h3 className="line-clamp-2 text-[11px] font-bold uppercase leading-tight text-zinc-100">
                                                            {event.strAwayTeam}
                                                        </h3>
                                                    </div>
                                                </div>

                                                {/* Footer Event */}
                                                <div className="mt-5 flex items-center justify-between border-t border-zinc-800 pt-3 text-[10px] font-bold text-zinc-600">
                                                    <span className="uppercase">
                                                        {event.strStatus ||
                                                            "Scheduled"}
                                                    </span>
                                                    <span className="text-zinc-700">
                                                        |
                                                    </span>
                                                    <span className="uppercase">
                                                        {event.strSeason}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            ),
                        )}
                    </div>
                ) : (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900 py-20 text-center">
                        <div className="mb-4 text-4xl opacity-30 grayscale">
                            🗓️
                        </div>
                        <h2 className="mb-1 text-xl font-bold uppercase tracking-tight text-white">
                            No data available
                        </h2>
                        <p className="text-xs text-zinc-600">
                            Nothing scheduled for this date.
                        </p>
                    </div>
                )}
            </div>

            {/* Float Scroll Top - Flat version */}
            <button
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="fixed bottom-6 right-6 z-50 flex h-10 w-10 items-center justify-center rounded bg-zinc-200 text-sm font-bold text-black shadow-xl transition-colors hover:bg-white"
            >
                TOP
            </button>

            {/* Match Details Modal */}
            {isModalOpen && selectedMatch && (
                <div className="animate-in fade-in z-100 fixed inset-0 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm duration-300">
                    <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-2xl">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 p-4">
                            <div>
                                <h2 className="text-lg font-bold uppercase tracking-tight text-white">
                                    {selectedMatch.strEvent}
                                </h2>
                                <p className="text-[10px] font-black uppercase text-zinc-500">
                                    {selectedMatch.strLeague} /{" "}
                                    {selectedMatch.dateEvent}
                                </p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="flex h-8 w-8 items-center justify-center rounded bg-zinc-800 font-bold text-white transition-colors hover:bg-zinc-700"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 space-y-8 overflow-y-auto p-6">
                            {loadingDetails ? (
                                <div className="flex flex-col items-center justify-center space-y-4 py-20">
                                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-800 border-t-zinc-200"></div>
                                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                                        Loading Match Insights...
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {/* Stats Section */}
                                    {matchDetails.stats &&
                                        matchDetails.stats.length > 0 && (
                                            <section>
                                                <div className="mb-4 flex items-center gap-2 border-l-4 border-zinc-500 pl-3">
                                                    <h3 className="text-sm font-black uppercase tracking-wider text-white">
                                                        Match Statistics
                                                    </h3>
                                                </div>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {matchDetails.stats.map(
                                                        (stat, i) => (
                                                            <div
                                                                key={i}
                                                                className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950 p-3 text-xs"
                                                            >
                                                                <span className="font-bold text-zinc-400">
                                                                    {
                                                                        stat.strStat
                                                                    }
                                                                </span>
                                                                <span className="font-black text-white">
                                                                    {
                                                                        stat.intStat
                                                                    }
                                                                </span>
                                                            </div>
                                                        ),
                                                    )}
                                                </div>
                                            </section>
                                        )}

                                    {/* Lineups Section */}
                                    {matchDetails.lineups &&
                                        matchDetails.lineups.length > 0 && (
                                            <section>
                                                <div className="mb-4 flex items-center gap-2 border-l-4 border-zinc-500 pl-3">
                                                    <h3 className="text-sm font-black uppercase tracking-wider text-white">
                                                        Lineups
                                                    </h3>
                                                </div>
                                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                    <div className="space-y-2">
                                                        <h4 className="border-b border-zinc-800 pb-2 text-[10px] font-black uppercase text-zinc-500">
                                                            Home Starters
                                                        </h4>
                                                        {matchDetails.lineups
                                                            .filter(
                                                                (l) =>
                                                                    l.strPosition !==
                                                                        "Substitute" &&
                                                                    l.idTeam ===
                                                                        selectedMatch.idHomeTeam,
                                                            )
                                                            .map(
                                                                (player, i) => (
                                                                    <div
                                                                        key={i}
                                                                        className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-300"
                                                                    >
                                                                        <span>
                                                                            {
                                                                                player.strPlayer
                                                                            }
                                                                        </span>
                                                                        <span className="text-[10px] font-bold uppercase text-zinc-600">
                                                                            {
                                                                                player.strPosition
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                ),
                                                            )}
                                                    </div>
                                                    <div className="space-y-2">
                                                        <h4 className="border-b border-zinc-800 pb-2 text-[10px] font-black uppercase text-zinc-500">
                                                            Away Starters
                                                        </h4>
                                                        {matchDetails.lineups
                                                            .filter(
                                                                (l) =>
                                                                    l.strPosition !==
                                                                        "Substitute" &&
                                                                    l.idTeam ===
                                                                        selectedMatch.idAwayTeam,
                                                            )
                                                            .map(
                                                                (player, i) => (
                                                                    <div
                                                                        key={i}
                                                                        className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-300"
                                                                    >
                                                                        <span>
                                                                            {
                                                                                player.strPlayer
                                                                            }
                                                                        </span>
                                                                        <span className="text-[10px] font-bold uppercase text-zinc-600">
                                                                            {
                                                                                player.strPosition
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                ),
                                                            )}
                                                    </div>
                                                </div>
                                            </section>
                                        )}

                                    {/* TV Section */}
                                    {matchDetails.tv &&
                                        matchDetails.tv.length > 0 && (
                                            <section>
                                                <div className="mb-4 flex items-center gap-2 border-l-4 border-zinc-500 pl-3">
                                                    <h3 className="text-sm font-black uppercase tracking-wider text-white">
                                                        Broadcasting
                                                    </h3>
                                                </div>
                                                <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
                                                    {matchDetails.tv.map(
                                                        (tv, i) => (
                                                            <div
                                                                key={i}
                                                                className="flex flex-col items-center gap-2 rounded border border-zinc-800 bg-zinc-950 p-3 transition-colors hover:border-zinc-700"
                                                            >
                                                                {tv.strLogo ? (
                                                                    <img
                                                                        loading="lazy"
                                                                        src={
                                                                            tv.strLogo
                                                                        }
                                                                        alt={
                                                                            tv.strChannel
                                                                        }
                                                                        className="h-8 w-auto object-contain brightness-90 transition-all hover:brightness-100"
                                                                    />
                                                                ) : (
                                                                    <div className="flex h-8 items-center justify-center">
                                                                        <span className="text-[8px] font-black uppercase text-zinc-700">
                                                                            No
                                                                            Logo
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                <div className="text-center">
                                                                    <p className="line-clamp-1 text-[10px] font-bold uppercase text-zinc-300">
                                                                        {
                                                                            tv.strChannel
                                                                        }
                                                                    </p>
                                                                    <p className="text-[8px] font-bold uppercase text-zinc-600">
                                                                        {
                                                                            tv.strCountry
                                                                        }
                                                                    </p>
                                                                </div>

                                                                {/* HLS Mapping Button */}
                                                                {(() => {
                                                                    const mapped =
                                                                        findHlsChannel(
                                                                            tv.strChannel,
                                                                        );
                                                                    if (
                                                                        mapped
                                                                    ) {
                                                                        return (
                                                                            <a
                                                                                href={`/entertainment/tv?id=${mapped.id}`}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-sm bg-zinc-800 py-1 text-[8px] font-black uppercase text-white transition-all hover:bg-zinc-700 hover:text-cyan-400 active:scale-95"
                                                                            >
                                                                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-600 shadow-[0_0_5px_rgba(220,38,38,0.8)]"></span>
                                                                                Xem
                                                                                ngay
                                                                            </a>
                                                                        );
                                                                    }
                                                                    return null;
                                                                })()}
                                                            </div>
                                                        ),
                                                    )}
                                                </div>
                                            </section>
                                        )}

                                    {/* Highlights Section */}
                                    {matchDetails.highlights && (
                                        <section>
                                            <div className="mb-4 flex items-center gap-2 border-l-4 border-zinc-500 pl-3">
                                                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                                                    Match Highlights
                                                </h3>
                                            </div>
                                            <a
                                                href={
                                                    matchDetails.highlights
                                                        .strVideo
                                                }
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 rounded bg-zinc-200 px-4 py-2 text-[10px] font-black uppercase text-black transition-colors hover:bg-white"
                                            >
                                                ▶ Watch Video Highlights
                                            </a>
                                        </section>
                                    )}

                                    {(!matchDetails.stats ||
                                        matchDetails.stats.length === 0) &&
                                        (!matchDetails.lineups ||
                                            matchDetails.lineups.length ===
                                                0) &&
                                        (!matchDetails.tv ||
                                            matchDetails.tv.length === 0) &&
                                        !matchDetails.highlights && (
                                            <div className="py-10 text-center text-zinc-600">
                                                <p className="text-xs font-bold uppercase tracking-widest">
                                                    No detailed insights
                                                    available for this event
                                                    yet.
                                                </p>
                                            </div>
                                        )}
                                </>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="flex justify-end border-t border-zinc-800 bg-zinc-950 p-4">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="rounded bg-zinc-800 px-6 py-2 text-[10px] font-black uppercase text-zinc-300 transition-colors hover:bg-zinc-700"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
