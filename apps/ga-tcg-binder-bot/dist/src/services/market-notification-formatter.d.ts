import type { MarketNotification } from "../db/repositories/marketplace-repository";
/**
 * Formats a batch of market notifications into a single Markdown message
 * suitable for sending to a Root community channel.
 */
export declare function formatMarketNotificationMessage(notifications: MarketNotification[], storeName: string, lastSyncDate?: Date | string | null): string;
