import { describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import * as catalogRepository from "@/db/repositories/catalog-repository";
import { createTestDb } from "@/db/test-utils";
import { cards, deckCards, decks, users } from "@/db/schema";
import {
  createDeckService,
  DeckNotFoundError,
  DeckValidationError,
  deleteDeckService,
  updateDeckService,
} from "./deck";

const user = {
  id: "deck-service-user",
  name: "Deck Service User",
  email: "deck-service@example.com",
  friendCode: "GA-DECK01",
  lowPopThreshold: 1000,
};

describe("deck service", () => {
  it("creates an Omnidex deck and its missing catalog card", async () => {
    const { db } = await createTestDb();
    await db.insert(users).values(user);

    const { id } = await createDeckService(user.id, {
      name: "  Slime &amp; Swarm  ",
      champion: "  Silvie  ",
      omnidexText: "# Material Deck\n1 Silvie\n# Main Deck\n4 Rousing Slime",
    }, db);

    const [deck] = await db.select().from(decks).where(eq(decks.id, id));
    const deckCardRows = await db.select().from(deckCards).where(eq(deckCards.deckId, id));
    const [slime] = await db.select().from(cards).where(eq(cards.slug, "rousing-slime"));

    expect(deck).toMatchObject({
      userId: user.id,
      name: "Slime & Swarm",
      champion: "Silvie",
      format: "standard",
      section: "4fun",
      priority: 0,
    });
    expect(deckCardRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ cardSlug: "silvie", zone: "material", quantity: 1 }),
      expect.objectContaining({ cardSlug: "rousing-slime", zone: "main", quantity: 4 }),
    ]));
    expect(slime).toMatchObject({ name: "Rousing Slime" });
  });

  it("does not persist a deck when importing a missing catalog card fails", async () => {
    const { db } = await createTestDb();
    await db.insert(users).values(user);
    const upsertCatalogCard = vi
      .spyOn(catalogRepository, "upsertCatalogCard")
      .mockRejectedValueOnce(new Error("Catalog unavailable"));

    await expect(
      createDeckService(user.id, {
        name: "Failed import",
        omnidexText: "1 Missing Card",
      }, db)
    ).rejects.toThrow("Catalog unavailable");

    expect(await db.select().from(decks)).toEqual([]);
    upsertCatalogCard.mockRestore();
  });

  it("updates and deletes an existing deck", async () => {
    const { db } = await createTestDb();
    await db.insert(users).values(user);
    await db.insert(decks).values({
      id: "deck-to-update",
      userId: user.id,
      name: "Original",
      format: "standard",
    });

    await updateDeckService("deck-to-update", { name: "Updated", format: "casual" }, db);
    const [updatedDeck] = await db.select().from(decks).where(eq(decks.id, "deck-to-update"));
    expect(updatedDeck?.name).toBe("Updated");
    expect(updatedDeck?.format).toBe("casual");

    // In-place replacement with omnidexText
    await updateDeckService(
      "deck-to-update",
      {
        name: "New Deck Name",
        champion: "Lorraine",
        omnidexText: "# Material Deck\n1 Lorraine\n# Main Deck\n2 Fireball",
      },
      db
    );

    const [reloadedDeck] = await db.select().from(decks).where(eq(decks.id, "deck-to-update"));
    expect(reloadedDeck?.name).toBe("New Deck Name");
    expect(reloadedDeck?.champion).toBe("Lorraine");

    const newCards = await db.select().from(deckCards).where(eq(deckCards.deckId, "deck-to-update"));
    expect(newCards).toHaveLength(2);
    expect(newCards.find((c) => c.zone === "material")?.cardSlug).toBe("lorraine");
    expect(newCards.find((c) => c.zone === "main")?.quantity).toBe(2);

    await deleteDeckService("deck-to-update", db);

    const [deletedDeck] = await db.select().from(decks).where(eq(decks.id, "deck-to-update"));
    expect(deletedDeck).toBeUndefined();
  });

  it("reports validation and missing-deck errors", async () => {
    const { db } = await createTestDb();

    await expect(createDeckService(user.id, { name: "  " }, db))
      .rejects.toBeInstanceOf(DeckValidationError);
    await expect(updateDeckService("missing", {}, db))
      .rejects.toBeInstanceOf(DeckNotFoundError);
    await expect(deleteDeckService("missing", db))
      .rejects.toBeInstanceOf(DeckNotFoundError);
  });

  it("assigns sequential priority per section and orders decks by section and priority", async () => {
    const { db } = await createTestDb();
    await db.insert(users).values(user);

    await createDeckService(user.id, { name: "Casual Deck 1" }, db);
    await createDeckService(user.id, { name: "Casual Deck 2" }, db);
    await createDeckService(user.id, { name: "Tournament Deck 1", section: "competitive" }, db);
    await createDeckService(user.id, { name: "Tournament Deck 2", section: "competitive" }, db);

    const { getUserDecksSummary } = await import("./deck");
    const summary = await getUserDecksSummary(user.id, db);

    // competitive decks should come first, then 4fun decks, each ordered by priority
    expect(summary.map((d) => ({ name: d.name, section: d.section, priority: d.priority }))).toEqual([
      { name: "Tournament Deck 1", section: "competitive", priority: 0 },
      { name: "Tournament Deck 2", section: "competitive", priority: 1 },
      { name: "Casual Deck 1", section: "4fun", priority: 0 },
      { name: "Casual Deck 2", section: "4fun", priority: 1 },
    ]);
  });

  describe("reorderDecksService", () => {
    it("successfully reorders decks and moves across sections", async () => {
      const { db } = await createTestDb();
      await db.insert(users).values(user);

      const d1 = await createDeckService(user.id, { name: "D1", section: "competitive" }, db);
      const d2 = await createDeckService(user.id, { name: "D2", section: "competitive" }, db);
      const d3 = await createDeckService(user.id, { name: "D3", section: "4fun" }, db);

      const { reorderDecksService, getUserDecksSummary } = await import("./deck");

      // Move d1 to 4fun and promote d3 to competitive
      await reorderDecksService(user.id, [
        { id: d3.id, section: "competitive", priority: 0 },
        { id: d2.id, section: "competitive", priority: 1 },
        { id: d1.id, section: "4fun", priority: 0 },
      ], db);

      const summary = await getUserDecksSummary(user.id, db);
      expect(summary.map((d) => ({ name: d.name, section: d.section, priority: d.priority }))).toEqual([
        { name: "D3", section: "competitive", priority: 0 },
        { name: "D2", section: "competitive", priority: 1 },
        { name: "D1", section: "4fun", priority: 0 },
      ]);
    });

    it("rejects duplicates or empty updates", async () => {
      const { db } = await createTestDb();
      const { reorderDecksService } = await import("./deck");

      await expect(reorderDecksService(user.id, [], db)).rejects.toBeInstanceOf(DeckValidationError);
      await expect(
        reorderDecksService(user.id, [
          { id: "d1", section: "competitive", priority: 0 },
          { id: "d1", section: "4fun", priority: 1 },
        ], db)
      ).rejects.toBeInstanceOf(DeckValidationError);
    });

    it("rejects updates if any deck belongs to another user and does not modify database", async () => {
      const { db } = await createTestDb();
      await db.insert(users).values([
        user,
        { id: "other-user", name: "Other", friendCode: "GA-OTH01" },
      ]);

      const myDeck = await createDeckService(user.id, { name: "My Deck", section: "competitive" }, db);
      const otherDeck = await createDeckService("other-user", { name: "Other Deck", section: "competitive" }, db);

      const { reorderDecksService, getUserDecksSummary } = await import("./deck");

      await expect(
        reorderDecksService(user.id, [
          { id: myDeck.id, section: "4fun", priority: 0 },
          { id: otherDeck.id, section: "4fun", priority: 1 },
        ], db)
      ).rejects.toBeInstanceOf(DeckNotFoundError);

      // Verify atomic rollback: myDeck was NOT changed to 4fun
      const summary = await getUserDecksSummary(user.id, db);
      expect(summary[0].section).toBe("competitive");
    });

    it("orders public decks by section and priority while omitting section property", async () => {
      const { db } = await createTestDb();
      await db.insert(users).values(user);

      const comp = await createDeckService(user.id, { name: "Tournament Deck", section: "competitive" }, db);
      const fun = await createDeckService(user.id, { name: "Kitchen Table", section: "4fun" }, db);
      await createDeckService(user.id, { name: "Secret Deck", section: "competitive" }, db);

      const { getPublicDecksByUserId } = await import("../db/repositories/deck-repository");
      await db.update(decks).set({ isPublic: true }).where(inArray(decks.id, [comp.id, fun.id]));

      const publicDecks = await getPublicDecksByUserId(user.id, db);

      expect(publicDecks).toHaveLength(2);
      expect(publicDecks[0].name).toBe("Tournament Deck");
      expect(publicDecks[1].name).toBe("Kitchen Table");
      expect((publicDecks[0] as any).section).toBeUndefined();
      expect((publicDecks[1] as any).section).toBeUndefined();
    });
  });
});
