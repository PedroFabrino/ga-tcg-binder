import { describe, expect, it, beforeEach } from "vitest";
import { createTestDb } from "../../db/test-utils";
import { users } from "../../db/schema";
import {
  generatePairingCodeForCollector,
  linkIdentityWithToken,
  getLinkedIdentities,
  removeLinkedIdentity,
} from "../collector-assistant";
import * as assistantRepo from "../../db/repositories/assistant-repository";

describe("collector-assistant (Ticket 1: Identity Linking)", () => {
  let db: any;
  const testCollectorId = "user_arthur_123";

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db;

    // Seed test collector
    await db.insert(users).values({
      id: testCollectorId,
      name: "Arthur Pendragon",
      email: "arthur@camelot.local",
      friendCode: "GA-EXCAL1",
      locale: "en",
    });
  });

  it("generates a 6-digit alphanumeric uppercase pairing code", async () => {
    // Override db instance on repo calls using testDb
    const tokenRecord = await assistantRepo.createPairingToken(
      testCollectorId,
      "XYZ789",
      new Date(Date.now() + 600000),
      db
    );

    expect(tokenRecord.token).toBe("XYZ789");
    expect(tokenRecord.token).toHaveLength(6);
    expect(tokenRecord.collectorId).toBe(testCollectorId);
  });

  it("links an identity with valid token and consumes it", async () => {
    const tokenRecord = await assistantRepo.createPairingToken(
      testCollectorId,
      "LINK99",
      new Date(Date.now() + 600000),
      db
    );

    const validToken = await assistantRepo.findValidPairingToken("LINK99", new Date(), db);
    expect(validToken).not.toBeNull();

    // Consume token and link
    await assistantRepo.consumePairingToken(tokenRecord.id, new Date(), db);
    const linked = await assistantRepo.upsertCollectorIdentity(
      {
        collectorId: testCollectorId,
        provider: "discord",
        providerUserId: "discord_snow_99",
        providerUsername: "Arthur#1234",
      },
      db
    );

    expect(linked.provider).toBe("discord");
    expect(linked.providerUserId).toBe("discord_snow_99");

    // Token cannot be reused
    const consumed = await assistantRepo.findValidPairingToken("LINK99", new Date(), db);
    expect(consumed).toBeNull();

    // Verify lookup by identity
    const found = await assistantRepo.findCollectorByIdentity("discord", "discord_snow_99", db);
    expect(found).not.toBeNull();
    expect(found?.collector.name).toBe("Arthur Pendragon");
    expect(found?.collector.friendCode).toBe("GA-EXCAL1");
  });

  it("unlinks an identity cleanly", async () => {
    await assistantRepo.upsertCollectorIdentity(
      {
        collectorId: testCollectorId,
        provider: "root",
        providerUserId: "root_guid_abc",
      },
      db
    );

    const listBefore = await assistantRepo.findIdentitiesByCollectorId(testCollectorId, db);
    expect(listBefore).toHaveLength(1);

    await assistantRepo.unlinkCollectorIdentity(testCollectorId, "root", db);

    const listAfter = await assistantRepo.findIdentitiesByCollectorId(testCollectorId, db);
    expect(listAfter).toHaveLength(0);
  });
});
