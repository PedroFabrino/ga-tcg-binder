import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

let testDb: any;

const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({ auth: authMock }));

vi.mock("@/db", () => ({
  db: new Proxy({}, {
    get: (_, prop) => testDb?.[prop],
  }),
}));

vi.mock("@/db/init", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/db/init")>();
  return {
    ...actual,
    runMigrations: (client?: Parameters<typeof actual.runMigrations>[0]) =>
      client ? actual.runMigrations(client) : Promise.resolve(),
  };
});
vi.mock("@/services/seed", () => ({ ensureDefaultUserAndSeed: vi.fn().mockResolvedValue(undefined) }));

import { createTestDb } from "@/db/test-utils";
import { users } from "@/db/schema";
import { GET, POST } from "../route";
import { POST as SYNC_POST } from "../sync/route";

function jsonRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Marketplace vendor capability gate", () => {
  beforeEach(async () => {
    const { db } = await createTestDb();
    testDb = db;
    authMock.mockReset();

    await testDb.insert(users).values({
      id: "u-seller",
      name: "Seller",
      email: "seller@test.com",
      friendCode: "GA-SELL",
      mypUsername: "seller",
      mypPasswordEncrypted: "configured-password",
      sellerModeEnabled: true,
    });
    await testDb.insert(users).values({
      id: "u-collector",
      name: "Collector",
      email: "collector@test.com",
      friendCode: "GA-COLL",
    });
  });

  it("returns 404 for GET without a session", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(new NextRequest("http://localhost/api/marketplace?userId=u-seller"));
    expect(res.status).toBe(404);
  });

  it("returns 404 for GET from an authenticated non-vendor", async () => {
    authMock.mockResolvedValue({ user: { id: "u-collector" } });
    const res = await GET(new NextRequest("http://localhost/api/marketplace"));
    expect(res.status).toBe(404);
  });

  it("returns 404 for POST without a session despite a vendor userId in the body", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(jsonRequest("http://localhost/api/marketplace", { userId: "u-seller", action: "sync" }));
    expect(res.status).toBe(404);
  });

  it("ignores a body userId when the session user is a non-vendor", async () => {
    authMock.mockResolvedValue({ user: { id: "u-collector" } });
    const res = await POST(jsonRequest("http://localhost/api/marketplace", { userId: "u-seller", action: "sync" }));
    expect(res.status).toBe(404);
  });

  it("returns 404 for sync without a session despite a vendor userId in the body", async () => {
    authMock.mockResolvedValue(null);
    const res = await SYNC_POST(jsonRequest("http://localhost/api/marketplace/sync", { userId: "u-seller" }));
    expect(res.status).toBe(404);
  });

  it("returns 404 for sync from an authenticated non-vendor", async () => {
    authMock.mockResolvedValue({ user: { id: "u-collector" } });
    const res = await SYNC_POST(jsonRequest("http://localhost/api/marketplace/sync", {}));
    expect(res.status).toBe(404);
  });

  it("serves the report to an authenticated vendor", async () => {
    authMock.mockResolvedValue({ user: { id: "u-seller" } });
    const res = await GET(new NextRequest("http://localhost/api/marketplace"));
    expect(res.status).toBe(200);
  });
});

