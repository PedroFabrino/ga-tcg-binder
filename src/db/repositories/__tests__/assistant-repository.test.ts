import { describe, expect, it, beforeEach } from "vitest";
import { createTestDb } from "../../test-utils";
import { users } from "../../schema";
import {
  createPairingToken,
  findValidPairingToken,
  consumePairingToken,
  upsertCollectorIdentity,
  findCollectorByIdentity,
  findIdentitiesByCollectorId,
  unlinkCollectorIdentity,
} from "../assistant-repository";

describe("assistant-repository", () => {
  let db: any;
  const testCollectorId = "user_collector_123";

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db;

    // Seed test user
    await db.insert(users).values({
      id: testCollectorId,
      name: "Arthur Pendragon",
      email: "arthur@camelot.local",
      friendCode: "GA-EXCAL1",
      locale: "en",
    });
  });

  describe("pairing tokens", () => {
    it("creates, finds, and consumes a valid pairing token", async () => {
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      const created = await createPairingToken(testCollectorId, "ABC123", expiresAt, db);

      expect(created.token).toBe("ABC123");
      expect(created.collectorId).toBe(testCollectorId);
      expect(created.usedAt).toBeNull();

      // Find token
      const found = await findValidPairingToken("abc123", new Date(), db);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);

      // Consume token
      await consumePairingToken(created.id, new Date(), db);

      // Verify no longer valid
      const consumed = await findValidPairingToken("ABC123", new Date(), db);
      expect(consumed).toBeNull();
    });

    it("rejects expired tokens", async () => {
      const past = new Date(Date.now() - 1000);
      await createPairingToken(testCollectorId, "EXPIRE", past, db);

      const found = await findValidPairingToken("EXPIRE", new Date(), db);
      expect(found).toBeNull();
    });
  });

  describe("collector identities", () => {
    it("links and finds a collector by platform identity", async () => {
      const linked = await upsertCollectorIdentity(
        {
          collectorId: testCollectorId,
          provider: "discord",
          providerUserId: "112233445566",
          providerUsername: "Arthur#0001",
        },
        db
      );

      expect(linked.provider).toBe("discord");
      expect(linked.providerUserId).toBe("112233445566");
      expect(linked.collectorId).toBe(testCollectorId);

      // Lookup by identity
      const found = await findCollectorByIdentity("discord", "112233445566", db);
      expect(found).not.toBeNull();
      expect(found?.collector.name).toBe("Arthur Pendragon");
      expect(found?.collector.friendCode).toBe("GA-EXCAL1");
      expect(found?.identity.providerUsername).toBe("Arthur#0001");
    });

    it("lists and unlinks identities", async () => {
      await upsertCollectorIdentity(
        {
          collectorId: testCollectorId,
          provider: "discord",
          providerUserId: "disc_1",
        },
        db
      );

      await upsertCollectorIdentity(
        {
          collectorId: testCollectorId,
          provider: "root",
          providerUserId: "root_guid_1",
        },
        db
      );

      const list = await findIdentitiesByCollectorId(testCollectorId, db);
      expect(list).toHaveLength(2);

      // Unlink discord
      await unlinkCollectorIdentity(testCollectorId, "discord", db);

      const remaining = await findIdentitiesByCollectorId(testCollectorId, db);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].provider).toBe("root");
    });
  });
});
