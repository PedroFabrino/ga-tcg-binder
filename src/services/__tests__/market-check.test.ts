import { describe, expect, it, vi } from "vitest";
import { createTestDb } from "../../db/test-utils";
import * as schema from "../../db/schema";
import { checkMarketStores } from "../market-check";
import { eq } from "drizzle-orm";

describe("checkMarketStores dual change detection", () => {
  it("detects change when count changes for LigaStore", async () => {
    const { db } = await createTestDb();

    // Disable default myp store so only brandao runs
    await db.update(schema.marketStores).set({ enabled: false });

    await db.insert(schema.marketStores).values({
      id: "brandao",
      platform: "liga_store",
      name: "Brandao Card Game",
      baseUrl: "https://www.brandaocardgame.com.br",
      tcgId: "21",
      enabled: true,
      lastCount: 100,
      lastLatestCardRefId: "ref_current",
    });

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("txt_order=12")) {
        return {
          ok: true,
          text: async () => `
            <div class="card-item">
              <a href="?view=ecom/item&refid=ref_current">Same Card</a>
            </div>
          `,
        };
      }
      // txt_order=6: count changed to 105
      return {
        ok: true,
        text: async () => `
          <table><tr><td class="textoMaior"> 1-30 de <b>105</b></td></tr></table>
        `,
      };
    });

    const report = await checkMarketStores(db, mockFetch as any);

    expect(report.stores).toHaveLength(1);
    const result = report.stores[0];
    expect(result.storeId).toBe("brandao");
    expect(result.changed).toBe(true);
    expect(result.observedCount).toBe(105);
    expect(result.latestCardRefId).toBe("ref_current");
    expect(result.latestCardChanged).toBe(false);

    // Verify DB count updated
    const [storeInDb] = await db
      .select()
      .from(schema.marketStores)
      .where(eq(schema.marketStores.id, "brandao"));
    expect(storeInDb.lastCount).toBe(105);
  });

  it("detects change when latest card changes even if count is unchanged", async () => {
    const { db } = await createTestDb();

    await db.update(schema.marketStores).set({ enabled: false });

    await db.insert(schema.marketStores).values({
      id: "brandao",
      platform: "liga_store",
      name: "Brandao Card Game",
      baseUrl: "https://www.brandaocardgame.com.br",
      tcgId: "21",
      enabled: true,
      lastCount: 100,
      lastLatestCardRefId: "ref_old",
    });

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("txt_order=12")) {
        return {
          ok: true,
          text: async () => `
            <div class="card-item">
              <a href="?view=ecom/item&refid=ref_new">Newest Card</a>
            </div>
          `,
        };
      }
      // txt_order=6: count unchanged at 100
      return {
        ok: true,
        text: async () => `
          <table><tr><td class="textoMaior"> 1-30 de <b>100</b></td></tr></table>
        `,
      };
    });

    const report = await checkMarketStores(db, mockFetch as any);

    expect(report.stores).toHaveLength(1);
    const result = report.stores[0];
    expect(result.changed).toBe(true);
    expect(result.latestCardRefId).toBe("ref_new");
    expect(result.latestCardChanged).toBe(true);

    // Verify DB lastLatestCardRefId updated
    const [storeInDb] = await db
      .select()
      .from(schema.marketStores)
      .where(eq(schema.marketStores.id, "brandao"));
    expect(storeInDb.lastLatestCardRefId).toBe("ref_new");
  });

  it("reports no change when both count and latest card are unchanged", async () => {
    const { db } = await createTestDb();

    await db.update(schema.marketStores).set({ enabled: false });

    await db.insert(schema.marketStores).values({
      id: "brandao",
      platform: "liga_store",
      name: "Brandao Card Game",
      baseUrl: "https://www.brandaocardgame.com.br",
      tcgId: "21",
      enabled: true,
      lastCount: 100,
      lastLatestCardRefId: "ref_current",
    });

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("txt_order=12")) {
        return {
          ok: true,
          text: async () => `
            <div class="card-item">
              <a href="?view=ecom/item&refid=ref_current">Same Card</a>
            </div>
          `,
        };
      }
      return {
        ok: true,
        text: async () => `
          <table><tr><td class="textoMaior"> 1-30 de <b>100</b></td></tr></table>
        `,
      };
    });

    const report = await checkMarketStores(db, mockFetch as any);

    expect(report.stores).toHaveLength(1);
    const result = report.stores[0];
    expect(result.changed).toBe(false);
    expect(result.latestCardChanged).toBe(false);
  });

  it("handles latest-card check failure gracefully without false positives", async () => {
    const { db } = await createTestDb();

    await db.update(schema.marketStores).set({ enabled: false });

    await db.insert(schema.marketStores).values({
      id: "brandao",
      platform: "liga_store",
      name: "Brandao Card Game",
      baseUrl: "https://www.brandaocardgame.com.br",
      tcgId: "21",
      enabled: true,
      lastCount: 100,
      lastLatestCardRefId: "ref_current",
    });

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("txt_order=12")) {
        // HTTP error or malformed response
        return {
          ok: false,
          status: 500,
          text: async () => "Internal Server Error",
        };
      }
      return {
        ok: true,
        text: async () => `
          <table><tr><td class="textoMaior"> 1-30 de <b>100</b></td></tr></table>
        `,
      };
    });

    const report = await checkMarketStores(db, mockFetch as any);

    expect(report.stores).toHaveLength(1);
    const result = report.stores[0];
    // Count is unchanged and latest check failed -> changed must be false
    expect(result.changed).toBe(false);
    expect(result.observedCount).toBe(100);
    expect(result.latestCardRefId).toBeNull();
    expect(result.latestCardChanged).toBe(false);
  });

  it("runs only count check for MyP platform", async () => {
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

    // Verify no latest-card URL was fetched for MyP
    const latestUrls = requestedUrls.filter((u) => u.includes("txt_order=12"));
    expect(latestUrls).toHaveLength(0);
  });
});
