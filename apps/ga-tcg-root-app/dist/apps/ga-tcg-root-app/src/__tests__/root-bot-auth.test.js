"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
vitest_1.vi.mock("@rootsdk/server-bot", () => ({
    rootServer: { appId: "app-1", dataStore: { appData: {} } },
}));
const root_bot_auth_1 = require("../root-bot-auth");
function fakeStore(initial = {}) {
    const data = new Map(Object.entries(initial));
    return {
        async get(key) {
            return data.get(key);
        },
        async set({ key, value }) {
            data.set(key, value);
        },
    };
}
(0, vitest_1.describe)("getRootBotToken", () => {
    (0, vitest_1.it)("registers once and then reuses the cached token", async () => {
        const store = fakeStore();
        const fetchImpl = vitest_1.vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: "tok-1" }), { status: 200 }));
        const options = {
            communityId: "comm-1",
            appId: "app-1",
            apiBaseUrl: "https://api.example",
            store,
            fetchImpl: fetchImpl,
        };
        await (0, vitest_1.expect)((0, root_bot_auth_1.getRootBotToken)(options)).resolves.toBe("tok-1");
        await (0, vitest_1.expect)((0, root_bot_auth_1.getRootBotToken)(options)).resolves.toBe("tok-1");
        (0, vitest_1.expect)(fetchImpl).toHaveBeenCalledTimes(1);
    });
    (0, vitest_1.it)("throws when the install endpoint rejects", async () => {
        const store = fakeStore();
        const fetchImpl = vitest_1.vi
            .fn()
            .mockResolvedValue(new Response("{}", { status: 403 }));
        await (0, vitest_1.expect)((0, root_bot_auth_1.getRootBotToken)({
            communityId: "comm-1",
            appId: "app-1",
            apiBaseUrl: "https://api.example",
            store,
            fetchImpl: fetchImpl,
        })).rejects.toThrow();
    });
});
