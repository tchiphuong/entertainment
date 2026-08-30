/**
 * TẬP TRUNG TOÀN BỘ HẰNG SỐ (CONSTANTS) CỦA TOÀN BỘ HỆ THỐNG ENTERTAINMENT
 * 
 * Quy tắc:
 * - 100% hằng số của hệ thống (VOD, TV, Schedule, Player, Cache, Theme, UI) được tập trung tại file này.
 * - Tránh phân tán hằng số ra nhiều file con khác nhau.
 */

// ==========================================
// 1. VOD SOURCES & SYSTEM CONFIG
// ==========================================
export const SOURCES = {
    SOURCE_C: "source_c",
    SOURCE_K: "source_k",
    SOURCE_O: "source_o",
    SOURCE_R: "source_r",
    SOURCE_TMDB: "source_tmdb",
};

export const DEFAULT_REGION = "VN";
export const DEFAULT_TMDB_LANG = "vi-VN";

export const FILTER_YEARS = Array.from({ length: 26 }, (_, i) =>
    (2025 - i).toString(),
);

export const FILTER_SOURCES = [
    { id: "all", name: "Tất cả" },
    { id: SOURCES.SOURCE_K, name: "Từ K" },
    { id: SOURCES.SOURCE_C, name: "Từ C" },
];

export const MEDIA_TYPES = {
    ALL: "all",
    MOVIE: "movie",
    TV: "tv",
};

export const TIMEFRAMES = {
    DAY: "day",
    WEEK: "week",
    MONTH: "month",
};

// ==========================================
// 2. TMDB CONSTANTS & ENDPOINTS
// ==========================================
export const TMDB_SLUGS = {
    TOP_VIEW: "top-view",
    NOW_PLAYING: "now-playing",
    POPULAR: "popular",
    TOP_RATED: "top-rated",
};

export const TMDB_SLUG_LIST = Object.values(TMDB_SLUGS);

export const TMDB_RELEASE_TYPES = {
    PREMIERE: "1",
    THEATRICAL_LIMITED: "2",
    THEATRICAL: "3",
    DIGITAL: "4",
    PHYSICAL: "5",
    TV: "6",
};

export const TMDB_THEATRICAL_RELEASE_TYPES = "2|3";

export const TMDB_ENDPOINTS = {
    POPULAR: "movie/popular",
    NOW_PLAYING: "movie/now_playing",
    TOP_RATED: "movie/top_rated",
    TRENDING_DAY: "trending/all/day",
    TRENDING_WEEK: "trending/all/week",
    TRENDING_MOVIE_WEEK: "trending/movie/week",
    SEARCH_PERSON: "search/person",
    PERSON_DETAIL: (id) => `person/${id}`,
    PERSON_CREDITS: (id) => `person/${id}/combined_credits`,
    MOVIE_DETAIL: (id) => `movie/${id}`,
    TV_DETAIL: (id) => `tv/${id}`,
    MOVIE_IMAGES: (id) => `movie/${id}/images`,
    TV_IMAGES: (id) => `tv/${id}/images`,
    TV_SEASON: (id, season) => `tv/${id}/season/${season}`,
    MOVIE_RECOMMENDATIONS: (id) => `movie/${id}/recommendations`,
    TV_RECOMMENDATIONS: (id) => `tv/${id}/recommendations`,
    MOVIE_SIMILAR: (id) => `movie/${id}/similar`,
    TV_SIMILAR: (id) => `tv/${id}/similar`,
};

export const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

export const TMDB_IMAGE_SIZES = {
    POSTER: "w500",
    BACKDROP: "original",
    THUMBNAIL: "w780",
    PROFILE: "h632",
    SMALL: "w342",
    TINY: "w92",
    LOGO: "h60",
};

