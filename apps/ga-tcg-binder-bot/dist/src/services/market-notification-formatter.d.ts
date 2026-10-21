import type { MarketNotification } from "../db/repositories/marketplace-repository";
/**
 * Formats the "New cards since …" date exactly as the Root bot renders it:
 * a pt-BR locale date string, falling back to "now" when no date is known.
 */
export declare function formatMarketNotificationDate(lastSyncDate?: Date | string | null): string;
/**
 * Returns a copy of the notifications sorted by detection time (oldest first).
 */
export declare function sortMarketNotificationsByDetectedAt(notifications: MarketNotification[]): MarketNotification[];
/**
 * Groups notifications by store id, preserving the insertion order of the
 * input list for each group.
 */
export declare function groupMarketNotificationsByStore(notifications: MarketNotification[]): Map<string, MarketNotification[]>;
/**
 * Builds the trailing "SET collector (Foil) — price" segment shared by every
 * notification sink. Card names are handled separately because sinks render
 * them differently (plain text, Markdown links, escaped, …).
 */
export declare function formatMarketNotificationCardDetails(notification: MarketNotification): string;
/**
 * Maximum character length for a single chat message (Root, Discord).
 */
export declare const ROOT_MESSAGE_MAX_LENGTH = 2000;
export interface MarketNotificationChunk {
    content: string;
    notificationIds: string[];
}
/**
 * Splits arbitrary multiline text into chunks no longer than `maxLength`, breaking on line boundaries.
 */
export declare function splitMessageContent(message: string, maxLength?: number): string[];
/**
 * Splits a batch of notifications into chunks of at most `maxLength` characters.
 * Each chunk tracks the notification IDs included within it so delivery can be
 * marked incrementally per sent message, preventing duplicate re-sends on partial failures.
 */
export declare function formatMarketNotificationChunks(notifications: MarketNotification[], storeName: string, lastSyncDate?: Date | string | null, maxLength?: number): MarketNotificationChunk[];
/**
 * Formats a batch of market notifications into a single Markdown message
 * suitable for sending to a Root community channel.
 */
export declare function formatMarketNotificationMessage(notifications: MarketNotification[], storeName: string, lastSyncDate?: Date | string | null): string;
