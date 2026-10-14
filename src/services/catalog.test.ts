import { describe, it, expect } from "vitest";
import { createTestDb } from "../db/test-utils";
import { cards, cardEditions, cardCirculations, users, decks, deckCards } from "../db/schema";
import { searchCatalog } from "./catalog";

describe("Catalog & Search Seam", () => {
  it("filters cards by query, element, class, set prefix, and detects Low Population printings", async () => {
    const { db } = await createTestDb();

    // Seed test cards matching Grand Archive attributes
    await db.insert(cards).values([
      {
        slug: "apotheosis-rite",
        name: "Apotheosis Rite",
        element: "NORM",
        class: "WARRIOR",
        type: "REGALIA",
        subtypes: JSON.stringify(["WARRIOR", "RING"]),
        effect: "Divine Relic. Banish CARDNAME: Draw a card.",
      },
      {
        slug: "flame-burst",
        name: "Flame Burst",
        element: "FIRE",
        class: "MAGE",
        type: "ACTION",
        subtypes: JSON.stringify(["SPELL"]),
        effect: "Deal 4 damage to target unit.",
      },
      {
        slug: "tidal-surge",
        name: "Tidal Surge",
        element: "WATER",
        class: "MAGE",
        type: "ACTION",
        subtypes: JSON.stringify(["SPELL"]),
        effect: "Return target unit to hand.",
      },
    ]);

    // Seed editions: Apotheosis Rite has a low-pop promo printing (pop 1) and a standard printing (pop 5000)
    await db.insert(cardEditions).values([
      {
        id: "ed-apo-promo",
        cardSlug: "apotheosis-rite",
        setPrefix: "P24",
        setName: "Promotional 2024",
        collectorNumber: "000",
        rarity: 9,
        imageUrl: "https://api.gatcg.com/cards/images/p24.jpg",
      },
      {
        id: "ed-apo-std",
        cardSlug: "apotheosis-rite",
        setPrefix: "DOA",
        setName: "Dawn of Ashes",
        collectorNumber: "001",
        rarity: 3,
        imageUrl: "https://api.gatcg.com/cards/images/doa.jpg",
      },
      {
        id: "ed-flame",
        cardSlug: "flame-burst",
        setPrefix: "DOA",
        setName: "Dawn of Ashes",
        collectorNumber: "020",
        rarity: 2,
        imageUrl: "https://api.gatcg.com/cards/images/flame.jpg",
      },
    ]);

    // Circulations
    await db.insert(cardCirculations).values([
      {
        id: "circ-1",
        editionId: "ed-apo-promo",
        kind: "FOIL",
        population: 1, // <= 1000 => LOW POP
        foil: true,
      },
      {
        id: "circ-2",
        editionId: "ed-apo-std",
        kind: "NONFOIL",
        population: 5000, // > 1000 => STANDARD
        foil: false,
      },
      {
        id: "circ-3",
        editionId: "ed-flame",
        kind: "NONFOIL",
        population: 15000,
        foil: false,
      },
    ]);

    // 1. Search by name query
    const nameSearch = await searchCatalog({ query: "apotheosis" }, db);
    expect(nameSearch.total).toBe(1);
    expect(nameSearch.cards[0].slug).toBe("apotheosis-rite");
    expect(nameSearch.cards[0].hasLowPopEdition).toBe(true);

    const promoEd = nameSearch.cards[0].editions.find((e) => e.setPrefix === "P24");
    expect(promoEd?.isLowPop).toBe(true);
    expect(promoEd?.lowestPopulation).toBe(1);

    const stdEd = nameSearch.cards[0].editions.find((e) => e.setPrefix === "DOA");
    expect(stdEd?.isLowPop).toBe(false);
    expect(stdEd?.lowestPopulation).toBe(5000);

    // 2. Filter by Element FIRE
    const fireFilter = await searchCatalog({ element: "FIRE" }, db);
    expect(fireFilter.total).toBe(1);
    expect(fireFilter.cards[0].slug).toBe("flame-burst");

    // 3. Filter by Class MAGE
    const mageFilter = await searchCatalog({ class: "MAGE" }, db);
    expect(mageFilter.total).toBe(2);

    // 4. Filter by Low Population Only
    const lowPopFilter = await searchCatalog({ lowPopOnly: true, lowPopThreshold: 1000 }, db);
    expect(lowPopFilter.total).toBe(1);
    expect(lowPopFilter.cards[0].slug).toBe("apotheosis-rite");

    // 5. Deck usage detection
    await db.insert(users).values({ id: "user-1", name: "Player 1", friendCode: "P1-TEST", lowPopThreshold: 1000 });
    await db.insert(decks).values({ id: "deck-1", userId: "user-1", name: "Fire Aggro" });
    await db.insert(deckCards).values({
      id: "dc-1",
      deckId: "deck-1",
      cardSlug: "flame-burst",
      zone: "main",
      quantity: 4,
    });

    const deckUsageSearch = await searchCatalog({ query: "flame", userId: "user-1" }, db);
    expect(deckUsageSearch.cards[0].deckUsage).toHaveLength(1);
    expect(deckUsageSearch.cards[0].deckUsage[0]).toMatchObject({
      deckId: "deck-1",
      deckName: "Fire Aggro",
      quantity: 4,
      zone: "main",
    });
  });
});