export const FILTER_TYPE_LIST = [
    { slug: TMDB_SLUGS.TOP_VIEW, name: "Top Lượt Xem" },
    { slug: TMDB_SLUGS.NOW_PLAYING, name: "Phim Đang Chiếu (TMDB)" },
    { slug: TMDB_SLUGS.POPULAR, name: "Phim Phổ Biến (TMDB)" },
    { slug: TMDB_SLUGS.TOP_RATED, name: "Phim Đánh Giá Cao (TMDB)" },
    { slug: "phim-bo", name: "Phim Bộ" },
    { slug: "phim-le", name: "Phim Lẻ" },
    { slug: "hoat-hinh", name: "Phim Hoạt Hình" },
    { slug: "phim-chieu-rap", name: "Phim Chiếu Rạp" },
    { slug: "tv-shows", name: "TV Shows" },
    { slug: "phim-bo-dang-chieu", name: "Đang Chiếu" },
    { slug: "phim-bo-hoan-thanh", name: "Hoàn Thành" },
    { slug: "phim-sap-chieu", name: "Sắp Chiếu" },
    { slug: "phim-thuyet-minh", name: "Thuyết Minh" },
    { slug: "phim-long-tieng", name: "Lồng Tiếng" },
    { slug: "phim-vietsub", name: "Vietsub" },
];

export const CATEGORIES = [
    {
        id: "history",
        title: "Lịch Sử",
        titleKey: "vods.history",
        type: "lich-su",
        source: "",
        isView: false,
    },
    {
        id: "favorites",
        title: "Yêu Thích",
        titleKey: "vods.favorites",
        type: "yeu-thich",
        source: "",
        isView: false,
    },
    {
        id: "new",
        title: "Phim Mới Cập Nhật",
        titleKey: "vods.newMovies",
        type: "danh-sach/phim-moi-cap-nhat",
        source: SOURCES.SOURCE_K,
        isView: true,
        useV1: false,
    },
    {
        id: TMDB_SLUGS.TOP_VIEW,
        title: "Top Lượt Xem",
        titleKey: "vods.topViews",
        type: TMDB_ENDPOINTS.TRENDING_MOVIE_WEEK,
        source: SOURCES.SOURCE_TMDB,
        isView: true,
    },
    {
        id: TMDB_SLUGS.NOW_PLAYING,
        title: "Phim Đang Chiếu Rạp",
        titleKey: "vods.nowPlaying",
        type: TMDB_ENDPOINTS.NOW_PLAYING,
        source: SOURCES.SOURCE_TMDB,
        params: {
            region: DEFAULT_REGION,
            with_release_type: TMDB_THEATRICAL_RELEASE_TYPES,
        },
        isView: true,
    },
    {
        id: TMDB_SLUGS.POPULAR,
        title: "Phim Phổ Biến",
        titleKey: "vods.popularMovies",
        type: TMDB_ENDPOINTS.POPULAR,
        source: SOURCES.SOURCE_TMDB,
        isView: true,
    },
    {
        id: TMDB_SLUGS.TOP_RATED,
        title: "Phim Đánh Giá Cao",
        titleKey: "vods.topRated",
        type: TMDB_ENDPOINTS.TOP_RATED,
        source: SOURCES.SOURCE_TMDB,
        isView: true,
    },
    {
        id: "phim-le",
        title: "Phim Lẻ",
        titleKey: "vods.movies",
        type: "danh-sach/phim-le",
        source: SOURCES.SOURCE_K,
        useV1: true,
    },
    {
        id: "phim-bo",
        title: "Phim Bộ",
        titleKey: "vods.series",
        type: "danh-sach/phim-bo",
        source: "source_k",
        useV1: true,
    },
    {
        id: "phim-chieu-rap",
        title: "Phim Chiếu Rạp",
        titleKey: "vods.cinemaMovies",
        type: "danh-sach/phim-chieu-rap",
        source: "source_k",
        useV1: true,
    },
    {
        id: "tv-shows",
        title: "TV Shows",
        titleKey: "vods.tvShows",
        type: "danh-sach/tv-shows",
        source: "source_k",
        useV1: true,
    },
    {
        id: "hoat-hinh",
        title: "Phim Hoạt Hình",
        titleKey: "vods.animation",
        type: "danh-sach/hoat-hinh",
        source: "source_k",
        useV1: true,
    },
    {
        id: "trung-quoc",
        title: "Phim Trung Quốc",
        titleKey: "vods.china",
        type: "quoc-gia/trung-quoc",
        source: "source_k",
        useV1: true,
    },
    {
        id: "han-quoc",
        title: "Phim Hàn Quốc",
        titleKey: "vods.korea",
        type: "quoc-gia/han-quoc",
        source: "source_k",
        useV1: true,
    },
    {
        id: "viet-nam",
        title: "Phim Việt Nam",
        titleKey: "vods.vietnam",
        type: "quoc-gia/viet-nam",
        source: "source_k",
        useV1: true,
    },
    {
        id: "action",
        title: "Phim Hành Động",
        titleKey: "vods.action",
        type: "the-loai/hanh-dong",
        source: "source_k",
        useV1: true,
    },
    {
        id: "horror",
        title: "Phim Kinh Dị",
        titleKey: "vods.horror",
        type: "the-loai/kinh-di",
        source: "source_k",
        useV1: true,
    },
    {
        id: "romance",
        title: "Phim Tình Cảm",
        titleKey: "vods.romance",
        type: "the-loai/tinh-cam",
        source: "source_k",
        useV1: true,
    },
    {
        id: "phim-thuyet-minh",
        title: "Phim Thuyết Minh",
        titleKey: "vods.voiceoverMovies",
        type: "danh-sach/phim-thuyet-minh",
        source: "source_k",
        useV1: true,
    },
    {
        id: "phim-long-tieng",
        title: "Phim Lồng Tiếng",
        titleKey: "vods.dubbedMovies",
        type: "danh-sach/phim-long-tieng",
        source: "source_k",
        useV1: true,
    },
];

