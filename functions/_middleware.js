/**
 * Cloudflare Pages Middleware
 * Tự động tạo thẻ Open Graph / Twitter Card động cho crawler mạng xã hội (Facebook, Zalo, Telegram, Twitter...)
 * Giúp hiển thị thumbnail, tiêu đề và mô tả chính xác của từng phim khi người dùng paste link.
 * Đồng thời đảm bảo định tuyến SPA chuẩn xác 100% với HTTP status 200 (không bị 404).
 */

const BOT_USER_AGENTS = [
    "facebookexternalhit",
    "Facebot",
    "Twitterbot",
    "TelegramBot",
    "WhatsApp",
    "LinkedInBot",
    "ZaloBot",
    "zalo",
    "Slackbot",
    "Discordbot",
    "Pinterest",
    "Googlebot",
    "bingbot",
    "Applebot",
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

const resolveMovieSocialImage = (movie, fallbackUrl) => {
    if (!movie) return fallbackUrl;
    // Ưu tiên thumb_url (ảnh ngang 16:9) để hiển thị thumbnail mạng xã hội đẹp nhất
    const raw = movie.thumb_url || movie.poster_url || "";
    if (!raw) return fallbackUrl;
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
        return raw;
    }
    return `https://img.phimapi.com/uploads/movies/${raw}`;
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

    // Nhận diện link xem phim: /vod/play/:slug hoặc /vods/play/:slug hoặc /play/:slug
    const movieMatch = url.pathname.match(/\/(?:vod|vods)?\/?play\/([a-z0-9_-]+)/i);
    if (movieMatch?.[1]) {
        const slug = movieMatch[1].toLowerCase();
        try {
            // Gọi API lấy metadata phim với timeout 2.5s
            const apiRes = await fetch(`https://phimapi.com/phim/${encodeURIComponent(slug)}`, {
                headers: { "User-Agent": "VODPrime-Edge/1.0" },
                signal: AbortSignal.timeout(2500),
            });

            if (apiRes.ok) {
                const data = await apiRes.json();
                const movie = data?.movie;
                if (movie?.name) {
                    const origin = movie.origin_name ? ` (${movie.origin_name})` : "";
                    ogTitle = `${movie.name}${origin} - Xem Phim Online | VOD Prime`;
                    ogDesc = stripHtml(movie.content) || `Xem phim ${movie.name} Full HD Vietsub Thuyết Minh tốc độ cao tại VOD Prime.`;
                    ogImage = resolveMovieSocialImage(movie, defaultImage);
                }
            }
        } catch {
            // Giữ metadata mặc định nếu API bên thứ 3 lỗi/timeout
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
