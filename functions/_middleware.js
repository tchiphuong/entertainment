/**
 * Cloudflare Pages Middleware
 * Tự động tạo thẻ Open Graph / Twitter Card động cho crawler mạng xã hội (Facebook, Zalo, Telegram, Twitter...)
 * Giúp hiển thị thumbnail, tiêu đề và mô tả chính xác của từng phim khi người dùng paste link.
 * Đồng thời đảm bảo định tuyến SPA chuẩn xác 100% với HTTP status 200 (không bị 404).
 */

const BOT_USER_AGENTS = [
    "facebookexternalhit",
    "Facebot",
    "facebookcatalog",
    "Twitterbot",
    "TelegramBot",
    "WhatsApp",
    "LinkedInBot",
    "ZaloBot",
    "zalo",
    "ZaloPC",
    "Zalo-LinkPreview",
    "Slackbot",
    "Discordbot",
    "Pinterest",
    "Googlebot",
    "bingbot",
    "Applebot",
    "SkypeUriPreview",
    "Viber",
];

const BOT_REGEX = new RegExp(BOT_USER_AGENTS.join("|"), "i");

const STATIC_EXT_REGEX = /\.(js|css|png|jpg|jpeg|gif|svg|webp|woff2?|ico|json|txt|xml|mp4|m3u8|mpd)$/i;

const stripHtml = (html) => {
    if (!html || typeof html !== "string") return "";
    return html
        .replace(/<[^>]*>?/gm, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200);
};

// Ưu tiên lấy ảnh TMDB (chuẩn JPEG 1280x720) để hiển thị thumbnail mạng xã hội đẹp nhất, không bị lỗi WebP
const fetchTmdbSocialImage = async (tmdbId, tmdbType, apiKey) => {
    if (!tmdbId || !apiKey) return null;
    const resolvedType = tmdbType === "series" || tmdbType === "tv" ? "tv" : "movie";
    try {
        const res = await fetch(
            `https://api.themoviedb.org/3/${resolvedType}/${encodeURIComponent(tmdbId)}?api_key=${apiKey}&language=vi-VN`,
            { signal: AbortSignal.timeout(1800) }
        );
        if (!res.ok) return null;
        const data = await res.json();
        if (data?.backdrop_path) {
            return `https://image.tmdb.org/t/p/w1280${data.backdrop_path}`;
        }
        if (data?.poster_path) {
            return `https://image.tmdb.org/t/p/w780${data.poster_path}`;
        }
    } catch {
        // Bỏ qua nếu TMDB timeout
    }
    return null;
};

const resolveMovieSocialImage = (movie, fallbackUrl) => {
    if (!movie) return fallbackUrl;
    // Ưu tiên thumb_url (ảnh ngang 16:9) để hiển thị thumbnail mạng xã hội đẹp nhất
    const raw = movie.thumb_url || movie.poster_url || "";
    if (!raw) return fallbackUrl;
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
        return raw;
    }
    return `https://phimimg.com/uploads/movies/${raw}`;
};

// Lấy thông tin phim từ Nguồn phù hợp
const fetchMovieMetadata = async (slug, source, env) => {
    const isSource2 = source === "2" || source === "source_2" || source === "source_o";
    const source1Api = env?.VITE_SOURCE_1_API || "https://phimapi.com";
    const source2Api = env?.VITE_SOURCE_2_API || "https://ophim1.com";

    // 1. Thử nguồn được chỉ định hoặc nguồn 1
    const primaryUrl = isSource2
        ? `${source2Api}/v1/api/phim/${encodeURIComponent(slug)}`
        : `${source1Api}/phim/${encodeURIComponent(slug)}`;

    try {
        const res = await fetch(primaryUrl, {
            headers: { "User-Agent": "VODPrime-Edge/1.0" },
            signal: AbortSignal.timeout(2200),
        });
        if (res.ok) {
            const data = await res.json();
            const movie = isSource2 ? data?.data?.item : data?.movie;
            if (movie?.name) return movie;
        }
    } catch {}

    // 2. Fallback sang nguồn còn lại nếu nguồn chính không tìm thấy
    const fallbackUrl = isSource2
        ? `${source1Api}/phim/${encodeURIComponent(slug)}`
        : `${source2Api}/v1/api/phim/${encodeURIComponent(slug)}`;

    try {
        const res = await fetch(fallbackUrl, {
            headers: { "User-Agent": "VODPrime-Edge/1.0" },
            signal: AbortSignal.timeout(2000),
        });
        if (res.ok) {
            const data = await res.json();
            const movie = isSource2 ? data?.movie : data?.data?.item;
            if (movie?.name) return movie;
        }
    } catch {}

    return null;
};