export const SOURCE_C_COUNTRIES = [
    { slug: "au-my", name: "Âu Mỹ", id: "48" },
    { slug: "anh", name: "Anh", id: "49" },
    { slug: "trung-quoc", name: "Trung Quốc", id: "50" },
    { slug: "indonesia", name: "Indonesia", id: "51" },
    { slug: "viet-nam", name: "Việt Nam", id: "52" },
    { slug: "argentina", name: "Argentina", id: "53" },
    { slug: "ao", name: "Áo", id: "54" },
    { slug: "uc", name: "Úc", id: "55" },
    { slug: "bangladesh", name: "Bangladesh", id: "56" },
    { slug: "brazil", name: "Brazil", id: "57" },
    { slug: "bahamas", name: "Bahamas", id: "58" },
    { slug: "belarus", name: "Belarus", id: "59" },
    { slug: "canada", name: "Canada", id: "60" },
    { slug: "thuy-si", name: "Thụy Sĩ", id: "61" },
    { slug: "bo-bien-nga", name: "Bờ Biển Ngà", id: "62" },
    { slug: "chile", name: "Chile", id: "63" },
    { slug: "colombia", name: "Colombia", id: "64" },
    { slug: "costa-rica", name: "Costa Rica", id: "65" },
    { slug: "duc", name: "Đức", id: "66" },
    { slug: "dan-mach", name: "Đan Mạch", id: "67" },
    { slug: "tay-ban-nha", name: "Tây Ban Nha", id: "68" },
    { slug: "phap", name: "Pháp", id: "69" },
    { slug: "greenland", name: "Greenland", id: "70" },
    { slug: "hong-kong", name: "Hồng Kông", id: "71" },
    { slug: "han-quoc", name: "Hàn Quốc", id: "72" },
    { slug: "nhat-ban", name: "Nhật Bản", id: "73" },
    { slug: "thai-lan", name: "Thái Lan", id: "74" },
    { slug: "dai-loan", name: "Đài Loan", id: "75" },
    { slug: "nga", name: "Nga", id: "76" },
    { slug: "ha-lan", name: "Hà Lan", id: "77" },
    { slug: "quoc-gia-khac", name: "Quốc gia khác", id: "78" },
    { slug: "philippines", name: "Philippines", id: "95" },
    { slug: "an-do", name: "Ấn Độ", id: "96" },
];

