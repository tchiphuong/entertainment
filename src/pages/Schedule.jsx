import { useEffect, useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "react-aria-components";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import ScheduleFilterBar from "../components/schedule/ScheduleFilterBar";
import LeagueSection from "../components/schedule/LeagueSection";
import LeagueStandings from "../components/schedule/LeagueStandings";
import MatchDetailModal from "../components/schedule/MatchDetailModal";
import { scheduleService } from "../services/schedule/scheduleService";

export default function Schedule() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState("matches"); // "matches" | "standings"
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

    // Tải danh sách kênh HLS mapping
    useEffect(() => {
        const loadHls = async () => {
            const channels = await scheduleService.fetchHlsMapping();
            setHlsChannels(channels);
        };
        loadHls();
    }, []);

    // Cập nhật tiêu đề trang và fetch sự kiện khi đổi ngày
    const loadEvents = useCallback(async (date) => {
        setLoading(true);
        const data = await scheduleService.fetchEventsByDate(date);
        setEvents(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        document.title = activeTab === "matches"
            ? "Lịch Thi Đấu & Kết Quả • Sports Hub"
            : "Bảng Xếp Hạng Giải Đấu • Sports Hub";
        if (activeTab === "matches") {
            loadEvents(selectedDate);
        }
    }, [selectedDate, loadEvents, activeTab]);

    // Xử lý mở modal chi tiết trận đấu
    const handleSelectMatch = useCallback(async (event) => {
        setSelectedMatch(event);
        setIsModalOpen(true);
        setLoadingDetails(true);
        setMatchDetails({ lineups: [], stats: [], tv: [], highlights: null });

        const details = await scheduleService.fetchMatchDetails(event);
        setMatchDetails(details);
        setLoadingDetails(false);
    }, []);

    const handleCloseModal = useCallback(() => {
        setIsModalOpen(false);
        setSelectedMatch(null);
    }, []);

    // Lọc theo từ khóa tìm kiếm
    const filteredEvents = useMemo(() => {
        return scheduleService.filterEventsBySearch(events, searchQuery);
    }, [events, searchQuery]);

    // Nhóm theo giải đấu và sắp xếp ưu tiên
    const groupedEvents = useMemo(() => {
        return scheduleService.groupEventsByLeague(filteredEvents);
    }, [filteredEvents]);

    const totalMatches = filteredEvents.length;
    const hasEvents = Object.keys(groupedEvents).length > 0;

    return (
        <div className="min-h-screen bg-zinc-950 font-sans text-white selection:bg-red-600/30">
            {/* Header Lịch Thi Đấu & Bảng Xếp Hạng */}
            <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
                <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between md:px-8">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-600/30 bg-red-600/10 text-red-500 shadow-sm">
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-base font-black uppercase tracking-wider text-white">
                                {activeTab === "matches"
                                    ? t("schedule.title") || "Lịch Thi Đấu Thể Thao"
                                    : "Bảng Xếp Hạng Giải Đấu"}
                            </h1>
                            <p className="text-[11px] font-medium text-zinc-400">
                                {activeTab === "matches"
                                    ? "Cập nhật trực tiếp kết quả & kênh phát sóng"
                                    : "Theo dõi vị trí, điểm số & phong độ các câu lạc bộ"}
                            </p>
                        </div>
                    </div>

                    {/* Tab Switcher (HeroUI Buttons) */}
                    <div className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/90 p-1 shadow-inner">
                        <Button
                            onPress={() => setActiveTab("matches")}
                            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-black uppercase tracking-wider transition-all outline-none cursor-pointer ${
                                activeTab === "matches"
                                    ? "bg-red-600 text-white shadow-md"
                                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                            }`}
                        >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>Lịch Thi Đấu</span>
                            {activeTab === "matches" && totalMatches > 0 && (
                                <span className="rounded-full bg-black/30 px-1.5 py-0.5 text-[10px] font-bold">
                                    {totalMatches}
                                </span>
                            )}
                        </Button>

                        <Button
                            onPress={() => setActiveTab("standings")}
                            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-black uppercase tracking-wider transition-all outline-none cursor-pointer ${
                                activeTab === "standings"
                                    ? "bg-red-600 text-white shadow-md"
                                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                            }`}
                        >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <span>Bảng Xếp Hạng</span>
                        </Button>
                    </div>
                </div>
            </header>

            <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
                {activeTab === "matches" ? (
                    <>
                        {/* Filter & Search Bar */}
                        <ScheduleFilterBar
                            selectedDate={selectedDate}
                            onDateChange={setSelectedDate}
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            onRefresh={() => loadEvents(selectedDate)}
                            totalMatches={totalMatches}
                            loading={loading}
                        />

                        {/* Loading State */}
                        {loading && (
                            <div className="flex min-h-[360px] items-center justify-center py-20">
                                <LoadingSpinner />
                            </div>
                        )}

                        {/* Match Lists by League */}
                        {hasEvents ? (
                            <div className="space-y-10 pb-16">
                                {Object.entries(groupedEvents).map(([league, leagueEvents]) => (
                                    <LeagueSection
                                        key={league}
                                        league={league}
                                        events={leagueEvents}
                                        onSelectMatch={handleSelectMatch}
                                    />
                                ))}
                            </div>
                        ) : (
                            !loading && (
                                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 py-20 text-center">
                                    <div className="mb-4 flex justify-center text-zinc-600">
                                        <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <h2 className="text-lg font-black uppercase tracking-tight text-white">
                                        {t("schedule.noData") || "Không có trận đấu nào trong ngày này"}
                                    </h2>
                                    <p className="mt-1 text-xs text-zinc-500">
                                        {t("schedule.noDataSub") || "Vui lòng chọn ngày khác hoặc thử lại sau"}
                                    </p>
                                </div>
                            )
                        )}
                    </>
                ) : (
                    /* Tab Bảng Xếp Hạng */
                    <div className="pb-16">
                        <LeagueStandings />
                    </div>
                )}
            </div>

            {/* Match Details Modal */}
            <MatchDetailModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                match={selectedMatch}
                details={matchDetails}
                loadingDetails={loadingDetails}
                hlsChannels={hlsChannels}
            />
        </div>
    );
}
