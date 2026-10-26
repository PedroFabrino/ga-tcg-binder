"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssistantRpcService = void 0;
const gen_server_1 = require("@ga/gen-server");
const root_bot_api_1 = require("./root-bot-api");
const assistant_rpc_helpers_1 = require("./assistant-rpc-helpers");
class AssistantRpcService extends gen_server_1.AssistantServiceBase {
    communityId;
    deps;
    defaultApi;
    constructor(communityId, deps = {}) {
        super();
        this.communityId = communityId;
        this.deps = deps;
        if (deps.api) {
            this.defaultApi = deps.api;
        }
        else if (communityId || process.env.COMMUNITY_ID) {
            this.defaultApi = new root_bot_api_1.RootBotApi({
                communityId: communityId ?? process.env.COMMUNITY_ID ?? "",
            });
        }
    }
    getApi(client) {
        if (this.deps.api) {
            return this.deps.api;
        }
        const resolvedCommunityId = client.communityId
            ? String(client.communityId)
            : (this.communityId ?? process.env.COMMUNITY_ID ?? "");
        if (this.defaultApi &&
            (!client.communityId || String(client.communityId) === this.communityId)) {
            return this.defaultApi;
        }
        return new root_bot_api_1.RootBotApi({ communityId: resolvedCommunityId });
    }
    async getStatus(client) {
        const userId = String(client.userId);
        const api = this.getApi(client);
        try {
            const [collector, channel] = await Promise.all([
                api.getCollector(userId),
                api.getDealAlertChannel(userId).catch(() => null),
            ]);
            if (!collector) {
                return {
                    isLinked: false,
                    collectorId: "",
                    collectorName: "",
                    friendCode: "",
                    notificationsEnabled: false,
                    dealAlertMode: "all",
                    alertChannelId: "",
                };
            }
            return {
                isLinked: true,
                collectorId: collector.collectorId,
                collectorName: collector.collectorName ?? "",
                friendCode: collector.friendCode ?? "",
                notificationsEnabled: Boolean(collector.notificationsEnabled),
                dealAlertMode: collector.dealAlertMode ?? "all",
                alertChannelId: channel?.channelId ?? "",
            };
        }
        catch {
            return {
                isLinked: false,
                collectorId: "",
                collectorName: "",
                friendCode: "",
                notificationsEnabled: false,
                dealAlertMode: "all",
                alertChannelId: "",
            };
        }
    }
    async linkAccount(request, client) {
        const userId = String(client.userId);
        const api = this.getApi(client);
        const code = (request.code || "").trim().toUpperCase();
        if (!code) {
            return {
                success: false,
                collectorName: "",
                error: "INVALID_CODE",
            };
        }
        try {
            const res = await api.link({
                token: code,
                provider: "root",
                providerUserId: userId,
            });
            return {
                success: true,
                collectorName: res.collectorName ?? "",
                error: "",
            };
        }
        catch (err) {
            if (err instanceof root_bot_api_1.RootBotApiError) {
                return {
                    success: false,
                    collectorName: "",
                    error: err.code || err.message,
                };
            }
            return {
                success: false,
                collectorName: "",
                error: err instanceof Error ? err.message : "LINK_FAILED",
            };
        }
    }
    async registerAccount(client) {
        const userId = String(client.userId);
        const api = this.getApi(client);
        try {
            const res = await api.register(userId);
            return {
                success: true,
                collectorName: res.collector.name ?? "",
                friendCode: res.collector.friendCode ?? "",
                error: "",
            };
        }
        catch (err) {
            return {
                success: false,
                collectorName: "",
                friendCode: "",
                error: err instanceof Error ? err.message : "REGISTER_FAILED",
            };
        }
    }
    async setPreferences(request, client) {
        const userId = String(client.userId);
        const communityId = client.communityId
            ? String(client.communityId)
            : (this.communityId ?? process.env.COMMUNITY_ID ?? "");
        const api = this.getApi(client);
        const mode = request.dealAlertMode === "hard" ? "hard" : "all";
        try {
            const { alertChannelId } = await (0, assistant_rpc_helpers_1.updateDealAlertPreferencesHelper)(api, userId, communityId, request.notificationsEnabled, mode, this.deps);
            return {
                success: true,
                notificationsEnabled: request.notificationsEnabled,
                dealAlertMode: mode,
                alertChannelId,
                error: "",
            };
        }
        catch (err) {
            return {
                success: false,
                notificationsEnabled: false,
                dealAlertMode: "all",
                alertChannelId: "",
                error: err instanceof Error ? err.message : "SET_PREFERENCES_FAILED",
            };
        }
    }
    async getDecks(client) {
        const userId = String(client.userId);
        const api = this.getApi(client);
        try {
            const res = await api.getDecks(userId);
            const decks = await (0, assistant_rpc_helpers_1.buildDeckSummariesWithShortages)(api, userId, res.decks || []);
            return { decks };
        }
        catch {
            return { decks: [] };
        }
    }
    async autocomplete(request, client) {
        const userId = String(client.userId);
        const api = this.getApi(client);
        try {
            const type = request.type === "wants" || request.type === "deck" ? request.type : "card";
            const res = await api.autocomplete(userId, type, request.query || "");
            return {
                results: (res.results || []).map((r) => ({
                    name: r.name,
                    value: r.value,
                    element: r.element || "",
                    type: r.type || "",
                    quantity: r.quantity || 0,
                    foil: Boolean(r.foil),
                })),
            };
        }
        catch {
            return { results: [] };
        }
    }
    async getPersonalWants(client) {
        const userId = String(client.userId);
        const api = this.getApi(client);
        try {
            const res = await api.getPersonalWants(userId);
            return {
                wants: (res.personalWants || []).map((w) => ({
                    cardSlug: w.cardSlug,
                    cardName: w.cardName,
                    element: w.element || "",
                    type: w.type || "",
                    desiredQuantity: w.desiredQuantity,
                    foil: Boolean(w.foil),
                })),
            };
        }
        catch {
            return { wants: [] };
        }
    }
    async addWant(request, client) {
        const userId = String(client.userId);
        const api = this.getApi(client);
        try {
            const res = await api.addWant(userId, {
                card: request.card,
                quantity: request.quantity,
                foil: request.foil,
                omnidexUrl: request.omnidexUrl,
            });
            return {
                success: true,
                message: res.card ? `Added ${res.card.name}` : "Imported Omnidex shortages",
                error: "",
                suggestions: (res.suggestions || []).map((s) => ({
                    name: s.name,
                    value: s.slug,
                    element: "",
                    type: "",
                    quantity: 0,
                    foil: false,
                })),
            };
        }
        catch (err) {
            return {
                success: false,
                message: "",
                error: err instanceof Error ? err.message : "ADD_WANT_FAILED",
                suggestions: [],
            };
        }
    }
    async removeWant(request, client) {
        const userId = String(client.userId);
        const api = this.getApi(client);
        try {
            const res = await api.removeWant(userId, {
                card: request.card,
                quantity: request.quantity,
            });
            return {
                success: res.success,
                removed: res.removed,
                remainingQuantity: res.remainingQuantity,
                cardName: res.cardName,
                error: "",
                suggestions: (res.suggestions || []).map((s) => ({
                    name: s.name,
                    value: s.slug,
                    element: "",
                    type: "",
                    quantity: s.quantity,
                    foil: false,
                })),
            };
        }
        catch (err) {
            return {
                success: false,
                removed: false,
                remainingQuantity: 0,
                cardName: request.card,
                error: err instanceof Error ? err.message : "REMOVE_WANT_FAILED",
                suggestions: [],
            };
        }
    }
    async importDeck(request, client) {
        const userId = String(client.userId);
        const api = this.getApi(client);
        try {
            const res = await api.importDeck(userId, { url: request.url });
            return {
                success: true,
                deckName: res.deck.name,
                error: "",
            };
        }
        catch (err) {
            return {
                success: false,
                deckName: "",
                error: err instanceof Error ? err.message : "IMPORT_DECK_FAILED",
            };
        }
    }
}
exports.AssistantRpcService = AssistantRpcService;
