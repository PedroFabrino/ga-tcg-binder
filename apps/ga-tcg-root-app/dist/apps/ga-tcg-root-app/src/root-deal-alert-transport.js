"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRootServerDealAlertApi = createRootServerDealAlertApi;
exports.createRootDealAlertTransport = createRootDealAlertTransport;
const server_app_1 = require("@rootsdk/server-app");
const deal_alert_sink_1 = require("./deal-alert-sink");
const describe_error_1 = require("./describe-error");
/** Default adapter over `rootServer.community`. */
function createRootServerDealAlertApi(root = server_app_1.rootServer) {
    const botId = String(root.appId);
    return {
        everyoneRoleId: String(server_app_1.WellKnownRootGuids.CommunityRoles.EveryoneRole),
        botId,
        async createChannel(request) {
            const channel = await root.community.channels.create({
                channelGroupId: request.channelGroupId,
                name: request.name,
                channelType: request.channelType,
                useChannelGroupPermission: request.useChannelGroupPermission,
                ...(request.accessRuleCreates.length > 0
                    ? {
                        accessRuleCreates: request.accessRuleCreates.map((rule) => ({
                            roleOrMemberId: rule.roleOrMemberId,
                            overlay: rule.overlay,
                        })),
                    }
                    : {}),
            });
            return { id: String(channel.id) };
        },
        async createChannelGroup(name) {
            const group = await root.community.channelGroups.create({
                name,
            });
            return { id: String(group.id) };
        },
        async grantBotFullControl(channelGroupId) {
            await root.community.accessRules.create({
                channelOrChannelGroupId: channelGroupId,
                roleOrMemberId: botId,
                overlay: { channelFullControl: true },
            });
        },
        async getMemberName(userId) {
            const member = await root.community.communityMembers.get({
                userId: userId,
            });
            return member.nickname;
        },
        async createMessage(request) {
            const message = await root.community.channelMessages.create({
                channelId: request.channelId,
                content: request.content,
            });
            return { id: String(message.id) };
        },
        async getChannel(id) {
            const channel = await root.community.channels.get({
                id: id,
            });
            return { id: String(channel.id) };
        },
        async listChannels(channelGroupId) {
            const channels = await root.community.channels.list({
                channelGroupId: channelGroupId,
            });
            return channels.map((channel) => ({
                id: String(channel.id),
                name: channel.name,
            }));
        },
        async deleteMessage(request) {
            await root.community.channelMessages.delete({
                channelId: request.channelId,
                id: request.id,
            });
        },
        async deleteChannel(id) {
            await root.community.channels.delete({ id: id });
        },
        async sendNotification(request) {
            await root.community.notifications.send({
                userIds: request.userIds,
                title: request.title,
                description: request.description,
            });
        },
    };
}
function fallbackChannelName(recipient) {
    return `ga-alerts-${recipient}`.slice(0, 100);
}
/**
 * Root delivery for Deal Alerts: one private channel per recipient under the
 * bot-only section, a rolling message inside it, and a short in-app
 * notification ping. Access rules deny `channelView` to everyone and grant it
 * to the recipient so other members cannot see the channel.
 */
function createRootDealAlertTransport({ channelGroupId, api, channelType = server_app_1.ChannelType.Text, }) {
    const verifiedChannels = new Set();
    return {
        async send(recipient, content, previousChannelId) {
            if (previousChannelId && verifiedChannels.has(previousChannelId)) {
                const message = await api.createMessage({
                    channelId: previousChannelId,
                    content,
                });
                return { channelId: previousChannelId, messageId: message.id };
            }
            const fallbackName = fallbackChannelName(recipient);
            let channelName = fallbackName;
            try {
                const displayName = await api.getMemberName(recipient);
                if (displayName && displayName.trim()) {
                    // Root channel names reject spaces, so use a dash separator.
                    channelName = `${displayName.trim()}-Wantlist`.slice(0, 100);
                }
            }
            catch (err) {
                console.warn(`[deal-alert-transport] Could not resolve member name for ${recipient}; using fallback:`, (0, describe_error_1.describeError)(err));
            }
            let channelId;
            if (previousChannelId) {
                try {
                    await api.getChannel(previousChannelId);
                    channelId = previousChannelId;
                }
                catch (err) {
                    console.warn(`[deal-alert-transport] Stored channel ${previousChannelId} is no longer accessible; recreating:`, (0, describe_error_1.describeError)(err));
                }
            }
            if (api.listChannels) {
                try {
                    const existingChannels = await api.listChannels(channelGroupId);
                    const matching = existingChannels.filter((ch) => ch.name === channelName || ch.name === fallbackName);
                    for (const ch of matching) {
                        if (ch.id !== channelId) {
                            try {
                                await api.deleteChannel(ch.id);
                            }
                            catch (err) {
                                console.warn(`[deal-alert-transport] Could not delete duplicate channel ${ch.id}:`, (0, describe_error_1.describeError)(err));
                            }
                        }
                    }
                }
                catch (err) {
                    console.warn(`[deal-alert-transport] Could not list channels in group ${channelGroupId}:`, (0, describe_error_1.describeError)(err));
                }
            }
            if (!channelId) {
                try {
                    channelId = (await api.createChannel({
                        channelGroupId,
                        name: channelName,
                        channelType,
                        useChannelGroupPermission: true,
                        accessRuleCreates: [],
                    })).id;
                }
                catch (err) {
                    throw new Error(`Channel create failed (name="${channelName}", group="${channelGroupId}"): ${(0, describe_error_1.describeError)(err)}`);
                }
            }
            verifiedChannels.add(channelId);
            const message = await api.createMessage({ channelId, content });
            return { channelId, messageId: message.id };
        },
        async delete(ref) {
            for (const id of (0, deal_alert_sink_1.parseMessageIds)(ref.messageId)) {
                try {
                    await api.deleteMessage({ channelId: ref.channelId, id });
                }
                catch (err) {
                    console.warn(`[deal-alert-transport] Could not delete message ${id} in channel ${ref.channelId}:`, (0, describe_error_1.describeError)(err));
                }
            }
        },
        async notify(recipient, summary) {
            await api.sendNotification({
                userIds: [recipient],
                title: summary.title,
                description: summary.description,
            });
        },
    };
}
