"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssistantRpcService = void 0;
const gen_server_1 = require("@ga/gen-server");
const server_app_1 = require("@rootsdk/server-app");
const root_bot_api_1 = require("./root-bot-api");
const assistant_rpc_helpers_1 = require("./assistant-rpc-helpers");
const community_config_1 = require("./community-config");
const community_admin_1 = require("./community-admin");
const admin_rpc_helpers_1 = require("./admin-rpc-helpers");
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
    getConfig() {
        return this.deps.config ?? (0, community_config_1.createCommunityConfig)(server_app_1.rootServer.dataStore.appData);
    }
    async getStatus(client) {
        const userId = String(client.userId);
        const api = this.getApi(client);
        const isAdmin = await (this.deps.isCommunityAdmin ?? community_admin_1.checkIsCommunityAdmin)(userId);
        try {
            const [collector, channel] = await Promise.all([
                api.getCollector(userId),
                api.getDealAlertChannel(userId).catch((err) => {
                    console.warn("[assistant-rpc] Failed to load deal-alert channel, falling back to null:", err);
                    return null;
                }),
            ]);
            if (!collector) {
                let broadcastLocale = "";
                try {
                    broadcastLocale = (await this.getConfig().getConfiguredBroadcastLocale?.()) ?? "";
                }
                catch (err) {
                    console.warn("[assistant-rpc] Failed to read configured broadcast locale:", err);
                }
                return (0, assistant_rpc_helpers_1.createUnlinkedStatus)(isAdmin, broadcastLocale);
            }
            return {
                isLinked: true,
                collectorId: collector.collectorId,
                collectorName: collector.collectorName ?? "",
                friendCode: collector.friendCode ?? "",
                notificationsEnabled: Boolean(collector.notificationsEnabled),
                dealAlertMode: collector.dealAlertMode ?? "all",
                alertChannelId: channel?.channelId ?? "",
                isAdmin,
                locale: collector.locale || "en",
            };
        }
        catch (err) {
            console.warn("[assistant-rpc] Failed to get collector status, returning unlinked status:", err);
            let broadcastLocale = "";
            try {
                broadcastLocale = (await this.getConfig().getConfiguredBroadcastLocale?.()) ?? "";
            }
            catch (configErr) {
                console.warn("[assistant-rpc] Failed to read configured broadcast locale on fallback:", configErr);
            }
            return (0, assistant_rpc_helpers_1.createUnlinkedStatus)(isAdmin, broadcastLocale);
        }
    }
    async linkAccount(request, client) {
        return (0, assistant_rpc_helpers_1.linkAccountHelper)(this.getApi(client), String(client.userId), request.code);
    }
    async registerAccount(client) {
        return (0, assistant_rpc_helpers_1.registerAccountHelper)(this.getApi(client), String(client.userId));
    }
    async setPreferences(request, client) {
        const userId = String(client.userId);
        const communityId = client.communityId
            ? String(client.communityId)
            : (this.communityId ?? process.env.COMMUNITY_ID ?? "");
        const api = this.getApi(client);
        const mode = request.dealAlertMode === "hard" ? "hard" : "all";
        const locale = request.locale === "pt-BR" ? "pt-BR" : (request.locale === "en" ? "en" : undefined);
        try {
            const { alertChannelId } = await (0, assistant_rpc_helpers_1.updateDealAlertPreferencesHelper)(api, userId, communityId, request.notificationsEnabled, mode, this.deps, locale);
            return {
                success: true,
                notificationsEnabled: request.notificationsEnabled,
                dealAlertMode: mode,
                alertChannelId,
                locale: locale || "",
                error: "",
            };
        }
        catch (err) {
            return {
                success: false,
                notificationsEnabled: false,
                dealAlertMode: "all",
                alertChannelId: "",
                locale: "",
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
            return { results: (res.results || []).map(assistant_rpc_helpers_1.mapAutocompleteChoice) };
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
            return { wants: (res.personalWants || []).map(assistant_rpc_helpers_1.mapPersonalWant) };
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
                omnidexUrl: request.omnidexUrl || undefined,
                omnidexText: request.omnidexText || undefined,
            });
            return {
                success: true,
                message: res.card ? `Added ${res.card.name}` : "Imported Omnidex shortages",
                error: "",
                suggestions: (res.suggestions || []).map(assistant_rpc_helpers_1.mapSuggestion),
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
                suggestions: (res.suggestions || []).map(assistant_rpc_helpers_1.mapSuggestion),
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
            const res = await api.importDeck(userId, {
                url: request.url || undefined,
                text: request.text || undefined,
            });
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
    async updateDeck(request, client) {
        const userId = String(client.userId);
        const api = this.getApi(client);
        try {
            const res = await api.updateDeck(userId, {
                deckId: request.deckId,
                url: request.url || undefined,
                text: request.text || undefined,
                name: request.name || undefined,
                champion: request.champion || undefined,
            });
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
                error: err instanceof Error ? err.message : "UPDATE_DECK_FAILED",
            };
        }
    }
    async getAdminSettings(client) {
        return (0, admin_rpc_helpers_1.getAdminSettingsHelper)(String(client.userId), this.getConfig(), this.deps);
    }
    async setBroadcastChannel(request, client) {
        return (0, admin_rpc_helpers_1.setBroadcastChannelHelper)(String(client.userId), request, this.getConfig(), this.deps);
    }
    async provisionMarketChannels(request, client) {
        return (0, admin_rpc_helpers_1.provisionMarketChannelsHelper)(String(client.userId), this.getConfig(), request, this.deps);
    }
}
exports.AssistantRpcService = AssistantRpcService;
