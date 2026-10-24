"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const root_bot_api_1 = require("../root-bot-api");
function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), { status });
}
(0, vitest_1.describe)("RootBotApi", () => {
    (0, vitest_1.it)("sends the install token and community id on every call", async () => {
        const fetchImpl = vitest_1.vi.fn().mockResolvedValue(jsonResponse({ chunks: [] }));
        const api = new root_bot_api_1.RootBotApi({
            communityId: "comm-1",
            baseUrl: "https://api.example",
            token: "tok-1",
            fetchImpl: fetchImpl,
        });
        await api.getMarketNotifications();
        (0, vitest_1.expect)(fetchImpl).toHaveBeenCalledTimes(1);
        const [url, init] = fetchImpl.mock.calls[0];
        (0, vitest_1.expect)(url).toBe("https://api.example/api/root-bot/market-notifications");
        const headers = init.headers;
        (0, vitest_1.expect)(headers.get("Authorization")).toBe("Bearer tok-1");
        (0, vitest_1.expect)(headers.get("x-root-community-id")).toBe("comm-1");
    });
    (0, vitest_1.it)("throws a typed error on a non-ok response", async () => {
        const fetchImpl = vitest_1.vi
            .fn()
            .mockResolvedValue(jsonResponse({ error: "UNAUTHORIZED", message: "nope" }, 401));
        const api = new root_bot_api_1.RootBotApi({
            communityId: "comm-1",
            baseUrl: "https://api.example",
            token: "tok-1",
            fetchImpl: fetchImpl,
        });
        await (0, vitest_1.expect)(api.getDealAlerts()).rejects.toBeInstanceOf(root_bot_api_1.RootBotApiError);
    });
});
