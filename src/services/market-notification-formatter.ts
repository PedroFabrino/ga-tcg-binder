import type { MarketNotification } from "../db/repositories/marketplace-repository";

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

  const dateStr = lastSyncDate
    ? lastSyncDate instanceof Date
      ? lastSyncDate.toLocaleDateString("pt-BR")
      : String(lastSyncDate)
    : new Date().toLocaleDateString("pt-BR");

  const lines: string[] = [
    `**${storeName}** updated their stock!`,
    `New cards since ${dateStr}:`,
  ];

  const sorted = [...notifications].sort((a, b) => {
    const timeA = a.detectedAt ? new Date(a.detectedAt).getTime() : 0;
    const timeB = b.detectedAt ? new Date(b.detectedAt).getTime() : 0;
    return timeA - timeB;
  });

  for (const n of sorted) {
    const foilStatus = n.isFoil ? " (Foil)" : "";
    const collectorNumber = n.collectorNumber ? ` ${n.collectorNumber}` : "";
    lines.push(
      `• ${n.cardName} — ${n.setPrefix}${collectorNumber}${foilStatus} — ${n.price}`
    );
  }

  return lines.join("\n");
}
