import type { MarketNotification } from "../db/repositories/marketplace-repository";
import { MESSAGE_MAX_LENGTH } from "../lib/market-vocabulary";

export const BRAZIL_TIMEZONE = "America/Sao_Paulo";

/**
 * Formats a Date into Brazil's standard time (America/Sao_Paulo, UTC-3)
 * as "DD/MM/YYYY HH:mm".
 */
export function formatDateTimeInBrazil(date: Date): string {
 const datePart = date.toLocaleDateString("pt-BR", { timeZone: BRAZIL_TIMEZONE });
 const timePart = date.toLocaleTimeString("pt-BR", {
  timeZone: BRAZIL_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
 });
 return `${datePart} ${timePart}`;
}

/**
 * Formats the "New cards since …" timestamp in Brazil's standard time
 * (America/Sao_Paulo, UTC-3), falling back to "now" when no date is known.
 */
export function formatMarketNotificationDate(
 lastSyncDate?: Date | string | null
): string {
 if (!lastSyncDate) {
  return formatDateTimeInBrazil(new Date());
 }

 if (lastSyncDate instanceof Date) {
  return formatDateTimeInBrazil(lastSyncDate);
 }

 const parsed = new Date(lastSyncDate);
 if (!Number.isNaN(parsed.getTime())) {
  return formatDateTimeInBrazil(parsed);
 }

 return String(lastSyncDate);
}

/**
 * Returns a copy of the notifications sorted by detection time (oldest first).
 */
export function sortMarketNotificationsByDetectedAt(
 notifications: MarketNotification[]
): MarketNotification[] {
 return [...notifications].sort((a, b) => {
  const timeA = a.detectedAt ? new Date(a.detectedAt).getTime() : 0;
  const timeB = b.detectedAt ? new Date(b.detectedAt).getTime() : 0;
  return timeA - timeB;
 });
}

/**
 * Groups notifications by store id, preserving the insertion order of the
 * input list for each group.
 */
export function groupMarketNotificationsByStore(
 notifications: MarketNotification[]
): Map<string, MarketNotification[]> {
 const byStore = new Map<string, MarketNotification[]>();
 for (const notification of notifications) {
  const list = byStore.get(notification.storeId);
  if (list) {
   list.push(notification);
  } else {
   byStore.set(notification.storeId, [notification]);
  }
 }
 return byStore;
}

/**
 * Builds the trailing "SET collector (Foil) — price" segment shared by every
 * notification sink. Card names are handled separately because sinks render
 * them differently (plain text, Markdown links, escaped, …).
 */
export function formatMarketNotificationCardDetails(
 notification: MarketNotification
): string {
 const foilStatus = notification.isFoil ? " (Foil)" : "";
 const collectorNumber = notification.collectorNumber
  ? ` ${notification.collectorNumber}`
  : "";
 return `${notification.setPrefix}${collectorNumber}${foilStatus} — ${notification.price}`;
}

/**
 * Checks whether a given string is a valid https URL.
 */
export function isHttpsUrl(value: string | null | undefined): value is string {
 if (!value) {
  return false;
 }
 try {
  return new URL(value).protocol === "https:";
 } catch {
  return false;
 }
}

/**
 * Escapes characters in URLs to prevent breaking Markdown links.
 */
export function escapeLinkUrl(value: string): string {
 return value
  .replace(/\\/g, "\\\\")
  .replace(/\(/g, "\\(")
  .replace(/\)/g, "\\)");
}

/**
 * Renders one card bullet line for chat platforms (Root, Discord).
 * The card name is hyperlinked if `imageUrl` is a valid https product URL.
 */
export function formatMarketNotificationCardLine(
 notification: MarketNotification
): string {
 const cardDetails = formatMarketNotificationCardDetails(notification);
 const cardName = isHttpsUrl(notification.imageUrl)
  ? `[${notification.cardName}](<${escapeLinkUrl(notification.imageUrl)}>)`
  : notification.cardName;

 return `• ${cardName} — ${cardDetails}`;
}

export interface MarketNotificationChunk {
 content: string;
 notificationIds: string[];
}

/**
 * Splits arbitrary multiline text into chunks no longer than `maxLength`, breaking on line boundaries.
 */
export function splitMessageContent(
 message: string,
 maxLength: number = MESSAGE_MAX_LENGTH
): string[] {
 if (message.length <= maxLength) {
  return [message];
 }

 const lines = message.split("\n");
 const chunks: string[] = [];
 let current = "";

 for (const line of lines) {
  if (line.length > maxLength) {
   if (current) {
    chunks.push(current);
    current = "";
   }
   let remaining = line;
   while (remaining.length > maxLength) {
    chunks.push(remaining.slice(0, maxLength));
    remaining = remaining.slice(maxLength);
   }
   if (remaining) {
    current = remaining;
   }
   continue;
  }

  const candidate = current ? `${current}\n${line}` : line;
  if (candidate.length > maxLength) {
   chunks.push(current);
   current = line;
  } else {
   current = candidate;
  }
 }

 if (current) {
  chunks.push(current);
 }

 return chunks;
}

