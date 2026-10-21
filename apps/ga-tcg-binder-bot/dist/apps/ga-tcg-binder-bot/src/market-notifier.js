"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startMarketNotifier = startMarketNotifier;
const server_bot_1 = require("@rootsdk/server-bot");
const db_1 = require("../../../src/db");
const marketplace_repository_1 = require("../../../src/db/repositories/marketplace-repository");
const market_notification_formatter_1 = require("../../../src/services/market-notification-formatter");
/**
 * Starts the market notification poller.
 *
 * Reads configuration from environment variables and begins polling the
 * `market_notifications` outbox table at the configured interval. Pending
 * notifications are grouped by store, formatted as Markdown, and sent to
 * the configured Root community channel.
 */
function startMarketNotifier() {
    const pollIntervalMs = Number.parseInt(process.env.ROOT_BOT_POLL_INTERVAL_MS ?? "30000", 10);
    const rawChannelId = process.env.ROOT_BOT_MARKET_CHANNEL_ID;
    if (!rawChannelId) {
        console.warn("[market-notifier] ROOT_BOT_MARKET_CHANNEL_ID is not set — market notifications disabled");
        return;
    }
    const channelId = rawChannelId;
    console.log(`[market-notifier] Starting poller (interval=${pollIntervalMs}ms, channel=${rawChannelId})`);
    let running = false;
    const tick = async () => {
        if (running) {
            return;
        }
        running = true;
        try {
            const pending = await (0, marketplace_repository_1.getPendingNotifications)(db_1.db);
            if (pending.length === 0) {
                return;
            }
            // Group by storeId
            const byStore = new Map();
            for (const n of pending) {
                const list = byStore.get(n.storeId);
                if (list) {
                    list.push(n);
                }
                else {
                    byStore.set(n.storeId, [n]);
                }
            }
            for (const [storeId, notifications] of byStore) {
                const store = await (0, marketplace_repository_1.getMarketStoreById)(storeId, db_1.db);
                const storeName = store?.name ?? storeId;
                const lastSyncDate = store?.lastFullScanAt ?? null;
                const message = (0, market_notification_formatter_1.formatMarketNotificationMessage)(notifications, storeName, lastSyncDate);
                if (!message) {
                    continue;
                }
                try {
                    const sentMessage = await server_bot_1.rootServer.community.channelMessages.create({
                        channelId,
                        content: message,
                    });
                    const ids = notifications.map((n) => n.id);
                    const messageId = sentMessage?.id ? String(sentMessage.id) : "sent";
                    await (0, marketplace_repository_1.markNotificationsSent)(ids, messageId, new Date(), db_1.db);
                    console.log(`[market-notifier] Sent ${notifications.length} notifications for store "${storeName}"`);
                }
                catch (err) {
                    console.error(`[market-notifier] Failed to send notifications for store "${storeName}":`, err instanceof Error ? err.message : err);
                }
            }
        }
        catch (err) {
            console.error("[market-notifier] Poll tick error:", err instanceof Error ? err.message : err);
        }
        finally {
            running = false;
        }
    };
    setInterval(tick, pollIntervalMs);
    tick();
}
