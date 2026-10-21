import {
 DISCORD_DESTINATION,
 markNotificationsDelivered,
} from "../db/repositories/notification-delivery-repository";
import type {
 MarketplaceDatabase,
 MarketNotification,
} from "../db/repositories/marketplace-repository";
import { formatDiscordMarketNotificationMessage } from "./discord-market-notification-formatter";
import {
 sendDiscordWebhookMessage,
 validateDiscordWebhookUrl,
} from "./discord-webhook";
import {
 deliverMarketNotifications,
 type MarketNotificationDeliveryResult,
 type MarketNotificationSink,
} from "./market-notification-sink";

export type { MarketNotificationDeliveryResult };

export interface DiscordDeliveryOutcome {
 disabled: boolean;
 attempted: number;
 delivered: number;
}

/**
 * Discord implementation of the notification sink. Runs inside the sync
 * process, separate from the Root bot poller.
 */
export class DiscordMarketNotificationSink implements MarketNotificationSink {
 readonly destination = DISCORD_DESTINATION;

 constructor(private readonly webhookUrl: string) {}

 formatGroup(
  notifications: MarketNotification[],
  storeName: string,
  lastSyncDate?: Date | string | null
 ): string[] {
  return formatDiscordMarketNotificationMessage(
   notifications,
   storeName,
   lastSyncDate
  );
 }

 async send(content: string): Promise<string | null> {
  return sendDiscordWebhookMessage(this.webhookUrl, content);
 }

 async markDelivered(
  notificationIds: string[],
  messageId: string | null,
  database?: MarketplaceDatabase
 ): Promise<void> {
  await markNotificationsDelivered(
   notificationIds,
   DISCORD_DESTINATION,
   messageId,
   new Date(),
   database
  );
 }
}

/**
 * Delivers undelivered market notifications to Discord. A missing or invalid
 * DISCORD_WEBHOOK disables the sink without throwing; the caller decides how
 * to surface that warning. The webhook URL (and its secret token) is never
 * logged here.
 */
export async function deliverDiscordNotifications(
 database?: MarketplaceDatabase
): Promise<DiscordDeliveryOutcome> {
 const webhookUrl = validateDiscordWebhookUrl(process.env.DISCORD_WEBHOOK);

 if (!webhookUrl) {
  return { disabled: true, attempted: 0, delivered: 0 };
 }

 const sink = new DiscordMarketNotificationSink(webhookUrl);
 const result = await deliverMarketNotifications(sink, database);

 return { disabled: false, ...result };
}
