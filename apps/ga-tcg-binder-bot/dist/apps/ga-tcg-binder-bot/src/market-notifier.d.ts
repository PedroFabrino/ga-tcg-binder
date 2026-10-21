import { type MarketNotification } from "../../../src/db/repositories/marketplace-repository";
/**
 * Formats a batch of market notifications into a single Markdown message
 * suitable for sending to a Root community channel.
 */
export declare function formatMarketNotificationMessage(notifications: MarketNotification[], storeName: string, lastSyncDate?: Date | string | null): string;
/**
 * Starts the market notification poller.
 *
 * Reads configuration from environment variables and begins polling the
 * `market_notifications` outbox table at the configured interval. Pending
 * notifications are grouped by store, formatted as Markdown, and sent to
 * the configured Root community channel.
 */
export declare function startMarketNotifier(): void;
