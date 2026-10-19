import { spawn, type ChildProcess } from "node:child_process";

const rawInterval = Number(process.env.SYNC_INTERVAL_MINUTES ?? "60");
const intervalMinutes =
  Number.isFinite(rawInterval) && rawInterval > 0 ? rawInterval : 60;

const intervalMs = Math.floor(intervalMinutes * 60 * 1000);

let timer: NodeJS.Timeout | undefined;
let currentSync: ChildProcess | undefined;
let stopping = false;

function runSync(): Promise<void> {
  if (stopping || currentSync) {
    return Promise.resolve();
  }

  console.log(`[sync-daemon] Starting market sync at ${new Date().toISOString()}`);

  return new Promise((resolve) => {
    currentSync = spawn(
      "pnpm",
      ["exec", "tsx", "scripts/sync-market.ts"],
      {
        stdio: "inherit",
        env: process.env,
      }
    );

    currentSync.once("error", (error) => {
      console.error("[sync-daemon] Failed to start sync:", error);
      currentSync = undefined;
      resolve();
    });

    currentSync.once("close", (code, signal) => {
      if (code === 0) {
        console.log("[sync-daemon] Market sync completed successfully");
      } else {
        console.error(
          `[sync-daemon] Market sync exited with code=${code}, signal=${signal}`
        );
      }

      currentSync = undefined;
      resolve();
    });
  });
}

function shutdown(signal: string) {
  if (stopping) return;

  stopping = true;
  console.log(`[sync-daemon] Received ${signal}; shutting down...`);

  if (timer) {
    clearInterval(timer);
  }

  if (currentSync && !currentSync.killed) {
    currentSync.kill("SIGTERM");
  }

  process.exit(0);
}

async function main() {
  console.log(`[sync-daemon] Sync interval: ${intervalMinutes} minute(s)`);

  await runSync();

  if (!stopping) {
    timer = setInterval(() => {
      void runSync();
    }, intervalMs);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

void main();
