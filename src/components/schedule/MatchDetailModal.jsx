import { memo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { findHlsChannel } from "../../services/schedule/scheduleService";

const MatchDetailModal = memo(({
    isOpen,
    onClose,
    match,
    details,
    loadingDetails,
    hlsChannels = [],
}) => {
    const { t } = useTranslation();

    if (!isOpen || !match) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-fade-in">
            <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-6 py-4">
                    <div>
                        <h2 className="text-lg font-black uppercase tracking-tight text-white md:text-xl">
                            {match.strEvent}
                        </h2>
                        <p className="text-xs font-bold uppercase tracking-wider text-red-500">
                            {match.strLeague} • {match.dateEvent}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 transition-colors hover:border-red-600 hover:bg-red-600 hover:text-white"
                        aria-label="Đóng"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 space-y-6 overflow-y-auto p-6 custom-scrollbar">
                    {loadingDetails ? (
                        <div className="flex flex-col items-center justify-center py-16 space-y-3">
                            <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-800 border-t-red-600"></div>
                            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                                {t("common.loading") || "Đang tải dữ liệu..."}
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Stats Section */}
                            {details.stats && details.stats.length > 0 && (
                                <section className="space-y-3">
                                    <div className="flex items-center gap-2 border-l-4 border-red-600 pl-3">
                                        <h3 className="text-sm font-black uppercase tracking-wider text-white">
                                            {t("schedule.statistics") || "Thống kê trận đấu"}
                                        </h3>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        {details.stats.map((stat, i) => (
                                            <div
                                                key={`${stat.strStat || ""}-${i}`}
                                                className="flex items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-950 px-3.5 py-2.5 text-xs"
                                            >
                                                <span className="font-bold text-zinc-400">
                                                    {stat.strStat}
                                                </span>
                                                <span className="font-black text-white">
                                                    {stat.intStat}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Lineups Section */}
                            {details.lineups && details.lineups.length > 0 && (
                                <section className="space-y-3">
                                    <div className="flex items-center gap-2 border-l-4 border-red-600 pl-3">
                                        <h3 className="text-sm font-black uppercase tracking-wider text-white">
                                            {t("schedule.lineups") || "Đội hình ra sân"}
                                        </h3>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        {/* Home Starters */}
                                        <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                                            <h4 className="border-b border-zinc-800 pb-2 text-xs font-black uppercase text-red-500">
                                                {match.strHomeTeam} ({t("schedule.homeStarters") || "Chủ nhà"})
                                            </h4>
                                            <div className="space-y-1.5 pt-1">
                                                {details.lineups
                                                    .filter(
                                                        (l) =>
                                                            l.strPosition !== "Substitute" &&
                                                            l.idTeam === match.idHomeTeam,
                                                    )
                                                    .map((player, i) => (
                                                        <div
                                                            key={`${player.idPlayer || player.strPlayer}-${i}`}
                                                            className="flex items-center justify-between text-xs text-zinc-300"
                                                        >
                                                            <span className="font-medium">
                                                                {player.strPlayer}
                                                            </span>
                                                            <span className="text-[10px] font-bold uppercase text-zinc-500">
                                                                {player.strPosition}
                                                            </span>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>

                                        {/* Away Starters */}
                                        <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                                            <h4 className="border-b border-zinc-800 pb-2 text-xs font-black uppercase text-zinc-400">
                                                {match.strAwayTeam} ({t("schedule.awayStarters") || "Đội khách"})
                                            </h4>
                                            <div className="space-y-1.5 pt-1">
                                                {details.lineups
                                                    .filter(
                                                        (l) =>
                                                            l.strPosition !== "Substitute" &&
                                                            l.idTeam === match.idAwayTeam,
                                                    )
                                                    .map((player, i) => (
                                                        <div
                                                            key={`${player.idPlayer || player.strPlayer}-${i}`}
                                                            className="flex items-center justify-between text-xs text-zinc-300"
                                                        >
                                                            <span className="font-medium">
                                                                {player.strPlayer}
                                                            </span>
                                                            <span className="text-[10px] font-bold uppercase text-zinc-500">
                                                                {player.strPosition}
                                                            </span>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* Broadcasting Section */}
                            {details.tv && details.tv.length > 0 && (
                                <section className="space-y-3">
                                    <div className="flex items-center gap-2 border-l-4 border-red-600 pl-3">
                                        <h3 className="text-sm font-black uppercase tracking-wider text-white">
                                            {t("schedule.broadcasting") || "Kênh phát sóng"}
                                        </h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                        {details.tv.map((tv, i) => {
                                            const mappedHls = findHlsChannel(tv.strChannel, hlsChannels);
                                            return (
                                                <div
                                                    key={`${tv.strChannel || ""}-${i}`}
                                                    className="flex flex-col items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-center transition-colors hover:border-zinc-700"
                                                >
                                                    {tv.strLogo ? (
                                                        <img
                                                            loading="lazy"
                                                            src={tv.strLogo}
                                                            alt={tv.strChannel}
                                                            className="h-8 object-contain"
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = "none";
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="flex h-8 items-center justify-center">
                                                            <span className="text-[10px] font-black uppercase text-zinc-600">
                                                                {tv.strChannel}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="line-clamp-1 text-xs font-bold text-zinc-200">
                                                            {tv.strChannel}
                                                        </p>
                                                        <p className="text-[9px] font-bold uppercase text-zinc-500">
                                                            {tv.strCountry || "Global"}
                                                        </p>
                                                    </div>

                                                    {mappedHls && (
                                                        <Link
                                                            to={`/tv?id=${mappedHls.id}`}
                                                            className="mt-1 flex w-full items-center justify-center gap-1 rounded-md bg-red-600/90 py-1 text-[10px] font-black uppercase text-white shadow transition-all hover:bg-red-600 active:scale-95"
                                                        >
                                                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white"></span>
                                                            {t("schedule.watchNow") || "Xem ngay"}
                                                        </Link>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}

                            {/* Video Highlights */}
                            {details.highlights?.strVideo && (
                                <section className="space-y-3">
                                    <div className="flex items-center gap-2 border-l-4 border-red-600 pl-3">
                                        <h3 className="text-sm font-black uppercase tracking-wider text-white">
                                            {t("schedule.highlights") || "Video Highlights"}
                                        </h3>
                                    </div>
                                    <a
                                        href={details.highlights.strVideo}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-xs font-black uppercase text-white shadow-lg transition-colors hover:bg-red-600"
                                    >
                                        ▶ {t("schedule.watchHighlights") || "Xem Highlights"}
                                    </a>
                                </section>
                            )}

                            {/* Empty state if nothing found */}
                            {(!details.stats || details.stats.length === 0) &&
                                (!details.lineups || details.lineups.length === 0) &&
                                (!details.tv || details.tv.length === 0) &&
                                !details.highlights && (
                                    <div className="py-8 text-center text-zinc-500">
                                        <p className="text-xs font-bold uppercase tracking-wider">
                                            {t("schedule.noInsights") || "Chưa có thông tin chi tiết cho trận đấu này"}
                                        </p>
                                    </div>
                                )}
                        </>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="flex justify-end border-t border-zinc-800 bg-zinc-950 px-6 py-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-2 text-xs font-black uppercase tracking-wider text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
                    >
                        {t("common.close") || "Đóng"}
                    </button>
                </div>
            </div>
        </div>
    );
});

export default MatchDetailModal;
