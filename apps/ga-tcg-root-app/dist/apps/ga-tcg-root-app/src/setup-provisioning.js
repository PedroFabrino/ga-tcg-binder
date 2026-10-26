"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GROUP_NAME = exports.ASSISTANT_CHANNEL_NAME = exports.MARKET_CHANNEL_NAME = void 0;
exports.provisionCommunityChannels = provisionCommunityChannels;
const server_bot_1 = require("@rootsdk/server-bot");
exports.MARKET_CHANNEL_NAME = "market";
exports.ASSISTANT_CHANNEL_NAME = "assistant";
exports.GROUP_NAME = "GA Market";
async function provisionCommunityChannels(ctx) {
    const { rootServer, config } = ctx;
    let [sectionId, broadcastId, assistantId] = await Promise.all([
        config.getAlertSectionId(),
        config.getBroadcastChannelId(),
        config.getAssistantChannelId(),
    ]);
    if (!sectionId) {
        const group = await rootServer.community.channelGroups.create({
            name: exports.GROUP_NAME,
            accessRuleCreates: [
                {
                    roleOrMemberId: String(rootServer.appId),
                    overlay: { channelFullControl: true },
                },
            ],
        });
        sectionId = String(group.id);
        await config.setAlertSectionId(sectionId);
    }
    if (!broadcastId) {
        const created = await rootServer.community.channels.create({
            channelGroupId: sectionId,
            name: exports.MARKET_CHANNEL_NAME,
            channelType: server_bot_1.ChannelType.Text,
            useChannelGroupPermission: true,
        });
        broadcastId = String(created.id);
        await config.setBroadcastChannelId(broadcastId);
    }
    if (!assistantId) {
        const createdApp = await rootServer.community.channels.create({
            channelGroupId: sectionId,
            name: exports.ASSISTANT_CHANNEL_NAME,
            channelType: server_bot_1.ChannelType.App,
            useChannelGroupPermission: true,
        });
        assistantId = String(createdApp.id);
        await config.setAssistantChannelId(assistantId);
    }
    return {
        marketChannel: exports.MARKET_CHANNEL_NAME,
        assistantChannel: exports.ASSISTANT_CHANNEL_NAME,
    };
}