export const SOURCE_C_CATEGORIES = [
    { slug: "hanh-dong", name: "Hành Động", id: "7" },
    { slug: "phieu-luu", name: "Phiêu Lưu", id: "8" },
    { slug: "hoat-hinh", name: "Hoạt Hình", id: "9" },
    { slug: "phim-hai", name: "Phim Hài", id: "10" },
    { slug: "hinh-su", name: "Hình Sự", id: "11" },
    { slug: "tai-lieu", name: "Tài Liệu", id: "12" },
    { slug: "chinh-kich", name: "Chính Kịch", id: "13" },
    { slug: "gia-dinh", name: "Gia Đình", id: "14" },
    { slug: "gia-tuong", name: "Giả Tưởng", id: "15" },
    { slug: "lich-su", name: "Lịch Sử", id: "16" },
    { slug: "kinh-di", name: "Kinh Dị", id: "17" },
    { slug: "phim-nhac", name: "Phim Nhạc", id: "18" },
    { slug: "bi-an", name: "Bí Ẩn", id: "19" },
    { slug: "lang-man", name: "Lãng Mạn", id: "20" },
    { slug: "khoa-hoc-vien-tuong", name: "Khoa Học Viễn Tưởng", id: "21" },
    { slug: "gay-can", name: "Gây Cấn", id: "22" },
    { slug: "chien-tranh", name: "Chiến Tranh", id: "23" },
    { slug: "mien-tay", name: "Miền Tây", id: "24" },
    { slug: "co-trang", name: "Cổ Trang", id: "142" },
    { slug: "tam-ly", name: "Tâm Lý", id: "143" },
    { slug: "phim-18", name: "Phim 18+", id: "144" },
    { slug: "tinh-cam", name: "Tình Cảm", id: "155" },
];

// ==========================================
// 3. UI, PLAYER, & ROLE CONSTANTS
// ==========================================
export const TYPE_CONFIG = {
    vietsub: { label: "Phụ đề", color: "bg-red-600" },
    thuyetminh: { label: "Thuyết Minh", color: "bg-blue-600" },
    longtieng: { label: "Lồng Tiếng", color: "bg-green-600" },
};

export const STUNT_KEYWORDS = [
    "stunt",
    "fight",
    "martial",
    "action",
    "combat",
    "võ thuật",
    "đóng thế",
];

export const DANH_SACH_TYPES = new Set([
    "phim-bo",
    "phim-le",
    "hoat-hinh",
    "tv-shows",
    "phim-vietsub",
    "phim-thuyet-minh",
    "phim-long-tieng",
    "phim-bo-dang-chieu",
    "phim-bo-hoan-thanh",
    "phim-sap-chieu",
    ...TMDB_SLUG_LIST,
]);

export const HERO_PRIORITY_SET = new Set([
    "hot-rophim",
    "new-ophim",
    "new",
]);

export const SKELETON_COUNTRIES = Array.from({ length: 8 }, (_, i) => `country-skel-${i}`);
export const SKELETON_CATEGORIES = Array.from({ length: 10 }, (_, i) => `category-skel-${i}`);

export const PLAYER_CONFIG = {
    VOLUME_KEY: "vodPlayerVolume",
    MUTE_KEY: "vodPlayerMuted",
    THROTTLE_MS: 30000,
    DEFAULT_INTRO_DURATION: 0,
    COUNTDOWN_DURATION: 5,
};

