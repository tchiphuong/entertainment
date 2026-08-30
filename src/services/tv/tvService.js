import {
    toProxyImageUrl,
    handleImageFallbackError,
    FALLBACK_LOGO_DATA_URI,
    IMAGE_PROXY_PREFIX,
} from "../../utils/imageUtils";

export {
    toProxyImageUrl,
    handleImageFallbackError,
    FALLBACK_LOGO_DATA_URI,
    IMAGE_PROXY_PREFIX,
};

const parseSourceConfig = (src) => ({
    file: src.url,
    type: src.type || (src.url.includes(".mpd") ? "dash" : "hls"),
    label: src.label || src.quality || "Default",
    userAgent: src.headers?.userAgent || src.ua || null,
    referrer: src.headers?.referrer || src.referer || null,
    licenseType: src.drm?.licenseType || null,
    clearKeys: src.drm?.keys || null,
});

const parseApiChannel = (chItem, groupItem, gIdx, cIdx) => {
    if (chItem.enabled === false) return null;
    const configSources = (Array.isArray(chItem.sources) ? chItem.sources : [])
        .map(parseSourceConfig)
        .filter((s) => Boolean(s.file));

    if (configSources.length === 0) return null;

    const defaultUrl = chItem.url || chItem.link || configSources[0]?.file || "";
    return {
        id: chItem.id || `api-ch-${gIdx}-${cIdx}`,
        name: chItem.name || "Unknown",
        logo: toProxyImageUrl(chItem.logo || chItem.image),
        url: defaultUrl,
        group: groupItem.name || "Khác",
        tvgId: chItem.tvgId || chItem.id,
        tags: chItem.tags || [],
        configSources,
    };
};

const parseNewApiGroups = (apiGroups, apiEpgs) => {
    if (!Array.isArray(apiGroups)) return null;

    const mappedGroups = apiGroups
        .filter((groupItem) => groupItem.enabled !== false)
        .map((groupItem, gIdx) => {
            const channels = (Array.isArray(groupItem.channels) ? groupItem.channels : [])
                .map((ch, cIdx) => parseApiChannel(ch, groupItem, gIdx, cIdx))
                .filter(Boolean);

            return {
                id: groupItem.id || `api-g-${gIdx}`,
                name: groupItem.name || "Khác",
                logo: toProxyImageUrl(groupItem.logo),
                sortOrder: groupItem.sortOrder ?? 999,
                channels,
            };
        })
        .filter((g) => g.channels.length > 0);

    return mappedGroups.length > 0 ? { groups: mappedGroups, epgs: apiEpgs } : null;
};

