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
    set<T>(value: {
        key: string;
        value: T;
    }): Promise<void>;
}
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
export declare function createCommunityConfig(store: CommunityConfigStore): RootCommunityConfig;
