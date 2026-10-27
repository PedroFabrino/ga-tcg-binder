import { describe, expect, it, vi, beforeEach } from "vitest";
import { runMarketSync } from "../market-sync-runner";
import { createTestDb } from "../../db/test-utils";
import { marketStores } from "../../db/schema";
import * as mypSyncModule from "../myp-sync";
import * as ligaSyncModule from "../ligastore-sync";
import * as lootcardsSyncModule from "../lootcards-sync";
import * as marketNotificationsModule from "../market-notifications";
import * as discordMarketNotifierModule from "../discord-market-notifier";
import * as discordDealNotifierModule from "../discord-deal-notifier";

describe("market-sync-runner", () => {
  let testDb: any;

  beforeEach(async () => {
    const { db } = await createTestDb();
    testDb = db;
    await testDb.delete(marketStores);

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
        id: "brandao",
        platform: "liga_store",
        name: "Brandão Card Game",
        baseUrl: "https://www.brandaocardgame.com.br",
        tcgId: "21",
        enabled: true,
      },
      {
        id: "tabletopsorocaba",
        platform: "liga_store",
        name: "TabletopSorocaba",
        baseUrl: "https://www.tabletoptcg.com.br",
        tcgId: "21",
        enabled: true,
      },
      {
        id: "lootcards",
        platform: "lootcards",
        name: "Lootcards",
        baseUrl: "https://lootcards.store",
        tcgId: "grandarchive",
        enabled: true,
      },
    ]);
  });

  it("runs pipelines concurrently by shop type and executes stores in each pipeline", async () => {
    const activeTasks: string[] = [];
    let maxConcurrentPipelines = 0;
    const executionOrder: string[] = [];

    vi.spyOn(mypSyncModule, "syncGlobalMarketplace").mockImplementation(async () => {
      activeTasks.push("myp");
      maxConcurrentPipelines = Math.max(maxConcurrentPipelines, activeTasks.length);
      await new Promise((r) => setTimeout(r, 20));
      executionOrder.push("myp");
      activeTasks.splice(activeTasks.indexOf("myp"), 1);
      return { totalCount: 10, totalSynced: 10, matchedCount: 8, unmatchedCount: 2, complete: true };
    });

    vi.spyOn(ligaSyncModule, "syncLigaStore").mockImplementation(async (opts) => {
      const storeId = opts?.storeId ?? "unknown";
      const task = `liga:${storeId}`;
      activeTasks.push(task);
      maxConcurrentPipelines = Math.max(maxConcurrentPipelines, activeTasks.length);
      await new Promise((r) => setTimeout(r, 20));
      executionOrder.push(task);
      activeTasks.splice(activeTasks.indexOf(task), 1);
      return { storeName: storeId, totalSynced: 5, matchedCount: 5, unmatchedCount: 0, enrichedCount: 0 };
    });

    vi.spyOn(lootcardsSyncModule, "syncLootcards").mockImplementation(async () => {
      activeTasks.push("lootcards");
      maxConcurrentPipelines = Math.max(maxConcurrentPipelines, activeTasks.length);
      await new Promise((r) => setTimeout(r, 20));
      executionOrder.push("lootcards");
      activeTasks.splice(activeTasks.indexOf("lootcards"), 1);
      return { totalSynced: 6, matchedCount: 6, unmatchedCount: 0, enrichedCount: 0 };
    });

    vi.spyOn(marketNotificationsModule, "writeMarketNotifications").mockResolvedValue(0);
    vi.spyOn(discordMarketNotifierModule, "deliverDiscordNotifications").mockResolvedValue({
      disabled: true,
      attempted: 0,
      delivered: 0,
    });
    vi.spyOn(discordDealNotifierModule, "dispatchDealAlerts").mockResolvedValue({
      matched: 0,
      sent: 0,
    });

    const result = await runMarketSync({ database: testDb });

    expect(result.stores).toHaveLength(4);
    expect(result.stores.every((s) => s.status === "success")).toBe(true);

    // Verified that pipelines ran concurrently: at some point more than 1 pipeline was active simultaneously
    expect(maxConcurrentPipelines).toBeGreaterThan(1);

    // Liga stores run sequentially within the liga pipeline
    const brandaoIndex = executionOrder.indexOf("liga:brandao");
    const tabletopIndex = executionOrder.indexOf("liga:tabletopsorocaba");
    expect(brandaoIndex).toBeLessThan(tabletopIndex);
  });

  it("handles a single store filter option correctly", async () => {
    vi.spyOn(ligaSyncModule, "syncLigaStore").mockResolvedValue({
      storeName: "TabletopSorocaba",
      totalSynced: 3,
      matchedCount: 3,
      unmatchedCount: 0,
      enrichedCount: 0,
    });
    vi.spyOn(marketNotificationsModule, "writeMarketNotifications").mockResolvedValue(0);
    vi.spyOn(discordMarketNotifierModule, "deliverDiscordNotifications").mockResolvedValue({
      disabled: true,
      attempted: 0,
      delivered: 0,
    });

    const result = await runMarketSync({
      storeId: "tabletopsorocaba",
      database: testDb,
    });

    expect(result.stores).toEqual([{ storeId: "tabletopsorocaba", status: "success" }]);
  });

  it("captures errors per store without failing other pipelines", async () => {
    vi.spyOn(mypSyncModule, "syncGlobalMarketplace").mockRejectedValue(new Error("MyP network error"));
    vi.spyOn(ligaSyncModule, "syncLigaStore").mockResolvedValue({
      storeName: "Brandão Card Game",
      totalSynced: 2,
      matchedCount: 2,
      unmatchedCount: 0,
      enrichedCount: 0,
    });
    vi.spyOn(lootcardsSyncModule, "syncLootcards").mockResolvedValue({
      totalSynced: 2,
      matchedCount: 2,
      unmatchedCount: 0,
      enrichedCount: 0,
    });
    vi.spyOn(marketNotificationsModule, "writeMarketNotifications").mockResolvedValue(0);
    vi.spyOn(discordMarketNotifierModule, "deliverDiscordNotifications").mockResolvedValue({
      disabled: true,
      attempted: 0,
      delivered: 0,
    });

    const result = await runMarketSync({ database: testDb });

    const mypResult = result.stores.find((s) => s.storeId === "myp");
    const brandaoResult = result.stores.find((s) => s.storeId === "brandao");
    const lootResult = result.stores.find((s) => s.storeId === "lootcards");

    expect(mypResult?.status).toBe("failed");
    expect(mypResult?.error).toContain("MyP network error");
    expect(brandaoResult?.status).toBe("success");
    expect(lootResult?.status).toBe("success");
  });
});
