import { memo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PlayIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { Button, Chip, Modal, Spinner } from "../ui";
import { findHlsChannel } from "../../services/schedule/scheduleService";

const MatchStatsSection = ({ stats, t }) => {
    if (!stats || stats.length === 0) return null;
    return (
        <section className="space-y-3">
            <div className="flex items-center gap-2 border-l-4 border-red-600 pl-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    {t("schedule.statistics") || "Thống kê trận đấu"}
                </h3>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {stats.map((stat, i) => (
                    <div
                        key={`${stat.strStat || ""}-${i}`}
                        className="flex items-center justify-between rounded-xl border border-white/5 bg-zinc-950 px-3.5 py-2.5 text-xs"
                    >
                        <span className="font-bold text-zinc-400">{stat.strStat}</span>
                        <span className="font-black text-white">{stat.intStat}</span>
                    </div>
                ))}
            </div>
        </section>
    );
};

const LineupColumn = ({ title, teamName, isHome, players }) => (
    <div className="space-y-2 rounded-xl border border-white/5 bg-zinc-950 p-4">
        <h4 className={`border-b border-white/5 pb-2 text-xs font-black uppercase ${isHome ? "text-red-500" : "text-zinc-400"}`}>
            {teamName} ({title})
        </h4>
        <div className="space-y-1.5 pt-1">
            {players.map((player, i) => (
                <div
                    key={`${player.idPlayer || player.strPlayer}-${i}`}
                    className="flex items-center justify-between text-xs text-zinc-300"
                >
                    <span className="font-medium">{player.strPlayer}</span>
                    <span className="text-[10px] font-bold uppercase text-zinc-500">
                        {player.strPosition}
                    </span>
                </div>
            ))}
        </div>
    </div>
);

const MatchLineupsSection = ({ lineups, match, t }) => {
    if (!lineups || lineups.length === 0) return null;
    const homePlayers = lineups.filter((l) => l.strPosition !== "Substitute" && l.idTeam === match.idHomeTeam);
    const awayPlayers = lineups.filter((l) => l.strPosition !== "Substitute" && l.idTeam === match.idAwayTeam);

    return (
        <section className="space-y-3">
            <div className="flex items-center gap-2 border-l-4 border-red-600 pl-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    {t("schedule.lineups") || "Đội hình ra sân"}
                </h3>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <LineupColumn
                    title={t("schedule.homeStarters") || "Chủ nhà"}
                    teamName={match.strHomeTeam}
                    isHome={true}
                    players={homePlayers}
                />
                <LineupColumn
                    title={t("schedule.awayStarters") || "Đội khách"}
                    teamName={match.strAwayTeam}
                    isHome={false}
                    players={awayPlayers}
                />
            </div>
        </section>
    );
};

const TvChannelCard = ({ tv, hlsChannels, t }) => {
    const mappedHls = findHlsChannel(tv.strChannel, hlsChannels);
    return (
        <div className="flex flex-col items-center justify-between gap-2 rounded-xl border border-white/5 bg-zinc-950 p-3 text-center transition-colors hover:border-white/20">
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
                <p className="line-clamp-1 text-xs font-bold text-zinc-200">{tv.strChannel}</p>
                <p className="text-[9px] font-bold uppercase text-zinc-500">
                    {tv.strCountry || "Global"}
                </p>
            </div>

            {mappedHls && (
                <Link
                    to={`/tv?id=${mappedHls.id}`}
                    className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg bg-red-600 py-1 text-[10px] font-black uppercase text-white shadow transition-all hover:bg-red-500 active:scale-95"
                >
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white"></span>
                    {t("schedule.watchNow") || "Xem ngay"}
                </Link>
            )}
        </div>
    );
};

const MatchBroadcastingSection = ({ tvList, hlsChannels, t }) => {
    if (!tvList || tvList.length === 0) return null;
    return (
        <section className="space-y-3">
            <div className="flex items-center gap-2 border-l-4 border-red-600 pl-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    {t("schedule.broadcasting") || "Kênh phát sóng"}
                </h3>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {tvList.map((tv, i) => (
                    <TvChannelCard key={`${tv.strChannel || ""}-${i}`} tv={tv} hlsChannels={hlsChannels} t={t} />
                ))}
            </div>
        </section>
    );
};

const MatchHighlightsSection = ({ videoUrl, t }) => {
    if (!videoUrl) return null;
    return (
        <section className="space-y-3">
            <div className="flex items-center gap-2 border-l-4 border-red-600 pl-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    {t("schedule.highlights") || "Video Highlights"}
                </h3>
            </div>
            <a
                href={videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2 text-xs font-black uppercase text-white shadow-lg transition-colors hover:bg-red-600"
            >
                <PlayIcon className="h-4 w-4 text-red-500" />
                {t("schedule.watchHighlights") || "Xem Highlights"}
            </a>
        </section>
    );
};

const MatchModalHeader = ({ match, onClose }) => (
    <Modal.Header className="flex items-center justify-between border-b border-white/5 bg-zinc-950 px-6 py-4">
        <div>
            <Modal.Heading className="text-lg font-black uppercase tracking-tight text-white md:text-xl">
                {match.strEvent}
            </Modal.Heading>
            <div className="mt-1 flex items-center gap-2">
                <Chip color="danger" size="sm" variant="secondary">
                    {match.strLeague}
                </Chip>
                <span className="text-xs font-bold text-zinc-400">
                    {match.dateEvent}
                </span>
            </div>
        </div>
        <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-zinc-900 text-zinc-400 transition-colors hover:border-red-600 hover:bg-red-600 hover:text-white"
            aria-label="Đóng"
        >
            <XMarkIcon className="h-5 w-5" />
        </button>
    </Modal.Header>
);

const MatchModalLoading = ({ t }) => (
    <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <Spinner color="danger" size="lg" />
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
            {t("common.loading") || "Đang tải dữ liệu..."}
        </p>
    </div>
);

const MatchModalBody = ({ loadingDetails, details, match, hlsChannels, t }) => {
    if (loadingDetails) {
        return <MatchModalLoading t={t} />;
    }

    const hasAnyContent =
        (details.stats && details.stats.length > 0) ||
        (details.lineups && details.lineups.length > 0) ||
        (details.tv && details.tv.length > 0) ||
        Boolean(details.highlights?.strVideo);

    return (
        <>
            <MatchStatsSection stats={details.stats} t={t} />
            <MatchLineupsSection lineups={details.lineups} match={match} t={t} />
            <MatchBroadcastingSection tvList={details.tv} hlsChannels={hlsChannels} t={t} />
            <MatchHighlightsSection videoUrl={details.highlights?.strVideo} t={t} />

            {!hasAnyContent && (
                <div className="py-8 text-center text-zinc-500">
                    <p className="text-xs font-bold uppercase tracking-wider">
                        {t("schedule.noInsights") || "Chưa có thông tin chi tiết cho trận đấu này"}
                    </p>
                </div>
            )}
        </>
    );
};

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
        <Modal>
            <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose?.()}>
                <Modal.Container size="lg" placement="center">
                    <Modal.Dialog className="max-h-[90vh] w-full overflow-hidden p-0">
                        <MatchModalHeader match={match} onClose={onClose} />

                        <Modal.Body className="max-h-[60vh] space-y-6 overflow-y-auto p-6 custom-scrollbar">
                            <MatchModalBody
                                loadingDetails={loadingDetails}
                                details={details}
                                match={match}
                                hlsChannels={hlsChannels}
                                t={t}
                            />
                        </Modal.Body>

                        <Modal.Footer className="flex justify-end border-t border-white/5 bg-zinc-950 px-6 py-3">
                            <Button
                                variant="secondary"
                                size="sm"
                                onPress={onClose}
                            >
                                {t("common.close") || "Đóng"}
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
});

export default MatchDetailModal;
