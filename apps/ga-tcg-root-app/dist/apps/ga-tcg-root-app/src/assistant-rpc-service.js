"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssistantRpcService = void 0;
const gen_server_1 = require("@ga/gen-server");
const root_bot_api_1 = require("./root-bot-api");
const deal_alert_notifier_1 = require("./deal-alert-notifier");
class AssistantRpcService extends gen_server_1.AssistantServiceBase {
    communityId;
    deps;
    api;
    constructor(communityId, deps = {}) {
        super();
        this.communityId = communityId;
        this.deps = deps;
        this.api =
            deps.api ??
                new root_bot_api_1.RootBotApi({
                    communityId: communityId ?? process.env.COMMUNITY_ID ?? "",
                });
    }
    async getStatus(client) {
        const userId = String(client.userId);
        try {
            const [collector, channel] = await Promise.all([
                this.api.getCollector(userId),
                this.api.getDealAlertChannel(userId).catch(() => null),
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
        const code = (request.code || "").trim().toUpperCase();
        if (!code) {
            return {
                success: false,
                collectorName: "",
                error: "INVALID_CODE",
            };
        }
        try {
            const res = await this.api.link({
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
    async setPreferences(request, client) {
        const userId = String(client.userId);
        const communityId = client.communityId
            ? String(client.communityId)
            : this.communityId;
        const mode = request.dealAlertMode === "hard" ? "hard" : "all";
        try {
            if (this.deps.setNotificationPreference) {
                await this.deps.setNotificationPreference(userId, request.notificationsEnabled, mode);
            }
            else {
                await this.api.setNotifyPreference({
                    providerUserId: userId,
                    enabled: request.notificationsEnabled,
                    mode,
                });
            }
            let alertChannelId = "";
            if (request.notificationsEnabled) {
                const channelUrl = this.deps.ensureRecipientChannel
                    ? await this.deps.ensureRecipientChannel(userId, communityId)
                    : await (0, deal_alert_notifier_1.ensureRootRecipientChannel)(userId, {
                        communityId,
                        api: this.api,
                    });
                alertChannelId = channelUrl
                    ? channelUrl.replace(/^root:\/\/channel\//, "")
                    : "";
            }
            else {
                if (this.deps.removeDealAlertChannel) {
                    await this.deps.removeDealAlertChannel(userId, communityId);
                }
                else {
                    await (0, deal_alert_notifier_1.removeRootDealAlertChannel)(userId, {
                        communityId,
                        api: this.api,
                    });
                }
            }
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
        try {
            const res = await this.api.getDecks(userId);
            const decks = await Promise.all((res.decks || []).map(async (deck) => {
                let hardShortages = [];
                let sharedShortages = [];
                try {
                    const shortages = await this.api.getShortages(userId, deck.id);
                    hardShortages = (shortages.hardShortages || []).map((h) => ({
                        cardSlug: h.cardSlug || "",
                        cardName: h.cardName,
                        quantity: h.missingQuantity,
                    }));
                    sharedShortages = (shortages.sharedShortages || []).map((s) => ({
                        cardSlug: s.cardSlug || "",
                        cardName: s.cardName,
                        quantity: s.sharedQuantity,
                    }));
                }
                catch {
                    // Shortages breakdown degrades gracefully
                }
                return {
                    id: deck.id,
                    name: deck.name,
                    champion: deck.champion || "",
                    format: deck.format,
                    totalCards: deck.totalCards,
                    hardShortagesCount: deck.hardShortageCount,
                    sharedShortagesCount: deck.sharedShortageCount,
                    hardShortages,
                    sharedShortages,
                };
            }));
            return { decks };
        }
        catch {
            return { decks: [] };
        }
    }
}
exports.AssistantRpcService = AssistantRpcService;
