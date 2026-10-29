/**
 * Market Sync runner: the market-store scope of the sync system.
 *
 * Crawls every enabled Marketplace Store (MyP, Lootcards, LigaStore), writes the
 * Notification Outbox and delivers Discord notifications per store, then
 * dispatches Deal Alerts exactly once after all stores have synced. The daily
 * `runFullSyncPipeline` does not dispatch Deal Alerts, so a collector never
 * receives the same rolling DM from both schedules.
 */

import {
  getEnabledMarketStores,
  type MarketplaceDatabase,
} from "../db/repositories/marketplace-repository";
import { syncGlobalMarketplace } from "./myp-sync";
import { syncLootcards } from "./lootcards-sync";
import { syncLigaStore } from "./ligastore-sync";
import { writeMarketNotifications } from "./market-notifications";
import { deliverDiscordNotifications } from "./discord-market-notifier";
import { dispatchDealAlerts } from "./discord-deal-notifier";
import {
  DISCORD_DM_DESTINATION,
  readDealAlertDestinations,
} from "../lib/market-vocabulary";
import { MarketSyncProgressDashboard } from "./market-sync-progress";

export interface MarketSyncResult {
  stores: { storeId: string; status: "success" | "failed"; error?: string }[];
  dealAlerts: { matched: number; sent: number } | null;
}

export interface RunMarketSyncOptions {
  storeId?: string;
  database: MarketplaceDatabase;
  sequential?: boolean;
  showDashboard?: boolean;
}

async function notifyMarketChanges(
  storeId: string,
  database: MarketplaceDatabase,
  bootstrapIfNeverNotified = false
): Promise<void> {
  const notificationsWritten = await writeMarketNotifications(storeId, database, {
    bootstrapIfNeverNotified,
  });

  const discord = await deliverDiscordNotifications(database);
  if (discord.disabled) {
    // Discord disabled silently in background
  } else if (discord.attempted > 0) {
    console.log(`- Discord Notifications: ${discord.delivered}/${discord.attempted} delivered`);
  }
}

export async function runMarketSync(options: RunMarketSyncOptions): Promise<MarketSyncResult> {
  const database = options.database;
  const enabledStores = await getEnabledMarketStores(database);
  const stores = options.storeId
    ? enabledStores.filter((store) => store.id === options.storeId)
    : enabledStores;

  if (options.storeId && stores.length === 0) {
    throw new Error(`Enabled marketplace store "${options.storeId}" was not found.`);
  }

  const result: MarketSyncResult = { stores: [], dealAlerts: null };

  if (stores.length === 0) {
    console.log("No enabled marketplace stores to sync.");
    return result;
  }

  const showDashboard = options.showDashboard ?? true;
  const dashboard = showDashboard ? new MarketSyncProgressDashboard() : null;

  if (dashboard) {
    dashboard.init(stores.map((s) => ({ id: s.id, name: s.name, platform: s.platform })));
  }

  const mypStores = stores.filter((s) => s.platform === "myp");
  const ligaStores = stores.filter((s) => s.platform === "liga_store");
  const lootcardsStores = stores.filter((s) => s.platform === "lootcards");
  const otherStores = stores.filter(
    (s) => !["myp", "liga_store", "lootcards"].includes(s.platform)
  );

  const pipelines = [
    mypStores,
    ligaStores,
    lootcardsStores,
    otherStores,
  ].filter((group) => group.length > 0);

  let deliveryQueue = Promise.resolve();
  const queueDiscordNotification = (storeId: string, bootstrapIfNeverNotified = false) => {
    deliveryQueue = deliveryQueue.then(async () => {
      try {
        await notifyMarketChanges(storeId, database, bootstrapIfNeverNotified);
      } catch (err) {
        console.error(
          `Failed to notify market changes for store ${storeId}:`,
          err instanceof Error ? err.message : err
        );
      }
    });
    return deliveryQueue;
  };

  const syncSingleStore = async (store: (typeof stores)[number]) => {
    const onProgress = dashboard?.getCallback(store.id);
    dashboard?.startStore(store.id);
    const startTime = Date.now();

    try {
      let stats = { totalSynced: 0, matchedCount: 0 };

      if (store.platform === "myp") {
        const mypStats = await syncGlobalMarketplace(database, { onProgress });
        stats = { totalSynced: mypStats.totalSynced, matchedCount: mypStats.matchedCount };
        if (mypStats.complete) {
          await queueDiscordNotification(store.id, true);
        }
      } else if (store.platform === "lootcards") {
        const lootStats = await syncLootcards({ storeId: store.id, database, onProgress });
        stats = { totalSynced: lootStats.totalSynced, matchedCount: lootStats.matchedCount };
        await queueDiscordNotification(store.id);
      } else if (store.platform === "liga_store") {
        const ligaStats = await syncLigaStore({ storeId: store.id, database, onProgress });
        stats = { totalSynced: ligaStats.totalSynced, matchedCount: ligaStats.matchedCount };
        await queueDiscordNotification(store.id);
      } else {
        console.warn(`Skipping unknown platform ${store.platform} for store ${store.id}.`);
        return;
      }

      const durationSec = (Date.now() - startTime) / 1000;
      dashboard?.completeStore(store.id, {
        totalSynced: stats.totalSynced,
        matchedCount: stats.matchedCount,
        durationSec,
      });

      result.stores.push({ storeId: store.id, status: "success" });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      dashboard?.failStore(store.id, errorMsg);
      result.stores.push({
        storeId: store.id,
        status: "failed",
        error: errorMsg,
      });
      if (!dashboard) {
        console.error(`Failed to synchronize store "${store.name}" (${store.id}):`, errorMsg);
      }
    }
  };

  if (options.sequential) {
    for (const store of stores) {
      await syncSingleStore(store);
    }
  } else {
    await Promise.all(
      pipelines.map(async (pipelineStores) => {
        for (const store of pipelineStores) {
          await syncSingleStore(store);
        }
      })
    );
  }

  await deliveryQueue;

  if (dashboard) {
    dashboard.printFinalSummary();
  }

  // Deal alert dispatch runs once after all stores have synced
  if (readDealAlertDestinations().includes(DISCORD_DM_DESTINATION)) {
    try {
      const dealAlerts = await dispatchDealAlerts(database, undefined, undefined, {
        destination: DISCORD_DM_DESTINATION,
      });
      result.dealAlerts = { matched: dealAlerts.matched, sent: dealAlerts.sent };
      console.log(
        `- Deal Alerts (Discord): ${dealAlerts.matched} matched, ${dealAlerts.sent} DMs sent`
      );
    } catch (error) {
      console.error(
        "Failed to dispatch deal alerts:",
        error instanceof Error ? error.message : error
      );
    }
  }

  return result;
}
