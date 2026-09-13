import axios from "axios";
import moment from "moment";
import { TOP_TIER_LEAGUES, PRIORITY_LEAGUES } from "../../constants/index.js";

export { TOP_TIER_LEAGUES, PRIORITY_LEAGUES };

const API_KEY = import.meta.env.VITE_SPORTSDB_API_KEY;
const BASE_URL = import.meta.env.VITE_SPORTSDB_BASE_URL;
const EVENTS_API_URL = `${BASE_URL}/${API_KEY}/eventsday.php`;
const HLS_MAPPING_URL = import.meta.env.VITE_HLS_MAPPING_URL;

/**
 * Tính điểm xếp hạng chính xác theo độ phổ biến của giải đấu
 */
export const getLeaguePopularityIndex = (rawName = "") => {
    if (!rawName) return 9999;
    const norm = rawName.trim().toLowerCase();

    // 1. Khớp chính xác với alias
    for (const tier of TOP_TIER_LEAGUES) {
        if (tier.aliases.includes(norm)) {
            return tier.score;
        }
    }

    // 2. Khớp tiền tố (Starts with) để nhận diện các giải có đuôi mùa giải hoặc tên nhà tài trợ
    for (const tier of TOP_TIER_LEAGUES) {
        for (const a of tier.aliases) {
            if (norm.startsWith(`${a} `) || norm.startsWith(`${a}:`) || norm.startsWith(`${a} -`)) {
                return tier.score;
            }
        }
    }

    return 9999;
};

// Memory cache cho HLS Channels Mapping
let cachedHlsChannels = null;

/**
 * Lấy danh sách ánh xạ kênh HLS từ GitHub
 */
export const fetchHlsMapping = async () => {
    if (cachedHlsChannels && cachedHlsChannels.length > 0) {
        return cachedHlsChannels;
    }
    try {
        const response = await axios.get(HLS_MAPPING_URL);
        if (Array.isArray(response.data)) {
            const flattened = response.data
                .flatMap((group) => group.channels || [])
                .map((ch) => ({
                    ...ch,
                    normalizedName: (ch.name || "").toLowerCase().replace(/\s+/g, ""),
                    normalizedTags:
                        ch.tags?.map((tag) => (tag || "").toLowerCase().replace(/\s+/g, "")) || [],
                }));
            cachedHlsChannels = flattened;
            return flattened;
        }
    } catch (error) {
        console.error("Error fetching HLS mapping:", error);
    }
    return [];
};

/**
 * Tìm kênh HLS theo tên đài truyền hình
 */
