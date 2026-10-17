import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

let testDb: any;

vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "u-wl-api" } }),
}));

vi.mock("@/db", () => ({
  db: new Proxy({}, {
    get: (_, prop) => {
      return testDb?.[prop];
    },
  }),
}));

import { createTestDb } from "@/db/test-utils";
import { users, mypWatchlist } from "@/db/schema";
import { eq } from "drizzle-orm";
import { GET as watchlistGet, POST as watchlistPost } from "../route";
import { POST as confirmPost } from "../confirm/route";

describe("Watchlist API Endpoints (GET/POST /api/watchlist & POST /api/watchlist/confirm)", () => {
  beforeEach(async () => {
    const { db } = await createTestDb();
    testDb = db;

    await testDb.insert(users).values({
      id: "u-wl-api",
      name: "Watchlist Collector",
      email: "wl@example.com",
      friendCode: "GA-WL1",
      mypUsername: "WLCollector",
      watchlistPolicyHard: true,
      watchlistPolicyShared: false,
      watchlistPolicyStaples: false,
    });

    await testDb.insert(mypWatchlist).values([
      {
        id: "wl-item-add",
        userId: "u-wl-api",
        cardSlug: "fracturize",
        cardName: "Fracturize",
        editionSlug: "DOA",
        collectorNumber: "001",
        targetQuantity: 2,
        targetPriceBrl: 4.5,
        status: "pending_add",
      },
      {
        id: "wl-item-update",
        userId: "u-wl-api",
        cardSlug: "rend",
        cardName: "Rend",
        editionSlug: "DOA",
        collectorNumber: "010",
        targetQuantity: 1,
        targetPriceBrl: 1.0,
        status: "pending_update",
      },
      {
        id: "wl-item-remove",
        userId: "u-wl-api",
        cardSlug: "fireball",
        cardName: "Fireball",
        editionSlug: "DOA",
        collectorNumber: "020",
        targetQuantity: 0,
        targetPriceBrl: 2.0,
        status: "pending_remove",
      },
      {
        id: "wl-item-ignored",
        userId: "u-wl-api",
        cardSlug: "shield",
        cardName: "Shield",
        editionSlug: "DOA",
        collectorNumber: "030",
        targetQuantity: 2,
        targetPriceBrl: 3.0,
        status: "ignored",
      },
    ]);
  });

  it("GET /api/watchlist returns items and summary metrics", async () => {
    const req = new NextRequest("http://localhost:3000/api/watchlist?userId=u-wl-api");
    const res = await watchlistGet(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.items).toHaveLength(4);
    expect(json.summary.pendingAdds).toBe(1);
    expect(json.summary.pendingUpdates).toBe(1);
    expect(json.summary.pendingRemoves).toBe(1);
    expect(json.summary.ignoredCount).toBe(1);
  });

  it("POST /api/watchlist action: re_enable transitions ignored to pending_add", async () => {
    const req = new NextRequest("http://localhost:3000/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "u-wl-api",
        action: "re_enable",
        watchlistId: "wl-item-ignored",
      }),
    });

    const res = await watchlistPost(req);
    expect(res.status).toBe(200);

    const row = (await testDb.select().from(mypWatchlist).where(eq(mypWatchlist.id, "wl-item-ignored")))[0];
    expect(row.status).toBe("pending_add");
  });

  it("POST /api/watchlist/confirm applies batch confirmation from Browser Bridge", async () => {
    const req = new NextRequest("http://localhost:3000/api/watchlist/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "u-wl-api",
        confirmedAddIds: ["wl-item-add"],
        confirmedUpdateIds: ["wl-item-update"],
        confirmedRemoveIds: ["wl-item-remove"],
      }),
    });

    const res = await confirmPost(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);

    const addRow = (await testDb.select().from(mypWatchlist).where(eq(mypWatchlist.id, "wl-item-add")))[0];
    expect(addRow.status).toBe("watching");

    const updateRow = (await testDb.select().from(mypWatchlist).where(eq(mypWatchlist.id, "wl-item-update")))[0];
    expect(updateRow.status).toBe("watching");

    const removeRow = (await testDb.select().from(mypWatchlist).where(eq(mypWatchlist.id, "wl-item-remove")))[0];
    expect(removeRow).toBeUndefined(); // Deleted on confirmed removal
  });
});
