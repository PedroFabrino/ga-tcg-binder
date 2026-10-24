"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const deal_alert_notifier_1 = require("../deal-alert-notifier");
function fakeTransport() {
    const sent = [];
    const deleted = [];
    const notified = [];
    let next = 0;
    return {
        transport: {
            async send(recipient, content, channelId) {
                next += 1;
                const ref = { channelId: channelId ?? `chan-${recipient}`, messageId: `msg-${next}` };
                sent.push({ recipient, content });
                return ref;
            },
            async delete(ref) {
                deleted.push(ref);
            },
            async notify(recipient, summary) {
                notified.push({ recipient, summary });
            },
        },
        sent,
        deleted,
        notified,
    };
}
(0, vitest_1.describe)("runDealAlertPoll", () => {
    (0, vitest_1.it)("delivers changed plans, cleans up stale ones, and reports", async () => {
        const api = {
            getDealAlerts: vitest_1.vi.fn().mockResolvedValue({
                plans: [
                    {
                        recipientId: "u1",
                        channelId: null,
                        previousMessageIds: [],
                        chunks: ["c1"],
                        summary: { title: "t", description: "d" },
                        lastListingKeys: ["k1"],
                    },
                ],
                cleanup: [
                    { recipientId: "u2", channelId: "chan-u2", messageIds: ["old-1"] },
                ],
            }),
            recordDealAlertDelivery: vitest_1.vi.fn().mockResolvedValue(undefined),
            recordDealAlertCleanup: vitest_1.vi.fn().mockResolvedValue(undefined),
        };
        const fake = fakeTransport();
        await (0, deal_alert_notifier_1.runDealAlertPoll)({
            api,
            ensureSection: async () => "sec-1",
            createTransport: () => fake.transport,
        });
        (0, vitest_1.expect)(fake.sent[0]).toEqual({ recipient: "u1", content: "c1" });
        (0, vitest_1.expect)(fake.notified[0]).toMatchObject({ recipient: "u1" });
        (0, vitest_1.expect)(api.recordDealAlertDelivery).toHaveBeenCalledWith({
            recipientId: "u1",
            channelId: "chan-u1",
            messageIds: ["msg-1"],
            lastListingKeys: ["k1"],
        });
        (0, vitest_1.expect)(fake.deleted).toContainEqual({
            channelId: "chan-u2",
            messageId: "old-1",
        });
        (0, vitest_1.expect)(api.recordDealAlertCleanup).toHaveBeenCalledWith("u2");
    });
    (0, vitest_1.it)("does not report a plan when a chunk fails", async () => {
        const api = {
            getDealAlerts: vitest_1.vi.fn().mockResolvedValue({
                plans: [
                    {
                        recipientId: "u1",
                        channelId: null,
                        previousMessageIds: [],
                        chunks: ["c1", "c2"],
                        summary: { title: "t", description: "d" },
                        lastListingKeys: ["k"],
                    },
                ],
                cleanup: [],
            }),
            recordDealAlertDelivery: vitest_1.vi.fn(),
            recordDealAlertCleanup: vitest_1.vi.fn(),
        };
        const transport = {
            send: vitest_1.vi
                .fn()
                .mockResolvedValueOnce({ channelId: "chan-u1", messageId: "m1" })
                .mockResolvedValueOnce(null),
            delete: vitest_1.vi.fn(),
            notify: vitest_1.vi.fn(),
        };
        await (0, deal_alert_notifier_1.runDealAlertPoll)({
            api,
            ensureSection: async () => "sec",
            createTransport: () => transport,
        });
        (0, vitest_1.expect)(api.recordDealAlertDelivery).not.toHaveBeenCalled();
        (0, vitest_1.expect)(transport.delete).toHaveBeenCalledWith({
            channelId: "chan-u1",
            messageId: "m1",
        });
    });
});
