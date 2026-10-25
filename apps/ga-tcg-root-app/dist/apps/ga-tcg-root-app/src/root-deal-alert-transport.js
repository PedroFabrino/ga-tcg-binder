"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRootServerDealAlertApi = createRootServerDealAlertApi;
exports.createRootDealAlertTransport = createRootDealAlertTransport;
const server_bot_1 = require("@rootsdk/server-bot");
const deal_alert_sink_1 = require("./deal-alert-sink");
/** Default adapter over `rootServer.community`. */
function createRootServerDealAlertApi(root = server_bot_1.rootServer) {
    const botId = String(root.appId);
    return {
        everyoneRoleId: String(server_bot_1.WellKnownRootGuids.CommunityRoles.EveryoneRole),
        botId,
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
            // Grant the bot full control over the group it creates, otherwise it
            // cannot create the per-user channels inside it (NoPermissionToCreate).
            const group = await root.community.channelGroups.create({
                name,
                accessRuleCreates: [
                    {
                        roleOrMemberId: botId,
                        overlay: { channelFullControl: true },
                    },
                ],
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
function createRootDealAlertTransport({ channelGroupId, api, channelType = server_bot_1.ChannelType.Text, }) {
    return {
        async send(recipient, content, previousChannelId) {
            const accessRuleCreates = [
                {
                    // `useChannelGroupPermission: false` means unlisted members have no
                    // access by default, so we only grant the recipient and the bot.
                    roleOrMemberId: recipient,
                    overlay: { channelView: true, channelCreateMessage: true },
                },
                {
                    roleOrMemberId: api.botId,
                    overlay: { channelFullControl: true },
                },
            ];
            let channelName = fallbackChannelName(recipient);
            try {
                const displayName = await api.getMemberName(recipient);
                if (displayName && displayName.trim()) {
                    channelName = `${displayName.trim()} Wantlist`.slice(0, 100);
                }
            }
            catch {
                // Keep the id-based fallback when the member can't be resolved.
            }
            const channelId = previousChannelId ??
                (await api.createChannel({
                    channelGroupId,
                    name: channelName,
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
