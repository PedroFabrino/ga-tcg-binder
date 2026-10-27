import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "../../db/test-utils";
import * as schema from "../../db/schema";
import {
  checkMarketStores,
  parseMypLatestCardRefId,
  resetMarketCheckBackoff,
} from "../market-check";
import { eq } from "drizzle-orm";

beforeEach(() => {
  resetMarketCheckBackoff();
});

describe("checkMarketStores dual change detection", () => {

  it("uses a single request for MyP count and latest-card detection", async () => {
    const { db } = await createTestDb();

    // Default myp store is enabled with id="myp", platform="myp"
    const requestedUrls: string[] = [];
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      requestedUrls.push(url);
      return {
        ok: true,
        text: async () => `
          <div class="summary"><strong>500</strong> itens</div>
        `,
      };
    });

    const report = await checkMarketStores(db, mockFetch as any);

    const mypResult = report.stores.find((s) => s.storeId === "myp");
    expect(mypResult).toBeDefined();
    expect(mypResult?.observedCount).toBe(500);

    // MyP has no separate latest-additions page; the catalog page is used.
    expect(requestedUrls).toHaveLength(1);
    const latestUrls = requestedUrls.filter((u) => u.includes("txt_order=12"));
    expect(latestUrls).toHaveLength(0);
  });
  it("detects change when count or latest card changes for Lootcards", async () => {
    const { db } = await createTestDb();

    await db.update(schema.marketStores).set({ enabled: false });

    await db.insert(schema.marketStores).values({
      id: "lootcards",
      platform: "lootcards",
      name: "Lootcards",
      baseUrl: "https://lootcards.store",
      tcgId: "grandarchive",
      enabled: true,
      lastCount: 450,
      lastLatestCardRefId: "ed1:100",
    });

    const mockResponse = {
      cards: [
        {
          edition_uuid: "ed2",
          min_price_cents: 250,
        },
      ],
      totalCards: 451,
      totalPages: 19,
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(mockResponse),
    });

    const report = await checkMarketStores(db, mockFetch as any);

    expect(report.stores).toHaveLength(1);
    const result = report.stores[0];
    expect(result.storeId).toBe("lootcards");
    expect(result.changed).toBe(true);
    expect(result.observedCount).toBe(451);
    expect(result.latestCardRefId).toBe("ed2:250");
    expect(result.latestCardChanged).toBe(true);

    const [storeInDb] = await db
      .select()
      .from(schema.marketStores)
      .where(eq(schema.marketStores.id, "lootcards"));
    expect(storeInDb.lastCount).toBe(451);
    expect(storeInDb.lastLatestCardRefId).toBe("ed2:250");
  });
});

const MYP_PAGE_HTML = `
  <div class="summary"><strong>42</strong> itens encontrados.</div>
  <div class="card" data-ga-item-id="grandarchive_dtr1e_064">
    <a class="card-img-link" href="/grandarchive/produto/383635/fluffy-shopkeep"></a>
    <div class="card-name"><h3>Fluffy Shopkeep</h3></div>
    <span class="card-edicao">DTR1E</span>
    <span class="quantidade-num">3</span>
    <span class="card-preco moeda">R$ 140,00</span>
  </div>
`;

describe("parseMypLatestCardRefId", () => {
  it("returns the first card's item id", () => {
    expect(parseMypLatestCardRefId(MYP_PAGE_HTML)).toBe(
      "grandarchive_dtr1e_064"
    );
  });

  it("returns null when the page has no cards", () => {
    expect(
      parseMypLatestCardRefId(
        '<div class="summary"><strong>0</strong> itens encontrados.</div>'
      )
    ).toBeNull();
  });

  it("ignores wrapper divs that lack the item id", () => {
    const html = `
      <div class="card-deck">
        <div class="card-body">
          <span class="card-name">Some wrapper</span>
        </div>
      </div>
      <div class="card" data-ga-item-id="grandarchive_dtr1e_064"></div>
    `;
    expect(parseMypLatestCardRefId(html)).toBe("grandarchive_dtr1e_064");
  });
});

describe("checkMarketStores MyP latest-card detection", () => {
  it("detects a new latest listing and count change in a single request", async () => {
    const { db } = await createTestDb();

    await db.update(schema.marketStores).set({ enabled: false });
    await db
      .update(schema.marketStores)
      .set({
        enabled: true,
        lastCount: 41,
        lastLatestCardRefId: "grandarchive_old_001",
      })
      .where(eq(schema.marketStores.id, "myp"));

    const fetchMock = vi.fn(async () => new Response(MYP_PAGE_HTML));

    const report = await checkMarketStores(db, fetchMock as unknown as typeof fetch);
    const myp = report.stores.find((store) => store.storeId === "myp");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://mypcards.com/grandarchive?ProdutoSearch%5BexibirSomenteVenda%5D=1",
      expect.any(Object)
    );
    expect(myp).toMatchObject({
      observedCount: 42,
      changed: true,
      latestCardRefId: "grandarchive_dtr1e_064",
      previousLatestCardRefId: "grandarchive_old_001",
      latestCardChanged: true,
    });

    const [store] = await db
      .select()
      .from(schema.marketStores)
      .where(eq(schema.marketStores.id, "myp"));
    expect(store.lastCount).toBe(42);
    expect(store.lastLatestCardRefId).toBe("grandarchive_dtr1e_064");
  });

  it("does not signal a change when count and latest listing are unchanged", async () => {
    const { db } = await createTestDb();

    await db.update(schema.marketStores).set({ enabled: false });
    await db
      .update(schema.marketStores)
      .set({
        enabled: true,
        lastCount: 42,
        lastLatestCardRefId: "grandarchive_dtr1e_064",
      })
      .where(eq(schema.marketStores.id, "myp"));

    const fetchMock = vi.fn(async () => new Response(MYP_PAGE_HTML));

    const report = await checkMarketStores(db, fetchMock as unknown as typeof fetch);
    const myp = report.stores.find((store) => store.storeId === "myp");

    expect(report.changes).toHaveLength(0);
    expect(myp).toMatchObject({
      observedCount: 42,
      changed: false,
      latestCardChanged: false,
      dispatched: false,
    });
  });
});

