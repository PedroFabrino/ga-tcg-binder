import { runMigrations } from "../src/db/init";
import { db } from "../src/db";
import { ensureDefaultUserAndSeed } from "../src/services/seed";
import { getEnabledMarketStores } from "../src/db/repositories/marketplace-repository";
import { syncGlobalMarketplace } from "../src/services/myp-sync";
import { syncLigaStore } from "../src/services/ligastore-sync";
import { syncLootcards } from "../src/services/lootcards-sync";
import { writeMarketNotifications } from "../src/services/market-notifications";
import { deliverDiscordNotifications } from "../src/services/discord-market-notifier";
import { dispatchDealAlerts } from "../src/services/discord-deal-notifier";

function readStoreIdArgument(args: string[]): string | undefined {
  const storeFlagIndex = args.indexOf("--store");

  if (storeFlagIndex === -1) {
    return undefined;
  }

  const storeId = args[storeFlagIndex + 1];

  if (!storeId || storeId.startsWith("--")) {
    throw new Error("Expected a store id after --store");
  }

  return storeId;
}

async function notifyMarketChanges(
  storeId: string,
  bootstrapIfNeverNotified = false
): Promise<void> {
  const notificationsWritten = await writeMarketNotifications(storeId, db, {
    bootstrapIfNeverNotified,
  });
  console.log(`- Outbox Notifications Written: ${notificationsWritten}`);

  const discord = await deliverDiscordNotifications(db);
  if (discord.disabled) {
    console.warn("- Discord Notifications: disabled (DISCORD_WEBHOOK is missing or invalid)");
  } else {
    console.log(`- Discord Notifications: ${discord.delivered}/${discord.attempted} delivered`);
  }
}

async function main() {
  console.log("=== Initializing Database Schema & Stores ===");
  await runMigrations();
  await ensureDefaultUserAndSeed(db);
  console.log("Schema initialized successfully.");

  const requestedStoreId = readStoreIdArgument(process.argv.slice(2));
  const enabledStores = await getEnabledMarketStores(db);
  const stores = requestedStoreId
    ? enabledStores.filter((s) => s.id === requestedStoreId)
    : enabledStores;

  if (requestedStoreId && stores.length === 0) {
    throw new Error(
      `Enabled marketplace store "${requestedStoreId}" was not found.`
    );
  }

  if (stores.length === 0) {
    console.log("No enabled marketplace stores to sync.");
    return;
  }

  for (const store of stores) {
    console.log(`\n=== Starting Synchronization for Store: ${store.name} (${store.id}) ===`);
    const startTime = Date.now();

    try {
      if (store.platform === "myp") {
        const stats = await syncGlobalMarketplace(db);
        const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`- Total Listings Synced: ${stats.totalSynced}`);
        console.log(`- Matched Catalog Printings: ${stats.matchedCount}`);
        console.log(`- Unmatched Listings: ${stats.unmatchedCount}`);
        console.log(`- Full Scan Complete: ${stats.complete}`);
        console.log(`- Duration: ${durationSec}s`);

        if (stats.complete) {
          await notifyMarketChanges(store.id, true);
        }
      } else if (store.platform === "lootcards") {
        const stats = await syncLootcards({
          storeId: store.id,
          database: db,
        });
        const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`- Total Synced: ${stats.totalSynced}`);
        console.log(`- Matched: ${stats.matchedCount}`);
        console.log(`- Unmatched: ${stats.unmatchedCount}`);
        console.log(`- Enriched: ${stats.enrichedCount}`);
        console.log(`- Duration: ${durationSec}s`);

        await notifyMarketChanges(store.id);
      } else if (store.platform === "liga_store") {
        if (!store.baseUrl) {
          throw new Error(`Liga Store "${store.id}" has no baseUrl configured.`);
        }

        const stats = await syncLigaStore({
          storeId: store.id,
          database: db,
        });
        const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`- Total Synced: ${stats.totalSynced}`);
        console.log(`- Matched: ${stats.matchedCount}`);
        console.log(`- Unmatched: ${stats.unmatchedCount}`);
        console.log(`- Enriched: ${stats.enrichedCount}`);
        console.log(`- Duration: ${durationSec}s`);

        await notifyMarketChanges(store.id);
      } else {
        console.warn(`Unknown platform ${store.platform} for store ${store.id}, skipping.`);
        continue;
      }

      console.log(`=== Finished Synchronization for ${store.name} ===`);
    } catch (err: any) {
      console.error(`Failed to synchronize store "${store.name}" (${store.id}):`, err.message || err);
    }
  }

  // Deal alert dispatch runs once after all stores have synced so matching
  // sees the complete set of freshly updated listings.
  try {
    const dealAlerts = await dispatchDealAlerts(db);
    console.log(`- Deal Alerts: ${dealAlerts.matched} matched, ${dealAlerts.sent} DMs sent`);
  } catch (err: any) {
    console.error("Failed to dispatch deal alerts:", err.message || err);
  }
}

main().catch((err) => {
  console.error("Error during marketplace sync:", err);
  process.exit(1);
});
