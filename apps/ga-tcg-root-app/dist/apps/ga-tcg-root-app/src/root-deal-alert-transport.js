"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRootServerDealAlertApi = createRootServerDealAlertApi;
exports.createRootDealAlertTransport = createRootDealAlertTransport;
const server_bot_1 = require("@rootsdk/server-bot");
const deal_alert_sink_1 = require("./deal-alert-sink");
/** Default adapter over `rootServer.community`. */
function createRootServerDealAlertApi(root = server_bot_1.rootServer) {
    return {
        everyoneRoleId: String(server_bot_1.WellKnownRootGuids.CommunityRoles.EveryoneRole),
        botId: String(root.appId),
        async createChannel(request) {
            const channel = await root.community.channels.create({
                channelGroupId: request.channelGroupId,
                name: request.name,
                channelType: request.channelType,
                useChannelGroupPermission: request.useChannelGroupPermission,
                accessRuleCreates: request.accessRuleCreates.map((rule) => ({
                    roleOrMemberId: rule.roleOrMemberId,
                    overlay: rule.overlay,
                })),
            });
            return { id: String(channel.id) };
        },
        async createChannelGroup(name) {
            const group = await root.community.channelGroups.create({ name });
            return { id: String(group.id) };
        },
        async createMessage(request) {
            const message = await root.community.channelMessages.create({
                channelId: request.channelId,
                content: request.content,
            });
            return { id: String(message.id) };
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
function channelNameForRecipient(recipient) {
    return `ga-alerts-${recipient}`.slice(0, 100);
}
/**
 * Root delivery for Deal Alerts: one private channel per recipient under the
 * bot-only section, a rolling message inside it, and a short in-app
 * notification ping. Access rules deny `channelView` to everyone and grant it
 * to the recipient so other members cannot see the channel.
 */
function createRootDealAlertTransport({ channelGroupId, api, channelType = server_bot_1.ChannelType.Text, }) {
    return {
        async send(recipient, content, previousChannelId) {
            const accessRuleCreates = [
                {
                    roleOrMemberId: api.everyoneRoleId,
                    overlay: { channelView: false },
                },
                {
                    roleOrMemberId: recipient,
                    overlay: {
                        channelView: true,
                        channelCreateMessage: true,
                        channelViewMessageHistory: true,
                    },
                },
                {
                    // Each channel denies the Everyone role view, so the bot must grant
                    // itself access explicitly (as a member: an App is a valid
                    // RoleOrMemberGuid).
                    roleOrMemberId: api.botId,
                    overlay: { channelFullControl: true },
                },
            ];
            const channelId = previousChannelId ??
                (await api.createChannel({
                    channelGroupId,
                    name: channelNameForRecipient(recipient),
                    channelType,
                    useChannelGroupPermission: false,
                    accessRuleCreates,
                })).id;
            const message = await api.createMessage({ channelId, content });
            return { channelId, messageId: message.id };
        },
        async delete(ref) {
            for (const id of (0, deal_alert_sink_1.parseMessageIds)(ref.messageId)) {
                await api.deleteMessage({ channelId: ref.channelId, id });
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
