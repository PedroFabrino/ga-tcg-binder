"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
async function fetchCommunityTextChannels(deps = {}) {
    const listGroups = deps.listChannelGroups ?? (() => server_app_1.rootServer.community.channelGroups.list());
    const listChannels = deps.listChannels ??
        ((p) => server_app_1.rootServer.community.channels.list(p));
    const groups = await listGroups();
    const textChannels = [];
    for (const group of groups) {
        const groupChannels = await listChannels({
            channelGroupId: group.id,
        });
        for (const ch of groupChannels) {
            if (ch.channelType === server_app_1.ChannelType.Text) {
                textChannels.push({
                    id: String(ch.id),
                    name: ch.name,
                    groupName: group.name,
                });
            }
        }
    }
    return textChannels;
}
async function getAdminSettingsHelper(userId, config, deps = {}) {
    if (!(await resolveIsAdmin(userId, deps))) {
        return {
            isAdmin: false,
            broadcastChannelId: "",
            broadcastChannelName: "",
            textChannels: [],
        };
    }
    const [broadcastChannelId, textChannels] = await Promise.all([
        config.getBroadcastChannelId(),
        fetchCommunityTextChannels(deps),
    ]);
    const activeChannel = broadcastChannelId
        ? textChannels.find((ch) => ch.id === broadcastChannelId)
        : undefined;
    return {
        isAdmin: true,
        broadcastChannelId: broadcastChannelId ?? "",
        broadcastChannelName: activeChannel?.name ?? "",
        textChannels,
    };
}
async function setBroadcastChannelHelper(userId, request, config, deps = {}) {
    if (!(await resolveIsAdmin(userId, deps))) {
        return {
            success: false,
            broadcastChannelId: "",
            broadcastChannelName: "",
            error: "FORBIDDEN",
        };
    }
    const targetChannelId = (request.channelId || "").trim();
    if (!targetChannelId) {
        return {
            success: false,
            broadcastChannelId: "",
            broadcastChannelName: "",
            error: "INVALID_CHANNEL",
        };
    }
    const textChannels = await fetchCommunityTextChannels(deps);
    const matched = textChannels.find((ch) => ch.id === targetChannelId);
    if (!matched) {
        return {
            success: false,
            broadcastChannelId: "",
            broadcastChannelName: "",
            error: "CHANNEL_NOT_FOUND",
        };
    }
    await config.setBroadcastChannelId(targetChannelId);
    return {
        success: true,
        broadcastChannelId: targetChannelId,
        broadcastChannelName: matched.name,
        error: "",
    };
}
async function provisionMarketChannelsHelper(userId, config, deps = {}) {
    if (!(await resolveIsAdmin(userId, deps))) {
        return {
            success: false,
            broadcastChannelId: "",
            broadcastChannelName: "",
            assistantChannelId: "",
            error: "FORBIDDEN",
        };
    }
    if (deps.provisionChannels) {
        await deps.provisionChannels();
    }
    else {
        await (0, setup_provisioning_1.provisionCommunityChannels)({ rootServer: server_app_1.rootServer, config });
    }
    const [broadcastChannelId, assistantChannelId] = await Promise.all([
        config.getBroadcastChannelId(),
        config.getAssistantChannelId(),
    ]);
    return {
        success: true,
        broadcastChannelId: broadcastChannelId ?? "",
        broadcastChannelName: setup_provisioning_1.MARKET_CHANNEL_NAME,
        assistantChannelId: assistantChannelId ?? "",
        error: "",
    };
}
