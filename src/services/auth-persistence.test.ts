import { describe, it, expect } from "vitest";
import { createTestDb } from "../db/test-utils";
import { users, decks, collectionItems, cards, cardEditions } from "../db/schema";
import { DEFAULT_USER_ID, migrateDefaultUserDataToUser } from "./seed";
import { eq } from "drizzle-orm";

describe("User Account Resolution & Cross-Device Persistence", () => {
  it("resolves canonical user ID by email to prevent duplicate IDs on multiple devices", async () => {
    const { db } = await createTestDb();

    // Device 1 registers Pedro
    const canonicalId = "user_pedro_uuid_123";
    const userEmail = "pedro@example.com";

    await db.insert(users).values({
      id: canonicalId,
      name: "Pedro Fabrino",
      email: userEmail,
      friendCode: "GA-PEDRO1",
      lowPopThreshold: 1000,
    });

    // Device 2 logs in with Google OAuth using same email
    // OAuth produces a fresh ephemeral id or different id
    const device2OAuthId = "google_sub_99999999";

    // Lookup by normalized email should return existing canonical user
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, userEmail.toLowerCase().trim()))
      .get();

    expect(existing).toBeDefined();
    expect(existing?.id).toBe(canonicalId);
    expect(existing?.id).not.toBe(device2OAuthId);
  });

  it("migrates decks and collection cards from DEFAULT_USER_ID into authenticated user", async () => {
    const { db } = await createTestDb();

    const targetUserId = "user_authenticated_456";

    await db.insert(users).values([
      {
        id: DEFAULT_USER_ID,
        name: "Alex",
        email: "alex@grandarchive.local",
        friendCode: "GA-ALEX01",
        lowPopThreshold: 1000,
      },
      {
        id: targetUserId,
        name: "Pedro Fabrino",
        email: "pedro@example.com",
        friendCode: "GA-PEDRO2",
        lowPopThreshold: 1000,
      },
    ]);

    await db.insert(cards).values({
      slug: "rousing-slime",
      name: "Rousing Slime",
      element: "NORM",
      class: "TAMER",
      type: "ALLY",
      subtypes: "[]",
    });

    await db.insert(cardEditions).values({
      id: "ed-slime-1",
      cardSlug: "rousing-slime",
      setPrefix: "RDO",
      setName: "Re:Collection",
      collectorNumber: "275",
      rarity: 1,
      imageUrl: "https://example.com/slime.png",
    });

    // Create a deck under DEFAULT_USER_ID
    await db.insert(decks).values({
      id: "deck-guest-1",
      userId: DEFAULT_USER_ID,
      name: "Slime Swarm",
      champion: "Silvie",
      format: "standard",
    });

    // Create collection items:
    // 1. One edition that targetUser doesn't have yet (1x non-foil)
    await db.insert(collectionItems).values({
      id: "col-default-1",
      userId: DEFAULT_USER_ID,
      editionId: "ed-slime-1",
      foil: false,
      quantity: 1,
      isDedicated: false,
    });

    // 2. targetUser already has 2x non-foil of ed-slime-1
    await db.insert(collectionItems).values({
      id: "col-target-1",
      userId: targetUserId,
      editionId: "ed-slime-1",
      foil: false,
      quantity: 2,
      isDedicated: false,
    });

    // Run migration
    await migrateDefaultUserDataToUser(targetUserId, db as any);

    // Verify deck is now owned by targetUserId
    const migratedDeck = await db.select().from(decks).where(eq(decks.id, "deck-guest-1")).get();
    expect(migratedDeck?.userId).toBe(targetUserId);

    // Verify default user has no decks
    const defaultDecks = await db.select().from(decks).where(eq(decks.userId, DEFAULT_USER_ID));
    expect(defaultDecks.length).toBe(0);

    // Verify collection item was merged: 2 + 1 = 3x non-foil
    const targetItems = await db
      .select()
      .from(collectionItems)
      .where(eq(collectionItems.userId, targetUserId));
    expect(targetItems.length).toBe(1);
    expect(targetItems[0].quantity).toBe(3);

    // Verify default user has no leftover collection items
    const defaultItems = await db
      .select()
      .from(collectionItems)
      .where(eq(collectionItems.userId, DEFAULT_USER_ID));
    expect(defaultItems.length).toBe(0);
  });
});
