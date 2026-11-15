/**
 * Cloudflare Pages Function: High-performance Video & IPTV Stream Proxy
 * Endpoint: /api/proxy
 * Supports:
 * - OPTIONS: CORS preflight
 * - POST: JSON payload { url, method, headers, referer, userAgent, origin, body } (Used by Shaka Player)
 * - GET: Query parameters ?url=...&referer=...&ua=... (Used by HLS.js / Native Video)
 * - Automatic .m3u8 playlist URL rewriting to ensure child chunks flow through the proxy
 * - Full Range request forwarding (HTTP 206 Partial Content) for smooth video seeking
 */

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, HEAD",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type, Date",
    "Access-Control-Max-Age": "86400",
};

export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
    });
}

function resolveProxyParams(request) {
    const requestUrl = new URL(request.url);
    const targetUrl = requestUrl.searchParams.get("url");
    const referer = requestUrl.searchParams.get("referer") || requestUrl.searchParams.get("ref");
    const userAgent = requestUrl.searchParams.get("ua") || requestUrl.searchParams.get("userAgent");
    const origin = requestUrl.searchParams.get("origin");

    return { targetUrl, referer, userAgent, origin };
}

function buildForwardHeaders(incomingHeaders, customHeaders = {}, referer, userAgent, origin) {
    const headers = new Headers();

    const range = incomingHeaders.get("range");
    if (range) {
        headers.set("Range", range);
    }
    const accept = incomingHeaders.get("accept");
    if (accept) {
        headers.set("Accept", accept);
    }

    for (const [key, value] of Object.entries(customHeaders)) {
        if (value && typeof value === "string") {
            headers.set(key, value);
        }
    }

    if (referer) {
        headers.set("Referer", referer);
        if (!origin) {
            try {
                headers.set("Origin", new URL(referer).origin);
            } catch {}
        }
    }
    if (origin) {
        headers.set("Origin", origin);
    }
    if (userAgent) {
        headers.set("User-Agent", userAgent);
    }

    return headers;
}

function rewriteM3u8Playlist(manifestText, baseUrl, proxyOrigin, referer, userAgent) {
    const lines = manifestText.split("\n");
    const outputLines = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
            outputLines.push(line);
            continue;
        }

        if (trimmed.startsWith("#")) {
            if (trimmed.includes('URI="')) {
                const rewrittenTag = trimmed.replace(/URI="([^"]+)"/g, (match, uri) => {
                    const resolvedUri = new URL(uri, baseUrl).toString();
                    const proxyUri = `${proxyOrigin}/api/proxy?url=${encodeURIComponent(resolvedUri)}` +
                        (referer ? `&referer=${encodeURIComponent(referer)}` : "") +
                        (userAgent ? `&ua=${encodeURIComponent(userAgent)}` : "");
                    return `URI="${proxyUri}"`;
                });
                outputLines.push(rewrittenTag);
                continue;
            }
            outputLines.push(line);
            continue;
        }

        try {
            const resolvedUri = new URL(trimmed, baseUrl).toString();
            const proxyUri = `${proxyOrigin}/api/proxy?url=${encodeURIComponent(resolvedUri)}` +
                (referer ? `&referer=${encodeURIComponent(referer)}` : "") +
                (userAgent ? `&ua=${encodeURIComponent(userAgent)}` : "");
            outputLines.push(proxyUri);
        } catch {
            outputLines.push(line);
        }
    }

    return outputLines.join("\n");
}

export async function onRequest(context) {
    const { request } = context;
    if (request.method === "OPTIONS") {
        return onRequestOptions();
    }

    try {
        let targetUrl = "";
        let method = "GET";
        let customHeaders = {};
        let bodyPayload = null;
        let referer = "";
        let userAgent = "";
        let origin = "";

        if (request.method === "POST") {
            const contentType = request.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
                const jsonBody = await request.json().catch(() => ({}));
                targetUrl = jsonBody.url || "";
                method = jsonBody.method || "GET";
                customHeaders = jsonBody.headers || {};
                bodyPayload = jsonBody.body || null;
                referer = jsonBody.referer || jsonBody.referrer || "";
                userAgent = jsonBody.userAgent || jsonBody.ua || "";
                origin = jsonBody.origin || "";
            }
        }

        if (!targetUrl) {
            const params = resolveProxyParams(request);
            targetUrl = params.targetUrl;
            referer = referer || params.referer;
            userAgent = userAgent || params.userAgent;
            origin = origin || params.origin;
        }

        if (!targetUrl) {
            return new Response(JSON.stringify({ error: "Missing 'url' parameter" }), {
                status: 400,
                headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
            });
        }

        const forwardHeaders = buildForwardHeaders(request.headers, customHeaders, referer, userAgent, origin);

        const fetchOptions = {
            method: method,
            headers: forwardHeaders,
            redirect: "follow",
        };

        if (bodyPayload && method !== "GET" && method !== "HEAD") {
            fetchOptions.body = bodyPayload;
        }

        const upstreamResponse = await fetch(targetUrl, fetchOptions);

        const responseHeaders = new Headers(CORS_HEADERS);
        const headersToForward = [
            "content-type",
            "content-length",
            "content-range",
            "accept-ranges",
            "last-modified",
            "etag",
        ];

        for (const h of headersToForward) {
            const val = upstreamResponse.headers.get(h);
            if (val) {
                responseHeaders.set(h, val);
            }
        }

        const contentType = upstreamResponse.headers.get("content-type") || "";
        const isM3u8 = targetUrl.includes(".m3u8") ||
            contentType.includes("application/vnd.apple.mpegurl") ||
            contentType.includes("application/x-mpegurl");

        if (isM3u8 && upstreamResponse.ok) {
            const manifestText = await upstreamResponse.text();
            const currentOrigin = new URL(request.url).origin;
            const rewritten = rewriteM3u8Playlist(manifestText, targetUrl, currentOrigin, referer, userAgent);
            responseHeaders.set("Content-Type", "application/vnd.apple.mpegurl");
            return new Response(rewritten, {
                status: upstreamResponse.status,
                headers: responseHeaders,
            });
        }

        return new Response(upstreamResponse.body, {
            status: upstreamResponse.status,
            statusText: upstreamResponse.statusText,
            headers: responseHeaders,
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message || "Proxy error" }), {
            status: 502,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
    }
}
