"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const deal_alert_notifier_1 = require("../deal-alert-notifier");
function createRootApi() {
    const channels = [];
    const messages = [];
    let nextChannel = 0;
    const api = {
        everyoneRoleId: "role_everyone",
        botId: "app_bot",
        async createChannel() {
            nextChannel += 1;
            const id = `chan-${nextChannel}`;
            channels.push(id);
            return { id };
        },
        async createChannelGroup() {
            return { id: "grp-1" };
        },
        async createMessage(request) {
            messages.push(request.content);
            return { id: `msg-${messages.length}` };
        },
        async deleteMessage() { },
        async deleteChannel() { },
        async sendNotification() { },
    };
    return { api, channels, messages };
}
function createBotApi(existing = null) {
    const deliveries = [];
    const api = {
        getDealAlertChannel: vitest_1.vi.fn().mockResolvedValue(existing),
        recordDealAlertDelivery: vitest_1.vi.fn(async (record) => {
            deliveries.push(record);
        }),
        recordDealAlertCleanup: vitest_1.vi.fn(),
    };
    return { api, deliveries };
}
function createConfig() {
    let section = "grp-1";
    return {
        async getBroadcastChannelId() {
            return undefined;
        },
        async setBroadcastChannelId() { },
        async getAlertSectionId() {
            return section;
        },
        async setAlertSectionId(id) {
            section = id;
        },
    };
}
(0, vitest_1.describe)("ensureRootRecipientChannel", () => {
    (0, vitest_1.it)("creates the channel with a welcome message and records delivery", async () => {
        const root = createRootApi();
        const bot = createBotApi(null);
        const channelId = await (0, deal_alert_notifier_1.ensureRootRecipientChannel)("root_user_1", {
            communityId: "comm-1",
            api: bot.api,
            config: createConfig(),
            rootApi: root.api,
        });
        (0, vitest_1.expect)(channelId).toBe("chan-1");
        (0, vitest_1.expect)(root.channels).toEqual(["chan-1"]);
        (0, vitest_1.expect)(root.messages[0]).toContain("Deal alerts are on");
        (0, vitest_1.expect)(bot.api.recordDealAlertDelivery).toHaveBeenCalledWith({
            recipientId: "root_user_1",
            channelId: "chan-1",
            messageIds: ["msg-1"],
            lastListingKeys: [],
        });
    });
    (0, vitest_1.it)("reuses an existing channel without creating another", async () => {
        const root = createRootApi();
        const bot = createBotApi({
            channelId: "chan-existing",
            messageIds: ["msg-old"],
        });
        const channelId = await (0, deal_alert_notifier_1.ensureRootRecipientChannel)("root_user_1", {
            communityId: "comm-1",
            api: bot.api,
            config: createConfig(),
            rootApi: root.api,
        });
        (0, vitest_1.expect)(channelId).toBe("chan-existing");
        (0, vitest_1.expect)(root.channels).toHaveLength(0);
    });
});
