import { memo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PlayIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { Button, Chip, Modal, Spinner } from "../ui";
import { formatMatchDateTime } from "../../utils/dateUtils";
import { findHlsChannel } from "../../services/schedule/scheduleService";

// Bản dịch tiếng Việt các chỉ số thống kê bóng đá phổ biến
const STAT_TRANSLATIONS = {
    "ball possession": "Kiểm soát bóng",
    "passes accurate": "Chuyền chính xác",
    "total passes": "Tổng số đường chuyền",
    "passes %": "Tỷ lệ chuyền bóng",
    "total shots": "Tổng số cú sút",
    "shots on goal": "Sút trúng đích",
    "shots on target": "Sút trúng đích",
    "shots off goal": "Sút ra ngoài",
    "shots off target": "Sút ra ngoài",
    "shots insidebox": "Dứt điểm trong vòng cấm",
    "shots outsidebox": "Dứt điểm ngoài vòng cấm",
    "blocked shots": "Cú sút bị chặn",
    "free kicks": "Đá phạt trực tiếp",
    "corner kicks": "Phạt góc",
    "offsides": "Việt vị",
    "fouls": "Phạm lỗi",
    "yellow cards": "Thẻ vàng",
    "red cards": "Thẻ đỏ",
    "goalkeeper saves": "Cứu thua",
    "saves": "Cứu thua",
};

const formatStatLabel = (label) => {
    if (!label) return "";
    const lower = label.trim().toLowerCase();
    return STAT_TRANSLATIONS[lower] || label;
};

// Thanh so sánh tỷ lệ % chỉ số giữa 2 đội
const StatProgressBar = ({ homeVal, awayVal }) => {
    const numHome = Number.parseFloat(homeVal) || 0;
    const numAway = Number.parseFloat(awayVal) || 0;
    const total = numHome + numAway;
    const homePercent = total > 0 ? Math.round((numHome / total) * 100) : 50;
    const awayPercent = 100 - homePercent;

    return (
        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full bg-red-600 transition-all" style={{ width: `${homePercent}%` }} />
            <div className="h-full bg-zinc-500 transition-all" style={{ width: `${awayPercent}%` }} />
        </div>
    );
};

// Thống kê trận đấu
const MatchStatsSection = ({ stats, t }) => {
    if (!stats || stats.length === 0) return null;

    return (
        <section className="space-y-3">
            <div className="flex items-center gap-2 border-l-4 border-red-600 pl-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    {t("schedule.statistics") || "Thống kê trận đấu"}
                </h3>
            </div>
            <div className="space-y-2.5">
                {stats.map((stat, i) => {
                    const homeVal = stat.intHome ?? stat.intStat ?? "0";
                    const awayVal = stat.intAway ?? "0";
                    return (
                        <div
                            key={`${stat.strStat || ""}-${i}`}
                            className="space-y-1.5 rounded-xl border border-zinc-800/80 bg-zinc-950 p-3"
                        >
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span className="font-black text-white">{homeVal}</span>
                                <span className="text-zinc-400">{formatStatLabel(stat.strStat)}</span>
                                <span className="font-black text-white">{awayVal}</span>
                            </div>
                            <StatProgressBar homeVal={homeVal} awayVal={awayVal} />
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

// Danh sách cầu thủ (đội hình chính hoặc dự bị)
const LineupList = ({ players, title }) => {
    if (!players || players.length === 0) return null;

    return (
        <div className="space-y-2">
            <h5 className="text-xs font-black uppercase tracking-wider text-zinc-500">
                {title} ({players.length})
            </h5>
            <div className="space-y-1.5">
                {players.map((player, i) => {
                    const avatar = player.strCutout || player.strThumb;
                    return (
                        <div
                            key={`${player.idPlayer || player.strPlayer}-${i}`}
                            className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800/60 bg-zinc-950 px-3 py-2 text-xs"
                        >
                            <div className="flex min-w-0 items-center gap-2">
                                {avatar && (
                                    <img
                                        loading="lazy"
                                        src={avatar}
                                        alt={player.strPlayer}
                                        className="h-6 w-6 shrink-0 rounded-full border border-zinc-800 bg-zinc-900 object-cover"
                                        onError={(e) => {
                                            e.currentTarget.style.display = "none";
                                        }}
                                    />
                                )}
                                {player.intSquadNumber && (
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-800 text-xs font-black text-red-500">
                                        {player.intSquadNumber}
                                    </span>
                                )}
                                <span className="truncate font-semibold text-zinc-200">{player.strPlayer}</span>
                            </div>
                            <span className="shrink-0 text-xs font-bold uppercase text-zinc-500">
                                {player.strPosition}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Cột đội hình 1 câu lạc bộ
const LineupColumn = ({ teamName, isHome, starters, subs }) => (
    <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <h4 className={`border-b border-zinc-800 pb-2 text-xs font-black uppercase ${isHome ? "text-red-500" : "text-zinc-300"}`}>
            {teamName}
        </h4>
        <LineupList players={starters} title="Đội hình ra sân" />
        <LineupList players={subs} title="Dự bị" />
    </div>
);

// Khu vực đội hình ra sân
const MatchLineupsSection = ({ lineups, match, t }) => {
    if (!lineups || lineups.length === 0) return null;

    const isHomePlayer = (p) => p.strHome === "Yes" || p.idTeam === match.idHomeTeam;
    const isAwayPlayer = (p) => p.strHome === "No" || p.idTeam === match.idAwayTeam;

    const homeStarters = lineups.filter((l) => isHomePlayer(l) && l.strSubstitute !== "Yes");
    const homeSubs = lineups.filter((l) => isHomePlayer(l) && l.strSubstitute === "Yes");

    const awayStarters = lineups.filter((l) => isAwayPlayer(l) && l.strSubstitute !== "Yes");
    const awaySubs = lineups.filter((l) => isAwayPlayer(l) && l.strSubstitute === "Yes");

    return (
        <section className="space-y-3">
            <div className="flex items-center gap-2 border-l-4 border-red-600 pl-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    {t("schedule.lineups") || "Đội hình ra sân"}
                </h3>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <LineupColumn
                    teamName={match.strHomeTeam}
                    isHome={true}
                    starters={homeStarters}
                    subs={homeSubs}
                />
                <LineupColumn
                    teamName={match.strAwayTeam}
                    isHome={false}
                    starters={awayStarters}
                    subs={awaySubs}
                />
            </div>
        </section>
    );
};

// Thẻ hiển thị kênh truyền hình
const TvChannelCard = ({ tv, hlsChannels, t }) => {
    const mappedHls = findHlsChannel(tv.strChannel, hlsChannels);
    return (
        <div className="flex flex-col items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-center transition-colors hover:border-zinc-700">
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
                    <span className="text-xs font-black uppercase text-zinc-500">
                        {tv.strChannel}
                    </span>
                </div>
            )}
            <div>
                <p className="line-clamp-1 text-xs font-bold text-zinc-200">{tv.strChannel}</p>
                <p className="text-xs font-bold uppercase text-zinc-500">
                    {tv.strCountry || "Global"}
                </p>
            </div>

            {mappedHls && (
                <Link
                    to={`/tv?id=${mappedHls.id}`}
                    className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg bg-red-600 py-1.5 text-xs font-black uppercase text-white shadow transition-all hover:bg-red-500 active:scale-95"
                >
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white"></span>
                    {t("schedule.watchNow") || "Xem ngay"}
                </Link>
            )}
        </div>
    );
};

// Khu vực kênh phát sóng
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

// Helper trích xuất ID YouTube
const getYoutubeEmbedUrl = (url) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
};

// Khu vực video highlights
const MatchHighlightsSection = ({ videoUrl, t }) => {
    if (!videoUrl) return null;
    const embedUrl = getYoutubeEmbedUrl(videoUrl);

    return (
        <section className="space-y-3">
            <div className="flex items-center justify-between border-l-4 border-red-600 pl-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    {t("schedule.highlights") || "Video Highlights"}
                </h3>
                <a
                    href={videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs font-bold text-zinc-300 transition-colors hover:border-red-600 hover:bg-red-600 hover:text-white"
                >
                    <PlayIcon className="h-3.5 w-3.5 text-red-500" />
                    <span>{t("schedule.watchHighlights") || "Mở trên YouTube"} ↗</span>
                </a>
            </div>
            {embedUrl && (
                <div className="aspect-video w-full overflow-hidden rounded-xl border border-zinc-800 bg-black shadow-lg">
                    <iframe
                        src={embedUrl}
                        title="Match Highlights"
                        className="h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    />
                </div>
            )}
        </section>
    );
};

const getStatusConfig = (status) => {
    switch (status) {
        case "FT":
        case "AET":
            return { text: "Hết giờ", className: "bg-zinc-800 text-zinc-300" };
        case "Live":
            return { text: "Trực tiếp", className: "bg-red-600/20 text-red-500" };
        case "HT":
            return { text: "Nghỉ giữa hiệp", className: "bg-amber-600/20 text-amber-500" };
        case "NS":
            return { text: "Chưa đá", className: "bg-zinc-800 text-zinc-400" };
        default:
            return { text: status, className: "bg-zinc-800 text-zinc-300" };
    }
};

const MatchStatusChip = ({ status }) => {
    if (!status) return null;
    const { text, className } = getStatusConfig(status);
    return (
        <Chip variant="secondary" size="sm" className={`font-black text-xs uppercase ${className}`}>
            {text}
        </Chip>
    );
};

const TeamDisplay = ({ name, badge, isWinner, isHome }) => (
    <div className="flex min-w-0 flex-1 flex-col items-center text-center">
        <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 p-2 shadow-inner">
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
                <span className="text-lg font-black text-zinc-600">
                    {name?.charAt(0) || (isHome ? "H" : "A")}
                </span>
            )}
        </div>
        <h3 className={`line-clamp-2 text-sm font-black uppercase md:text-base ${isWinner ? "text-white" : "text-zinc-300"}`}>
            {name}
        </h3>
    </div>
);

const ScoreDisplay = ({ hasScore, homeScore, awayScore, isHomeWinner, isAwayWinner }) => {
    if (!hasScore) {
        return (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-2 text-lg font-black text-zinc-400">
                VS
            </div>
        );
    }
    return (
        <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-2 text-2xl font-black md:text-3xl">
            <span className={isHomeWinner ? "text-red-500" : "text-white"}>
                {homeScore}
            </span>
            <span className="text-zinc-600">:</span>
            <span className={isAwayWinner ? "text-red-500" : "text-white"}>
                {awayScore}
            </span>
        </div>
    );
};

const MatchMetaVenue = ({ venue, city, country, official }) => {
    if (!venue && !official) return null;
    return (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 border-t border-zinc-800/60 pt-3 text-xs font-medium text-zinc-500">
            {venue && (
                <span className="flex items-center gap-1">
                    <svg className="h-3.5 w-3.5 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{venue}{city ? `, ${city}` : ""}{country ? ` (${country})` : ""}</span>
                </span>
            )}
            {official && (
                <span>Trọng tài: <strong className="text-zinc-400">{official}</strong></span>
            )}
        </div>
    );
};

// Header bảng điểm Scoreboard hoành tráng
const MatchScoreboardHeader = ({ match, onClose }) => {
    const formattedTime = formatMatchDateTime(match.dateEvent, match.strTime, "DD/MM/YYYY HH:mm");
    const hasScore = match.intHomeScore !== null && match.intAwayScore !== null;
    const isHomeWinner = hasScore && Number(match.intHomeScore) > Number(match.intAwayScore);
    const isAwayWinner = hasScore && Number(match.intAwayScore) > Number(match.intHomeScore);

    return (
        <div className="relative border-b border-zinc-800 bg-zinc-950 px-6 py-6">
            <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 transition-colors hover:border-red-600 hover:bg-red-600 hover:text-white cursor-pointer"
                aria-label="Đóng"
            >
                <XMarkIcon className="h-4 w-4" />
            </button>

            {/* Thông tin giải đấu & Trạng thái */}
            <div className="mb-4 flex flex-wrap items-center justify-center gap-2 text-center">
                <Chip color="danger" size="sm" variant="secondary" className="font-bold text-xs uppercase">
                    {match.strLeague}
                </Chip>
                {match.intRound && (
                    <Chip variant="secondary" size="sm" className="font-bold text-xs text-zinc-400">
                        Vòng {match.intRound}
                    </Chip>
                )}
                <span className="text-xs font-bold text-zinc-400">
                    {formattedTime}
                </span>
                <MatchStatusChip status={match.strStatus} />
            </div>

            {/* Bảng điểm 2 đội */}
            <div className="flex items-center justify-between gap-4">
                <TeamDisplay
                    name={match.strHomeTeam}
                    badge={match.strHomeTeamBadge}
                    isWinner={isHomeWinner}
                    isHome={true}
                />
                <div className="flex shrink-0 flex-col items-center justify-center px-4">
                    <ScoreDisplay
                        hasScore={hasScore}
                        homeScore={match.intHomeScore}
                        awayScore={match.intAwayScore}
                        isHomeWinner={isHomeWinner}
                        isAwayWinner={isAwayWinner}
                    />
                </div>
                <TeamDisplay
                    name={match.strAwayTeam}
                    badge={match.strAwayTeamBadge}
                    isWinner={isAwayWinner}
                    isHome={false}
                />
            </div>

            {/* Thông tin địa điểm & Trọng tài */}
            <MatchMetaVenue
                venue={match.strVenue}
                city={match.strCity}
                country={match.strCountry}
                official={match.strOfficial}
            />
        </div>
    );
};

const MatchModalLoading = ({ t }) => (
    <div className="flex flex-col items-center justify-center space-y-3 py-16">
        <Spinner color="danger" size="lg" />
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
            {t("common.loading") || "Đang tải dữ liệu chi tiết..."}
        </p>
    </div>
);

const MatchModalBody = ({ loadingDetails, details, match, hlsChannels, t }) => {
    if (loadingDetails) {
        return <MatchModalLoading t={t} />;
    }

    const hasStats = details.stats && details.stats.length > 0;
    const hasLineups = details.lineups && details.lineups.length > 0;
    const hasTv = details.tv && details.tv.length > 0;
    const videoUrl = details.highlights?.strVideo || match.strVideo;

    const hasAnyContent = hasStats || hasLineups || hasTv || Boolean(videoUrl);

    return (
        <div className="space-y-6">
            <MatchHighlightsSection videoUrl={videoUrl} t={t} />
            <MatchStatsSection stats={details.stats} t={t} />
            <MatchLineupsSection lineups={details.lineups} match={match} t={t} />
            <MatchBroadcastingSection tvList={details.tv} hlsChannels={hlsChannels} t={t} />

            {!hasAnyContent && (
                <div className="py-8 text-center text-zinc-500">
                    <p className="text-xs font-bold uppercase tracking-wider">
                        {t("schedule.noInsights") || "Ban tổ chức chưa cập nhật đội hình & thống kê chi tiết cho trận đấu này"}
                    </p>
                </div>
            )}
        </div>
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
                <Modal.Container size="3xl" placement="center">
                    <Modal.Dialog className="max-h-[90vh] w-full max-w-3xl overflow-hidden p-0">
                        <MatchScoreboardHeader match={match} onClose={onClose} />

                        <Modal.Body className="max-h-[60vh] space-y-6 overflow-y-auto p-6 custom-scrollbar">
                            <MatchModalBody
                                loadingDetails={loadingDetails}
                                details={details}
                                match={match}
                                hlsChannels={hlsChannels}
                                t={t}
                            />
                        </Modal.Body>

                        <Modal.Footer className="flex justify-end border-t border-zinc-800 bg-zinc-950 px-6 py-3">
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
