"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatMarketNotificationMessage = formatMarketNotificationMessage;
/**
 * Formats a batch of market notifications into a single Markdown message
 * suitable for sending to a Root community channel.
 */
function formatMarketNotificationMessage(notifications, storeName, lastSyncDate) {
    if (notifications.length === 0) {
        return "";
    }
    const dateStr = lastSyncDate
        ? lastSyncDate instanceof Date
            ? lastSyncDate.toLocaleDateString("pt-BR")
            : String(lastSyncDate)
        : new Date().toLocaleDateString("pt-BR");
    const lines = [
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
        lines.push(`• ${n.cardName} — ${n.setPrefix}${collectorNumber}${foilStatus} — ${n.price}`);
    }
    return lines.join("\n");
}
