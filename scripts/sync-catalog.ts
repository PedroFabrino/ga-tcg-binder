import { runMigrations } from "../src/db/init";
import { syncCatalogFromApi } from "../src/services/catalog-sync";

async function main() {
  console.log("=== Initializing Database Schema ===");
  await runMigrations();
  console.log("Schema initialized successfully.");

  console.log("=== Starting Live Catalog Synchronization from api.gatcg.com ===");
  const stats = await syncCatalogFromApi({
    onProgress: (p) => {
      console.log(`[Sync] Page ${p.page}/${p.totalPages} processed (${p.cardsCount} cards recorded)...`);
    },
  });

  console.log("=== Catalog Synchronization Finished ===");
  console.log(`- Cards Synced: ${stats.cardsSynced}`);
  console.log(`- Editions Synced: ${stats.editionsSynced}`);
  console.log(`- Circulations Synced: ${stats.circulationsSynced}`);
  console.log(`- Total Pages: ${stats.pagesFetched}`);
  console.log(`- Duration: ${(stats.durationMs / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error("Error during catalog sync:", err);
  process.exit(1);
});
