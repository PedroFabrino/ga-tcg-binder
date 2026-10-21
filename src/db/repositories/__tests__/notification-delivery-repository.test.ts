import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it } from "vitest";
import * as schema from "../../schema";
import { runMigrations } from "../../init";
import { createTestDb } from "../../test-utils";
import {
 marketNotifications,
 marketStores,
 notificationDeliveries,
} from "../../schema";
import {
 DISCORD_DESTINATION,
 getUndeliveredNotifications,
 markNotificationsDelivered,
} from "../notification-delivery-repository";

function buildNotification(id: string, createdAt = new Date()) {
 return {
  id,
  storeId: "brandao",
  cardName: `Card ${id}`,
  setPrefix: "FTC",
  collectorNumber: "001",
  isFoil: false,
  price: "R$ 10,00",
  refId: `ref-${id}`,
  imageUrl: null,
  detectedAt: new Date("2026-10-21T00:00:00Z"),
  sentAt: null,
  messageId: null,
  createdAt,
 };
}

describe("notification-delivery-repository", () => {
 it("creates the notification_deliveries table via migrations", async () => {
  const { db } = await createTestDb();

  const rows = await db.select().from(notificationDeliveries);
  expect(rows).toEqual([]);
 });

 it("returns notifications without a delivery for the destination", async () => {
  const { db } = await createTestDb();

  await db.insert(marketStores).values({
   id: "brandao",
   platform: "myp",
   name: "MyP Cards",
   baseUrl: "https://mypcards.com",
  });
  await db.insert(marketNotifications).values([
   buildNotification("n1", new Date("2026-10-21T01:00:00Z")),
   buildNotification("n2", new Date("2026-10-21T02:00:00Z")),
  ]);

  const undelivered = await getUndeliveredNotifications(DISCORD_DESTINATION, db);
  expect(undelivered.map((n) => n.id)).toEqual(["n1", "n2"]);
 });

 it("excludes notifications already delivered to the destination", async () => {
  const { db } = await createTestDb();

  await db.insert(marketStores).values({
   id: "brandao",
   platform: "myp",
   name: "MyP Cards",
   baseUrl: "https://mypcards.com",
  });
  await db.insert(marketNotifications).values([
   buildNotification("n1", new Date("2026-10-21T01:00:00Z")),
   buildNotification("n2", new Date("2026-10-21T02:00:00Z")),
  ]);

  await markNotificationsDelivered(["n1"], DISCORD_DESTINATION, "msg-1", undefined, db);

  const undelivered = await getUndeliveredNotifications(DISCORD_DESTINATION, db);
  expect(undelivered.map((n) => n.id)).toEqual(["n2"]);
 });

 it("does not affect other destinations when one destination is delivered", async () => {
  const { db } = await createTestDb();

  await db.insert(marketStores).values({
   id: "brandao",
   platform: "myp",
   name: "MyP Cards",
   baseUrl: "https://mypcards.com",
  });
  await db.insert(marketNotifications).values([buildNotification("n1")]);

  await markNotificationsDelivered(["n1"], DISCORD_DESTINATION, "msg-1", undefined, db);

  const discord = await getUndeliveredNotifications(DISCORD_DESTINATION, db);
  const email = await getUndeliveredNotifications("email", db);

  expect(discord).toHaveLength(0);
  expect(email.map((n) => n.id)).toEqual(["n1"]);
 });

 it("markNotificationsDelivered is idempotent", async () => {
  const { db } = await createTestDb();

  await db.insert(marketStores).values({
   id: "brandao",
   platform: "myp",
   name: "MyP Cards",
   baseUrl: "https://mypcards.com",
  });
  await db.insert(marketNotifications).values([buildNotification("n1")]);

  await markNotificationsDelivered(["n1"], DISCORD_DESTINATION, "msg-1", undefined, db);
  await markNotificationsDelivered(["n1"], DISCORD_DESTINATION, "msg-1", undefined, db);

  const rows = await db.select().from(notificationDeliveries);
  expect(rows).toHaveLength(1);
  expect(rows[0].messageId).toBe("msg-1");
 });
});

describe("notification_deliveries migration backfill", () => {
 it("backfills pre-existing outbox rows as delivered to discord", async () => {
  // Phase 1: simulate a database that already has market_notifications rows
  // but predates the notification_deliveries table.
  // We also pre-create the myp_market_cards table because the legacy
  // migration 0000 references it in an INSERT ... SELECT statement.
  // Note: LibSQL execute() does not support multi-statement batches, so
  // each statement is executed individually.
  const client = createClient({ url: ":memory:" });

  const createMarketStores = `
    CREATE TABLE market_stores (
      id text PRIMARY KEY NOT NULL,
      platform text NOT NULL,
      name text NOT NULL,
      base_url text NOT NULL,
      tcg_id text,
      enabled integer DEFAULT true NOT NULL,
      last_count integer,
      last_count_checked_at integer,
      last_full_scan_at integer,
      last_latest_card_ref_id text,
      last_notified_at integer,
      updated_at integer DEFAULT (strftime('%s', 'now'))
    )`;
  const createMarketNotifications = `
    CREATE TABLE market_notifications (
      id text PRIMARY KEY NOT NULL,
      store_id text NOT NULL,
      card_name text NOT NULL,
      set_prefix text NOT NULL,
      collector_number text NOT NULL,
      is_foil integer DEFAULT false NOT NULL,
      price text NOT NULL,
      ref_id text NOT NULL,
      image_url text,
      detected_at integer NOT NULL,
      sent_at integer,
      message_id text,
      created_at integer DEFAULT (strftime('%s', 'now')) NOT NULL
    )`;
  const createMypMarketCards = `
    CREATE TABLE myp_market_cards (
      id text PRIMARY KEY NOT NULL,
      card_slug text,
      edition_id text,
      raw_name text NOT NULL,
      card_name text NOT NULL,
      set_prefix text NOT NULL,
      quantity integer DEFAULT 1 NOT NULL,
      price text DEFAULT 'R$ 0,00' NOT NULL,
      price_numeric real DEFAULT 0 NOT NULL,
      tcg_price text,
      tcg_price_numeric real,
      is_foil integer DEFAULT false NOT NULL,
      myp_item_id text,
      myp_product_url text,
      vendor_name text,
      vendor_url text,
      updated_at integer DEFAULT (strftime('%s', 'now'))
    )`;
  const insertStore = `INSERT INTO market_stores (id, platform, name, base_url) VALUES ('myp', 'myp', 'MyP Cards', 'https://mypcards.com')`;
  const insertNotification = `INSERT INTO market_notifications (id, store_id, card_name, set_prefix, collector_number, is_foil, price, ref_id, detected_at) VALUES ('mock-test-001', 'myp', 'Test Card', 'FTC', '1', 0, 'R$ 1,00', 'r1', 0)`;

  await client.execute(createMarketStores);
  await client.execute(createMarketNotifications);
  await client.execute(createMypMarketCards);
  await client.execute(insertStore);
  await client.execute(insertNotification);

  // Phase 2: run the full migration, which creates notification_deliveries
  // and backfills the existing row as already delivered.
  await runMigrations(client);

  const db = drizzle(client, { schema });
  const deliveries = await db.select().from(notificationDeliveries);

  expect(deliveries).toHaveLength(1);
  expect(deliveries[0].notificationId).toBe("mock-test-001");
  expect(deliveries[0].destination).toBe("discord");
  expect(deliveries[0].messageId).toBeNull();

  // The backfilled row must not be selected as undelivered for discord.
  const undelivered = await getUndeliveredNotifications("discord", db);
  expect(undelivered).toHaveLength(0);
 });
});
