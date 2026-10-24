import { runMigrations } from "../src/db/init";
import { db } from "../src/db";
import { ensureDefaultUserAndSeed } from "../src/services/seed";
import { runMarketSync } from "../src/services/market-sync-runner";

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

async function main() {
  console.log("=== Initializing Database Schema & Stores ===");
  await runMigrations();
  await ensureDefaultUserAndSeed(db);
  console.log("Schema initialized successfully.");

  const requestedStoreId = readStoreIdArgument(process.argv.slice(2));
  await runMarketSync({ storeId: requestedStoreId, database: db });
}

main().catch((err) => {
  console.error("Error during marketplace sync:", err);
  process.exit(1);
});
