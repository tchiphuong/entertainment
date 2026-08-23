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

/**
 * Fetch danh sách kênh TV từ New API hoặc fallback M3U
 */
export const fetchChannels = async () => {
    const NEW_API_URL = import.meta.env.VITE_TV_API_URL || "";
    const ACCESS_TOKEN = import.meta.env.VITE_TV_API_ACCESS_TOKEN || "";

    let apiGroups = null;
    let apiEpgs = [];
    try {
        console.log("Fetching channels from New API...");
        const apiResponse = await fetch(NEW_API_URL, {
            headers: { "X-Access-Token": ACCESS_TOKEN },
            signal: AbortSignal.timeout(8000),
        });

        if (apiResponse.ok) {
            const json = await apiResponse.json();
            if (json && Array.isArray(json.groups)) {
                apiGroups = json.groups;
                apiEpgs = Array.isArray(json.epgs) ? json.epgs : [];
                console.log(
                    `Fetched ${apiGroups.length} groups, ${apiEpgs.length} EPG sources`,
                );
            } else if (Array.isArray(json)) {
                apiGroups = json;
            } else if (Array.isArray(json.data)) {
                apiGroups = json.data;
            }
        }
    } catch (apiError) {
        console.warn("New API failed, falling back to M3U:", apiError.message);
    }

    // --- NEW JSON API PARSER ---
    if (Array.isArray(apiGroups)) {
        const mappedGroups = apiGroups
            .filter((groupItem) => groupItem.enabled !== false)
            .map((groupItem, gIdx) => {
                const channelsInGroup = [];

                if (Array.isArray(groupItem.channels)) {
                    groupItem.channels.forEach((chItem, cIdx) => {
                        if (chItem.enabled === false) return;

                        const configSources = [];
                        if (Array.isArray(chItem.sources)) {
                            chItem.sources.forEach((src) => {
                                configSources.push({
                                    file: src.url,
                                    type:
                                        src.type ||
                                        (src.url.includes(".mpd")
                                            ? "dash"
                                            : "hls"),
                                    label:
                                        src.label || src.quality || "Default",
                                    userAgent:
                                        src.headers?.userAgent ||
                                        src.ua ||
                                        null,
                                    referrer:
                                        src.headers?.referrer ||
                                        src.referer ||
                                        null,
                                    licenseType: src.drm?.licenseType || null,
                                    clearKeys: src.drm?.keys || null,
                                });
                            });
                        }

                        if (configSources.length === 0) return;

                        const defaultUrl =
                            chItem.url ||
                            chItem.link ||
                            configSources[0]?.file ||
                            "";

                        channelsInGroup.push({
                            id: chItem.id || `api-ch-${gIdx}-${cIdx}`,
                            name: chItem.name || "Unknown",
                            logo: toProxyImageUrl(chItem.logo || chItem.image),
                            url: defaultUrl,
                            group: groupItem.name || "Khác",
                            tvgId: chItem.tvgId || chItem.id,
                            tags: chItem.tags || [],
                            configSources: configSources,
                        });
                    });
                }

                return {
                    id: groupItem.id || `api-g-${gIdx}`,
                    name: groupItem.name || "Khác",
                    logo: toProxyImageUrl(groupItem.logo),
                    sortOrder: groupItem.sortOrder ?? 999,
                    channels: channelsInGroup,
                };
            })
            .filter((g) => g.channels.length > 0);

        if (mappedGroups.length > 0) {
            return { groups: mappedGroups, epgs: apiEpgs };
        }
    }

    // --- FALLBACK LOGIC (M3U) ---
    const channelSourcesEnv = import.meta.env.VITE_TV_CHANNEL_SOURCES || "";
    const urls = channelSourcesEnv.split(",").filter((url) => url.trim());

    const fetchPromises = urls.map(async (url) => {
        try {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(10000),
            });
            if (!response.ok) return null;
            return await response.text();
        } catch (error) {
            return null;
        }
    });

    const results = await Promise.all(fetchPromises);

    const allLines = results
        .filter((text) => text)
        .flatMap((text, index) => {
            const lines = text.split(/\r?\n/).map((l) => l.trim());

            if (urls[index]?.includes("bongda2.m3u")) {
                const filtered = [];
                let inTargetGroup = false;

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    if (line.startsWith("#EXTINF")) {
                        const groupMatch = line.match(/group-title="([^"]+)"/i);
                        inTargetGroup = groupMatch && groupMatch[1] === "10Cam";
                        if (inTargetGroup) filtered.push(line);
                    } else if (inTargetGroup) {
                        filtered.push(line);
                        if (line && !line.startsWith("#")) inTargetGroup = false;
                    } else if (line.startsWith("#EXTM3U")) {
                        filtered.push(line);
                    }
                }
                return filtered;
            }

            return lines;
        });

    const channelsByTvgId = {};
    const channelsByBaseName = {};
    const groups = {};

    const getBaseName = (name) => {
        return name
            .replace(
                /\s*(HD\s*Nhanh|FullHD|Full\s*HD|FHD|HD\d+|HD|SD|4K|UHD)(\s*\(\d+\))?\s*$/i,
                "",
            )
            .trim();
    };

    for (let i = 0; i < allLines.length; i++) {
        const line = allLines[i];
        if (!line || !line.startsWith("#EXTINF")) continue;

        const nameMatch = line.match(/,(.+)$/);
        const name = nameMatch ? nameMatch[1].trim() : "Unknown";
        const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
        const tvgIdMatch = line.match(/tvg-id="([^"]+)"/i);
        const groupMatch = line.match(/group-title="([^"]+)"/i);

        let referrer = null;
        let userAgent = null;
        let licenseType = null;
        let licenseKey = null;
        let clearKeys = [];

        for (let j = i + 1; j < allLines.length; j++) {
            const optLine = allLines[j];
            if (!optLine) continue;
            if (optLine.startsWith("#EXTINF") || !optLine.startsWith("#")) break;

            if (optLine.startsWith("#EXTVLCOPT:")) {
                const refMatch = optLine.match(/http-referrer=(.+)$/i);
                if (refMatch) referrer = refMatch[1].trim();
                const uaMatch = optLine.match(/http-user-agent=(.+)$/i);
                if (uaMatch) userAgent = uaMatch[1].trim();
            }

            if (optLine.startsWith("#KODIPROP:")) {
                const typeMatch = optLine.match(
                    /inputstream\.adaptive\.license_type=(.+)$/i,
                );
                if (typeMatch) licenseType = typeMatch[1].trim().toLowerCase();

                const keyMatch = optLine.match(
                    /inputstream\.adaptive\.license_key=(.+)$/i,
                );
                if (keyMatch) {
                    licenseKey = keyMatch[1].trim().replace(/^"|"$/g, "");
                    if (licenseKey.includes(":") && !licenseKey.startsWith("http") && !licenseKey.startsWith("{")) {
                        const pairs = licenseKey.split(",");
                        pairs.forEach((pair) => {
                            const parts = pair.trim().split(":");
                            if (parts.length === 2) {
                                clearKeys.push({
                                    kid: parts[0].trim(),
                                    key: parts[1].trim(),
                                });
                            }
                        });
                    } else if (licenseKey.startsWith("{")) {
                        try {
                            const json = JSON.parse(licenseKey);
                            if (json.keys && Array.isArray(json.keys)) {
                                json.keys.forEach((k) => {
                                    if (k.kid && k.k) {
                                        clearKeys.push({
                                            kid: k.kid,
                                            key: k.k,
                                            isBase64: true,
                                        });
                                    }
                                });
                            }
                        } catch (e) {}
                    }
                }
            }
        }

        let url = "";
        for (let j = i + 1; j < allLines.length; j++) {
            if (allLines[j] && !allLines[j].startsWith("#")) {
                url = allLines[j];
                break;
            }
        }

        if (!url) continue;

        const tvgId = tvgIdMatch ? tvgIdMatch[1] : null;
        const groupName = groupMatch ? groupMatch[1] : "Khác";
        const baseName = getBaseName(name);

        const qualityMatch = name.match(
            /\s*(HD\s*Nhanh|FullHD|Full\s*HD|FHD|HD\d+|HD|SD|4K|UHD)(\s*\(\d+\))?\s*$/i,
        );
        const quality = qualityMatch ? qualityMatch[1].trim() : "Default";
        const sourceType = url.toLowerCase().includes(".mpd") ? "dash" : "hls";

        const source = {
            file: url,
            type: sourceType,
            label: quality,
            referrer,
            userAgent,
            licenseType,
            licenseKey,
            clearKeys: clearKeys.length > 0 ? clearKeys : null,
        };

        const groupKey = tvgId || baseName;

        if (groupKey && (channelsByTvgId[groupKey] || channelsByBaseName[groupKey])) {
            const existingChannel = channelsByTvgId[groupKey] || channelsByBaseName[groupKey];
            existingChannel.configSources.push(source);
        } else {
            const newChannel = {
                id: `m3u-ch-${Object.keys(channelsByBaseName).length}`,
                name: baseName,
                logo: toProxyImageUrl(logoMatch ? logoMatch[1] : null),
                url: url,
                group: groupName,
                tvgId: tvgId,
                configSources: [source],
            };

            if (tvgId) channelsByTvgId[tvgId] = newChannel;
            channelsByBaseName[baseName] = newChannel;

            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(newChannel);
        }
    }

    const mappedGroups = Object.keys(groups).map((groupName, idx) => ({
        id: `m3u-g-${idx}`,
        name: groupName,
        channels: groups[groupName],
    }));

    return { groups: mappedGroups, epgs: [] };
};

export const tvService = {
    fetchChannels,
    toProxyImageUrl,
    handleImageFallbackError,
    FALLBACK_LOGO_DATA_URI,
};
