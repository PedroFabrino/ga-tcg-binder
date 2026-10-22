import { runMigrations } from "../src/db/init";
import { syncFeaturedSetsFromApi } from "../src/services/featured-set-sync";

async function main() {
  console.log("=== Initializing Database Schema ===");
  await runMigrations();
  console.log("Schema initialized successfully.");

  console.log("=== Starting Featured Sets Synchronization from api.gatcg.com ===");
  const stats = await syncFeaturedSetsFromApi();

  console.log("=== Featured Sets Synchronization Finished ===");
  console.log(`- Featured Set Groups Synced: ${stats.featuredSetGroupsSynced}`);
  console.log(`- Set Definitions Synced: ${stats.setDefinitionsSynced}`);
}

main().catch((err) => {
  console.error("Error during featured sets sync:", err);
  process.exit(1);
});