export const findHlsChannel = (tvName, hlsChannels = []) => {
    if (!tvName || !Array.isArray(hlsChannels) || hlsChannels.length === 0) return null;
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

/**
 * Lấy danh sách trận đấu thể thao theo ngày (múi giờ GMT+7)
 */
export const fetchEventsByDate = async (localDate) => {
    try {
        const dateStr = moment(localDate).format("YYYY-MM-DD");
        const prevDateStr = moment(localDate).subtract(1, "days").format("YYYY-MM-DD");
        const nextDateStr = moment(localDate).add(1, "days").format("YYYY-MM-DD");

        const [res1, res2, res3] = await Promise.all([
            axios.get(`${EVENTS_API_URL}?d=${dateStr}&s=Soccer`),
            axios.get(`${EVENTS_API_URL}?d=${prevDateStr}&s=Soccer`),
            axios.get(`${EVENTS_API_URL}?d=${nextDateStr}&s=Soccer`),
        ]);

        const allEvents = [
            ...(res1.data?.events || []),
            ...(res2.data?.events || []),
            ...(res3.data?.events || []),
        ];

        // Khung thời gian theo múi giờ GMT+7:
        // Bắt đầu từ 00:00 ngày được chọn đến 07:00 rạng sáng ngày mai
        const startWindow = moment.utc(`${dateStr}T00:00:00+07:00`).valueOf();
        const endWindow = moment.utc(`${nextDateStr}T07:00:00+07:00`).valueOf();

        // Lọc các trận đấu nằm trong khung giờ trên
        const filteredEvents = allEvents.filter((event) => {
            if (!event.dateEvent) return false;

            if (!event.strTime) {
                return event.dateEvent === dateStr;
            }

            const timeClean = event.strTime.replace("Z", "");
            const eventTimeMs = moment
                .utc(`${event.dateEvent}T${timeClean}`)
                .utcOffset(7)
                .valueOf();

            return eventTimeMs >= startWindow && eventTimeMs <= endWindow;
        });

        // Loại bỏ trùng lặp idEvent
        return Array.from(
            new Map(filteredEvents.map((item) => [item.idEvent, item])).values(),
        );
    } catch (error) {
        console.error("Error fetching sports events:", error);
        return [];
    }
};

const toSafeArray = (arr) => (Array.isArray(arr) ? arr : []);

const resolveHighlightVideo = (highlights, event) => {
    const list = highlights?.tvhighlights;
    if (Array.isArray(list)) {
        const found = list.find(
            (h) => h.idEvent === event.idEvent || h.strEvent === event.strEvent,
        );
        if (found?.strVideo) return found.strVideo;
    }
    return event.strVideo || null;
};

/**
 * Lấy chi tiết thông số, đội hình, kênh phát sóng và highlights của trận đấu
 */
export const fetchMatchDetails = async (event) => {
    if (!event?.idEvent) return { lineups: [], stats: [], tv: [], highlights: null };

    const detailBaseUrl = `${BASE_URL}/${API_KEY}`;

    try {
        const [lineupsRes, statsRes, tvRes, highlightsRes] = await Promise.all([
            axios.get(`${detailBaseUrl}/lookuplineup.php?id=${event.idEvent}`).catch(() => ({ data: {} })),
            axios.get(`${detailBaseUrl}/lookupeventstats.php?id=${event.idEvent}`).catch(() => ({ data: {} })),
            axios.get(`${detailBaseUrl}/lookuptv.php?id=${event.idEvent}`).catch(() => ({ data: {} })),
            axios.get(`${detailBaseUrl}/eventshighlights.php?d=${event.dateEvent}`).catch(() => ({ data: {} })),
        ]);

        const videoUrl = resolveHighlightVideo(highlightsRes.data, event);

        return {
            lineups: toSafeArray(lineupsRes.data?.lineup),
            stats: toSafeArray(statsRes.data?.eventstats),
            tv: toSafeArray(tvRes.data?.tvevent),
            highlights: videoUrl ? { strVideo: videoUrl } : null,
        };
    } catch (error) {
        console.error("Error fetching match details:", error);
        return {
            lineups: [],
            stats: [],
            tv: [],
            highlights: event.strVideo ? { strVideo: event.strVideo } : null,
        };
    }
};

/**
 * Lọc danh sách trận đấu theo từ khóa tìm kiếm
 */
export const filterEventsBySearch = (events = [], searchQuery = "") => {
    const query = (searchQuery || "").trim().toLowerCase();
    if (!query) return events;
    return events.filter(
        (event) =>
            (event.strEvent || "").toLowerCase().includes(query) ||
            (event.strLeague || "").toLowerCase().includes(query) ||
            (event.strHomeTeam || "").toLowerCase().includes(query) ||
            (event.strAwayTeam || "").toLowerCase().includes(query),
    );
};

/**
 * Lấy timestamp (ms) chuẩn theo múi giờ GMT+7 của trận đấu
 */
export const getEventTimestamp = (event) => {
    if (!event?.dateEvent) return Infinity;
    const timeStr = event.strTime || "23:59:59";
    try {
        const combined = `${event.dateEvent}T${timeStr.replace("Z", "")}`;
        const m = moment.utc(combined).utcOffset(7);
        return m.isValid() ? m.valueOf() : Infinity;
    } catch {
        return Infinity;
    }
};

/**
 * Nhóm và sắp xếp các trận đấu:
 * 1. Thứ tự giải đấu: Sắp xếp theo ĐỘ PHỔ BIẾN (LEAGUE_POPULARITY_RANK) -> sau đó theo bảng chữ cái A-Z
 * 2. Thứ tự trận đấu trong từng giải: Sắp xếp theo Ngày / Giờ thi đấu tăng dần (A-Z: từ sớm nhất tới muộn nhất)
 */
export const groupEventsByLeague = (events = [], searchQuery = "") => {
    const filtered = filterEventsBySearch(events, searchQuery);

    // 1. Phân nhóm các trận đấu theo giải đấu (strLeague)
    const groups = {};
    filtered.forEach((event) => {
        const leagueName = event.strLeague || "Khác";
        if (!groups[leagueName]) {
            groups[leagueName] = [];
        }
        groups[leagueName].push(event);
    });

    // 2. Sắp xếp thứ tự các giải đấu theo ĐỘ PHỔ BIẾN (Popularity Rank)
    const sortedLeagues = Object.keys(groups).sort((a, b) => {
        const rankA = getLeaguePopularityIndex(a);
        const rankB = getLeaguePopularityIndex(b);

        if (rankA !== rankB) return rankA - rankB;

        // Nếu cùng rank (đều là các giải khác ngoài bảng xếp hạng), xếp theo bảng chữ cái A-Z
        return a.localeCompare(b, "vi", { sensitivity: "base" });
    });

    // 3. Với từng giải đấu, sắp xếp các trận đấu bên trong theo Ngày / Giờ tăng dần (A-Z: sớm -> muộn)
    const sortedGroups = {};
    sortedLeagues.forEach((league) => {
        sortedGroups[league] = [...groups[league]].sort((a, b) => {
            const timeA = getEventTimestamp(a);
            const timeB = getEventTimestamp(b);
            if (timeA !== timeB) return timeA - timeB;
            return (a.strEvent || "").localeCompare(b.strEvent || "", "vi", { sensitivity: "base" });
        });
    });

    return sortedGroups;
};

const LEAGUE_LOOKUP_API_URL = `${BASE_URL}/${API_KEY}/lookupleague.php`;
const STANDINGS_API_URL = `${BASE_URL}/${API_KEY}/lookuptable.php`;

// Cache in-memory cho chi tiết giải đấu
const leagueDetailsCache = new Map();

/**
 * Lấy thông tin chi tiết giải đấu (Tên, Logo, Badge, Trophy) từ API
 */
export const fetchLeagueDetails = async (leagueId) => {
    if (leagueDetailsCache.has(leagueId)) {
        return leagueDetailsCache.get(leagueId);
    }
    try {
        const response = await axios.get(`${LEAGUE_LOOKUP_API_URL}?id=${leagueId}`);
        const league = response.data?.leagues?.[0];
        if (league) {
            const data = {
                id: league.idLeague,
                name: league.strLeague,
                badge: league.strBadge,
                logo: league.strLogo,
                trophy: league.strTrophy,
                country: league.strCountry,
                currentSeason: league.strCurrentSeason || "2024-2025",
            };
            leagueDetailsCache.set(leagueId, data);
            return data;
        }
    } catch (error) {
        console.error(`Lỗi khi tải thông tin giải đấu ${leagueId}:`, error);
    }
    return null;
};

/**
 * Tải danh sách giải đấu có bảng xếp hạng kèm đầy đủ logo / badge động từ API
 */
export const fetchSupportedStandingsLeagues = async () => {
    const defaultLeagueIds = ["4328", "4335", "4332", "4331", "4334", "4337", "4344", "4329"];
    const results = await Promise.all(
        defaultLeagueIds.map((id) => fetchLeagueDetails(id))
    );
    return results.filter(Boolean);
};

/**
 * Tạo danh sách các mùa giải gần nhất một cách linh hoạt dựa theo năm hiện tại
 */
export const generateRecentSeasons = (count = 5) => {
    const currentYear = new Date().getFullYear();
    const seasons = [];
    for (let i = 0; i < count; i++) {
        const start = currentYear - i;
        const end = start + 1;
        seasons.push({
            value: `${start}-${end}`,
            label: `Mùa giải ${start} - ${end}`,
        });
    }
    return seasons;
};

const EVENTS_SEASON_API_URL = `${BASE_URL}/${API_KEY}/eventsseason.php`;

const toInt = (val) => Number.parseInt(val, 10) || 0;

const applyMatchResult = (homeStats, awayStats, homeGoals, awayGoals) => {
    if (homeStats) {
        homeStats.goalsFor += homeGoals;
        homeStats.goalsAgainst += awayGoals;
        homeStats.diff = homeStats.goalsFor - homeStats.goalsAgainst;
        if (homeGoals > awayGoals) homeStats.points += 3;
        else if (homeGoals === awayGoals) homeStats.points += 1;
    }

    if (awayStats) {
        awayStats.goalsFor += awayGoals;
        awayStats.goalsAgainst += homeGoals;
        awayStats.diff = awayStats.goalsFor - awayStats.goalsAgainst;
        if (awayGoals > homeGoals) awayStats.points += 3;
        else if (homeGoals === awayGoals) awayStats.points += 1;
    }
};

/**
 * Tính điểm và xếp hạng từ danh sách trận đấu đến vòng trước
 */
const calculateTableForRound = (matches, currentTeams) => {
    const statsMap = new Map();
    for (const t of currentTeams) {
        statsMap.set(t.strTeam, {
            teamName: t.strTeam,
            teamId: t.idTeam,
            points: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            diff: 0,
        });
    }

    for (const m of matches) {
        const homeGoals = Number.parseInt(m.intHomeScore, 10);
        const awayGoals = Number.parseInt(m.intAwayScore, 10);
        if (Number.isNaN(homeGoals) || Number.isNaN(awayGoals)) continue;

        const homeStats = statsMap.get(m.strHomeTeam);
        const awayStats = statsMap.get(m.strAwayTeam);
        applyMatchResult(homeStats, awayStats, homeGoals, awayGoals);
    }

    const sortedTable = Array.from(statsMap.values()).sort(
        (a, b) => b.points - a.points || b.diff - a.diff || b.goalsFor - a.goalsFor,
    );

    const rankMap = new Map();
    sortedTable.forEach((item, index) => {
        rankMap.set(item.teamName, index + 1);
        if (item.teamId) rankMap.set(item.teamId, index + 1);
    });

    return rankMap;
};

/**
 * Fetch toàn bộ trận đấu của mùa giải và tính bảng xếp hạng vòng trước (vòng - 1)
 */
export const fetchPreviousRoundRanks = async (leagueId, season, currentTeams = []) => {
    if (!leagueId || !season || !currentTeams.length) return new Map();

    try {
        const response = await axios.get(`${EVENTS_SEASON_API_URL}?id=${leagueId}&s=${season}`);
        const events = response.data?.events || [];
        const played = events.filter(
            (e) =>
                e.intHomeScore !== null &&
                e.intHomeScore !== "" &&
                e.intAwayScore !== null &&
                e.intAwayScore !== "" &&
                e.intRound,
        );

        if (!played.length) return new Map();

        const rounds = played.map((e) => Number.parseInt(e.intRound, 10)).filter(Boolean);
        const maxRound = Math.max(...rounds);
        if (maxRound <= 1) return new Map();

        const prevRound = maxRound - 1;
        const prevMatches = played.filter(
            (e) => Number.parseInt(e.intRound, 10) <= prevRound,
        );

        return calculateTableForRound(prevMatches, currentTeams);
    } catch (error) {
        console.error("Lỗi khi tải dữ liệu vòng cũ:", error);
        return new Map();
    }
};

const mapStandingRow = (item, prevRankMap) => {
    const rank = toInt(item.intRank);
    const prevRank = prevRankMap.get(item.strTeam) ?? prevRankMap.get(item.idTeam) ?? rank;
    const rankChange = prevRank - rank;

    return {
        rank,
        prevRank,
        rankChange,
        teamId: item.idTeam,
        teamName: item.strTeam || "",
        badge: item.strBadge || "",
        played: toInt(item.intPlayed),
        win: toInt(item.intWin),
        draw: toInt(item.intDraw),
        loss: toInt(item.intLoss),
        goalsFor: toInt(item.intGoalsFor),
        goalsAgainst: toInt(item.intGoalsAgainst),
        goalDifference: toInt(item.intGoalDifference),
        points: toInt(item.intPoints),
        form: (item.strForm || "").trim(),
        description: item.strDescription || "",
    };
};

/**
 * Lấy bảng xếp hạng giải đấu theo ID và Mùa giải kèm biến động thứ hạng vòng - 1
 */
export const fetchStandings = async (leagueId = "4328", season = "2024-2025") => {
    try {
        const standingsRes = await axios.get(`${STANDINGS_API_URL}?l=${leagueId}&s=${season}`);
        const rawTable = standingsRes.data?.table || [];

        const prevRankMap = await fetchPreviousRoundRanks(leagueId, season, rawTable);

        // Chuẩn hóa dữ liệu bảng xếp hạng chuẩn theo intRank từ API kèm thứ hạng vòng cũ thật
        return rawTable
            .map((item) => mapStandingRow(item, prevRankMap))
            .sort((a, b) => a.rank - b.rank);
    } catch (error) {
        console.error("Lỗi khi tải bảng xếp hạng:", error);
        return [];
    }
};

export const scheduleService = {
    PRIORITY_LEAGUES,
    TOP_TIER_LEAGUES,
    getLeaguePopularityIndex,
    getEventTimestamp,
    fetchHlsMapping,
    findHlsChannel,
    fetchEventsByDate,
    fetchMatchDetails,
    filterEventsBySearch,
    groupEventsByLeague,
    fetchLeagueDetails,
    fetchSupportedStandingsLeagues,
    generateRecentSeasons,
    fetchPreviousRoundRanks,
    fetchStandings,
};