export async function onRequest(context) {
    const { request, next } = context;
    const userAgent = request.headers.get("user-agent") || "";
    const url = new URL(request.url);

    // Bỏ qua các file tĩnh hoặc request API
    if (STATIC_EXT_REGEX.test(url.pathname) || url.pathname.startsWith("/api/")) {
        return next();
    }

    // Nếu không phải crawler của mạng xã hội -> phục vụ SPA bình thường
    if (!BOT_REGEX.test(userAgent)) {
        const response = await next();
        // Nếu Cloudflare Pages trả về 404 cho SPA subroute, fallback về index.html với HTTP status 200
        if (response.status === 404 && context.env?.ASSETS) {
            return context.env.ASSETS.fetch(new URL("/", request.url));
        }
        return response;
    }

    const defaultImage = `${url.origin}/og-image.jpg`;
    let ogTitle = "VOD Prime - Kho Phim Hay & Trực Tiếp Thể Thao";
    let ogDesc = "Khám phá kho phim điện ảnh, phim bộ chất lượng cao và xem trực tiếp thể thao, truyền hình trực tuyến tốc độ cao tại VOD Prime.";
    let ogImage = defaultImage;
    const ogUrl = request.url;

    // Nhận diện link xem phim hoặc chi tiết phim
    const movieMatch = url.pathname.match(/\/(?:vod|vods)?\/?(?:play|detail|phim)\/([a-z0-9_-]+)/i);
    if (movieMatch?.[1]) {
        const slug = movieMatch[1].toLowerCase();
        const sourceParam = url.searchParams.get("source") || "";
        const movie = await fetchMovieMetadata(slug, sourceParam, context.env);

        if (movie?.name) {
            const origin = movie.origin_name ? ` (${movie.origin_name})` : "";
            ogTitle = `${movie.name}${origin} - Xem Phim Online | VOD Prime`;
            ogDesc = stripHtml(movie.content) || `Xem phim ${movie.name} Full HD Vietsub Thuyết Minh tốc độ cao tại VOD Prime.`;

            // Thử lấy ảnh JPEG chất lượng cao từ TMDB trước để mạng xã hội parse mượt mà 100%
            const tmdbId = movie.tmdb?.id || movie.tmdb_id;
            const tmdbType = movie.tmdb?.type || movie.type;
            const tmdbApiKey = context.env?.VITE_TMDB_API_KEY || "3356865d41894a2fa9bfa84b2b5f59bb";

            const tmdbImage = await fetchTmdbSocialImage(tmdbId, tmdbType, tmdbApiKey);
            if (tmdbImage) {
                ogImage = tmdbImage;
            } else {
                ogImage = resolveMovieSocialImage(movie, defaultImage);
            }
        }
    } else if (url.pathname === "/tv" || url.pathname.startsWith("/tv/")) {
        ogTitle = "Truyền Hình Trực Tuyến HD - VOD Prime";
        ogDesc = "Xem trực tiếp các kênh truyền hình thời sự, thể thao, giải trí độ nét cao mượt mà không giật lag.";
    }

    // Lấy phản hồi HTML tĩnh của trang
    let response = await next();
    if (response.status === 404 && context.env?.ASSETS) {
        response = await context.env.ASSETS.fetch(new URL("/", request.url));
    }

    const imageType = ogImage.endsWith(".webp")
        ? "image/webp"
        : (ogImage.endsWith(".png") ? "image/png" : "image/jpeg");

    // Dùng HTMLRewriter để thay đổi thẻ meta động trả về cho bot mạng xã hội
    const transformed = new HTMLRewriter()
        .on("title", {
            element(e) {
                e.setInnerContent(ogTitle);
            },
        })
        .on('meta[name="robots"]', {
            element(e) {
                // Đảm bảo bot mạng xã hội được phép đọc và hiển thị hình ảnh cỡ lớn
                e.setAttribute("content", "index, follow, max-image-preview:large");
            },
        })
        .on('meta[name="description"]', {
            element(e) {
                e.setAttribute("content", ogDesc);
            },
        })
        .on('meta[property="og:title"]', {
            element(e) {
                e.setAttribute("content", ogTitle);
            },
        })
        .on('meta[property="og:description"]', {
            element(e) {
                e.setAttribute("content", ogDesc);
            },
        })
        .on('meta[property="og:image"]', {
            element(e) {
                e.setAttribute("content", ogImage);
            },
        })
        .on('meta[property="og:image:secure_url"]', {
            element(e) {
                e.setAttribute("content", ogImage);
            },
        })
        .on('meta[property="og:image:type"]', {
            element(e) {
                e.setAttribute("content", imageType);
            },
        })
        .on('meta[property="og:url"]', {
            element(e) {
                e.setAttribute("content", ogUrl);
            },
        })
        .on('meta[name="twitter:card"]', {
            element(e) {
                e.setAttribute("content", "summary_large_image");
            },
        })
        .on('meta[name="twitter:title"]', {
            element(e) {
                e.setAttribute("content", ogTitle);
            },
        })
        .on('meta[name="twitter:description"]', {
            element(e) {
                e.setAttribute("content", ogDesc);
            },
        })
        .on('meta[name="twitter:image"]', {
            element(e) {
                e.setAttribute("content", ogImage);
            },
        })
        .transform(response);

    // Luôn đảm bảo status là 200 OK cho bot mạng xã hội
    return new Response(transformed.body, {
        status: 200,
        headers: transformed.headers,
    });
}
