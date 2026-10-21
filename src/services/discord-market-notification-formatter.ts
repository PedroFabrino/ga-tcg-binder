import type { MarketNotification } from "../db/repositories/marketplace-repository";
import {
 formatMarketNotificationCardDetails,
 formatMarketNotificationDate,
 sortMarketNotificationsByDetectedAt,
} from "./market-notification-formatter";

/**
 * Discord enforces a 2000-character limit per message. Chunks are split on
 * line boundaries so card lines are never torn apart.
 */
export const DISCORD_MESSAGE_MAX_LENGTH = 2000;

const DISCORD_MARKDOWN_ESCAPE_PATTERN = /([\\*_~`|>@#:])/g;

/**
 * Escapes Markdown and mention characters so user-controlled values cannot
 * trigger formatting, channel mentions (`#…`), or user/role mentions (`@…`).
 */
export function escapeDiscordMarkdown(text: string): string {
 return text.replace(DISCORD_MARKDOWN_ESCAPE_PATTERN, "\\$1");
}

function isHttpsUrl(value: string | null | undefined): value is string {
 if (!value) {
  return false;
 }
 try {
  return new URL(value).protocol === "https:";
 } catch {
  return false;
 }
}

function escapeLinkUrl(value: string): string {
 return value
  .replace(/\\/g, "\\\\")
  .replace(/\(/g, "\\(")
  .replace(/\)/g, "\\)");
}

/**
 * Renders one card line for Discord. The card name links to the store
 * product page (`imageUrl` value) only when it is a valid https URL.
 */
export function formatDiscordCardLine(notification: MarketNotification): string {
 const escapedName = escapeDiscordMarkdown(notification.cardName);
 const cardName = isHttpsUrl(notification.imageUrl)
  ? `[${escapedName}](${escapeLinkUrl(notification.imageUrl as string)})`
  : escapedName;

 return `• ${cardName} — ${formatMarketNotificationCardDetails(notification)}`;
}

/**
 * Formats a store's notifications into one or more Discord `content`
 * messages. The structure mirrors the Root message (English text, pt-BR
 * date) but uses plain text with escaped names and linked card names.
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

 return splitDiscordContent(lines.join("\n"), DISCORD_MESSAGE_MAX_LENGTH);
}

/**
 * Splits a message into chunks no longer than `maxLength`, breaking only on
 * line boundaries. A single over-long line is hard-sliced as a last resort.
 */
export function splitDiscordContent(
 message: string,
 maxLength: number = DISCORD_MESSAGE_MAX_LENGTH
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