export const JWPLAYER_LICENSE_MOCK = {
    key: "mock-key",
};

// ==========================================
// 4. CACHE & IMAGE CONSTANTS
// ==========================================
export const CACHE_PREFIX = "smart_cache_";
export const MAX_MEMORY_ITEMS = 500;

export const CACHE_TTL = {
    STATIC_METADATA: 24 * 60 * 60 * 1000, // 24 giờ
    DETAIL: 4 * 60 * 60 * 1000,          // 4 giờ
    LISTING: 15 * 60 * 1000,              // 15 phút
    SHORT: 5 * 60 * 1000,                 // 5 phút
};

export const IMAGE_PROXY_PREFIX = "https://external-content.duckduckgo.com/iu/?u=";

export const FALLBACK_LOGO_DATA_URI =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <rect width="96" height="96" rx="16" fill="#18181b"/>
    <rect x="12" y="12" width="72" height="72" rx="12" fill="#27272a"/>
    <path d="M26 62l13-14 10 10 12-13 9 9" fill="none" stroke="#a1a1aa" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="39" cy="34" r="6" fill="#71717a"/>
</svg>
`);

export const FALLBACK_POSTER_DATA_URI =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 450">
    <rect width="300" height="450" fill="#09090b"/>
    <rect x="20" y="20" width="260" height="410" rx="8" fill="#18181b" stroke="#27272a" stroke-width="2"/>
    <circle cx="150" cy="180" r="40" fill="#27272a"/>
    <path d="M70 330l60-70 40 40 50-60 40 50" fill="none" stroke="#3f3f46" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`);

export const FALLBACK_IMAGE = FALLBACK_POSTER_DATA_URI;

