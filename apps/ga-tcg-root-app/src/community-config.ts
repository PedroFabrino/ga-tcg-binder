/**
 * Per-community configuration for the Root bot, stored in the bot's
 * install-scoped key-value store (`rootServer.dataStore.appData`).
 *
 * Community-specific ids (which channel to broadcast to, which channel group
 * holds the per-user deal-alert channels) must never come from `.env` — each
 * community configures itself.
 */

import { type SupportedLocale } from "@ga/contracts";

/** The minimal key-value surface the config store needs. */
export interface CommunityConfigStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(value: { key: string; value: T }): Promise<void>;
}

const BROADCAST_CHANNEL_KEY = "market.broadcastChannelId";
const ALERT_SECTION_KEY = "dealAlert.sectionId.v2";
const ASSISTANT_CHANNEL_KEY = "assistant.channelId.v1";
const BROADCAST_LOCALE_KEY = "market.broadcastLocale";

export interface RootCommunityConfig {
  getBroadcastChannelId(): Promise<string | undefined>;
  setBroadcastChannelId(channelId: string): Promise<void>;
  getAlertSectionId(): Promise<string | undefined>;
  setAlertSectionId(sectionId: string): Promise<void>;
  getAssistantChannelId(): Promise<string | undefined>;
  setAssistantChannelId(channelId: string): Promise<void>;
  getBroadcastLocale(): Promise<SupportedLocale>;
  setBroadcastLocale(locale: SupportedLocale): Promise<void>;
}

export function createCommunityConfig(
  store: CommunityConfigStore
): RootCommunityConfig {
  return {
    async getBroadcastChannelId() {
      return store.get<string>(BROADCAST_CHANNEL_KEY);
    },
    async setBroadcastChannelId(channelId) {
      await store.set({ key: BROADCAST_CHANNEL_KEY, value: channelId });
    },
    async getAlertSectionId() {
      return store.get<string>(ALERT_SECTION_KEY);
    },
    async setAlertSectionId(sectionId) {
      await store.set({ key: ALERT_SECTION_KEY, value: sectionId });
    },
    async getAssistantChannelId() {
      return store.get<string>(ASSISTANT_CHANNEL_KEY);
    },
    async setAssistantChannelId(channelId) {
      await store.set({ key: ASSISTANT_CHANNEL_KEY, value: channelId });
    },
    async getBroadcastLocale() {
      const stored = await store.get<string>(BROADCAST_LOCALE_KEY);
      return stored === "pt-BR" ? "pt-BR" : "en";
    },
    async setBroadcastLocale(locale) {
      const normalized: SupportedLocale = locale === "pt-BR" ? "pt-BR" : "en";
      await store.set({ key: BROADCAST_LOCALE_KEY, value: normalized });
    },
  };
}
