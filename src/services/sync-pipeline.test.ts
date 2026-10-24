import { describe, it, expect } from "vitest";
import { createTestDb } from "../db/test-utils";
import { users, cards, metaStaples, metaArchetypes } from "../db/schema";
import { runFullSyncPipeline } from "./sync-pipeline";

describe("Unified Sequential Sync Pipeline Seam", () => {
  it("executes stages in exact dependency order and returns structured report", async () => {
    const { db } = await createTestDb();

    await db.insert(users).values({
      id: "u-pipeline",
      name: "Pipeline Collector",
      friendCode: "GA-PIPE1",
      mypUsername: "PipeMaster",
    });

    const executionLog: string[] = [];

    const mockFetch = async (url: string) => {
      if (url.includes("/cards/staples")) {
        executionLog.push("staples");
        return {
          ok: true,
          text: async () => `<div class="gt-card-tile" data-card-name="Fracturize" data-inclusion="90%" data-avg-copies="4.0">Fracturize</div>`,
        };
      }
      if (url.includes("exibirSomenteCompra")) {
        if (!url.includes("load-more")) {
          executionLog.push("user-watchlist");
        }
        return {
          ok: true,
          text: async () => ``,
        };
      }
      if (url.includes("mypcards.com/PipeMaster")) {
        executionLog.push("user-myp");
        return {
          ok: true,
          text: async () => ``,
        };
      }
      if (url.includes("mypcards.com/grandarchive")) {
        executionLog.push("global-myp");
        return {
          ok: true,
          text: async () => ``,
        };
      }
      if (url.includes("/meta")) {
        executionLog.push("meta");
        return {
          ok: true,
          text: async () => ``,
        };
      }
      return { ok: true, text: async () => "" };
    };

    const report = await runFullSyncPipeline(db, {
      customFetch: mockFetch as any,
      targetUserId: "u-pipeline",
    });

    const failedStages = report.stages.filter((s) => s.status === "failed");
    if (failedStages.length > 0) {
      console.log("Failed stages in test 1:", failedStages);
    }

    expect(report.success).toBe(true);
    expect(report.stages).toHaveLength(8);
    expect(report.stages[0].stage).toContain("Catalog Check");
    expect(report.stages[1].stage).toContain("Meta Staples Sync");
    expect(report.stages[2].stage).toContain("Personal MyP Store Sync");
    expect(report.stages[3].stage).toContain("Global MyP Market Sync");
    expect(report.stages[4].stage).toContain("Deck Shortages TCG Price");
    expect(report.stages[5].stage).toContain("Watchlist Ledger Reconciliation");
    expect(report.stages[6].stage).toContain("Automated Watchlist Mutation Execution");
    expect(report.stages[7].stage).toContain("Meta Archetypes");

    // Exact order verification: staples -> user-myp -> global-myp -> user-watchlist -> meta
    expect(executionLog).toEqual(["staples", "user-myp", "global-myp", "user-watchlist", "meta"]);
  });

  it("isolates stage faults so upstream failures do not prevent subsequent stages", async () => {
    const { db } = await createTestDb();

    const mockFetchWithFailure = async (url: string) => {
      if (url.includes("/cards/staples")) {
        // Stage 1 fails with 500
        return { ok: false, status: 500, statusText: "Internal Error" };
      }
      return { ok: true, text: async () => "" };
    };

    const report = await runFullSyncPipeline(db, {
      customFetch: mockFetchWithFailure as any,
    });

    // Stage 1 failed
    expect(report.stages[1].status).toBe("failed");
    expect(report.stages[1].error).toBeDefined();

    // Subsequent stages still ran and completed cleanly
    expect(report.stages[2].status).toBe("success");
    expect(report.stages[3].status).toBe("success");
    expect(report.stages[4].status).toBe("success");
    expect(report.stages[5].status).toBe("success");
    expect(report.stages[6].status).toBe("success");
    expect(report.stages[7].status).toBe("success");
    expect(report.success).toBe(false); // Overall indicates a failure occurred
  });
});
