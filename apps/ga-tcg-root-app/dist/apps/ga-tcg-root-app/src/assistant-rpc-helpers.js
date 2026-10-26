"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDeckSummariesWithShortages = buildDeckSummariesWithShortages;
exports.updateDealAlertPreferencesHelper = updateDealAlertPreferencesHelper;
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
        catch {
            // Degrades gracefully on missing shortages
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
