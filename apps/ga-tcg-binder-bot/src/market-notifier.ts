import { rootServer, type ChannelGuid } from "@rootsdk/server-bot";
import { db } from "../../../src/db";
import {
  getPendingNotifications,
  markNotificationsSent,
  getMarketStoreById,
  type MarketNotification,
} from "../../../src/db/repositories/marketplace-repository";
import { formatMarketNotificationMessage } from "../../../src/services/market-notification-formatter";

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
      const byStore = new Map<string, MarketNotification[]>();
      for (const n of pending) {
        const list = byStore.get(n.storeId);
        if (list) {
          list.push(n);
        } else {
          byStore.set(n.storeId, [n]);
        }
      }

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

        try {
          const sentMessage = await rootServer.community.channelMessages.create({
            channelId,
            content: message,
          });

          const ids = notifications.map((n) => n.id);
          const messageId = sentMessage?.id ? String(sentMessage.id) : "sent";
          await markNotificationsSent(ids, messageId, new Date(), db);

          console.log(
            `[market-notifier] Sent ${notifications.length} notifications for store "${storeName}"`
          );
        } catch (err) {
          console.error(
            `[market-notifier] Failed to send notifications for store "${storeName}":`,
            err instanceof Error ? err.message : err
          );
        }
      }
    } catch (err) {
      console.error(
        "[market-notifier] Poll tick error:",
        err instanceof Error ? err.message : err
      );
    } finally {
      running = false;
    }
  };

  setInterval(tick, pollIntervalMs);
  tick();
}
