import { rootServer, type ChannelGuid } from "@rootsdk/server-bot";
import { db } from "../../../src/db";
import {
  getPendingNotifications,
  markNotificationsSent,
  getMarketStoreById,
} from "../../../src/db/repositories/marketplace-repository";
import {
  formatMarketNotificationChunks,
  groupMarketNotificationsByStore,
} from "../../../src/services/market-notification-message";
import {
  createCommunityConfig,
  type RootCommunityConfig,
} from "./community-config";
import { describeError } from "./describe-error";

export interface MarketNotifierOptions {
  config?: RootCommunityConfig;
  pollIntervalMs?: number;
}

/**
 * Starts the market notification poller. The broadcast channel is read from
 * per-community config (set once with `/setup`), so a public bot never relies
 * on a community-specific `.env`. Pending notifications are grouped by store,
 * formatted as Markdown chunks under Root message limits, and sent
 * incrementally. Until `/setup` is run, the poller stays idle.
 */
export function startMarketNotifier(options: MarketNotifierOptions = {}): void {
  const pollIntervalMs =
    options.pollIntervalMs ??
    Number.parseInt(process.env.ROOT_BOT_POLL_INTERVAL_MS ?? "30000", 10);
  const config =
    options.config ?? createCommunityConfig(rootServer.dataStore.appData);

  let warnedUnconfigured = false;

  console.log(`[market-notifier] Starting poller (interval=${pollIntervalMs}ms)`);

  let running = false;

  const tick = async () => {
    if (running) {
      return;
    }
    running = true;

    try {
      const broadcastChannelId = await config.getBroadcastChannelId();

      if (!broadcastChannelId) {
        if (!warnedUnconfigured) {
          console.warn(
            "[market-notifier] No broadcast channel configured — run /setup in the target channel. Market notifications paused."
          );
          warnedUnconfigured = true;
        }
        return;
      }
      warnedUnconfigured = false;

      const channelId = broadcastChannelId as unknown as ChannelGuid;
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
        const storeUrl = store?.baseUrl ?? null;

        const chunks = formatMarketNotificationChunks(
          notifications,
          storeName,
          lastSyncDate,
          undefined,
          storeUrl
        );

        if (chunks.length === 0) {
          continue;
        }

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          let sentMessage;
          try {
            sentMessage = await rootServer.community.channelMessages.create({
              channelId,
              content: chunk.content,
            });
          } catch (err) {
            console.error(
              `[market-notifier] Failed to send chunk ${i + 1}/${chunks.length} (${chunk.notificationIds.length} cards) for store "${storeName}" to channel ${broadcastChannelId}: ${describeError(err)}`
            );
            // Stop processing remaining chunks for this store to keep message ordering intact.
            // Remaining notifications will be retried on the next poll tick.
            break;
          }

          const messageId = sentMessage?.id ? String(sentMessage.id) : "sent";
          try {
            await markNotificationsSent(chunk.notificationIds, messageId, new Date(), db);
            console.log(
              `[market-notifier] Sent chunk ${i + 1}/${chunks.length} (${chunk.notificationIds.length} cards) for store "${storeName}" (message=${messageId})`
            );
          } catch (err) {
            console.error(
              `[market-notifier] Message ${messageId} was posted but ${chunk.notificationIds.length} notifications for store "${storeName}" could not be marked as sent (ids: ${chunk.notificationIds.join(", ")}) — they will be re-sent on the next tick: ${describeError(err)}`
            );
          }

          if (i < chunks.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 250));
          }
        }
      }
    } catch (err) {
      console.error(`[market-notifier] Poll tick error: ${describeError(err)}`);
    } finally {
      running = false;
    }
  };

  setInterval(tick, pollIntervalMs);
  void tick();
}
