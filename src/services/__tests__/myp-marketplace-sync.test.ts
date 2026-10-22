import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

import { createTestDb } from "../../db/test-utils";
import { cardEditions, cards, marketCards, marketStores } from "../../db/schema";
import { syncGlobalMarketplace } from "../myp-sync";

const CARD_A = {
  itemId: "grandarchive_alc_010",
  productUrl: "/grandarchive/produto/101/dungeon-guide",
  name: "Dungeon Guide",
  setPrefix: "ALC",
  quantity: 6,
  price: "R$ 5,00",
};

const CARD_B = {
  itemId: "grandarchive_alc_020",
  productUrl: "/grandarchive/produto/102/fire-ball",
  name: "Fire Ball",
  setPrefix: "ALC",
  quantity: 3,
  price: "R$ 1,50",
};

function cardBlock(card: typeof CARD_A): string {
  return `
    <div class="card" data-ga-item-id="${card.itemId}">
      <a class="card-img-link" href="${card.productUrl}"></a>
      <div class="card-name"><h3>${card.name}</h3></div>
      <span class="card-edicao">${card.setPrefix}</span>
      <span class="quantidade-num">${card.quantity}</span>
      <span class="card-preco moeda">${card.price}</span>
    </div>
  `;
}

function pageHtml(cardsInPage: Array<typeof CARD_A>, total: number): string {
  return `
    <div class="summary"><strong>${total}</strong> itens encontrados.</div>
    ${cardsInPage.map(cardBlock).join("\n")}
  `;
}

async function seedCatalog(db: Awaited<ReturnType<typeof createTestDb>>["db"]) {
  await db.insert(cards).values([
    {
      slug: "dungeon-guide",
      name: "Dungeon Guide",
      element: "NORM",
      class: "WARRIOR",
      type: "ALLY",
    },
    {
      slug: "fire-ball",
      name: "Fire Ball",
      element: "FIRE",
      class: "MAGE",
      type: "ACTION",
    },
  ]);

  await db.insert(cardEditions).values([
    {
      id: "alc-010",
      cardSlug: "dungeon-guide",
      setPrefix: "ALC",
      setName: "Alchemical Revolution",
      collectorNumber: "010",
      rarity: 1,
      imageUrl: "https://example.com/dungeon-guide.jpg",
    },
    {
      id: "alc-020",
      cardSlug: "fire-ball",
      setPrefix: "ALC",
      setName: "Alchemical Revolution",
      collectorNumber: "020",
      rarity: 1,
      imageUrl: "https://example.com/fire-ball.jpg",
    },
  ]);
}

describe("syncGlobalMarketplace listing parity", () => {
  it("upserts listings, preserves firstSeenAt, and reconciles removed stock", async () => {
    const { db } = await createTestDb();
    await seedCatalog(db);
    await db.delete(marketCards);

    const firstFetch = vi.fn(async () => new Response(pageHtml([CARD_A, CARD_B], 2)));

    const firstResult = await syncGlobalMarketplace(
      db,
      firstFetch as unknown as typeof fetch
    );

    expect(firstResult).toMatchObject({
      totalSynced: 2,
      matchedCount: 2,
      totalCount: 2,
      complete: true,
    });

    const afterFirstScan = await db.select().from(marketCards);
    const cardABefore = afterFirstScan.find((row) => row.itemId === CARD_A.itemId);
    expect(cardABefore?.quantity).toBe(6);
    expect(cardABefore?.firstSeenAt).toBeInstanceOf(Date);

    const updatedCardA = { ...CARD_A, price: "R$ 7,00" };
    const secondFetch = vi.fn(async () => new Response(pageHtml([updatedCardA], 1)));

    const secondResult = await syncGlobalMarketplace(
      db,
      secondFetch as unknown as typeof fetch
    );

    expect(secondResult).toMatchObject({
      totalSynced: 1,
      matchedCount: 1,
      totalCount: 1,
      complete: true,
    });

    const afterSecondScan = await db.select().from(marketCards);
    expect(afterSecondScan).toHaveLength(2);

    const cardAAfter = afterSecondScan.find((row) => row.itemId === CARD_A.itemId);
    const cardBAfter = afterSecondScan.find((row) => row.itemId === CARD_B.itemId);

    expect(cardAAfter?.quantity).toBe(6);
    expect(cardAAfter?.price).toBe("R$ 7,00");
    expect(cardAAfter?.firstSeenAt?.getTime()).toBe(
      cardABefore?.firstSeenAt?.getTime()
    );
    expect(cardAAfter?.lastSeenAt?.getTime()).toBeGreaterThanOrEqual(
      cardABefore?.firstSeenAt?.getTime() ?? 0
    );

    expect(cardBAfter?.quantity).toBe(0);

    const [store] = await db
      .select()
      .from(marketStores)
      .where(eq(marketStores.id, "myp"));
    expect(store.lastCount).toBe(1);
    expect(store.lastFullScanAt).toBeInstanceOf(Date);
  });

  it("skips reconciliation when a later page fails", async () => {
    const { db } = await createTestDb();
    await seedCatalog(db);
    await db.delete(marketCards);

    const firstFetch = vi.fn(async () => new Response(pageHtml([CARD_A, CARD_B], 2)));
    await syncGlobalMarketplace(db, firstFetch as unknown as typeof fetch);

    const partialFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/produto/load-more")) {
        throw new Error("page 2 unavailable");
      }
      return new Response(pageHtml([CARD_A], 60));
    });

    const partialResult = await syncGlobalMarketplace(
      db,
      partialFetch as unknown as typeof fetch
    );

    expect(partialResult.complete).toBe(false);

    const rows = await db.select().from(marketCards);
    const cardB = rows.find((row) => row.itemId === CARD_B.itemId);
    expect(cardB?.quantity).toBe(3);
  });

  it("treats a catalog larger than the page ceiling as incomplete", async () => {
    const { db } = await createTestDb();
    await seedCatalog(db);
    await db.delete(marketCards);

    const firstFetch = vi.fn(async () => new Response(pageHtml([CARD_A, CARD_B], 2)));
    await syncGlobalMarketplace(db, firstFetch as unknown as typeof fetch);

    // 2260 items = 76 pages, which exceeds the 75-page ceiling.
    const truncatedFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/produto/load-more")) {
        return new Response("", { status: 200 });
      }
      return new Response(pageHtml([CARD_A], 2260));
    });

    const result = await syncGlobalMarketplace(
      db,
      truncatedFetch as unknown as typeof fetch
    );

    expect(result.complete).toBe(false);

    const rows = await db.select().from(marketCards);
    const cardB = rows.find((row) => row.itemId === CARD_B.itemId);
    expect(cardB?.quantity).toBe(3);
  });
});
