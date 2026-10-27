"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDeckSummariesWithShortages = buildDeckSummariesWithShortages;
exports.updateDealAlertPreferencesHelper = updateDealAlertPreferencesHelper;
exports.mapAutocompleteChoice = mapAutocompleteChoice;
exports.mapPersonalWant = mapPersonalWant;
exports.createUnlinkedStatus = createUnlinkedStatus;
exports.mapSuggestion = mapSuggestion;
exports.linkAccountHelper = linkAccountHelper;
exports.registerAccountHelper = registerAccountHelper;
const root_bot_api_1 = require("./root-bot-api");
const deal_alert_notifier_1 = require("./deal-alert-notifier");
async function buildDeckSummariesWithShortages(api, userId, rawDecks) {
    return Promise.all(rawDecks.map(async (deck) => {
        let hardShortages = [];
        let sharedShortages = [];
        try {
            const shortages = await api.getShortages(userId, deck.id);
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
        catch (err) {
            console.warn(`[assistant-rpc] Failed to load shortages for deck ${deck.id}:`, err);
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
            omnidexText: deck.decklistText || "",
        };
    }));
}
async function updateDealAlertPreferencesHelper(api, userId, communityId, notificationsEnabled, mode, overrides) {
    if (overrides?.setNotificationPreference) {
        await overrides.setNotificationPreference(userId, notificationsEnabled, mode);
    }
    else {
        await api.setNotifyPreference({
            providerUserId: userId,
            enabled: notificationsEnabled,
            mode,
        });
    }
    let alertChannelId = "";
    if (notificationsEnabled) {
        const channelUrl = overrides?.ensureRecipientChannel
            ? await overrides.ensureRecipientChannel(userId, communityId)
            : await (0, deal_alert_notifier_1.ensureRootRecipientChannel)(userId, { communityId, api });
        alertChannelId = channelUrl ? channelUrl.replace(/^root:\/\/channel\//, "") : "";
    }
    else {
        if (overrides?.removeDealAlertChannel) {
            await overrides.removeDealAlertChannel(userId, communityId);
        }
        else {
            await (0, deal_alert_notifier_1.removeRootDealAlertChannel)(userId, { communityId, api });
        }
    }
    return { alertChannelId };
}
function mapAutocompleteChoice(r) {
    return {
        name: r.name,
        value: r.value,
        element: r.element || "",
        type: r.type || "",
        quantity: r.quantity || 0,
        foil: Boolean(r.foil),
    };
}
function mapPersonalWant(w) {
    return {
        cardSlug: w.cardSlug,
        cardName: w.cardName,
        element: w.element || "",
        type: w.type || "",
        desiredQuantity: w.desiredQuantity,
        foil: Boolean(w.foil),
    };
}
function createUnlinkedStatus(isAdmin = false) {
    return {
        isLinked: false,
        collectorId: "",
        collectorName: "",
        friendCode: "",
        notificationsEnabled: false,
        dealAlertMode: "all",
        alertChannelId: "",
        isAdmin,
    };
}
function mapSuggestion(s) {
    return {
        name: s.name,
        value: s.slug,
        element: "",
        type: "",
        quantity: s.quantity ?? 0,
        foil: false,
    };
}
async function linkAccountHelper(api, userId, rawCode) {
    const code = (rawCode || "").trim().toUpperCase();
    if (!code) {
        return { success: false, collectorName: "", error: "INVALID_CODE" };
    }
    try {
        const res = await api.link({
            token: code,
            provider: "root",
            providerUserId: userId,
        });
        return { success: true, collectorName: res.collectorName ?? "", error: "" };
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
async function registerAccountHelper(api, userId) {
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
