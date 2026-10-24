"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const community_config_1 = require("../community-config");
function fakeStore(initial = {}) {
    const data = new Map(Object.entries(initial));
    const store = {
        async get(key) {
            return data.get(key);
        },
        async set({ key, value }) {
            data.set(key, value);
        },
    };
    return { store, data };
}
(0, vitest_1.describe)("Root community config", () => {
    (0, vitest_1.it)("round-trips the broadcast channel and alert section ids", async () => {
        const { store } = fakeStore();
        const config = (0, community_config_1.createCommunityConfig)(store);
        (0, vitest_1.expect)(await config.getBroadcastChannelId()).toBeUndefined();
        (0, vitest_1.expect)(await config.getAlertSectionId()).toBeUndefined();
        await config.setBroadcastChannelId("chan-1");
        await config.setAlertSectionId("grp-1");
        (0, vitest_1.expect)(await config.getBroadcastChannelId()).toBe("chan-1");
        (0, vitest_1.expect)(await config.getAlertSectionId()).toBe("grp-1");
    });
    (0, vitest_1.it)("returns undefined for missing values without throwing", async () => {
        const { store } = fakeStore();
        const config = (0, community_config_1.createCommunityConfig)(store);
        await (0, vitest_1.expect)(config.getBroadcastChannelId()).resolves.toBeUndefined();
        await (0, vitest_1.expect)(config.getAlertSectionId()).resolves.toBeUndefined();
    });
});
