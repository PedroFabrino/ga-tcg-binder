import { beforeEach, describe, expect, it } from "vitest";
import { users } from "@/db/schema";
import { createTestDb } from "@/db/test-utils";
import {
  getUserCapabilities,
  getUserSettings,
  updateUserSettingsService,
} from "@/services/settings";
import { decryptMypPassword } from "@/lib/crypto";
import { eq } from "drizzle-orm";

describe("Settings Service (src/services/settings.ts)", () => {
  let db: Awaited<ReturnType<typeof createTestDb>>["db"];
  const userId = "u-settings-service-test";

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db;

    await db.insert(users).values({
      id: userId,
      name: "Collector Setting User",
      email: "settings-service@example.com",
      friendCode: "GA-SET-SVC",
      lowPopThreshold: 1000,
      mypUsername: "MyPSettingsServiceUser",
    });
  });

  it("returns sanitized user settings with computed credential flags and unexposed secrets", async () => {
    const settings = await getUserSettings(userId, db);

    expect(settings).not.toBeNull();
    expect(settings?.id).toBe(userId);
    expect(settings?.name).toBe("Collector Setting User");
    expect(settings?.hasSavedMypCredentials).toBe(false);
    expect(settings?.hasSavedSuperfreteApiKey).toBe(false);
    expect((settings as any)?.mypPasswordEncrypted).toBeUndefined();
    expect((settings as any)?.superfreteApiKeyEncrypted).toBeUndefined();
  });

  it("derives vendor and shipping capabilities from seller settings", () => {
    expect(
      getUserCapabilities({
        sellerModeEnabled: false,
        mypUsername: "seller",
        mypPasswordEncrypted: "encrypted-password",
        superfreteApiKeyEncrypted: "encrypted-key",
      })
    ).toEqual({ hasVendorCapability: false, hasShippingCapability: false });

    expect(
      getUserCapabilities({
        sellerModeEnabled: true,
        mypUsername: "seller",
        mypPasswordEncrypted: "encrypted-password",
        superfreteApiKeyEncrypted: null,
      })
    ).toEqual({ hasVendorCapability: true, hasShippingCapability: false });

    expect(
      getUserCapabilities({
        sellerModeEnabled: true,
        mypUsername: "seller",
        mypPasswordEncrypted: "encrypted-password",
        superfreteApiKeyEncrypted: "encrypted-key",
      })
    ).toEqual({ hasVendorCapability: true, hasShippingCapability: true });
  });

  it("saves and encrypts MyP credentials and generates watchlistSyncToken", async () => {
    const updated = await updateUserSettingsService(
      userId,
      {
        mypLogin: "collector@myp.com",
        mypPassword: "SecretPassword123!",
      },
      db
    );

    expect(updated).not.toBeNull();
    expect(updated?.hasSavedMypCredentials).toBe(true);
    expect(updated?.mypLogin).toBe("collector@myp.com");
    expect(updated?.watchlistSyncToken).toBeDefined();

    // Verify database record has encrypted password and not plain text
    const [row] = await db.select().from(users).where(eq(users.id, userId));
    expect(row.mypPasswordEncrypted).toBeDefined();
    expect(row.mypPasswordEncrypted).not.toBe("SecretPassword123!");
    expect(decryptMypPassword(row.mypPasswordEncrypted!)).toBe("SecretPassword123!");
  });

  it("disables seller mode when the MyP username is cleared", async () => {
    await updateUserSettingsService(
      userId,
      { mypPassword: "SecretPassword123!", sellerModeEnabled: true },
      db
    );

    const updated = await updateUserSettingsService(userId, { mypUsername: "" }, db);

    expect(updated?.mypUsername).toBeNull();
    expect(updated?.sellerModeEnabled).toBe(false);
    expect(updated?.hasVendorCapability).toBe(false);
  });

  it("clears saved MyP credentials when clearMypCredentials is true", async () => {
    await updateUserSettingsService(
      userId,
      {
        mypLogin: "collector@myp.com",
        mypPassword: "SecretPassword123!",
      },
      db
    );

    const cleared = await updateUserSettingsService(
      userId,
      {
        clearMypCredentials: true,
      },
      db
    );

    expect(cleared?.hasSavedMypCredentials).toBe(false);
    expect(cleared?.mypLogin).toBeNull();
    expect(cleared?.sellerModeEnabled).toBe(false);
    expect(cleared?.hasVendorCapability).toBe(false);

    const [row] = await db.select().from(users).where(eq(users.id, userId));
    expect(row.mypPasswordEncrypted).toBeNull();
    expect(row.mypLogin).toBeNull();
  });

  it("saves and encrypts Superfrete API key and fairness multipliers", async () => {
    const updated = await updateUserSettingsService(
      userId,
      {
        superfreteApiKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.superfrete-token",
        slightlyOverpricedMultiplier: 1.25,
        heavilyOverpricedMultiplier: 2.1,
      },
      db
    );

    expect(updated?.hasSavedSuperfreteApiKey).toBe(true);
    expect(updated?.slightlyOverpricedMultiplier).toBe(1.25);
    expect(updated?.heavilyOverpricedMultiplier).toBe(2.1);

    const [row] = await db.select().from(users).where(eq(users.id, userId));
    expect(row.superfreteApiKeyEncrypted).toBeDefined();
    expect(decryptMypPassword(row.superfreteApiKeyEncrypted!)).toBe(
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.superfrete-token"
    );
  });

  it("clears Superfrete API key when clearSuperfreteApiKey is true", async () => {
    await updateUserSettingsService(
      userId,
      {
        superfreteApiKey: "superfrete-token",
      },
      db
    );

    const cleared = await updateUserSettingsService(
      userId,
      {
        clearSuperfreteApiKey: true,
      },
      db
    );

    expect(cleared?.hasSavedSuperfreteApiKey).toBe(false);

    const [row] = await db.select().from(users).where(eq(users.id, userId));
    expect(row.superfreteApiKeyEncrypted).toBeNull();
  });

  it("saves shipping package preset and dimension properties", async () => {
    const updated = await updateUserSettingsService(
      userId,
      {
        shippingPackagePreset: "bubble-mailer",
        shippingPackageHeight: 3.5,
        shippingPackageWidth: 16,
        shippingPackageLength: 22,
        shippingPackageBaseWeight: 60,
        shippingPackageTapeWeight: 8,
        shippingCardWeight: 3.5,
      },
      db
    );

    expect(updated?.shippingPackagePreset).toBe("bubble-mailer");
    expect(updated?.shippingPackageHeight).toBe(3.5);
    expect(updated?.shippingPackageWidth).toBe(16);
    expect(updated?.shippingPackageLength).toBe(22);
    expect(updated?.shippingPackageBaseWeight).toBe(60);
    expect(updated?.shippingPackageTapeWeight).toBe(8);
    expect(updated?.shippingCardWeight).toBe(3.5);
  });
});
