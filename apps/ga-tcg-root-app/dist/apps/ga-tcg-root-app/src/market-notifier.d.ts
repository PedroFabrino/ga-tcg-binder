import { type JobScheduler } from "@rootsdk/server-app";
import { type RootCommunityConfig } from "./community-config";
import { RootBotApi } from "./root-bot-api";
export interface MarketNotificationPollDeps {
    api: Pick<RootBotApi, "getMarketNotifications" | "markMarketNotificationsDelivered">;
    config: Pick<RootCommunityConfig, "getBroadcastChannelId"> & Partial<Pick<RootCommunityConfig, "getBroadcastLocale">>;
    postMessage: (channelId: string, content: string) => Promise<string | null>;
    warn?: (message: string) => void;
}
/**
 * One market-notification poll: pull pending chunks from the API, post them to
 * the configured broadcast channel, and report each delivered chunk. A thrown post leaves
 * the remainder for the next poll; a successful post without a message id is
 * still recorded so it is not re-sent.
 */
export declare function runMarketNotificationPoll(deps: MarketNotificationPollDeps): Promise<void>;
export interface MarketNotifierOptions {
    communityId?: string;
    api?: RootBotApi;
    config?: RootCommunityConfig;
    intervalMs?: number;
    scheduler?: JobScheduler;
    postMessage?: (channelId: string, content: string) => Promise<string | null>;
}
/**
 * Starts the market-notification poller. It runs one poll immediately, then
 * schedules subsequent polls on Root's job scheduler (with a local watchdog).
 * The broadcast channel comes from per-community config configured via the GUI; all data
 * comes from the API, so the app holds no database or Discord secrets.
 */
export declare function startMarketNotifier(options?: MarketNotifierOptions): Promise<void>;