const fetchNewApiData = async (apiUrl, token) => {
    if (!apiUrl) return null;
    try {
        const res = await fetch(apiUrl, {
            headers: { "X-Access-Token": token },
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return null;
        const json = await res.json();
        if (json && Array.isArray(json.groups)) {
            return { groups: json.groups, epgs: Array.isArray(json.epgs) ? json.epgs : [] };
        }
        if (Array.isArray(json)) return { groups: json, epgs: [] };
        if (Array.isArray(json?.data)) return { groups: json.data, epgs: [] };
        return null;
    } catch {
        return null;
    }
};

const getBaseName = (name) =>
    name.replace(/\s*(HD\s*Nhanh|FullHD|Full\s*HD|FHD|HD\d+|HD|SD|4K|UHD)(\s*\(\d+\))?\s*$/i, "").trim();

const parseClearKeys = (licenseKey) => {
    const clearKeys = [];
    if (licenseKey.includes(":") && !licenseKey.startsWith("http") && !licenseKey.startsWith("{")) {
        licenseKey.split(",").forEach((pair) => {
            const parts = pair.trim().split(":");
            if (parts.length === 2) clearKeys.push({ kid: parts[0].trim(), key: parts[1].trim() });
        });
    } else if (licenseKey.startsWith("{")) {
        try {
            const json = JSON.parse(licenseKey);
            if (Array.isArray(json.keys)) {
                json.keys.forEach((k) => {
                    if (k.kid && k.k) clearKeys.push({ kid: k.kid, key: k.k, isBase64: true });
                });
            }
        } catch {}
    }
    return clearKeys;
};

const parseExtVlcOpt = (optLine, opts) => {
    const refMatch = optLine.match(/http-referrer=(.+)$/i);
    if (refMatch) opts.referrer = refMatch[1].trim();
    const uaMatch = optLine.match(/http-user-agent=(.+)$/i);
    if (uaMatch) opts.userAgent = uaMatch[1].trim();
};

const parseKodiProp = (optLine, opts) => {
    const typeMatch = optLine.match(/inputstream\.adaptive\.license_type=(.+)$/i);
    if (typeMatch) opts.licenseType = typeMatch[1].trim().toLowerCase();
    const keyMatch = optLine.match(/inputstream\.adaptive\.license_key=(.+)$/i);
    if (keyMatch) {
        opts.licenseKey = keyMatch[1].trim().replace(/^"|"$/g, "");
        opts.clearKeys = parseClearKeys(opts.licenseKey);
    }
};

const parseM3uBlockOptions = (allLines, startIndex) => {
    const opts = {
        referrer: null,
        userAgent: null,
        licenseType: null,
        licenseKey: null,
        clearKeys: [],
    };

    for (let j = startIndex + 1; j < allLines.length; j++) {
        const opt = allLines[j];
        if (!opt || opt.startsWith("#EXTINF") || !opt.startsWith("#")) break;

        if (opt.startsWith("#EXTVLCOPT:")) {
            parseExtVlcOpt(opt, opts);
        } else if (opt.startsWith("#KODIPROP:")) {
            parseKodiProp(opt, opts);
        }
    }

    return opts;
};

const findNextStreamUrl = (allLines, startIndex) => {
    for (let j = startIndex + 1; j < allLines.length; j++) {
        if (allLines[j] && !allLines[j].startsWith("#")) {
            return allLines[j];
        }
    }
    return "";
};

const filterBongda2Lines = (lines) => {
    const filtered = [];
    let inTarget = false;
    for (const line of lines) {
        if (line.startsWith("#EXTINF")) {
            const groupMatch = line.match(/group-title="([^"]+)"/i);
            inTarget = groupMatch?.[1] === "10Cam";
            if (inTarget) filtered.push(line);
        } else if (inTarget) {
            filtered.push(line);
            if (line && !line.startsWith("#")) inTarget = false;
        } else if (line.startsWith("#EXTM3U")) {
            filtered.push(line);
        }
    }
    return filtered;
};

const fetchAllM3uLines = async (sourcesEnv) => {
    const urls = sourcesEnv.split(",").map((u) => u.trim()).filter(Boolean);
    const results = await Promise.all(
        urls.map(async (url) => {
            try {
                const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
                return res.ok ? await res.text() : null;
            } catch {
                return null;
            }
        }),
    );

    return results.filter(Boolean).flatMap((text, idx) => {
        const lines = text.split(/\r?\n/).map((l) => l.trim());
        return urls[idx]?.includes("bongda2.m3u") ? filterBongda2Lines(lines) : lines;
    });
};

const registerM3uChannel = ({ channelsByTvgId, channelsByBaseName, groups }, chData, source) => {
    const groupKey = chData.tvgId || chData.baseName;
    const existing = groupKey ? (channelsByTvgId[groupKey] || channelsByBaseName[groupKey]) : null;

    if (existing) {
        existing.configSources.push(source);
        return;
    }

    const newChannel = {
        id: `m3u-ch-${Object.keys(channelsByBaseName).length}`,
        name: chData.baseName,
        logo: toProxyImageUrl(chData.logo),
        url: chData.url,
        group: chData.groupName,
        tvgId: chData.tvgId,
        configSources: [source],
    };

    if (chData.tvgId) channelsByTvgId[chData.tvgId] = newChannel;
    channelsByBaseName[chData.baseName] = newChannel;
    if (!groups[chData.groupName]) groups[chData.groupName] = [];
    groups[chData.groupName].push(newChannel);
};

const parseM3uExtinfLine = (line, allLines, index) => {
    const nameMatch = line.match(/,(.+)$/);
    const name = nameMatch ? nameMatch[1].trim() : "Unknown";
    const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
    const tvgIdMatch = line.match(/tvg-id="([^"]+)"/i);
    const groupMatch = line.match(/group-title="([^"]+)"/i);

    const opts = parseM3uBlockOptions(allLines, index);
    const url = findNextStreamUrl(allLines, index);
    if (!url) return null;

    const qualityMatch = name.match(/\s*(HD\s*Nhanh|FullHD|Full\s*HD|FHD|HD\d+|HD|SD|4K|UHD)(\s*\(\d+\))?\s*$/i);
    const quality = qualityMatch ? qualityMatch[1].trim() : "Default";

    return {
        chData: {
            name,
            baseName: getBaseName(name),
            logo: logoMatch ? logoMatch[1] : null,
            tvgId: tvgIdMatch ? tvgIdMatch[1] : null,
            groupName: groupMatch ? groupMatch[1] : "Khác",
            url,
        },
        source: {
            file: url,
            type: url.toLowerCase().includes(".mpd") ? "dash" : "hls",
            label: quality,
            referrer: opts.referrer,
            userAgent: opts.userAgent,
            licenseType: opts.licenseType,
            licenseKey: opts.licenseKey,
            clearKeys: opts.clearKeys.length > 0 ? opts.clearKeys : null,
        },
    };
};

const parseM3uLines = (allLines) => {
    const state = { channelsByTvgId: {}, channelsByBaseName: {}, groups: {} };

    for (let i = 0; i < allLines.length; i++) {
        const line = allLines[i];
        if (!line?.startsWith("#EXTINF")) continue;

        const parsed = parseM3uExtinfLine(line, allLines, i);
        if (parsed) {
            registerM3uChannel(state, parsed.chData, parsed.source);
        }
    }

    return Object.keys(state.groups).map((groupName, idx) => ({
        id: `m3u-g-${idx}`,
        name: groupName,
        channels: state.groups[groupName],
    }));
};

/**
 * Fetch danh sách kênh TV từ New API hoặc fallback M3U
 */
export const fetchChannels = async () => {
    const NEW_API_URL = import.meta.env.VITE_TV_API_URL || "";
    const ACCESS_TOKEN = import.meta.env.VITE_TV_API_ACCESS_TOKEN || "";

    const apiData = await fetchNewApiData(NEW_API_URL, ACCESS_TOKEN);
    if (apiData) {
        const parsed = parseNewApiGroups(apiData.groups, apiData.epgs);
        if (parsed) return parsed;
    }

    const allLines = await fetchAllM3uLines(import.meta.env.VITE_TV_CHANNEL_SOURCES || "");
    const mappedGroups = parseM3uLines(allLines);
    return { groups: mappedGroups, epgs: [] };
};

export const tvService = {
    fetchChannels,
    toProxyImageUrl,
    handleImageFallbackError,
    FALLBACK_LOGO_DATA_URI,
};
