import { spawn, type ChildProcess } from "node:child_process";
import { checkMarketStores } from "../src/services/market-check";
import { db } from "../src/db";

const pollIntervalMinutes =
  Number(process.env.CHECK_INTERVAL_MINUTES ?? "5") || 5;
const pollIntervalMs = pollIntervalMinutes * 60 * 1000;

const fullSyncIntervalHours =
  Number(process.env.FULL_SYNC_HOURS ?? "6") || 6;
const fullSyncIntervalMs = fullSyncIntervalHours * 60 * 60 * 1000;

let timer: NodeJS.Timeout | undefined;
let fullSyncTimer: NodeJS.Timeout | undefined;
let currentSync: ChildProcess | undefined;
let isChecking = false;
let stopping = false;

function runSync(storeId?: string): Promise<void> {
  if (stopping || currentSync) {
    return Promise.resolve();
  }

  const args = ["exec", "tsx", "scripts/sync-market.ts"];
  if (storeId) {
    args.push("--store", storeId);
  }

  const target = storeId ? `store "${storeId}"` : "all stores";
  console.log(
    `[sync-daemon] Starting full market sync for ${target} at ${new Date().toISOString()}`
  );

  return new Promise((resolve) => {
    currentSync = spawn("pnpm", args, {
      stdio: "inherit",
      env: process.env,
    });

    currentSync.once("error", (error) => {
      console.error(`[sync-daemon] Failed to start sync for ${target}:`, error);
      currentSync = undefined;
      resolve();
    });

    currentSync.once("close", (code, signal) => {
      if (code === 0) {
        console.log(
          `[sync-daemon] Market sync for ${target} completed successfully.`
        );
      } else {
        console.error(
          `[sync-daemon] Market sync for ${target} exited with code=${code}, signal=${signal}`
        );
      }
      currentSync = undefined;
      resolve();
    });
  });
}

async function performCheck() {
  if (stopping || isChecking || currentSync) {
    return;
  }

  isChecking = true;
  const startIso = new Date().toISOString();
  console.log(`[sync-daemon] [${startIso}] Polling marketplace store counts...`);

  try {
    const report = await checkMarketStores(db);
    const summary = report.stores
      .map((s) => {
        if (s.error) {
          return `${s.storeId}: error (${s.error})`;
        }
        return `${s.storeId}: ${s.observedCount ?? "?"}${s.changed ? " (changed!)" : ""}`;
      })
      .join(", ");

    console.log(
      `[sync-daemon] [${new Date().toISOString()}] Poll complete -> [${summary}]`
    );

    for (const change of report.changes) {
      console.log(
        `[sync-daemon] Count change detected for store "${change.storeId}": ${
          change.previousCount ?? 0
        } -> ${change.observedCount}. Triggering full sync...`
      );
      await runSync(change.storeId);
    }
  } catch (error) {
    console.error("[sync-daemon] Error checking market stores:", error);
  } finally {
    isChecking = false;
  }
}

function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  console.log(`[sync-daemon] Received ${signal}; shutting down...`);

  if (timer) clearInterval(timer);
  if (fullSyncTimer) clearInterval(fullSyncTimer);

  if (currentSync && !currentSync.killed) {
    currentSync.kill("SIGTERM");
  }

  process.exit(0);
}

async function main() {
  console.log(
    `[sync-daemon] Initialized. Polling store card counts every ${pollIntervalMinutes} min; periodic full reconciliation every ${fullSyncIntervalHours} hours.`
  );

  // Initial check on startup
  await performCheck();

  if (!stopping) {
    timer = setInterval(() => {
      void performCheck();
    }, pollIntervalMs);

    fullSyncTimer = setInterval(() => {
      console.log(
        "[sync-daemon] Triggering periodic full reconciliation for all stores..."
      );
      void runSync();
    }, fullSyncIntervalMs);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

void main();
