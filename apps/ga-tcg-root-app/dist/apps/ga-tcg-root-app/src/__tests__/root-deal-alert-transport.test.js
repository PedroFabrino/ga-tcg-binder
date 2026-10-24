"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
vitest_1.vi.mock("@rootsdk/server-bot", () => ({
    ChannelType: { Text: 1, ThreadedText: 2 },
    WellKnownRootGuids: {
        CommunityRoles: { EveryoneRole: "role_everyone" },
    },
    rootServer: { community: {} },
}));
const root_deal_alert_transport_1 = require("../root-deal-alert-transport");
function createFakeApi() {
    const channels = [];
    const messages = [];
    const deleted = [];
    const notifications = [];
    let nextChannel = 0;
    let nextMessage = 0;
    const api = {
        everyoneRoleId: "role_everyone",
        botId: "app_bot",
        async createChannel(request) {
            nextChannel += 1;
            const id = `chan-${nextChannel}`;
            channels.push({ ...request, id });
            return { id };
        },
        async createChannelGroup() {
            return { id: "grp-created" };
        },
        async createMessage(request) {
            nextMessage += 1;
            const id = `msg-${nextMessage}`;
            messages.push({ ...request, id });
            return { id };
        },
        async deleteMessage(request) {
            deleted.push(request);
        },
        async deleteChannel() {
            // no-op for the transport suite
        },
        async sendNotification(request) {
            notifications.push(request);
        },
    };
    return { api, channels, messages, deleted, notifications };
}
(0, vitest_1.describe)("Root deal-alert transport", () => {
    (0, vitest_1.it)("creates a private per-user channel and posts the rolling message", async () => {
        const fake = createFakeApi();
        const transport = (0, root_deal_alert_transport_1.createRootDealAlertTransport)({
            channelGroupId: "section_1",
            api: fake.api,
        });
        const ref = await transport.send("root_user_1", "the list");
        (0, vitest_1.expect)(fake.channels).toHaveLength(1);
        const channel = fake.channels[0];
        (0, vitest_1.expect)(channel.channelGroupId).toBe("section_1");
        (0, vitest_1.expect)(channel.name).toBe("ga-alerts-root_user_1");
        (0, vitest_1.expect)(channel.useChannelGroupPermission).toBe(false);
        (0, vitest_1.expect)(channel.accessRuleCreates).toEqual([
            { roleOrMemberId: "role_everyone", overlay: { channelView: false } },
            {
                roleOrMemberId: "root_user_1",
                overlay: {
                    channelView: true,
                    channelCreateMessage: true,
                    channelViewMessageHistory: true,
                },
            },
            { roleOrMemberId: "app_bot", overlay: { channelFullControl: true } },
        ]);
        (0, vitest_1.expect)(fake.messages).toEqual([
            { channelId: "chan-1", content: "the list", id: "msg-1" },
        ]);
        (0, vitest_1.expect)(ref).toEqual({ channelId: "chan-1", messageId: "msg-1" });
    });
    (0, vitest_1.it)("always grants the bot's own app id full control", async () => {
        const fake = createFakeApi();
        const transport = (0, root_deal_alert_transport_1.createRootDealAlertTransport)({
            channelGroupId: "section_1",
            api: fake.api,
        });
        await transport.send("root_user_1", "the list");
        (0, vitest_1.expect)(fake.channels[0].accessRuleCreates).toContainEqual({
            roleOrMemberId: "app_bot",
            overlay: { channelFullControl: true },
        });
    });
    (0, vitest_1.it)("reuses an existing channel instead of creating a new one", async () => {
        const fake = createFakeApi();
        const transport = (0, root_deal_alert_transport_1.createRootDealAlertTransport)({
            channelGroupId: "section_1",
            api: fake.api,
        });
        const ref = await transport.send("root_user_1", "the list", "chan-existing");
        (0, vitest_1.expect)(fake.channels).toHaveLength(0);
        (0, vitest_1.expect)(fake.messages[0].channelId).toBe("chan-existing");
        (0, vitest_1.expect)(ref?.channelId).toBe("chan-existing");
    });
    (0, vitest_1.it)("deletes every message id in a comma-separated reference", async () => {
        const fake = createFakeApi();
        const transport = (0, root_deal_alert_transport_1.createRootDealAlertTransport)({
            channelGroupId: "section_1",
            api: fake.api,
        });
        await transport.delete({ channelId: "chan-1", messageId: "msg-1,msg-2" });
        (0, vitest_1.expect)(fake.deleted).toEqual([
            { channelId: "chan-1", id: "msg-1" },
            { channelId: "chan-1", id: "msg-2" },
        ]);
    });
    (0, vitest_1.it)("sends a summary notification to the recipient", async () => {
        const fake = createFakeApi();
        const transport = (0, root_deal_alert_transport_1.createRootDealAlertTransport)({
            channelGroupId: "section_1",
            api: fake.api,
        });
        await transport.notify?.("root_user_1", {
            title: "🔔 2 new cards for your wantlist",
            description: "Cards: Alpha and Beta for sale!",
        });
        (0, vitest_1.expect)(fake.notifications).toEqual([
            {
                userIds: ["root_user_1"],
                title: "🔔 2 new cards for your wantlist",
                description: "Cards: Alpha and Beta for sale!",
            },
        ]);
    });
});
