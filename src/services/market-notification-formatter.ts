import type { MarketNotification } from "../db/repositories/marketplace-repository";

/**
 * Formats the "New cards since …" date exactly as the Root bot renders it:
 * a pt-BR locale date string, falling back to "now" when no date is known.
 */
export function formatMarketNotificationDate(
 lastSyncDate?: Date | string | null
): string {
 if (lastSyncDate) {
  return lastSyncDate instanceof Date
   ? lastSyncDate.toLocaleDateString("pt-BR")
   : String(lastSyncDate);
 }
 return new Date().toLocaleDateString("pt-BR");
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
 * Maximum character length for a single chat message (Root, Discord).
 */
export const ROOT_MESSAGE_MAX_LENGTH = 2000;

export interface MarketNotificationChunk {
 content: string;
 notificationIds: string[];
}

/**
 * Splits arbitrary multiline text into chunks no longer than `maxLength`, breaking on line boundaries.
 */
export function splitMessageContent(
 message: string,
 maxLength: number = ROOT_MESSAGE_MAX_LENGTH
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
 maxLength: number = ROOT_MESSAGE_MAX_LENGTH
): MarketNotificationChunk[] {
 if (notifications.length === 0) {
  return [];
 }

 const sorted = sortMarketNotificationsByDetectedAt(notifications);
 const dateStr = formatMarketNotificationDate(lastSyncDate);

 const header = `**${storeName}** updated their stock!\nNew cards since ${dateStr}:`;

 const chunks: MarketNotificationChunk[] = [];
 let currentContent = header;
 let currentIds: string[] = [];

 for (const n of sorted) {
  const cardLine = `• ${n.cardName} — ${formatMarketNotificationCardDetails(n)}`;
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
 lastSyncDate?: Date | string | null
): string {
 if (notifications.length === 0) {
  return "";
 }

 const dateStr = formatMarketNotificationDate(lastSyncDate);

 const lines: string[] = [
  `**${storeName}** updated their stock!`,
  `New cards since ${dateStr}:`,
 ];

 for (const n of sortMarketNotificationsByDetectedAt(notifications)) {
  lines.push(
   `• ${n.cardName} — ${formatMarketNotificationCardDetails(n)}`
  );
 }

 return lines.join("\n");
}
