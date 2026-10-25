"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRootBotToken = getRootBotToken;
const server_bot_1 = require("@rootsdk/server-bot");
const root_bot_config_1 = require("./root-bot-config");
const TOKEN_KEY_PREFIX = "rootBot.installToken";
/**
 * Returns this install's API token, registering once if needed. The token is
 * persisted in Root's per-install key-value store, so it survives restarts and
 * never lives in `.env` or the compiled code.
 */
async function getRootBotToken(options) {
    const store = options.store ?? server_bot_1.rootServer.dataStore.appData;
    const appId = options.appId ?? String(server_bot_1.rootServer.appId);
    const apiBaseUrl = (options.apiBaseUrl ?? root_bot_config_1.ROOT_BOT_API_BASE_URL).replace(/\/+$/, "");
    const fetchImpl = options.fetchImpl ?? fetch;
    const key = `${TOKEN_KEY_PREFIX}:${options.communityId}`;
    const cached = await store.get(key);
    if (cached) {
        return cached;
    }
    const response = await fetchImpl(`${apiBaseUrl}/api/root-bot/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId, communityId: options.communityId }),
    });
    if (!response.ok) {
        throw new Error(`Root bot install failed (${response.status})`);
    }
    const data = (await response.json());
    if (!data.token) {
        throw new Error("Root bot install response did not include a token");
    }
    await store.set({ key, value: data.token });
    return data.token;
}
