"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RootBotApi = exports.RootBotApiError = void 0;
const root_bot_auth_1 = require("./root-bot-auth");
const root_bot_config_1 = require("./root-bot-config");
class RootBotApiError extends Error {
    status;
    code;
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
        this.name = "RootBotApiError";
    }
}
exports.RootBotApiError = RootBotApiError;
/**
 * Typed client for the Root bot API. Every call carries the per-install bearer
 * token and the community id; the app scopes all data by that community.
 */
class RootBotApi {
    options;
    baseUrl;
    communityId;
    fetchImpl;
    tokenPromise = null;
    constructor(options) {
        this.options = options;
        this.baseUrl = (options.baseUrl ?? root_bot_config_1.ROOT_BOT_API_BASE_URL).replace(/\/+$/, "");
        this.communityId = options.communityId;
        this.fetchImpl = options.fetchImpl ?? fetch;
    }
    async token() {
        if (this.options.token) {
            return this.options.token;
        }
        if (!this.tokenPromise) {
            this.tokenPromise = (0, root_bot_auth_1.getRootBotToken)({
                communityId: this.communityId,
                apiBaseUrl: this.baseUrl,
                fetchImpl: this.fetchImpl,
            }).catch((err) => {
                // Allow a later call to retry the install instead of caching a failure.
                this.tokenPromise = null;
                throw err;
            });
        }
        return this.tokenPromise;
    }
    async request(path, init = {}) {
        const token = await this.token();
        const headers = new Headers(init.headers);
        headers.set("Authorization", `Bearer ${token}`);
        headers.set("x-root-community-id", this.communityId);
        if (init.body !== undefined) {
            headers.set("Content-Type", "application/json");
        }
        const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
            ...init,
            headers,
        });
        const data = (await response.json().catch(() => ({})));
        if (!response.ok) {
            throw new RootBotApiError(response.status, typeof data.error === "string" ? data.error : `HTTP_${response.status}`, typeof data.message === "string"
                ? data.message
                : `Root bot API request failed (${response.status})`);
        }
        return data;
    }
    async getMarketNotifications() {
        return this.request("/api/root-bot/market-notifications");
    }
    async markMarketNotificationsDelivered(request) {
        await this.request("/api/root-bot/market-notifications/delivered", {
            method: "POST",
            body: JSON.stringify(request),
        });
    }
    async getDealAlerts() {
        return this.request("/api/root-bot/deal-alerts");
    }
    async recordDealAlertDelivery(request) {
        await this.request("/api/root-bot/deal-alerts/delivered", {
            method: "POST",
            body: JSON.stringify(request),
        });
    }
    async recordDealAlertCleanup(recipientId) {
        await this.request("/api/root-bot/deal-alerts/cleanup", {
            method: "POST",
            body: JSON.stringify({ recipientId }),
        });
    }
    async getDealAlertChannel(recipientId) {
        const params = new URLSearchParams({ recipientId });
        return this.request(`/api/root-bot/deal-alerts/channel?${params.toString()}`);
    }
    async getCollector(providerUserId) {
        const params = new URLSearchParams({ provider: "root", providerUserId });
        return this.request(`/api/root-bot/collector?${params.toString()}`);
    }
    async setNotifyPreference(request) {
        await this.request("/api/root-bot/notify", {
            method: "POST",
            body: JSON.stringify(request),
        });
    }
    async register(providerUserId, providerUsername) {
        return this.request("/api/assistant/register", {
            method: "POST",
            body: JSON.stringify({
                provider: "root",
                providerUserId,
                providerUsername,
            }),
        });
    }
    async link(request) {
        return this.request("/api/assistant/link", {
            method: "POST",
            body: JSON.stringify(request),
        });
    }
    async getDecks(providerUserId) {
        const params = new URLSearchParams({ provider: "root", providerUserId });
        return this.request(`/api/assistant/decks?${params.toString()}`);
    }
    async importDeck(providerUserId, req) {
        return this.request("/api/assistant/decks", {
            method: "POST",
            body: JSON.stringify({
                provider: "root",
                providerUserId,
                ...req,
            }),
        });
    }
    async getShortages(providerUserId, deck) {
        const params = new URLSearchParams({ provider: "root", providerUserId, deck });
        return this.request(`/api/assistant/shortages?${params.toString()}`);
    }
    async searchCollection(providerUserId, query) {
        const params = new URLSearchParams({ provider: "root", providerUserId, query });
        return this.request(`/api/assistant/collection?${params.toString()}`);
    }
    async getPortfolio(providerUserId) {
        const params = new URLSearchParams({ provider: "root", providerUserId });
        return this.request(`/api/assistant/collection?${params.toString()}`);
    }
    async getWantlist(providerUserId, deck) {
        const params = new URLSearchParams({ provider: "root", providerUserId });
        if (deck) {
            params.set("deck", deck);
        }
        return this.request(`/api/assistant/wantlist?${params.toString()}`);
    }
    async getPersonalWants(providerUserId) {
        const params = new URLSearchParams({
            provider: "root",
            providerUserId,
            personalOnly: "true",
        });
        return this.request(`/api/assistant/wantlist?${params.toString()}`);
    }
    async addWant(providerUserId, req) {
        return this.request("/api/assistant/wantlist", {
            method: "POST",
            body: JSON.stringify({
                provider: "root",
                providerUserId,
                ...req,
            }),
        });
    }
    async removeWant(providerUserId, req) {
        return this.request("/api/assistant/wantlist", {
            method: "DELETE",
            body: JSON.stringify({
                provider: "root",
                providerUserId,
                ...req,
            }),
        });
    }
    async autocomplete(providerUserId, type, query) {
        const params = new URLSearchParams({
            provider: "root",
            providerUserId,
            type,
            query,
        });
        return this.request(`/api/assistant/autocomplete?${params.toString()}`);
    }
}
exports.RootBotApi = RootBotApi;
