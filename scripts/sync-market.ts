import { runMigrations } from "../src/db/init";
import { syncGlobalMarketplace } from "../src/services/marketplace";

async function main() {
  console.log("=== Initializing Database Schema ===");
  await runMigrations();
  console.log("Schema initialized successfully.");

  console.log("=== Starting Global MyP Market Synchronization (exibirSomenteVenda=1) ===");
  const startTime = Date.now();
  const stats = await syncGlobalMarketplace();
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("=== Global Market Synchronization Finished ===");
  console.log(`- Total Listings Synced: ${stats.totalSynced}`);
  console.log(`- Matched Catalog Printings: ${stats.matchedCount}`);
  console.log(`- Unmatched Listings: ${stats.unmatchedCount}`);
  console.log(`- Duration: ${durationSec}s`);
}

main().catch((err) => {
  console.error("Error during global market sync:", err);
  process.exit(1);
});
