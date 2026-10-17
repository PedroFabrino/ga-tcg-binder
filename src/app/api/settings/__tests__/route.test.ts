import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

let testDb: any;

vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "u-settings" } }),
}));

vi.mock("@/db", () => ({
  db: new Proxy({}, {
    get: (_, prop) => {
      return testDb?.[prop];
    },
  }),
}));

import { createTestDb } from "@/db/test-utils";
import { users } from "@/db/schema";
import { decryptMypPassword } from "@/lib/crypto";
import { GET, POST } from "../route";

describe("Settings API Route (src/app/api/settings/route.ts)", () => {
  beforeEach(async () => {
    const { db } = await createTestDb();
    testDb = db;

    await testDb.insert(users).values({
      id: "u-settings",
      name: "Collector Setting",
      email: "settings@example.com",
      friendCode: "GA-SET1",
      lowPopThreshold: 1000,
      mypUsername: "MyPSettingsUser",
    });
  });

  it("GET returns user settings without exposing encrypted password", async () => {
    const req = new NextRequest("http://localhost:3000/api/settings?userId=u-settings");
    const res = await GET(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.user).toBeDefined();
    expect(json.user.mypPasswordEncrypted).toBeUndefined();
    expect(json.user.hasSavedMypCredentials).toBe(false);
  });

  it("POST saves and encrypts MyP credentials via AES-256-GCM", async () => {
    const req = new NextRequest("http://localhost:3000/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "u-settings",
        mypLogin: "collector@myp.com",
        mypPassword: "SecretPassword123!",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.user.mypLogin).toBe("collector@myp.com");
    expect(json.user.hasSavedMypCredentials).toBe(true);
    expect(json.user.mypPasswordEncrypted).toBeUndefined();

    // Verify stored encrypted password in database
    const userInDb = await testDb.select().from(users).where().get?.() || (await testDb.select().from(users))[0];
    expect(userInDb.mypPasswordEncrypted).toBeDefined();
    expect(userInDb.mypPasswordEncrypted).not.toBe("SecretPassword123!");
    expect(decryptMypPassword(userInDb.mypPasswordEncrypted)).toBe("SecretPassword123!");
  });

  it("POST clears saved MyP credentials when clearMypCredentials is true", async () => {
    // First save
    await POST(
      new NextRequest("http://localhost:3000/api/settings", {
        method: "POST",
        body: JSON.stringify({
          userId: "u-settings",
          mypLogin: "collector@myp.com",
          mypPassword: "SecretPassword123!",
        }),
      })
    );

    // Clear
    const clearReq = new NextRequest("http://localhost:3000/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "u-settings",
        clearMypCredentials: true,
      }),
    });

    const res = await clearReq ? await POST(clearReq) : null;
    expect(res?.status).toBe(200);

    const json = await res?.json();
    expect(json.user.hasSavedMypCredentials).toBe(false);
    expect(json.user.mypLogin).toBeNull();
  });
});
