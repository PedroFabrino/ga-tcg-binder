/**
 * test-mock-notification
 * ------------------------------------------------------------------
 * Inserts a mock store + cards into the live database, generates
 * notification outbox rows, then fires the Discord webhook sink.
 *
 * The Root bot (polling separately) will pick up the same outbox
 * rows and post them to the configured Root community channel.
 *
 * By default the script waits 30 s for the Root bot to poll, then
 * cleans up all mock data.
 *
 * Usage:
 *   npx tsx scripts/test-mock-notification.ts              # default wait + cleanup
 *   npx tsx scripts/test-mock-notification.ts --wait 60    # wait 60 s
 *   npx tsx scripts/test-mock-notification.ts --keep       # no cleanup
 *   npx tsx scripts/test-mock-notification.ts --no-discord # skip webhook, just outbox
 */

import { eq } from "drizzle-orm";
import { runMigrations } from "../src/db/init";
import { db } from "../src/db";
import {
  marketCards,
  marketNotifications,
  marketStores,
  notificationDeliveries,
} from "../src/db/schema";
import {
  getPendingNotifications,
} from "../src/db/repositories/marketplace-repository";
import { getUndeliveredNotifications } from "../src/db/repositories/notification-delivery-repository";
import { writeMarketNotifications } from "../src/services/market-notifications";
import { deliverDiscordNotifications } from "../src/services/discord-market-notifier";
import {
  formatMarketNotificationMessage,
  groupMarketNotificationsByStore,
} from "../src/services/market-notification-formatter";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MOCK_STORE_ID = "mock-test-store";
const MOCK_STORE_NAME = "🧪 Mock Test Store";

const MOCK_CARDS = [
  {
    id: "mock-card-001",
    cardName: "Dungeon Guide",
    setPrefix: "FTC",
    rawName: "Dungeon Guide (Core Starter) (# FTC-001)",
    price: "R$ 2,50",
    priceNumeric: 2.5,
    isFoil: false,
  },
  {
    id: "mock-card-002",
    cardName: "Spellfire Arcanist",
    setPrefix: "FTC",
    rawName: "Spellfire Arcanist (Foil) (# FTC-042)",
    price: "R$ 15,00",
    priceNumeric: 15.0,
    isFoil: true,
  },
  {
    id: "mock-card-003",
    cardName: "Eternal Guardian",
    setPrefix: "MBC",
    rawName: "Eternal Guardian (# MBC-007)",
    price: "R$ 38,90",
    priceNumeric: 38.9,
    isFoil: false,
  },
];