/**
 * Splits a batch of notifications into chunks of at most `maxLength` characters.
 * Each chunk tracks the notification IDs included within it so delivery can be
 * marked incrementally per sent message, preventing duplicate re-sends on partial failures.
 */
export function formatMarketNotificationChunks(
 notifications: MarketNotification[],
 storeName: string,
 lastSyncDate?: Date | string | null,
 maxLength: number = MESSAGE_MAX_LENGTH,
 storeUrl?: string | null
): MarketNotificationChunk[] {
 if (notifications.length === 0) {
  return [];
 }

 const sorted = sortMarketNotificationsByDetectedAt(notifications);
 const dateStr = formatMarketNotificationDate(lastSyncDate);
 const storeTitle = isHttpsUrl(storeUrl)
  ? `**[${storeName}](<${escapeLinkUrl(storeUrl)}>)**`
  : `**${storeName}**`;

 const header = `${storeTitle} updated their stock!\nNew cards since ${dateStr}:`;

 const chunks: MarketNotificationChunk[] = [];
 let currentContent = header;
 let currentIds: string[] = [];

 for (const n of sorted) {
  const cardLine = formatMarketNotificationCardLine(n);
  const candidate = currentContent ? `${currentContent}\n${cardLine}` : cardLine;

  if (candidate.length > maxLength && currentIds.length > 0) {
   chunks.push({
    content: currentContent,
    notificationIds: currentIds,
   });
   currentContent = cardLine;
   currentIds = [n.id];
  } else {
   currentContent = candidate;
   currentIds.push(n.id);
  }
 }

 if (currentIds.length > 0) {
  chunks.push({
   content: currentContent,
   notificationIds: currentIds,
  });
 }

 return chunks;
}

/**
 * Formats a batch of market notifications into a single Markdown message
 * suitable for sending to a Root community channel.
 */
export function formatMarketNotificationMessage(
 notifications: MarketNotification[],
 storeName: string,
 lastSyncDate?: Date | string | null,
 storeUrl?: string | null
): string {
 if (notifications.length === 0) {
  return "";
 }

 const dateStr = formatMarketNotificationDate(lastSyncDate);
 const storeTitle = isHttpsUrl(storeUrl)
  ? `**[${storeName}](<${escapeLinkUrl(storeUrl)}>)**`
  : `**${storeName}**`;

 const lines: string[] = [
  `${storeTitle} updated their stock!`,
  `New cards since ${dateStr}:`,
 ];

 for (const n of sortMarketNotificationsByDetectedAt(notifications)) {
  lines.push(formatMarketNotificationCardLine(n));
 }

 return lines.join("\n");
}

const DISCORD_MARKDOWN_ESCAPE_PATTERN = /([\\*_~`|>@#:])/g;

/**
 * Escapes Markdown and mention characters so user-controlled values cannot
 * trigger formatting, channel mentions, or user/role mentions.
 */
export function escapeDiscordMarkdown(text: string): string {
 return text.replace(DISCORD_MARKDOWN_ESCAPE_PATTERN, "\\$1");
}

/** Renders one card line for Discord, escaping the user-controlled name. */
export function formatDiscordCardLine(notification: MarketNotification): string {
 const escapedName = escapeDiscordMarkdown(notification.cardName);
 const cardName = isHttpsUrl(notification.imageUrl)
  ? `[${escapedName}](<${escapeLinkUrl(notification.imageUrl as string)}>)`
  : escapedName;

 return `\u2022 ${cardName} \u2014 ${formatMarketNotificationCardDetails(notification)}`;
}

/**
 * Formats a store's notifications into Discord `content` messages. The
 * structure mirrors the Root message but escapes names and links.
 */
export function formatDiscordMarketNotificationMessage(
 notifications: MarketNotification[],
 storeName: string,
 lastSyncDate?: Date | string | null
): string[] {
 if (notifications.length === 0) {
  return [];
 }

 const dateStr = formatMarketNotificationDate(lastSyncDate);
 const lines: string[] = [
  `**${escapeDiscordMarkdown(storeName)}** updated their stock!`,
  `New cards since ${dateStr}:`,
 ];

 for (const notification of sortMarketNotificationsByDetectedAt(notifications)) {
  lines.push(formatDiscordCardLine(notification));
 }

 return splitMessageContent(lines.join("\n"), MESSAGE_MAX_LENGTH);
}

/** @deprecated Use `splitMessageContent` from this module. */
export function splitDiscordContent(
 message: string,
 maxLength: number = MESSAGE_MAX_LENGTH
): string[] {
 return splitMessageContent(message, maxLength);
}
