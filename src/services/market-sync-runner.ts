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

export interface MarketSyncResult {
  stores: { storeId: string; status: "success" | "failed"; error?: string }[];
  dealAlerts: { matched: number; sent: number } | null;
}

async function notifyMarketChanges(
  storeId: string,
  database: MarketplaceDatabase,
  bootstrapIfNeverNotified = false
): Promise<void> {
  const notificationsWritten = await writeMarketNotifications(storeId, database, {
    bootstrapIfNeverNotified,
  });
  console.log(`- Outbox Notifications Written: ${notificationsWritten}`);

  const discord = await deliverDiscordNotifications(database);
  if (discord.disabled) {
    console.warn("- Discord Notifications: disabled (DISCORD_WEBHOOK is missing or invalid)");
  } else {
    console.log(`- Discord Notifications: ${discord.delivered}/${discord.attempted} delivered`);
  }
}

export async function runMarketSync(options: {
  storeId?: string;
  database: MarketplaceDatabase;
}): Promise<MarketSyncResult> {
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
    console.log(`\n=== Starting Synchronization for Store: ${store.name} (${store.id}) ===`);
    const startTime = Date.now();

    try {
      if (store.platform === "myp") {
        const stats = await syncGlobalMarketplace(database);
        const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`- Total Listings Synced: ${stats.totalSynced}`);
        console.log(`- Matched Catalog Printings: ${stats.matchedCount}`);
        console.log(`- Unmatched Listings: ${stats.unmatchedCount}`);
        console.log(`- Full Scan Complete: ${stats.complete}`);
        console.log(`- Duration: ${durationSec}s`);

        if (stats.complete) {
          await queueDiscordNotification(store.id, true);
        }
      } else if (store.platform === "lootcards") {
        const stats = await syncLootcards({ storeId: store.id, database });
        const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`- Total Synced: ${stats.totalSynced}`);
        console.log(`- Matched: ${stats.matchedCount}`);
        console.log(`- Unmatched: ${stats.unmatchedCount}`);
        console.log(`- Enriched: ${stats.enrichedCount}`);
        console.log(`- Duration: ${durationSec}s`);

        await queueDiscordNotification(store.id);
      } else if (store.platform === "liga_store") {
        const stats = await syncLigaStore({ storeId: store.id, database });
        const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`- Total Synced: ${stats.totalSynced}`);
        console.log(`- Matched: ${stats.matchedCount}`);
        console.log(`- Unmatched: ${stats.unmatchedCount}`);
        console.log(`- Enriched: ${stats.enrichedCount}`);
        console.log(`- Duration: ${durationSec}s`);

        await queueDiscordNotification(store.id);
      } else {
        console.warn(`Skipping unknown platform ${store.platform} for store ${store.id}.`);
        return;
      }

      result.stores.push({ storeId: store.id, status: "success" });
      console.log(`=== Finished Synchronization for ${store.name} ===`);
    } catch (error) {
      result.stores.push({
        storeId: store.id,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(
        `Failed to synchronize store "${store.name}" (${store.id}):`,
        error instanceof Error ? error.message : error
      );
    }
  };

  await Promise.all(
    pipelines.map(async (pipelineStores) => {
      for (const store of pipelineStores) {
        await syncSingleStore(store);
      }
    })
  );

  await deliveryQueue;

  // Deal alert dispatch runs once after all stores have synced so matching
  // sees the complete set of freshly updated listings. Root delivery runs in
  // the Root bot (the only process with the Root SDK); this process owns only
  // the Discord DM destination.
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
