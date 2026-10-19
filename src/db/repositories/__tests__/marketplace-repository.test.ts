import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../test-utils";
import { cards, marketCards, marketStores } from "../../schema";
import {
  getMarketCards,
  getMarketStoreById,
  getMarketStores,
  reconcileStoreListings,
  updateStoreCount,
  updateStoreFullScanAt,
  upsertMarketCards,
} from "../marketplace-repository";

const baseListing = {
  storeId: "myp",
  rawName: "Fractured Crown - Fireball",
  cardName: "Fireball",
  setPrefix: "FTC",
  quantity: 1,
  price: "R$ 10,00",
  priceNumeric: 10,
  quality: "NM",
  isFoil: false,
  vendorName: "MyP Cards",
  vendorUrl: "https://mypcards.com",
};

describe("marketplace repository", () => {
  let testDb: any;

  beforeEach(async () => {
    const { db } = await createTestDb();
    testDb = db;

    await testDb.delete(marketCards);
    await testDb.delete(marketStores);

    await testDb.insert(cards).values([
      {
        slug: "fireball",
        name: "Fireball",
        element: "FIRE",
        class: "MAGE",
        type: "ACTION",
      },
      {
        slug: "flame-rune",
        name: "Flame Rune",
        element: "FIRE",
        class: "WARRIOR",
        type: "ITEM",
      },
    ]);

    await testDb.insert(marketStores).values([
      {
        id: "myp",
        platform: "myp",
        name: "MyP Cards",
        baseUrl: "https://mypcards.com",
        tcgId: "grandarchive",
        enabled: true,
      },
      {
        id: "disabled-store",
        platform: "liga_store",
        name: "Disabled Store",
        baseUrl: "https://example.com",
        enabled: false,
      },
    ]);
  });

  it("returns stores and supports enabled-only filtering", async () => {
    const allStores = await getMarketStores(testDb);
    const enabledStores = await getMarketStores(testDb, true);

    expect(allStores).toHaveLength(2);
    expect(enabledStores).toHaveLength(1);
    expect(enabledStores[0].id).toBe("myp");

    const store = await getMarketStoreById("myp", testDb);

    expect(store).toMatchObject({
      id: "myp",
      platform: "myp",
      name: "MyP Cards",
      tcgId: "grandarchive",
      enabled: true,
    });
  });

  it("updates store count and scan timestamps", async () => {
    const checkedAt = new Date("2026-01-01T10:00:00.000Z");
    const scannedAt = new Date("2026-01-01T11:00:00.000Z");

    await updateStoreCount("myp", 42, checkedAt, testDb);
    await updateStoreFullScanAt("myp", scannedAt, testDb);

    const store = await getMarketStoreById("myp", testDb);

    expect(store?.lastCount).toBe(42);
    expect(store?.lastCountCheckedAt).toEqual(checkedAt);
    expect(store?.lastFullScanAt).toEqual(scannedAt);
  });

  it("inserts listings and upserts them by storeId and itemId", async () => {
    await upsertMarketCards(
      [
        {
          ...baseListing,
          id: "myp-item-1",
          itemId: "item-1",
        },
      ],
      testDb
    );

    await upsertMarketCards(
      [
        {
          ...baseListing,
          id: "different-primary-id",
          itemId: "item-1",
          quantity: 3,
          price: "R$ 12,50",
          priceNumeric: 12.5,
          isFoil: true,
        },
      ],
      testDb
    );

    const listings = await getMarketCards({ storeId: "myp" }, testDb);

    expect(listings).toHaveLength(1);
    expect(listings[0]).toMatchObject({
      id: "myp-item-1",
      itemId: "item-1",
      quantity: 3,
      price: "R$ 12,50",
      priceNumeric: 12.5,
      isFoil: true,
    });
  });

  it("marks unobserved active listings as out of stock", async () => {
    await upsertMarketCards(
      [
        {
          ...baseListing,
          id: "myp-item-1",
          itemId: "item-1",
          quantity: 2,
        },
        {
          ...baseListing,
          id: "myp-item-2",
          itemId: "item-2",
          quantity: 4,
        },
      ],
      testDb
    );

    await reconcileStoreListings("myp", ["item-1"], testDb);

    const listings = await getMarketCards({ storeId: "myp" }, testDb);
    const retained = listings.find((listing) => listing.itemId === "item-1");
    const removed = listings.find((listing) => listing.itemId === "item-2");

    expect(retained?.quantity).toBe(2);
    expect(removed?.quantity).toBe(0);
  });

  it("filters market cards by store, card slug, and stock status", async () => {
    await upsertMarketCards(
      [
        {
          ...baseListing,
          id: "in-stock-card",
          itemId: "in-stock",
          cardSlug: "fireball",
          quantity: 2,
        },
        {
          ...baseListing,
          id: "out-of-stock-card",
          itemId: "out-of-stock",
          cardSlug: "fireball",
          quantity: 0,
        },
        {
          ...baseListing,
          id: "different-card",
          itemId: "different-card",
          cardSlug: "flame-rune",
          quantity: 1,
        },
      ],
      testDb
    );

    const inStockFireballs = await getMarketCards(
      {
        storeId: "myp",
        cardSlug: "fireball",
        inStockOnly: true,
      },
      testDb
    );

    expect(inStockFireballs).toHaveLength(1);
    expect(inStockFireballs[0]).toMatchObject({
      id: "in-stock-card",
      cardSlug: "fireball",
      quantity: 2,
    });

    const allFireballs = await getMarketCards(
      {
        storeId: "myp",
        cardSlug: "fireball",
      },
      testDb
    );

    expect(allFireballs).toHaveLength(2);
  });

  it("reconciles every active listing when a full scan observes no item IDs", async () => {
    await upsertMarketCards(
      [
        {
          ...baseListing,
          id: "myp-item-1",
          itemId: "item-1",
          quantity: 1,
        },
      ],
      testDb
    );

    await reconcileStoreListings("myp", [], testDb);

    const listings = await getMarketCards(
      {
        storeId: "myp",
        inStockOnly: true,
      },
      testDb
    );

    expect(listings).toHaveLength(0);
  });
});
