"use strict";
/**
 * Per-community configuration for the Root bot, stored in the bot's
 * install-scoped key-value store (`rootServer.dataStore.appData`).
 *
 * Community-specific ids (which channel to broadcast to, which channel group
 * holds the per-user deal-alert channels) must never come from `.env` — each
 * community configures itself.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCommunityConfig = createCommunityConfig;
const BROADCAST_CHANNEL_KEY = "market.broadcastChannelId";
const ALERT_SECTION_KEY = "dealAlert.sectionId.v2";
const ASSISTANT_CHANNEL_KEY = "assistant.channelId.v1";
const BROADCAST_LOCALE_KEY = "market.broadcastLocale";
function createCommunityConfig(store) {
    return {
        async getBroadcastChannelId() {
            return store.get(BROADCAST_CHANNEL_KEY);
        },
        async setBroadcastChannelId(channelId) {
            await store.set({ key: BROADCAST_CHANNEL_KEY, value: channelId });
        },
        async getAlertSectionId() {
            return store.get(ALERT_SECTION_KEY);
        },
        async setAlertSectionId(sectionId) {
            await store.set({ key: ALERT_SECTION_KEY, value: sectionId });
        },
        async getAssistantChannelId() {
            return store.get(ASSISTANT_CHANNEL_KEY);
        },
        async setAssistantChannelId(channelId) {
            await store.set({ key: ASSISTANT_CHANNEL_KEY, value: channelId });
        },
        async getConfiguredBroadcastLocale() {
            const stored = await store.get(BROADCAST_LOCALE_KEY);
            return stored === "pt-BR" || stored === "en" ? stored : undefined;
        },
        async getBroadcastLocale() {
            const stored = await this.getConfiguredBroadcastLocale();
            return stored ?? "en";
        },
        async setBroadcastLocale(locale) {
            const normalized = locale === "pt-BR" ? "pt-BR" : "en";
            await store.set({ key: BROADCAST_LOCALE_KEY, value: normalized });
        },
    };
}
