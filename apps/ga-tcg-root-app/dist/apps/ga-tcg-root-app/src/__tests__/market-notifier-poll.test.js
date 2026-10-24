"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const market_notifier_1 = require("../market-notifier");
(0, vitest_1.describe)("runMarketNotificationPoll", () => {
    (0, vitest_1.it)("posts each chunk and marks it delivered", async () => {
        const api = {
            getMarketNotifications: vitest_1.vi.fn().mockResolvedValue({
                chunks: [
                    { storeId: "s", storeName: "MyP", content: "c1", notificationIds: ["n1"] },
                    { storeId: "s", storeName: "MyP", content: "c2", notificationIds: ["n2"] },
                ],
            }),
            markMarketNotificationsDelivered: vitest_1.vi.fn().mockResolvedValue(undefined),
        };
        const config = { getBroadcastChannelId: vitest_1.vi.fn().mockResolvedValue("chan-1") };
        const postMessage = vitest_1.vi
            .fn()
            .mockResolvedValueOnce("m1")
            .mockResolvedValueOnce("m2");
        await (0, market_notifier_1.runMarketNotificationPoll)({ api, config, postMessage });
        (0, vitest_1.expect)(postMessage).toHaveBeenNthCalledWith(1, "chan-1", "c1");
        (0, vitest_1.expect)(api.markMarketNotificationsDelivered).toHaveBeenNthCalledWith(1, {
            notificationIds: ["n1"],
            messageIds: ["m1"],
        });
        (0, vitest_1.expect)(api.markMarketNotificationsDelivered).toHaveBeenNthCalledWith(2, {
            notificationIds: ["n2"],
            messageIds: ["m2"],
        });
    });
    (0, vitest_1.it)("does nothing when no broadcast channel is configured", async () => {
        const api = {
            getMarketNotifications: vitest_1.vi.fn(),
            markMarketNotificationsDelivered: vitest_1.vi.fn(),
        };
        const config = { getBroadcastChannelId: vitest_1.vi.fn().mockResolvedValue(undefined) };
        const warn = vitest_1.vi.fn();
        await (0, market_notifier_1.runMarketNotificationPoll)({
            api,
            config,
            postMessage: vitest_1.vi.fn(),
            warn,
        });
        (0, vitest_1.expect)(api.getMarketNotifications).not.toHaveBeenCalled();
        (0, vitest_1.expect)(warn).toHaveBeenCalled();
    });
    (0, vitest_1.it)("leaves the chunk undelivered when the post throws", async () => {
        const api = {
            getMarketNotifications: vitest_1.vi.fn().mockResolvedValue({
                chunks: [
                    { storeId: "s", storeName: "MyP", content: "c1", notificationIds: ["n1"] },
                    { storeId: "s", storeName: "MyP", content: "c2", notificationIds: ["n2"] },
                ],
            }),
            markMarketNotificationsDelivered: vitest_1.vi.fn(),
        };
        const config = { getBroadcastChannelId: vitest_1.vi.fn().mockResolvedValue("chan-1") };
        const postMessage = vitest_1.vi.fn().mockRejectedValueOnce(new Error("boom"));
        await (0, vitest_1.expect)((0, market_notifier_1.runMarketNotificationPoll)({ api, config, postMessage })).rejects.toThrow("boom");
        (0, vitest_1.expect)(postMessage).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(api.markMarketNotificationsDelivered).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)("records delivery when a posted chunk has no message id", async () => {
        const api = {
            getMarketNotifications: vitest_1.vi.fn().mockResolvedValue({
                chunks: [
                    { storeId: "s", storeName: "MyP", content: "c1", notificationIds: ["n1"] },
                ],
            }),
            markMarketNotificationsDelivered: vitest_1.vi.fn().mockResolvedValue(undefined),
        };
        const config = { getBroadcastChannelId: vitest_1.vi.fn().mockResolvedValue("chan-1") };
        const warn = vitest_1.vi.fn();
        await (0, market_notifier_1.runMarketNotificationPoll)({
            api,
            config,
            postMessage: vitest_1.vi.fn().mockResolvedValue(null),
            warn,
        });
        (0, vitest_1.expect)(api.markMarketNotificationsDelivered).toHaveBeenCalledWith({
            notificationIds: ["n1"],
            messageIds: [],
        });
        (0, vitest_1.expect)(warn).toHaveBeenCalled();
    });
});
