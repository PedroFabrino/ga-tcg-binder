"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchCommunityChannelGroups = fetchCommunityChannelGroups;
exports.fetchCommunityTextChannels = fetchCommunityTextChannels;
exports.getAdminSettingsHelper = getAdminSettingsHelper;
exports.setBroadcastChannelHelper = setBroadcastChannelHelper;
exports.provisionMarketChannelsHelper = provisionMarketChannelsHelper;
const server_app_1 = require("@rootsdk/server-app");
const community_admin_1 = require("./community-admin");
const setup_provisioning_1 = require("./setup-provisioning");
async function resolveIsAdmin(userId, deps) {
    const isAdminCheck = deps.isCommunityAdmin ?? community_admin_1.checkIsCommunityAdmin;
    return isAdminCheck(userId);
}
async function fetchCommunityChannelGroups(deps = {}) {
    const listGroups = deps.listChannelGroups ?? (() => server_app_1.rootServer.community.channelGroups.list());
    const getGroup = deps.getChannelGroup ??
        (typeof server_app_1.rootServer.community.channelGroups?.get === "function"
            ? (p) => server_app_1.rootServer.community.channelGroups.get(p)
            : undefined);
    let groupList = [];
    try {
        const groups = (await listGroups()) || [];
        groupList = groups.map((g) => ({ id: String(g.id), name: g.name }));
    }
    catch (err) {
        console.warn("Failed to list channel groups:", err);
    }
    // If config has an alertSectionId not returned in list, attempt direct resolution
    if (deps.config?.getAlertSectionId && getGroup) {
        try {
            const storedSectionId = await deps.config.getAlertSectionId();
            if (storedSectionId && !groupList.some((g) => g.id === storedSectionId)) {
                const directGroup = await getGroup({
                    id: storedSectionId,
                });
                if (directGroup?.name) {
                    groupList.push({
                        id: String(directGroup.id),
                        name: directGroup.name,
                    });
                }
            }
        }
        catch {
            // Stale or inaccessible stored group ID
        }
    }
    return groupList;
}
async function fetchCommunityTextChannels(deps = {}) {
    const groups = await fetchCommunityChannelGroups(deps);
    const listChannels = deps.listChannels ?? ((p) => server_app_1.rootServer.community.channels.list(p));
    const getChannel = deps.getChannel ??
        (typeof server_app_1.rootServer.community.channels?.get === "function"
            ? (p) => server_app_1.rootServer.community.channels.get(p)
            : undefined);
    const textChannels = [];
    const seenIds = new Set();
    for (const group of groups) {
        try {
            const groupChannels = (await listChannels({
                channelGroupId: group.id,
            })) || [];
            for (const ch of groupChannels) {
                if (ch.channelType === server_app_1.ChannelType.Text) {
                    const idStr = String(ch.id);
                    if (!seenIds.has(idStr)) {
                        seenIds.add(idStr);
                        textChannels.push({
                            id: idStr,
                            name: ch.name,
                            groupName: group.name,
                        });
                    }
                }
            }
        }
        catch (err) {
            console.warn(`Failed to list channels for group ${group.name}:`, err);
        }
    }
    // If broadcast channel is stored in config but not yet seen, attempt direct resolution
    if (deps.config?.getBroadcastChannelId && getChannel) {
        try {
            const storedBroadcastId = await deps.config.getBroadcastChannelId();
            if (storedBroadcastId && !seenIds.has(storedBroadcastId)) {
                const directCh = await getChannel({
                    id: storedBroadcastId,
                });
                if (directCh &&
                    (directCh.channelType === undefined ||
                        directCh.channelType === server_app_1.ChannelType.Text)) {
                    textChannels.push({
                        id: String(directCh.id),
                        name: directCh.name,
                        groupName: "",
                    });
                }
            }
        }
        catch {
            // Stale broadcast channel
        }
    }
    return textChannels;
}
async function getAdminSettingsHelper(userId, config, deps = {}) {
    const broadcastLocale = (await config.getBroadcastLocale?.()) ?? "en";
    if (!(await resolveIsAdmin(userId, deps))) {
        return {
            isAdmin: false,
            broadcastChannelId: "",
            broadcastChannelName: "",
            textChannels: [],
            broadcastLocale,
            channelGroups: [],
            alertSectionId: "",
            alertSectionName: "",
        };
    }
    const depsWithConfig = { ...deps, config };
    const [rawBroadcastChannelId, rawAlertSectionId, textChannels, channelGroups] = await Promise.all([
        config.getBroadcastChannelId?.() ?? Promise.resolve(undefined),
        config.getAlertSectionId?.() ?? Promise.resolve(undefined),
        fetchCommunityTextChannels(depsWithConfig),
        fetchCommunityChannelGroups(depsWithConfig),
    ]);
    const activeChannel = rawBroadcastChannelId
        ? textChannels.find((ch) => ch.id === rawBroadcastChannelId)
        : undefined;
    const activeGroup = rawAlertSectionId
        ? channelGroups.find((g) => g.id === rawAlertSectionId)
        : undefined;
    // If stored IDs cannot be found in resolved channels/groups, clear dead config
    const broadcastChannelId = activeChannel ? rawBroadcastChannelId : "";
    const alertSectionId = activeGroup ? rawAlertSectionId : "";
    return {
        isAdmin: true,
        broadcastChannelId: broadcastChannelId ?? "",
        broadcastChannelName: activeChannel?.name ?? "",
        textChannels,
        broadcastLocale: broadcastLocale ?? "en",
        channelGroups,
        alertSectionId: alertSectionId ?? "",
        alertSectionName: activeGroup?.name ?? "",
    };
}
async function setBroadcastChannelHelper(userId, request, config, deps = {}) {
    const currentLocale = (await config.getBroadcastLocale?.()) ?? "en";
    if (!(await resolveIsAdmin(userId, deps))) {
        return {
            success: false,
            broadcastChannelId: "",
            broadcastChannelName: "",
            broadcastLocale: currentLocale,
            alertSectionId: "",
            alertSectionName: "",
            error: "FORBIDDEN",
        };
    }
    const targetChannelId = (request.channelId || "").trim();
    const targetGroupId = (request.channelGroupId || "").trim();
    const rawLocale = (request.broadcastLocale || "").trim();
    const hasLocale = rawLocale === "en" || rawLocale === "pt-BR";
    if (!targetChannelId && !targetGroupId && !hasLocale) {
        return {
            success: false,
            broadcastChannelId: "",
            broadcastChannelName: "",
            broadcastLocale: currentLocale,
            alertSectionId: "",
            alertSectionName: "",
            error: "INVALID_CHANNEL",
        };
    }
    const depsWithConfig = { ...deps, config };
    let finalGroupId = (await config.getAlertSectionId?.()) ?? "";
    let finalGroupName = "";
    if (targetGroupId) {
        const groups = await fetchCommunityChannelGroups(depsWithConfig);
        const matchedGroup = groups.find((g) => g.id === targetGroupId);
        if (matchedGroup) {
            if (config.setAlertSectionId) {
                await config.setAlertSectionId(targetGroupId);
            }
            finalGroupId = targetGroupId;
            finalGroupName = matchedGroup.name;
        }
    }
    else if (finalGroupId) {
        const groups = await fetchCommunityChannelGroups(depsWithConfig);
        finalGroupName = groups.find((g) => g.id === finalGroupId)?.name ?? "";
    }
    let finalChannelId = await config.getBroadcastChannelId();
    let finalChannelName = "";
    if (targetChannelId) {
        const textChannels = await fetchCommunityTextChannels(depsWithConfig);
        const matched = textChannels.find((ch) => ch.id === targetChannelId);
        if (!matched) {
            return {
                success: false,
                broadcastChannelId: "",
                broadcastChannelName: "",
                broadcastLocale: currentLocale,
                alertSectionId: finalGroupId ?? "",
                alertSectionName: finalGroupName,
                error: "CHANNEL_NOT_FOUND",
            };
        }
        await config.setBroadcastChannelId(targetChannelId);
        finalChannelId = targetChannelId;
        finalChannelName = matched.name;
    }
    else if (finalChannelId) {
        const textChannels = await fetchCommunityTextChannels(depsWithConfig);
        finalChannelName = textChannels.find((ch) => ch.id === finalChannelId)?.name ?? "";
    }
    if (hasLocale && config.setBroadcastLocale) {
        await config.setBroadcastLocale(rawLocale);
    }
    const updatedLocale = (await config.getBroadcastLocale?.()) ?? currentLocale;
    return {
        success: true,
        broadcastChannelId: finalChannelId ?? "",
        broadcastChannelName: finalChannelName,
        broadcastLocale: updatedLocale,
        alertSectionId: finalGroupId ?? "",
        alertSectionName: finalGroupName,
        error: "",
    };
}
async function provisionMarketChannelsHelper(userId, config, request = { channelGroupId: "" }, deps = {}) {
    if (!(await resolveIsAdmin(userId, deps))) {
        return {
            success: false,
            broadcastChannelId: "",
            broadcastChannelName: "",
            assistantChannelId: "",
            alertSectionId: "",
            alertSectionName: "",
            error: "FORBIDDEN",
        };
    }
    const targetGroupId = (request.channelGroupId || "").trim();
    if (deps.provisionChannels) {
        await deps.provisionChannels(targetGroupId || undefined);
    }
    else {
        await (0, setup_provisioning_1.provisionCommunityChannels)({
            rootServer: server_app_1.rootServer,
            config,
            targetGroupId: targetGroupId || undefined,
        });
    }
    const depsWithConfig = { ...deps, config };
    const [broadcastChannelId, alertSectionId, channelGroups] = await Promise.all([
        config.getBroadcastChannelId(),
        config.getAlertSectionId(),
        fetchCommunityChannelGroups(depsWithConfig),
    ]);
    const activeGroup = alertSectionId
        ? channelGroups.find((g) => g.id === alertSectionId)
        : undefined;
    return {
        success: true,
        broadcastChannelId: broadcastChannelId ?? "",
        broadcastChannelName: setup_provisioning_1.MARKET_CHANNEL_NAME,
        assistantChannelId: "",
        alertSectionId: alertSectionId ?? "",
        alertSectionName: activeGroup?.name ?? "",
        error: "",
    };
}
