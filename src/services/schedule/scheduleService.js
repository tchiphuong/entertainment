import axios from "axios";
import moment from "moment";
import { TOP_TIER_LEAGUES, PRIORITY_LEAGUES } from "../../constants";

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

        const [res1, res2] = await Promise.all([
            axios.get(`${EVENTS_API_URL}?d=${dateStr}&s=Soccer`),
            axios.get(`${EVENTS_API_URL}?d=${prevDateStr}&s=Soccer`),
        ]);

        const allEvents = [
            ...(res1.data?.events || []),
            ...(res2.data?.events || []),
        ];

        // Lọc theo ngày địa phương GMT+7
        const filteredByLocalDate = allEvents.filter((event) => {
            if (!event.strTime) return event.dateEvent === dateStr;

            const eventLocalDay = moment
                .utc(`${event.dateEvent}T${event.strTime}`)
                .utcOffset(7)
                .format("YYYY-MM-DD");

            return eventLocalDay === dateStr;
        });

        // Loại bỏ trùng lặp idEvent
        return Array.from(
            new Map(filteredByLocalDate.map((item) => [item.idEvent, item])).values(),
        );
    } catch (error) {
        console.error("Error fetching sports events:", error);
        return [];
    }
};

/**
 * Lấy chi tiết thông số, đội hình, kênh phát sóng và highlights của trận đấu
 */
export const fetchMatchDetails = async (event) => {
    if (!event?.idEvent) return { lineups: [], stats: [], tv: [], highlights: null };

    const detailBaseUrl = `${BASE_URL}/${API_KEY}`;

    try {
        const [lineupsRes, statsRes, tvRes, highlightsRes] = await Promise.all([
            axios.get(`${detailBaseUrl}/lookuplineup.php?id=${event.idEvent}`),
            axios.get(`${detailBaseUrl}/lookupeventstats.php?id=${event.idEvent}`),
            axios.get(`${detailBaseUrl}/lookuptv.php?id=${event.idEvent}`),
            axios.get(`${detailBaseUrl}/eventshighlights.php?d=${event.dateEvent}`),
        ]);

        const highlights = highlightsRes.data?.tvhighlights?.find(
            (h) => h.idEvent === event.idEvent || h.strEvent === event.strEvent,
        );

        return {
            lineups: lineupsRes.data?.lineup || [],
            stats: statsRes.data?.eventstats || [],
            tv: tvRes.data?.tvevent || [],
            highlights: highlights || null,
        };
    } catch (error) {
        console.error("Error fetching match details:", error);
        return { lineups: [], stats: [], tv: [], highlights: null };
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

/**
 * Lấy bảng xếp hạng giải đấu theo ID và Mùa giải
 */
export const fetchStandings = async (leagueId = "4328", season = "2024-2025") => {
    try {
        const response = await axios.get(`${STANDINGS_API_URL}?l=${leagueId}&s=${season}`);
        const rawTable = response.data?.table || [];

        // Chuẩn hóa dữ liệu bảng xếp hạng
        return rawTable
            .map((item) => ({
                rank: Number.parseInt(item.intRank, 10) || 0,
                teamId: item.idTeam,
                teamName: item.strTeam || "",
                badge: item.strBadge || "",
                played: Number.parseInt(item.intPlayed, 10) || 0,
                win: Number.parseInt(item.intWin, 10) || 0,
                draw: Number.parseInt(item.intDraw, 10) || 0,
                loss: Number.parseInt(item.intLoss, 10) || 0,
                goalsFor: Number.parseInt(item.intGoalsFor, 10) || 0,
                goalsAgainst: Number.parseInt(item.intGoalsAgainst, 10) || 0,
                goalDifference: Number.parseInt(item.intGoalDifference, 10) || 0,
                points: Number.parseInt(item.intPoints, 10) || 0,
                form: (item.strForm || "").trim(),
                description: item.strDescription || "",
            }))
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
    fetchStandings,
};
