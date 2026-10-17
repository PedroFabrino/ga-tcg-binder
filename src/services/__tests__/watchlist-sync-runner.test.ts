import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb } from "../../db/test-utils";
import { users, mypWatchlist } from "../../db/schema";
import { encryptMypPassword } from "../../lib/crypto";
import { executeAutomatedWatchlistSync } from "../watchlist-sync-runner";
import { eq } from "drizzle-orm";

describe("Stage 2d/2e Automated Watchlist Mutation Runner (src/services/watchlist-sync-runner.ts)", () => {
  let testDb: any;

  beforeEach(async () => {
    const { db } = await createTestDb();
    testDb = db;

    const encryptedPass = encryptMypPassword("SecretMyPPass99!");

    await testDb.insert(users).values({
      id: "u-runner",
      name: "Runner User",
      email: "runner@example.com",
      friendCode: "GA-RUN1",
      mypUsername: "RunnerMyP",
      mypLogin: "runner@mypcards.com",
      mypPasswordEncrypted: encryptedPass,
    });
  });

  it("skips execution if user has no credentials or no pending mutations", async () => {
    // User has no pending rows in mypWatchlist
    const mockTransport = {
      createSession: vi.fn(),
      destroySession: vi.fn(),
      request: vi.fn(),
    };

    const res = await executeAutomatedWatchlistSync("u-runner", {
      database: testDb,
      transport: mockTransport,
    });

    expect(res.skipped).toBe(true);
    expect(mockTransport.createSession).not.toHaveBeenCalled();
  });

  it("authenticates FlareSolverr session, executes mutations, and updates ledger", async () => {
    await testDb.insert(mypWatchlist).values([
      {
        id: "wl-add-1",
        userId: "u-runner",
        cardSlug: "fracturize",
        cardName: "Fracturize",
        editionSlug: "DOA",
        collectorNumber: "001",
        mypItemId: "ga_doa_001",
        targetQuantity: 2,
        targetPriceBrl: 4.5,
        status: "pending_add",
      },
      {
        id: "wl-remove-1",
        userId: "u-runner",
        cardSlug: "fireball",
        cardName: "Fireball",
        editionSlug: "DOA",
        collectorNumber: "020",
        mypItemId: "ga_doa_020",
        targetQuantity: 0,
        targetPriceBrl: 1.0,
        status: "pending_remove",
      },
    ]);

    const calls: string[] = [];
    const mockTransport = {
      createSession: vi.fn().mockResolvedValue({ session: "sess_123" }),
      destroySession: vi.fn().mockResolvedValue({ status: "ok" }),
      request: vi.fn().mockImplementation(async (opts: any) => {
        calls.push(opts.url || opts.postData || "req");
        if (opts.url?.includes("site/login")) {
          return {
            status: 200,
            response: `<html><head><meta name="csrf-token" content="csrf_secret_token_abc"></head><body>Bem-vindo</body></html>`,
          };
        }
        return { status: 200, response: `{"success": true}` };
      }),
    };

    const res = await executeAutomatedWatchlistSync("u-runner", {
      database: testDb,
      transport: mockTransport,
    });

    expect(res.success).toBe(true);
    expect(res.addsExecuted).toBe(1);
    expect(res.removesExecuted).toBe(1);

    // Verify session lifecycle
    expect(mockTransport.createSession).toHaveBeenCalled();
    expect(mockTransport.destroySession).toHaveBeenCalledWith("sess_123");

    // Verify ledger updates
    const addRow = (await testDb.select().from(mypWatchlist).where(eq(mypWatchlist.id, "wl-add-1")))[0];
    expect(addRow.status).toBe("watching");

    const removeRow = (await testDb.select().from(mypWatchlist).where(eq(mypWatchlist.id, "wl-remove-1")))[0];
    expect(removeRow.status).toBe("removed");
  });

  it("always destroys session even if login or mutation fails", async () => {
    await testDb.insert(mypWatchlist).values({
      id: "wl-fail",
      userId: "u-runner",
      cardSlug: "fracturize",
      cardName: "Fracturize",
      editionSlug: "DOA",
      collectorNumber: "001",
      status: "pending_add",
    });

    const mockTransport = {
      createSession: vi.fn().mockResolvedValue({ session: "sess_error" }),
      destroySession: vi.fn().mockResolvedValue({ status: "ok" }),
      request: vi.fn().mockRejectedValue(new Error("Cloudflare challenge failed")),
    };

    const res = await executeAutomatedWatchlistSync("u-runner", {
      database: testDb,
      transport: mockTransport,
    });

    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
    expect(mockTransport.destroySession).toHaveBeenCalledWith("sess_error");
  });
});
