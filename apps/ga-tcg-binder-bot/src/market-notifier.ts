import { rootServer, type ChannelGuid } from "@rootsdk/server-bot";
import { db } from "../../../src/db";
import {
  getPendingNotifications,
  markNotificationsSent,
  getMarketStoreById,
} from "../../../src/db/repositories/marketplace-repository";
import { formatMarketNotificationMessage, groupMarketNotificationsByStore } from "../../../src/services/market-notification-formatter";
import { logCommunityChannels } from "./channel-diagnostics";
import { describeError } from "./describe-error";

/**
 * Starts the market notification poller.
 *
 * Reads configuration from environment variables and begins polling the
 * `market_notifications` outbox table at the configured interval. Pending
 * notifications are grouped by store, formatted as Markdown, and sent to
 * the configured Root community channel.
 */
export function startMarketNotifier(): void {
  const pollIntervalMs = Number.parseInt(
    process.env.ROOT_BOT_POLL_INTERVAL_MS ?? "30000",
    10
  );
  const rawChannelId = process.env.ROOT_BOT_MARKET_CHANNEL_ID;

  if (!rawChannelId) {
    console.warn(
      "[market-notifier] ROOT_BOT_MARKET_CHANNEL_ID is not set — market notifications disabled"
    );
    return;
  }

  const channelId = rawChannelId as unknown as ChannelGuid;

  void logCommunityChannels(rawChannelId);

  console.log(
    `[market-notifier] Starting poller (interval=${pollIntervalMs}ms, channel=${rawChannelId})`
  );

  let running = false;

  const tick = async () => {
    if (running) {
      return;
    }
    running = true;

    try {
      const pending = await getPendingNotifications(db);

      if (pending.length === 0) {
        return;
      }

      // Group by storeId
      const byStore = groupMarketNotificationsByStore(pending);

      for (const [storeId, notifications] of byStore) {
        const store = await getMarketStoreById(storeId, db);
        const storeName = store?.name ?? storeId;
        const lastSyncDate = store?.lastFullScanAt ?? null;

        const message = formatMarketNotificationMessage(
          notifications,
          storeName,
          lastSyncDate
        );

        if (!message) {
          continue;
        }

        const ids = notifications.map((n) => n.id);

        let sentMessage;
        try {
          sentMessage = await rootServer.community.channelMessages.create({
            channelId,
            content: message,
          });
        } catch (err) {
          console.error(
            `[market-notifier] Failed to send ${ids.length} notifications for store "${storeName}" to channel ${rawChannelId}: ${describeError(err)}`
          );
          continue;
        }

        const messageId = sentMessage?.id ? String(sentMessage.id) : "sent";
        try {
          await markNotificationsSent(ids, messageId, new Date(), db);
          console.log(
            `[market-notifier] Sent ${ids.length} notifications for store "${storeName}" (message=${messageId})`
          );
        } catch (err) {
          console.error(
            `[market-notifier] Message ${messageId} was posted but ${ids.length} notifications for store "${storeName}" could not be marked as sent (ids: ${ids.join(", ")}) — they will be re-sent on the next tick: ${describeError(err)}`
          );
        }
      }
    } catch (err) {
      console.error(`[market-notifier] Poll tick error: ${describeError(err)}`);
    } finally {
      running = false;
    }
  };

  setInterval(tick, pollIntervalMs);
  tick();
}