// ==========================================
// 5. SPORTS & LEAGUES CONSTANTS
// ==========================================
export const TOP_TIER_LEAGUES = [
    { name: "English Premier League", aliases: ["english premier league", "premier league", "fa premier league", "barclays premier league", "epl"], score: 1 },
    { name: "UEFA Champions League", aliases: ["uefa champions league", "uefa champions", "champions league", "c1"], score: 2 },
    { name: "Spanish La Liga", aliases: ["spanish la liga", "la liga", "laliga", "spain primera division", "spanish primera division", "la liga ea sports", "laliga ea sports"], score: 3 },
    { name: "Italian Serie A", aliases: ["italian serie a", "serie a", "serie a tim"], score: 4 },
    { name: "German Bundesliga", aliases: ["german bundesliga", "bundesliga", "german bundesliga 1"], score: 5 },
    { name: "French Ligue 1", aliases: ["french ligue 1", "ligue 1", "ligue 1 mcdonalds", "ligue 1 uber eats"], score: 6 },
    { name: "UEFA Europa League", aliases: ["uefa europa league", "europa league", "c2"], score: 7 },
    { name: "UEFA Conference League", aliases: ["uefa europa conference league", "uefa conference league", "conference league", "c3"], score: 8 },
    { name: "UEFA Super Cup", aliases: ["uefa super cup"], score: 9 },
    { name: "FIFA World Cup", aliases: ["fifa world cup", "world cup"], score: 10 },
    { name: "UEFA European Championship", aliases: ["uefa european championship", "uefa euro", "euro championship", "euro 2024", "euro 2028"], score: 11 },
    { name: "UEFA Nations League", aliases: ["uefa nations league", "nations league"], score: 12 },
    { name: "Copa America", aliases: ["copa america", "conmebol copa america"], score: 13 },
    { name: "AFC Asian Cup", aliases: ["afc asian cup", "asian cup"], score: 14 },
    { name: "AFF Championship", aliases: ["aff championship", "aff cup", "asean cup", "asean championship"], score: 15 },
    { name: "English FA Cup", aliases: ["english fa cup", "fa cup", "the fa cup"], score: 20 },
    { name: "English League Cup", aliases: ["english league cup", "efl cup", "carabao cup"], score: 21 },
    { name: "Spanish Copa del Rey", aliases: ["spanish copa del rey", "copa del rey"], score: 22 },
    { name: "Italian Coppa Italia", aliases: ["italian coppa italia", "coppa italia"], score: 23 },
    { name: "German DFB Pokal", aliases: ["german dfb pokal", "dfb pokal", "dfb-pokal"], score: 24 },
    { name: "French Coupe de France", aliases: ["french coupe de france", "coupe de france"], score: 25 },
    { name: "Vietnamese V-League", aliases: ["vietnamese v-league", "vietnamese v.league", "v-league 1", "v.league 1", "v-league", "v.league"], score: 26 },
    { name: "Saudi Pro League", aliases: ["saudi professional league", "saudi pro league", "saudi arabia pro league"], score: 30 },
    { name: "Major League Soccer", aliases: ["american major league soccer", "major league soccer", "mls"], score: 31 },
    { name: "AFC Champions League", aliases: ["afc champions league", "afc champions league elite"], score: 32 },
    { name: "CONMEBOL Copa Libertadores", aliases: ["conmebol libertadores", "copa libertadores"], score: 33 },
    { name: "Dutch Eredivisie", aliases: ["dutch eredivisie", "eredivisie"], score: 34 },
    { name: "Portuguese Primeira Liga", aliases: ["portuguese primeira liga", "primeira liga"], score: 35 },
    { name: "English League Championship", aliases: ["english league championship", "efl championship"], score: 36 },
    { name: "Scottish Premiership", aliases: ["scottish premiership", "scottish premier league"], score: 37 },
    { name: "Turkish Super Lig", aliases: ["turkish super lig", "turkish super league"], score: 38 },
    { name: "Brazilian Serie A", aliases: ["brazilian serie a", "brazil serie a", "campeonato brasileiro serie a"], score: 39 },
    { name: "Argentinian Primera Division", aliases: ["argentinian primera division", "argentine primera division", "liga profesional de futbol"], score: 40 },
    { name: "Spanish La Liga 2", aliases: ["spanish la liga 2", "spanish segunda division", "laliga 2", "la liga hypermotion"], score: 41 },
    { name: "Italian Serie B", aliases: ["italian serie b", "serie b"], score: 42 },
    { name: "German 2. Bundesliga", aliases: ["german 2. bundesliga", "2. bundesliga", "bundesliga 2"], score: 43 },
    { name: "French Ligue 2", aliases: ["french ligue 2", "ligue 2"], score: 44 }
];

export const PRIORITY_LEAGUES = TOP_TIER_LEAGUES.map((l) => l.name);

// ==========================================
// 6. I18N LANGUAGES
// ==========================================
export const LANGUAGES = [
    { code: "vi", name: "Tiếng Việt", flag: "🇻🇳" },
    { code: "en", name: "English", flag: "🇺🇸" },
];

// ==========================================
// 7. PAGINATION & GRID CONSTANTS
// ==========================================
export const PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_PAGE_SIZE: 16,
    LISTING_PAGE_SIZE: 16,
    ROW_PAGE_SIZE: 12,
    HERO_POOL_SIZE: 20,
    TMDB_PAGE_SIZE: 20,
    MAX_TMDB_PAGES: 500,
    VISIBLE_PAGE_BUTTONS: 5,
    NAVBAR_SCROLL_OFFSET: 84,
};

export const GRID_CONFIG = {
    LISTING_GRID_CLASSES: "grid grid-cols-2 gap-6 md:grid-cols-4 lg:grid-cols-8 xl:grid-cols-8 2xl:grid-cols-8",
    DESKTOP_COLUMNS: 8,
    TABLET_COLUMNS: 4,
    MOBILE_COLUMNS: 2,
    DEFAULT_ROWS: 2,
};