function parseArgs(argv: string[]) {
  const keep = argv.includes("--keep");
  const noDiscord = argv.includes("--no-discord");
  let waitSec = 30;

  const waitIdx = argv.indexOf("--wait");
  if (waitIdx !== -1 && argv.length > waitIdx + 1) {
    const parsed = Number(argv[waitIdx + 1]);
    if (!Number.isNaN(parsed) && parsed >= 0) waitSec = parsed;
  }

  return { keep, noDiscord, waitSec };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log("=== Mock Notification Test ===\n");
  await runMigrations();

  // ------------------------------------------------------------------
  // 1. Insert mock store
  // ------------------------------------------------------------------
  console.log(`[1/5] Inserting mock store "${MOCK_STORE_ID}" …`);

  const existingStore = await db
    .select({ id: marketStores.id })
    .from(marketStores)
    .where(eq(marketStores.id, MOCK_STORE_ID));

  if (existingStore.length > 0) {
    await db
      .update(marketStores)
      .set({ lastNotifiedAt: new Date("2020-01-01") })
      .where(eq(marketStores.id, MOCK_STORE_ID));
    console.log("  Store exists — reset lastNotifiedAt.");
  } else {
    await db.insert(marketStores).values({
      id: MOCK_STORE_ID,
      platform: "myp",
      name: MOCK_STORE_NAME,
      baseUrl: "https://mypcards.com",
      enabled: true,
      lastNotifiedAt: new Date("2020-01-01"),
    });
    console.log("  Store created.");
  }

  // ------------------------------------------------------------------
  // 2. Insert mock cards
  // ------------------------------------------------------------------
  console.log(`  Inserting ${MOCK_CARDS.length} mock cards …`);

  const now = new Date();
  for (const card of MOCK_CARDS) {
    // Remove any leftover from a previous run.
    await db.delete(marketCards).where(eq(marketCards.id, card.id));

    await db.insert(marketCards).values({
      id: card.id,
      storeId: MOCK_STORE_ID,
      rawName: card.rawName,
      cardName: card.cardName,
      setPrefix: card.setPrefix,
      price: card.price,
      priceNumeric: card.priceNumeric,
      isFoil: card.isFoil,
      firstSeenAt: now,
      lastSeenAt: now,
    });
  }
  console.log("  Done.");

  // ------------------------------------------------------------------
  // 3. Write outbox & preview messages
  // ------------------------------------------------------------------
  console.log("\n[2/5] Writing notification outbox rows …");
  const written = await writeMarketNotifications(MOCK_STORE_ID, db);
  console.log(`  ${written} notification(s) written.`);

  console.log("\n[3/5] Root bot message preview:");
  const pending = await getPendingNotifications(db);
  const mockPending = pending.filter((n) => n.storeId === MOCK_STORE_ID);

  if (mockPending.length === 0) {
    console.log("  (no pending — all already sent)");
  } else {
    const byStore = groupMarketNotificationsByStore(mockPending);
    for (const [, notifications] of byStore) {
      const msg = formatMarketNotificationMessage(
        notifications,
        MOCK_STORE_NAME,
        new Date()
      );
      console.log("  ---");
      console.log(msg.replace(/^/gm, "  "));
      console.log("  ---\n");
    }
  }

  // ------------------------------------------------------------------
  // 4. Fire Discord webhook
  // ------------------------------------------------------------------
  console.log("[4/5] Discord notifications:");

  if (args.noDiscord) {
    console.log("  Skipped (--no-discord).");
  } else {
    const undelivered = await getUndeliveredNotifications("discord", db);
    const mockUndelivered = undelivered.filter(
      (n) => n.storeId === MOCK_STORE_ID
    );
    console.log(`  ${mockUndelivered.length} undelivered for mock store.`);

    const discord = await deliverDiscordNotifications(db);
    if (discord.disabled) {
      console.warn("  DISABLED — set DISCORD_WEBHOOK to send real messages.");
    } else {
      console.log(
        `  Sent: ${discord.delivered}/${discord.attempted} delivered.`
      );
    }
  }

  // ------------------------------------------------------------------
  // 5. Wait for Root bot & cleanup
  // ------------------------------------------------------------------
  console.log(
    `\n[5/5] Waiting ${args.waitSec}s for Root bot to pick up pending rows …`
  );

  if (args.waitSec > 0) {
    for (let i = args.waitSec; i > 0; i -= 5) {
      await sleep(5000);
      const remaining = await getPendingNotifications(db);
      const mockRemaining = remaining.filter(
        (n) => n.storeId === MOCK_STORE_ID
      );
      console.log(
        `  ${Math.max(0, i - 5)}s left — ${mockRemaining.length} pending.`
      );
    }
  }

  if (args.keep) {
    console.log("\n--keep set — skipping cleanup.");
    console.log(`  Mock store ID: ${MOCK_STORE_ID}`);
    console.log("  Cleanup SQL:");
    console.log(
      `    DELETE FROM notification_deliveries WHERE notification_id IN (SELECT id FROM market_notifications WHERE store_id = '${MOCK_STORE_ID}');`
    );
    console.log(
      `    DELETE FROM market_notifications WHERE store_id = '${MOCK_STORE_ID}';`
    );
    console.log(`    DELETE FROM market_cards WHERE store_id = '${MOCK_STORE_ID}';`);
    console.log(`    DELETE FROM market_stores WHERE id = '${MOCK_STORE_ID}';`);
    return;
  }

  // ------------------------------------------------------------------
  // Cleanup
  // ------------------------------------------------------------------
  console.log("\nCleaning up …");

  const mockNotifRows = await db
    .select({ id: marketNotifications.id })
    .from(marketNotifications)
    .where(eq(marketNotifications.storeId, MOCK_STORE_ID));

  for (const row of mockNotifRows) {
    await db
      .delete(notificationDeliveries)
      .where(eq(notificationDeliveries.notificationId, row.id));
  }

  await db
    .delete(marketNotifications)
    .where(eq(marketNotifications.storeId, MOCK_STORE_ID));
  await db.delete(marketCards).where(eq(marketCards.storeId, MOCK_STORE_ID));
  await db.delete(marketStores).where(eq(marketStores.id, MOCK_STORE_ID));

  console.log("✓ Mock data removed.\n");
  console.log("=== Done ===");
}

main().catch((err) => {
  console.error("Test script failed:", err);
  process.exit(1);
});
