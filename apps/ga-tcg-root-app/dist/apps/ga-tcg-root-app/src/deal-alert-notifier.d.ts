import { type JobScheduler } from "@rootsdk/server-app";
import type { DirectMessageSink } from "./deal-alert-sink";
import { type RootCommunityConfig } from "./community-config";
import { RootBotApi } from "./root-bot-api";
import { type RootDealAlertApi } from "./root-deal-alert-transport";
export interface DealAlertPollDeps {
    api: Pick<RootBotApi, "getDealAlerts" | "recordDealAlertDelivery" | "recordDealAlertCleanup">;
    ensureSection: () => Promise<string | undefined>;
    createTransport: (sectionId: string) => DirectMessageSink;
}
/**
 * One deal-alert poll: ask the API for changed lists + cleanup, deliver to Root
 * channels/notifications, and report the results back. No matching or database
 * work happens in the bot.
 */
export declare function runDealAlertPoll(deps: DealAlertPollDeps): Promise<void>;
export interface DealAlertNotifierOptions {
    communityId?: string;
    api?: RootBotApi;
    config?: RootCommunityConfig;
    intervalMs?: number;
    scheduler?: JobScheduler;
    rootApi?: RootDealAlertApi;
    createTransport?: (sectionId: string) => DirectMessageSink;
}
export declare function startDealAlertNotifier(options?: DealAlertNotifierOptions): Promise<void>;
export interface RecipientChannelOptions {
    communityId?: string;
    api?: RootBotApi;
    config?: RootCommunityConfig;
    rootApi?: RootDealAlertApi;
}
/**
 * Runs one deal-alert delivery immediately (used after opt-in so the list is
 * populated without waiting for the next scheduled poll).
 */
export declare function provisionRootDealAlerts(options?: RecipientChannelOptions): Promise<void>;
/**
 * Ensures the recipient has a private deal-alert channel and posts a welcome
 * message in it. Channel existence is tracked by the API.
 */
export declare function ensureRootRecipientChannel(recipientId: string, options?: RecipientChannelOptions): Promise<string>;
/**
 * Removes a recipient's private deal-alert channel and clears its state.
 */
export declare function removeRootDealAlertChannel(recipientId: string, options?: RecipientChannelOptions): Promise<void>;
