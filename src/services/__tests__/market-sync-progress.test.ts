import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  renderProgressBar,
  formatDuration,
  MarketSyncProgressDashboard,
} from "../market-sync-progress";
import { runMarketSync } from "../market-sync-runner";
import { createTestDb } from "../../db/test-utils";
import { marketStores } from "../../db/schema";
import * as mypSyncModule from "../myp-sync";
import * as ligaSyncModule from "../ligastore-sync";
import * as lootcardsSyncModule from "../lootcards-sync";
import * as marketNotificationsModule from "../market-notifications";
import * as discordMarketNotifierModule from "../discord-market-notifier";
import * as discordDealNotifierModule from "../discord-deal-notifier";

describe("MarketSyncProgressDashboard & Progress Helpers", () => {
  it("renders progress bars with accurate ratios and widths", () => {
    expect(renderProgressBar(0, 10)).toBe("[░░░░░░░░░░]   0%");
    expect(renderProgressBar(0.5, 10)).toBe("[█████░░░░░]  50%");
    expect(renderProgressBar(1, 10)).toBe("[██████████] 100%");
    expect(renderProgressBar(-0.2, 10)).toBe("[░░░░░░░░░░]   0%");
    expect(renderProgressBar(1.5, 10)).toBe("[██████████] 100%");
    expect(renderProgressBar(NaN, 10)).toBe("[░░░░░░░░░░]   0%");
  });

  it("formats durations cleanly", () => {
    expect(formatDuration(4.25)).toBe("4.3s");
    expect(formatDuration(0)).toBe("0.0s");
    expect(formatDuration(undefined)).toBe("0.0s");
  });

  it("renders live progress lines in interactive TTY mode", () => {
    let output = "";
    const mockStream: any = {
      isTTY: true,
      write: (chunk: string) => {
        output += chunk;
      },
    };

    const dashboard = new MarketSyncProgressDashboard({
      isTTY: true,
      stream: mockStream,
    });

    dashboard.init([
      { id: "store-a", name: "Store Alpha", platform: "myp" },
      { id: "store-b", name: "Store Beta", platform: "liga_store" },
    ]);

    expect(output).toContain("Marketplace Synchronization in Progress");
    expect(output).toContain("Store Alpha");
    expect(output).toContain("Store Beta");

    // Update progress
    const cbA = dashboard.getCallback("store-a");
    cbA({ page: 5, totalPages: 10, itemsCount: 150 });
    expect(output).toContain("Page 5/10");

    // Complete store A
    dashboard.completeStore("store-a", {
      totalSynced: 300,
      matchedCount: 290,
      durationSec: 5.2,
    });
    expect(output).toContain("Synced 300 items");

    // Fail store B
    dashboard.failStore("store-b", "Connection refused");
    expect(output).toContain("Failed: Connection refused");

    // Final summary
    dashboard.printFinalSummary();
    expect(output).toContain("Marketplace Synchronization Summary");
    expect(output).toContain("Finished 1/2 stores");
  });

  it("emits clean milestone lines without ANSI cursor codes in non-TTY mode", () => {
    let output = "";
    const mockStream: any = {
      isTTY: false,
      write: (chunk: string) => {
        output += chunk;
      },
    };

    const dashboard = new MarketSyncProgressDashboard({
      isTTY: false,
      stream: mockStream,
    });

    dashboard.init([
      { id: "store-c", name: "Store Gamma", platform: "lootcards" },
    ]);

    const cb = dashboard.getCallback("store-c");
    cb({ page: 1, totalPages: 20, itemsCount: 30, status: "running" });
    cb({ page: 5, totalPages: 20, itemsCount: 150, status: "running" });

    dashboard.completeStore("store-c", {
      totalSynced: 500,
      matchedCount: 480,
      durationSec: 10.5,
    });

    // Non-TTY output should have clean store tags
    expect(output).toContain("[Store Gamma]");
    expect(output).toContain("Completed: 500 listings synced");
    // Should NOT contain ANSI cursor movement codes
    expect(output).not.toContain("\x1b[2K");
    expect(output).not.toContain("\x1b[?25l");
  });

  describe("Sequential vs Parallel sync runner options", () => {
    let testDb: any;

    beforeEach(async () => {
      const { db } = await createTestDb();
      testDb = db;
      await testDb.delete(marketStores);
      await testDb.insert(marketStores).values([
        {
          id: "seq-1",
          platform: "liga_store",
          name: "Store 1",
          baseUrl: "https://store1.example",
          enabled: true,
        },
        {
          id: "seq-2",
          platform: "lootcards",
          name: "Store 2",
          baseUrl: "https://store2.example",
          enabled: true,
        },
      ]);
    });

    it("runs stores sequentially when sequential option is enabled", async () => {
      const activeTasks: string[] = [];
      let maxConcurrent = 0;
      const order: string[] = [];

      vi.spyOn(ligaSyncModule, "syncLigaStore").mockImplementation(async () => {
        activeTasks.push("store-1");
        maxConcurrent = Math.max(maxConcurrent, activeTasks.length);
        await new Promise((r) => setTimeout(r, 20));
        order.push("store-1");
        activeTasks.splice(activeTasks.indexOf("store-1"), 1);
        return { storeName: "Store 1", totalSynced: 10, matchedCount: 10, unmatchedCount: 0, enrichedCount: 0 };
      });

      vi.spyOn(lootcardsSyncModule, "syncLootcards").mockImplementation(async () => {
        activeTasks.push("store-2");
        maxConcurrent = Math.max(maxConcurrent, activeTasks.length);
        await new Promise((r) => setTimeout(r, 20));
        order.push("store-2");
        activeTasks.splice(activeTasks.indexOf("store-2"), 1);
        return { totalSynced: 20, matchedCount: 20, unmatchedCount: 0, enrichedCount: 0 };
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

      const result = await runMarketSync({
        database: testDb,
        sequential: true,
        showDashboard: false,
      });

      expect(result.stores).toHaveLength(2);
      expect(maxConcurrent).toBe(1); // Never exceeded 1 concurrent store
      expect(order).toEqual(["store-1", "store-2"]);
    });
  });
});
