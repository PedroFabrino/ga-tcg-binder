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
