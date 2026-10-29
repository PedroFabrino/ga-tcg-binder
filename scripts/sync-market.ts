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

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

async function main() {
  const args = process.argv.slice(2);
  const isPlain = hasFlag(args, "--plain") || hasFlag(args, "--no-dashboard");
  const isSequential = hasFlag(args, "--sequential");
  const requestedStoreId = readStoreIdArgument(args);

  if (isPlain) {
    console.log("=== Initializing Database Schema & Stores ===");
  }
  await runMigrations();
  await ensureDefaultUserAndSeed(db);
  if (isPlain) {
    console.log("Schema initialized successfully.");
  }

  await runMarketSync({
    storeId: requestedStoreId,
    database: db,
    sequential: isSequential,
    showDashboard: !isPlain,
  });
}

main().catch((err) => {
  console.error("Error during marketplace sync:", err);
  process.exit(1);
});
