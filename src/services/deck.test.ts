import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
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
});
