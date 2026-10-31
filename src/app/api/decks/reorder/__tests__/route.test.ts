import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

let testDb: any;

vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "u1" } }),
}));

vi.mock("@/db", () => ({
  db: new Proxy({}, {
    get: (_, prop) => testDb?.[prop],
  }),
}));

import { createTestDb } from "@/db/test-utils";
import { users, decks } from "@/db/schema";
import { POST } from "../route";

describe("POST /api/decks/reorder", () => {
  beforeEach(async () => {
    const { db } = await createTestDb();
    testDb = db;

    await testDb.insert(users).values({
      id: "u1",
      name: "User 1",
      friendCode: "U1-CODE",
    });
  });

  it("returns 400 for malformed json or invalid payload structure", async () => {
    const req = new NextRequest("http://localhost:3000/api/decks/reorder", {
      method: "POST",
      body: JSON.stringify({ items: [] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Field 'items' must not be empty");
  });

  it("returns 400 when duplicate ids are submitted", async () => {
    const req = new NextRequest("http://localhost:3000/api/decks/reorder", {
      method: "POST",
      body: JSON.stringify({
        items: [
          { id: "d1", section: "competitive", priority: 0 },
          { id: "d1", section: "4fun", priority: 1 },
        ],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Duplicate deck id");
  });

  it("returns 404 when deck id does not belong to the user", async () => {
    const req = new NextRequest("http://localhost:3000/api/decks/reorder", {
      method: "POST",
      body: JSON.stringify({
        items: [
          { id: "nonexistent-deck", section: "competitive", priority: 0 },
        ],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("successfully updates deck sections and priorities for valid user decks", async () => {
    await testDb.insert(decks).values([
      { id: "d1", userId: "u1", name: "Deck 1", section: "competitive", priority: 0 },
      { id: "d2", userId: "u1", name: "Deck 2", section: "competitive", priority: 1 },
    ]);

    const req = new NextRequest("http://localhost:3000/api/decks/reorder", {
      method: "POST",
      body: JSON.stringify({
        items: [
          { id: "d1", section: "4fun", priority: 1 },
          { id: "d2", section: "competitive", priority: 0 },
        ],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});
