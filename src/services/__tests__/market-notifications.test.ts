import { describe, expect, it } from "vitest";
import { createTestDb } from "../../db/test-utils";
import * as schema from "../../db/schema";
import { writeMarketNotifications } from "../market-notifications";
import { getPendingNotifications } from "../../db/repositories/marketplace-repository";
import { eq } from "drizzle-orm";

describe("writeMarketNotifications service", () => {
  it("writes all cards to notifications when lastNotifiedAt is null", async () => {
    const { db } = await createTestDb();

    await db.insert(schema.marketStores).values({
      id: "brandao",
      platform: "liga_store",
      name: "Brandao Card Game",
      baseUrl: "https://www.brandaocardgame.com.br",
      tcgId: "21",
      enabled: true,
      lastCount: 2,
      lastLatestCardRefId: "ref_2",
      lastNotifiedAt: null,
    });

    await db.insert(schema.marketCards).values([
      {
        id: "c1",
        storeId: "brandao",
        rawName: "Flame-Rune Swordsman (#136)",
        cardName: "Flame-Rune Swordsman",
        setPrefix: "FTC",
        price: "R$ 10,00",
        priceNumeric: 10,
        itemId: "ref_1",
        quantity: 1,
        firstSeenAt: new Date("2026-10-21T01:00:00Z"),
      },
      {
        id: "c2",
        storeId: "brandao",
        rawName: "Frostbind (028) (#28b)",
        cardName: "Frostbind",
        setPrefix: "FTC",
        price: "R$ 20,00",
        priceNumeric: 20,
        itemId: "ref_2",
        quantity: 1,
        isFoil: true,
        firstSeenAt: new Date("2026-10-21T01:05:00Z"),
      },
    ]);

    const count = await writeMarketNotifications("brandao", db);

    expect(count).toBe(2);

    const pending = await getPendingNotifications(db);
    expect(pending).toHaveLength(2);
    expect(pending[0].cardName).toBe("Flame-Rune Swordsman");
    expect(pending[0].collectorNumber).toBe("136");
    expect(pending[0].isFoil).toBe(false);
    expect(pending[1].cardName).toBe("Frostbind");
    expect(pending[1].collectorNumber).toBe("28b");
    expect(pending[1].isFoil).toBe(true);

    // Verify lastNotifiedAt was updated
    const [store] = await db
      .select()
      .from(schema.marketStores)
      .where(eq(schema.marketStores.id, "brandao"));
    expect(store.lastNotifiedAt).not.toBeNull();
  });

  it("writes only cards with firstSeenAt > lastNotifiedAt", async () => {
    const { db } = await createTestDb();

    const lastNotified = new Date("2026-10-21T01:30:00Z");

    await db.insert(schema.marketStores).values({
      id: "brandao",
      platform: "liga_store",
      name: "Brandao Card Game",
      baseUrl: "https://www.brandaocardgame.com.br",
      enabled: true,
      lastNotifiedAt: lastNotified,
    });

    await db.insert(schema.marketCards).values([
      {
        id: "c1",
        storeId: "brandao",
        rawName: "Old Card (#001)",
        cardName: "Old Card",
        setPrefix: "FTC",
        price: "R$ 5,00",
        priceNumeric: 5,
        itemId: "ref_old",
        firstSeenAt: new Date("2026-10-21T01:00:00Z"), // before lastNotified
      },
      {
        id: "c2",
        storeId: "brandao",
        rawName: "New Card (#002)",
        cardName: "New Card",
        setPrefix: "FTC",
        price: "R$ 15,00",
        priceNumeric: 15,
        itemId: "ref_new",
        firstSeenAt: new Date("2026-10-21T02:00:00Z"), // after lastNotified
      },
    ]);

    const count = await writeMarketNotifications("brandao", db);

    expect(count).toBe(1);

    const pending = await getPendingNotifications(db);
    expect(pending).toHaveLength(1);
    expect(pending[0].cardName).toBe("New Card");
    expect(pending[0].collectorNumber).toBe("002");
  });

  it("returns 0 and does not update lastNotifiedAt when no new cards exist", async () => {
    const { db } = await createTestDb();

    const lastNotified = new Date("2026-10-21T03:00:00Z");

    await db.insert(schema.marketStores).values({
      id: "brandao",
      platform: "liga_store",
      name: "Brandao Card Game",
      baseUrl: "https://www.brandaocardgame.com.br",
      enabled: true,
      lastNotifiedAt: lastNotified,
    });

    await db.insert(schema.marketCards).values([
      {
        id: "c1",
        storeId: "brandao",
        rawName: "Old Card (#001)",
        cardName: "Old Card",
        setPrefix: "FTC",
        price: "R$ 5,00",
        priceNumeric: 5,
        itemId: "ref_old",
        firstSeenAt: new Date("2026-10-21T01:00:00Z"),
      },
    ]);

    const count = await writeMarketNotifications("brandao", db);

    expect(count).toBe(0);

    const pending = await getPendingNotifications(db);
    expect(pending).toHaveLength(0);

    const [store] = await db
      .select()
      .from(schema.marketStores)
      .where(eq(schema.marketStores.id, "brandao"));
    // timestamp preserved
    expect(new Date(store.lastNotifiedAt!).getTime()).toBe(lastNotified.getTime());
  });

  it("returns 0 if store does not exist", async () => {
    const { db } = await createTestDb();
    const count = await writeMarketNotifications("non-existent-store", db);
    expect(count).toBe(0);
  });
});
