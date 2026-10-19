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

  it("POST saves and encrypts Superfrete API key and updates price fairness multipliers", async () => {
    const req = new NextRequest("http://localhost:3000/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        superfreteApiKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-superfrete-token",
        slightlyOverpricedMultiplier: 1.3,
        heavilyOverpricedMultiplier: 2.2,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.user.hasSavedSuperfreteApiKey).toBe(true);
    expect(json.user.superfreteApiKeyEncrypted).toBeUndefined();
    expect(json.user.slightlyOverpricedMultiplier).toBe(1.3);
    expect(json.user.heavilyOverpricedMultiplier).toBe(2.2);

    const userInDb = (await testDb.select().from(users))[0];
    expect(userInDb.superfreteApiKeyEncrypted).toBeDefined();
    expect(decryptMypPassword(userInDb.superfreteApiKeyEncrypted)).toBe("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-superfrete-token");
  });

  it("POST clears saved Superfrete API key when clearSuperfreteApiKey is true", async () => {
    await POST(
      new NextRequest("http://localhost:3000/api/settings", {
        method: "POST",
        body: JSON.stringify({
          superfreteApiKey: "token-to-be-cleared",
        }),
      })
    );

    const clearReq = new NextRequest("http://localhost:3000/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clearSuperfreteApiKey: true,
      }),
    });

    const res = await POST(clearReq);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user.hasSavedSuperfreteApiKey).toBe(false);

    const userInDb = (await testDb.select().from(users))[0];
    expect(userInDb.superfreteApiKeyEncrypted).toBeNull();
  });

  it("POST saves shipping package dimensions and weight formula settings", async () => {
    const req = new NextRequest("http://localhost:3000/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shippingPackagePreset: "bubble-mailer",
        shippingPackageHeight: 3.5,
        shippingPackageWidth: 16,
        shippingPackageLength: 22,
        shippingPackageBaseWeight: 60,
        shippingPackageTapeWeight: 8,
        shippingCardWeight: 3.5,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.user.shippingPackagePreset).toBe("bubble-mailer");
    expect(json.user.shippingPackageHeight).toBe(3.5);
    expect(json.user.shippingPackageWidth).toBe(16);
    expect(json.user.shippingPackageLength).toBe(22);
    expect(json.user.shippingPackageBaseWeight).toBe(60);
    expect(json.user.shippingPackageTapeWeight).toBe(8);
    expect(json.user.shippingCardWeight).toBe(3.5);

    const userInDb = (await testDb.select().from(users))[0];
    expect(userInDb.shippingPackagePreset).toBe("bubble-mailer");
    expect(userInDb.shippingPackageHeight).toBe(3.5);
  });
});

