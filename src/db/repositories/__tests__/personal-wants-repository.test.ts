import { describe, expect, it, beforeEach } from "vitest";
import { createTestDb } from "../../test-utils";
import { users, cards, cardEditions } from "../../schema";
import { collectorIdentities } from "../../assistant-schema";
import {
  listPersonalWants,
  upsertPersonalWant,
  batchUpsertPersonalWants,
  removePersonalWant,
  setWantlistNotificationPreference,
  getWantlistNotificationPreference,
} from "../personal-wants-repository";

describe("personal-wants-repository", () => {
  let db: any;
  const testCollectorId = "user_wants_collector_1";

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db;

    // Seed test user
    await db.insert(users).values({
      id: testCollectorId,
      name: "Merlin Ambrosius",
      email: "merlin@camelot.local",
      friendCode: "GA-MERLIN",
      locale: "en",
    });

    // Seed cards
    await db.insert(cards).values([
      {
        slug: "creative-shock",
        name: "Creative Shock",
        element: "water",
        class: "mage",
        type: "action",
      },
      {
        slug: "fracture-storm",
        name: "Fracture Storm",
        element: "wind",
        class: "warrior",
        type: "attack",
      },
    ]);

    // Seed edition
    await db.insert(cardEditions).values({
      id: "ed_shock_1",
      cardSlug: "creative-shock",
      setPrefix: "DOA",
      setName: "Dawn of Ashes",
      collectorNumber: "042",
      rarity: 3,
      imageUrl: "https://images.ga.local/doa-042.png",
    });

    // Seed collector identity for discord
    await db.insert(collectorIdentities).values({
      id: "id_merlin_discord",
      collectorId: testCollectorId,
      provider: "discord",
      providerUserId: "discord_merlin_999",
      providerUsername: "Merlin#0001",
      wantlistNotificationsEnabled: false,
      linkedAt: new Date(),
    });
  });

  it("lists empty personal wants initially", async () => {
    const wants = await listPersonalWants(testCollectorId, db);
    expect(wants).toEqual([]);
  });

  it("upserts a new personal want and lists it with joined card data", async () => {
    const result = await upsertPersonalWant(
      {
        collectorId: testCollectorId,
        cardSlug: "creative-shock",
        editionId: "ed_shock_1",
        desiredQuantity: 2,
        foil: true,
        targetMaxPrice: 45.5,
        source: "manual",
      },
      db
    );

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected upsert to succeed");
    expect(result.item.desiredQuantity).toBe(2);
    expect(result.item.cardName).toBe("Creative Shock");
    expect(result.item.setPrefix).toBe("DOA");
    expect(result.item.foil).toBe(true);
    expect(result.item.targetMaxPrice).toBe(45.5);

    const list = await listPersonalWants(testCollectorId, db);
    expect(list).toHaveLength(1);
    expect(list[0].cardSlug).toBe("creative-shock");
    expect(list[0].desiredQuantity).toBe(2);
  });

  it("returns success:false without throwing for a non-existent card slug", async () => {
    const result = await upsertPersonalWant(
      {
        collectorId: testCollectorId,
        cardSlug: "nonexistent-card",
        desiredQuantity: 1,
        source: "manual",
      },
      db
    );

    expect(result.success).toBe(false);
    expect(result.item).toBeNull();

    const list = await listPersonalWants(testCollectorId, db);
    expect(list).toHaveLength(0);
  });

  it("increments quantity when upserting existing want", async () => {
    await upsertPersonalWant(
      {
        collectorId: testCollectorId,
        cardSlug: "creative-shock",
        desiredQuantity: 1,
        source: "manual",
      },
      db
    );

    const updated = await upsertPersonalWant(
      {
        collectorId: testCollectorId,
        cardSlug: "creative-shock",
        desiredQuantity: 3,
      },
      db
    );

    expect(updated.success).toBe(true);
    if (!updated.success) throw new Error("expected upsert to succeed");
    expect(updated.item.desiredQuantity).toBe(4);

    const list = await listPersonalWants(testCollectorId, db);
    expect(list).toHaveLength(1);
    expect(list[0].desiredQuantity).toBe(4);
  });

  it("decrements quantity and deletes when reaching zero", async () => {
    await upsertPersonalWant(
      {
        collectorId: testCollectorId,
        cardSlug: "fracture-storm",
        desiredQuantity: 3,
      },
      db
    );

    // Partial decrement
    const decRes = await removePersonalWant(testCollectorId, "fracture-storm", 1, db);
    expect(decRes.success).toBe(true);
    expect(decRes.remainingQuantity).toBe(2);
    expect(decRes.removed).toBe(false);

    let list = await listPersonalWants(testCollectorId, db);
    expect(list[0].desiredQuantity).toBe(2);

    // Full removal
    const remRes = await removePersonalWant(testCollectorId, "fracture-storm", undefined, db);
    expect(remRes.success).toBe(true);
    expect(remRes.remainingQuantity).toBe(0);
    expect(remRes.removed).toBe(true);

    list = await listPersonalWants(testCollectorId, db);
    expect(list).toHaveLength(0);
  });

  it("manages wantlist notification preference on collector identity", async () => {
    const initial = await getWantlistNotificationPreference(testCollectorId, "discord", db);
    expect(initial).toBe(false);

    await setWantlistNotificationPreference(testCollectorId, "discord", true, db);

    const updated = await getWantlistNotificationPreference(testCollectorId, "discord", db);
    expect(updated).toBe(true);
  });

  it("inserts and increments multiple wants via batchUpsertPersonalWants", async () => {
    const count = await batchUpsertPersonalWants(
      [
        {
          collectorId: testCollectorId,
          cardSlug: "creative-shock",
          desiredQuantity: 2,
          source: "omnidex",
        },
        {
          collectorId: testCollectorId,
          cardSlug: "fracture-storm",
          desiredQuantity: 3,
          source: "omnidex",
        },
      ],
      db
    );

    expect(count).toBe(2);

    let list = await listPersonalWants(testCollectorId, db);
    expect(list).toHaveLength(2);
    expect(list.find((i) => i.cardSlug === "creative-shock")?.desiredQuantity).toBe(2);
    expect(list.find((i) => i.cardSlug === "fracture-storm")?.desiredQuantity).toBe(3);

    // Increment existing via batch
    await batchUpsertPersonalWants(
      [
        {
          collectorId: testCollectorId,
          cardSlug: "creative-shock",
          desiredQuantity: 2,
        },
      ],
      db
    );

    list = await listPersonalWants(testCollectorId, db);
    expect(list.find((i) => i.cardSlug === "creative-shock")?.desiredQuantity).toBe(4);
  });
});