describe("checkMarketStores resilience", () => {
  it("uses a single request for Lootcards count and latest-card detection", async () => {
    const { db } = await createTestDb();
    await db.update(schema.marketStores).set({ enabled: false });
    await db.insert(schema.marketStores).values({
      id: "lootcards",
      platform: "lootcards",
      name: "Lootcards",
      baseUrl: "https://lootcards.store",
      tcgId: "grandarchive",
      enabled: true,
      lastCount: 450,
      lastLatestCardRefId: "ed1:100",
    });

    const requestedUrls: string[] = [];
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      requestedUrls.push(url);
      return {
        ok: true,
        text: async () =>
          JSON.stringify({
            cards: [{ edition_uuid: "ed2", min_price_cents: 250 }],
            totalCards: 451,
            totalPages: 19,
          }),
      };
    });

    const report = await checkMarketStores(db, mockFetch as any);
    const result = report.stores.find((s) => s.storeId === "lootcards");

    expect(result).toMatchObject({
      observedCount: 451,
      latestCardRefId: "ed2:250",
      latestCardChanged: true,
    });
    expect(requestedUrls).toHaveLength(1);
  });

  it("surfaces the upstream HTTP status when a store request fails", async () => {
    const { db } = await createTestDb();
    await db.update(schema.marketStores).set({ enabled: false });
    await db.insert(schema.marketStores).values({
      id: "lootcards",
      platform: "lootcards",
      name: "Lootcards",
      baseUrl: "https://lootcards.store",
      tcgId: "grandarchive",
      enabled: true,
      lastCount: 100,
    });

    const mockFetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 522, text: async () => "" });

    const report = await checkMarketStores(db, mockFetch as any);
    const result = report.stores.find((s) => s.storeId === "lootcards");

    expect(result?.skipped).toBeFalsy();
    expect(result?.error).toContain("HTTP 522");
  });

  it("backs off after consecutive failures and retries after the backoff is reset", async () => {
    const { db } = await createTestDb();
    await db.update(schema.marketStores).set({ enabled: false });
    await db.insert(schema.marketStores).values({
      id: "lootcards",
      platform: "lootcards",
      name: "Lootcards",
      baseUrl: "https://lootcards.store",
      tcgId: "grandarchive",
      enabled: true,
      lastCount: 100,
    });

    const failingFetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 522, text: async () => "" });

    const first = await checkMarketStores(db, failingFetch as any);
    expect(first.stores[0].skipped).toBeFalsy();
    expect(first.stores[0].error).toContain("HTTP 522");

    // The next cycle should skip the store entirely (no new request).
    const second = await checkMarketStores(db, failingFetch as any);
    expect(second.stores[0].skipped).toBe(true);
    expect(failingFetch).toHaveBeenCalledTimes(1);

    // Clearing the backoff lets the store be probed again.
    resetMarketCheckBackoff();
    const third = await checkMarketStores(db, failingFetch as any);
    expect(third.stores[0].skipped).toBeFalsy();
    expect(failingFetch).toHaveBeenCalledTimes(2);
  });

  describe("LigaStore count poll handling", () => {
    it("skips TabletopSorocaba from 5-minute Count Poll because stock filter is broken", async () => {
      const { db } = await createTestDb();
      await db.update(schema.marketStores).set({ enabled: false });

      await db.insert(schema.marketStores).values({
        id: "tabletopsorocaba",
        platform: "liga_store",
        name: "TabletopSorocaba",
        baseUrl: "https://www.tabletoptcg.com.br",
        tcgId: "21",
        enabled: true,
        lastCount: 2919,
      });

      const mockFetch = vi.fn();
      const report = await checkMarketStores(db, mockFetch as any);

      expect(report.stores).toHaveLength(1);
      expect(report.stores[0].storeId).toBe("tabletopsorocaba");
      expect(report.stores[0].skipped).toBe(true);
      expect(report.stores[0].changed).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("polls Brandão TCG and detects count changes with working stock filter", async () => {
      const { db } = await createTestDb();
      await db.update(schema.marketStores).set({ enabled: false });

      await db.insert(schema.marketStores).values({
        id: "brandao",
        platform: "liga_store",
        name: "Brandao TCG",
        baseUrl: "https://www.brandaocardgame.com.br",
        tcgId: "21",
        enabled: true,
        lastCount: 5,
      });

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("txt_order=6")) {
          return {
            ok: true,
            text: async () => `<td class="textoMaior"> 1-6 de <b>6</b></td>`,
          };
        }
        return {
          ok: true,
          text: async () => `<a href="?refid=ref_latest">Latest Card</a>`,
        };
      });

      const report = await checkMarketStores(db, mockFetch as any);

      expect(report.stores).toHaveLength(1);
      const brandao = report.stores[0];
      expect(brandao.storeId).toBe("brandao");
      expect(brandao.skipped).toBeFalsy();
      expect(brandao.observedCount).toBe(6);
      expect(brandao.changed).toBe(true);
    });
  });
});
