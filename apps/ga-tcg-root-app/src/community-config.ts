/**
 * Per-community configuration for the Root bot, stored in the bot's
 * install-scoped key-value store (`rootServer.dataStore.appData`).
 *
 * Community-specific ids (which channel to broadcast to, which channel group
 * holds the per-user deal-alert channels) must never come from `.env` — each
 * community configures itself.
 */

/** The minimal key-value surface the config store needs. */
export interface CommunityConfigStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(value: { key: string; value: T }): Promise<void>;
}

const BROADCAST_CHANNEL_KEY = "market.broadcastChannelId";
const ALERT_SECTION_KEY = "dealAlert.sectionId.v2";

export interface RootCommunityConfig {
  getBroadcastChannelId(): Promise<string | undefined>;
  setBroadcastChannelId(channelId: string): Promise<void>;
  getAlertSectionId(): Promise<string | undefined>;
  setAlertSectionId(sectionId: string): Promise<void>;
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
  };
}
