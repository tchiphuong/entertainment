import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
    Button,
    Select,
    SelectValue,
    ListBox,
    ListBoxItem,
    Popover,
    Label,
} from "react-aria-components";
import LoadingSpinner from "../ui/LoadingSpinner";
import { scheduleService } from "../../services/schedule/scheduleService";

export default function LeagueStandings() {
    const { t } = useTranslation();
    const [leagues, setLeagues] = useState([]);
    const [selectedLeagueId, setSelectedLeagueId] = useState("4328");
    const [selectedSeason, setSelectedSeason] = useState("");
    const [standings, setStandings] = useState([]);
    const [loadingLeagues, setLoadingLeagues] = useState(true);
    const [loadingStandings, setLoadingStandings] = useState(true);

    // Tính toán động các mùa giải gần nhất (Không hardcode)
    const availableSeasons = useMemo(() => {
        return scheduleService.generateRecentSeasons(5);
    }, []);

    // Tải danh sách giải đấu động từ API
    useEffect(() => {
        let isMounted = true;
        const loadLeagues = async () => {
            setLoadingLeagues(true);
            const data = await scheduleService.fetchSupportedStandingsLeagues();
            if (isMounted && data.length > 0) {
                setLeagues(data);
                setSelectedLeagueId(data[0].id);
                if (availableSeasons.length > 0) {
                    setSelectedSeason(availableSeasons[0].value);
                }
            }
            if (isMounted) setLoadingLeagues(false);
        };
        loadLeagues();
        return () => {
            isMounted = false;
        };
    }, [availableSeasons]);

    // Giải đấu hiện đang được chọn
    const activeLeague = useMemo(() => {
        return (
            leagues.find((l) => l.id === selectedLeagueId) ||
            leagues[0] ||
            null
        );
    }, [leagues, selectedLeagueId]);

    // Tải dữ liệu bảng xếp hạng từ API
    const loadStandings = useCallback(async (leagueId, season) => {
        if (!leagueId || !season) return;
        setLoadingStandings(true);
        const data = await scheduleService.fetchStandings(leagueId, season);
        setStandings(data);
        setLoadingStandings(false);
    }, []);

    useEffect(() => {
        if (selectedLeagueId && selectedSeason) {
            loadStandings(selectedLeagueId, selectedSeason);
        }
    }, [selectedLeagueId, selectedSeason, loadStandings]);

    // Xác định khu vực phân hạng (Cúp C1, C2, C3, Xuống hạng) để thể hiện vạch chỉ báo
    const getZoneIndicatorColor = (rank, totalTeams, description = "") => {
        const descLower = (description || "").toLowerCase();

        if (descLower.includes("champions league") || rank <= 4) {
            return "bg-emerald-500";
        }
        if (descLower.includes("europa league") || rank === 5) {
            return "bg-sky-500";
        }
        if (descLower.includes("conference") || descLower.includes("qualification") || rank === 6) {
            return "bg-amber-500";
        }
        if (descLower.includes("relegation") || (totalTeams > 6 && rank > totalTeams - 3)) {
            return "bg-red-500";
        }
        return "bg-transparent";
    };

    // Xác định biểu tượng biến động thứ hạng / phong độ cạnh số hạng
    const renderMovementIndicator = (formStr) => {
        if (!formStr) {
            return (
                <span className="flex h-3.5 w-3.5 items-center justify-center text-zinc-600" title={t("schedule.rankSame") || "Giữ nguyên"}>
                    <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" />
                    </svg>
                </span>
            );
        }

        const lastResult = formStr.slice(-1).toUpperCase();
        if (lastResult === "W") {
            return (
                <span className="flex h-3.5 w-3.5 items-center justify-center text-emerald-400" title={t("schedule.rankUp") || "Tăng phong độ / Thắng"}>
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
                    </svg>
                </span>
            );
        }
        if (lastResult === "L") {
            return (
                <span className="flex h-3.5 w-3.5 items-center justify-center text-red-400" title={t("schedule.rankDown") || "Giảm phong độ / Thua"}>
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                </span>
            );
        }

        return (
            <span className="flex h-3.5 w-3.5 items-center justify-center text-amber-500" title={t("schedule.rankSame") || "Giữ nguyên / Hòa"}>
                <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" />
                </svg>
            </span>
        );
    };

    // Helper tính class cho ô hiển thị thứ hạng
    const getRankBadgeClass = (rank, isTop, indicatorColor) => {
        if (isTop) return "bg-red-600 text-white shadow-sm";
        if (rank <= 4) return "bg-emerald-500/20 text-emerald-400";
        if (indicatorColor === "bg-red-500") return "bg-red-500/20 text-red-400";
        return "text-zinc-400";
    };

    // Render nội dung chính của bảng xếp hạng
    const renderTableContent = () => {
        if (loadingStandings) {
            return (
                <div className="flex min-h-80 items-center justify-center py-20">
                    <LoadingSpinner />
                </div>
            );
        }

        if (standings.length === 0) {
            return (
                <div className="py-16 text-center">
                    <div className="mb-3 flex justify-center text-zinc-600">
                        <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <p className="text-sm font-bold text-zinc-400">
                        Chưa có dữ liệu bảng xếp hạng cho mùa giải này
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">
                        Vui lòng chọn giải đấu hoặc mùa giải khác
                    </p>
                </div>
            );
        }

        return (
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-zinc-300">
                    <thead className="border-b border-zinc-800 bg-zinc-950/60 text-[11px] font-black uppercase tracking-wider text-zinc-400">
                        <tr>
                            <th scope="col" className="px-3 py-3.5 text-center w-16">
                                <div className="flex items-center justify-center gap-1">
                                    <span>#</span>
                                    <span className="text-[9px] text-zinc-600">+/-</span>
                                </div>
                            </th>
                            <th scope="col" className="px-4 py-3.5 min-w-[200px]">{t("schedule.club") || "Câu Lạc Bộ"}</th>
                            <th scope="col" className="px-3 py-3.5 text-center">{t("schedule.played") || "Trận"}</th>
                            <th scope="col" className="px-3 py-3.5 text-center">{t("schedule.won") || "T"}</th>
                            <th scope="col" className="px-3 py-3.5 text-center">{t("schedule.drawn") || "H"}</th>
                            <th scope="col" className="px-3 py-3.5 text-center">{t("schedule.lost") || "B"}</th>
                            <th scope="col" className="px-3 py-3.5 text-center hidden md:table-cell" title={t("schedule.goalsFor") || "Bàn thắng"}>BT</th>
                            <th scope="col" className="px-3 py-3.5 text-center hidden md:table-cell" title={t("schedule.goalsAgainst") || "Bàn thua"}>BB</th>
                            <th scope="col" className="px-3 py-3.5 text-center">{t("schedule.goalDiff") || "HS"}</th>
                            <th scope="col" className="px-4 py-3.5 text-center font-black text-white">{t("schedule.points") || "Điểm"}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                        {standings.map((row) => {
                            const indicatorColor = getZoneIndicatorColor(row.rank, standings.length, row.description);
                            const isTop = row.rank === 1;
                            const rankBadgeClass = getRankBadgeClass(row.rank, isTop, indicatorColor);

                            return (
                                <tr
                                    key={row.teamId || row.rank}
                                    className={`transition-colors hover:bg-zinc-800/50 ${
                                        isTop ? "bg-red-600/5 font-semibold" : ""
                                    }`}
                                >
                                    {/* Rank with Left Indicator Line & Movement Arrow */}
                                    <td className="relative px-3 py-3.5 text-center">
                                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${indicatorColor}`} />
                                        <div className="flex items-center justify-center gap-1.5">
                                            <span
                                                className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-black ${rankBadgeClass}`}
                                            >
                                                {row.rank}
                                            </span>
                                            {renderMovementIndicator(row.form)}
                                        </div>
                                    </td>

                                    {/* Team Name and Badge */}
                                    <td className="px-4 py-3.5">
                                        <div className="flex items-center gap-3">
                                            {row.badge ? (
                                                <img
                                                    src={row.badge}
                                                    alt={row.teamName}
                                                    className="h-6 w-6 object-contain drop-shadow-sm"
                                                    loading="lazy"
                                                    onError={(e) => {
                                                        e.target.style.display = "none";
                                                    }}
                                                />
                                            ) : (
                                                <div className="flex h-6 w-6 items-center justify-center rounded bg-zinc-800 text-[10px] font-black text-zinc-300">
                                                    {row.teamName.slice(0, 2).toUpperCase()}
                                                </div>
                                            )}
                                            <span className="font-bold text-white tracking-wide">
                                                {row.teamName}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Matches Played */}
                                    <td className="px-3 py-3.5 text-center font-medium text-zinc-300">
                                        {row.played}
                                    </td>

                                    {/* Won */}
                                    <td className="px-3 py-3.5 text-center font-medium text-emerald-400">
                                        {row.win}
                                    </td>

                                    {/* Draw */}
                                    <td className="px-3 py-3.5 text-center font-medium text-amber-400">
                                        {row.draw}
                                    </td>

                                    {/* Loss */}
                                    <td className="px-3 py-3.5 text-center font-medium text-red-400">
                                        {row.loss}
                                    </td>

                                    {/* Goals For */}
                                    <td className="px-3 py-3.5 text-center font-medium text-zinc-400 hidden md:table-cell">
                                        {row.goalsFor}
                                    </td>

                                    {/* Goals Against */}
                                    <td className="px-3 py-3.5 text-center font-medium text-zinc-400 hidden md:table-cell">
                                        {row.goalsAgainst}
                                    </td>

                                    {/* Goal Difference */}
                                    <td className="px-3 py-3.5 text-center font-bold text-zinc-200">
                                        {row.goalDifference > 0
                                            ? `+${row.goalDifference}`
                                            : row.goalDifference}
                                    </td>

                                    {/* Total Points */}
                                    <td className="px-4 py-3.5 text-center">
                                        <span className="inline-block rounded-lg bg-zinc-800 px-2.5 py-1 text-xs font-black text-white shadow-sm">
                                            {row.points}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Thanh điều khiển chọn Giải đấu & Mùa giải dạng HeroUI Combobox */}
            <div className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4 shadow-xl backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-4">
                    {/* Combobox Chọn Giải Đấu bằng HeroUI Select */}
                    {loadingLeagues ? (
                        <div className="flex h-10 items-center gap-3">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-red-600" />
                            <span className="text-xs text-zinc-400">Đang tải danh sách giải đấu...</span>
                        </div>
                    ) : (
                        <Select
                            selectedKey={selectedLeagueId}
                            onSelectionChange={(key) => setSelectedLeagueId(String(key))}
                            aria-label={t("schedule.league") || "Giải đấu"}
                            className="flex items-center gap-2.5"
                        >
                            <Label className="text-xs font-semibold text-zinc-400">
                                {t("schedule.league") || "Giải đấu"}:
                            </Label>
                            <Button className="flex items-center justify-between gap-3 min-w-[230px] rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-all hover:border-zinc-700 focus:border-red-600 outline-none cursor-pointer">
                                <div className="flex items-center gap-2.5 overflow-hidden">
                                    {activeLeague?.badge ? (
                                        <img
                                            src={activeLeague.badge}
                                            alt={activeLeague.name}
                                            className="h-5 w-5 shrink-0 object-contain"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-800 text-[10px] font-black">
                                            {activeLeague?.name ? activeLeague.name.slice(0, 2).toUpperCase() : "GD"}
                                        </span>
                                    )}
                                    <span className="truncate">{activeLeague?.name || (t("schedule.league") || "Giải đấu")}</span>
                                </div>
                                <svg
                                    className="h-4 w-4 shrink-0 text-zinc-400 transition-transform"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </Button>
                            <Popover className="min-w-[260px] max-h-[380px] overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/95 p-1.5 shadow-2xl backdrop-blur-md animate-in fade-in-0 zoom-in-95 z-50">
                                <ListBox className="outline-none space-y-1">
                                    {leagues.map((league) => (
                                        <ListBoxItem
                                            key={league.id}
                                            id={league.id}
                                            textValue={league.name}
                                            className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-xs font-bold text-zinc-300 transition-colors hover:bg-red-600/10 hover:text-red-500 focus:bg-red-600 focus:text-white outline-none data-[selected=true]:bg-red-600 data-[selected=true]:text-white"
                                        >
                                            {({ isSelected }) => (
                                                <>
                                                    <div className="flex items-center gap-2.5">
                                                        {league.badge ? (
                                                            <img
                                                                src={league.badge}
                                                                alt={league.name}
                                                                className="h-5 w-5 object-contain"
                                                            />
                                                        ) : (
                                                            <span className="flex h-5 w-5 items-center justify-center rounded bg-zinc-800 text-[10px] font-black">
                                                                {league.name.slice(0, 2).toUpperCase()}
                                                            </span>
                                                        )}
                                                        <span>{league.name}</span>
                                                    </div>
                                                    {isSelected && (
                                                        <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </>
                                            )}
                                        </ListBoxItem>
                                    ))}
                                </ListBox>
                            </Popover>
                        </Select>
                    )}

                    {/* Combobox Chọn Mùa Giải bằng HeroUI Select */}
                    <Select
                        selectedKey={selectedSeason}
                        onSelectionChange={(key) => setSelectedSeason(String(key))}
                        aria-label={t("schedule.season") || "Mùa giải"}
                        className="flex items-center gap-2.5"
                    >
                        <Label className="text-xs font-semibold text-zinc-400">
                            {t("schedule.season") || "Mùa giải"}:
                        </Label>
                        <Button className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-all hover:border-zinc-700 focus:border-red-600 outline-none cursor-pointer">
                            <SelectValue />
                            <svg
                                className="h-4 w-4 text-zinc-400 transition-transform"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </Button>
                        <Popover className="min-w-[200px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/95 p-1.5 shadow-2xl backdrop-blur-md animate-in fade-in-0 zoom-in-95 z-50">
                            <ListBox className="outline-none space-y-1">
                                {availableSeasons.map((s) => (
                                    <ListBoxItem
                                        key={s.value}
                                        id={s.value}
                                        textValue={s.label}
                                        className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-xs font-bold text-zinc-300 transition-colors hover:bg-red-600/10 hover:text-red-500 focus:bg-red-600 focus:text-white outline-none data-[selected=true]:bg-red-600 data-[selected=true]:text-white"
                                    >
                                        {({ isSelected }) => (
                                            <>
                                                <span>{s.label}</span>
                                                {isSelected && (
                                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </>
                                        )}
                                    </ListBoxItem>
                                ))}
                            </ListBox>
                        </Popover>
                    </Select>
                </div>
            </div>

            {/* Khung Bảng Xếp Hạng */}
            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-2xl backdrop-blur-md">
                {/* Header Bảng Xếp Hạng với Logo Giải Đấu lớn */}
                <div className="flex flex-col gap-4 border-b border-zinc-800 bg-zinc-950/80 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                        {activeLeague?.badge || activeLeague?.logo ? (
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 p-1.5 shadow-sm">
                                <img
                                    src={activeLeague.badge || activeLeague.logo}
                                    alt={activeLeague.name}
                                    className="max-h-full max-w-full object-contain"
                                    loading="lazy"
                                />
                            </div>
                        ) : (
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-red-600/30 bg-red-600/10 text-red-500">
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                        )}

                        <div>
                            <h2 className="text-base font-black uppercase tracking-wider text-white">
                                {t("schedule.standings") || "Bảng Xếp Hạng"} {activeLeague?.name || "Giải Đấu"}
                            </h2>
                            <p className="text-xs text-zinc-400">
                                {t("schedule.season") || "Mùa giải"} {selectedSeason} • Dữ liệu TheSportsDB
                            </p>
                        </div>
                    </div>

                    {/* Chú thích Vị trí / Suất tham dự */}
                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-zinc-400">
                        <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1">
                            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                            <span className="text-emerald-400">Cúp C1 (Top 4)</span>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-lg border border-sky-500/20 bg-sky-500/5 px-2.5 py-1">
                            <span className="h-2 w-2 rounded-full bg-sky-500"></span>
                            <span className="text-sky-400">Cúp C2 (Top 5)</span>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-1">
                            <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                            <span className="text-amber-400">Cúp C3 (Top 6)</span>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 px-2.5 py-1">
                            <span className="h-2 w-2 rounded-full bg-red-500"></span>
                            <span className="text-red-400">{t("schedule.relegation") || "Xuống hạng"}</span>
                        </div>
                    </div>
                </div>

                {/* Nội dung bảng xếp hạng */}
                {renderTableContent()}

                {/* Footer Chú Thích Bảng Xếp Hạng */}
                {standings.length > 0 && (
                    <div className="flex flex-col gap-3 border-t border-zinc-800 bg-zinc-950/60 px-6 py-3.5 text-xs text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-4">
                            <span className="font-bold text-zinc-300">Biến động:</span>
                            <div className="flex items-center gap-1 text-emerald-400 font-medium">
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
                                </svg>
                                <span>{t("schedule.rankUp") || "Tăng"}</span>
                            </div>
                            <div className="flex items-center gap-1 text-amber-400 font-medium">
                                <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" />
                                </svg>
                                <span>{t("schedule.rankSame") || "Giữ nguyên"}</span>
                            </div>
                            <div className="flex items-center gap-1 text-red-400 font-medium">
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                                </svg>
                                <span>{t("schedule.rankDown") || "Giảm"}</span>
                            </div>
                        </div>

                        <div className="text-[11px] text-zinc-500">
                            BT: {t("schedule.goalsFor") || "Bàn thắng"} • BB: {t("schedule.goalsAgainst") || "Bàn thua"} • HS: {t("schedule.goalDiff") || "Hiệu số"}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
