import { describe, it, expect } from "vitest";
import { createTestDb } from "../db/test-utils";
import { cards, cardEditions, cardCirculations, users, decks, deckCards, metaStaples } from "../db/schema";
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

    // Seed card with TERA element to test alias filtering
    await db.insert(cards).values({
      slug: "silvie-slime",
      name: "Silvie, Slime Sovereign",
      element: "TERA",
      class: "TAMER",
      type: "CHAMPION",
      subtypes: "[]",
      effect: "",
    });

    const teraFilter = await searchCatalog({ element: "TERA" }, db);
    expect(teraFilter.total).toBe(1);
    expect(teraFilter.cards[0].slug).toBe("silvie-slime");

    const earthAliasFilter = await searchCatalog({ element: "EARTH" }, db);
    expect(earthAliasFilter.total).toBe(1);
    expect(earthAliasFilter.cards[0].slug).toBe("silvie-slime");

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

    // 6. Meta staple detection and staplesOnly filtering
    await db.insert(metaStaples).values({
      cardSlug: "flame-burst",
      cardName: "Flame Burst",
      categories: JSON.stringify(["Fire Main Deck"]),
      primaryCategory: "Fire Main Deck",
      element: "FIRE",
      inclusionRate: "94.2%",
      avgCopies: "3.8",
      recommendedCopies: 4,
      deckCount: 45,
    });

    const stapleSearch = await searchCatalog({ staplesOnly: true }, db);
    expect(stapleSearch.total).toBe(1);
    expect(stapleSearch.cards[0].slug).toBe("flame-burst");
    expect(stapleSearch.cards[0].isMetaStaple).toBe(true);
    expect(stapleSearch.cards[0].stapleInclusionRate).toBe("94.2%");
    expect(stapleSearch.cards[0].stapleRecommendedCopies).toBe(4);
    expect(stapleSearch.cards[0].stapleCategories).toEqual(["Fire Main Deck"]);
  });

  it("filters cards by keywords with additive (AND) and either (OR) match modes", async () => {
    const { db } = await createTestDb();

    await db.insert(cards).values([
      {
        slug: "aegis-vanguard",
        name: "Aegis Vanguard",
        element: "NORM",
        class: "WARRIOR",
        type: "ALLY",
        subtypes: JSON.stringify(["WARRIOR", "HUMAN"]),
        effect: "**Taunt**\n\n**Floating Memory** *(While paying memory cost, banish this from GY.)*",
      },
      {
        slug: "alice-distorted-queen",
        name: "Alice, Distorted Queen",
        element: "NORM",
        class: "CLERIC",
        type: "ALLY",
        subtypes: JSON.stringify(["CLERIC", "DISTORTION", "HUMAN"]),
        effect: "**On Enter:** You gain the Phantasmagoria mastery.",
      },
      {
        slug: "spectral-defender",
        name: "Spectral Defender",
        element: "WATER",
        class: "WARRIOR",
        type: "ALLY",
        subtypes: JSON.stringify(["WARRIOR", "PHANTASM"]),
        effect: "**Taunt**\n\nWhenever this unit is attacked, recover 1 life.",
      },
    ]);

    // 1. Single keyword filter (Distortion)
    const distortionSearch = await searchCatalog({ keywords: ["Distortion"] }, db);
    expect(distortionSearch.total).toBe(1);
    expect(distortionSearch.cards[0].slug).toBe("alice-distorted-queen");

    // 2. Additive mode (AND): Floating Memory AND Taunt
    const andSearch = await searchCatalog(
      { keywords: ["Floating Memory", "Taunt"], keywordsMatchMode: "all" },
      db
    );
    expect(andSearch.total).toBe(1);
    expect(andSearch.cards[0].slug).toBe("aegis-vanguard");

    // 3. Either mode (OR): Floating Memory OR Distortion
    const orSearch = await searchCatalog(
      { keywords: ["Floating Memory", "Distortion"], keywordsMatchMode: "any" },
      db
    );
    expect(orSearch.total).toBe(2);
    const orSlugs = orSearch.cards.map((c) => c.slug).sort();
    expect(orSlugs).toEqual(["aegis-vanguard", "alice-distorted-queen"]);

    // 4. Either mode (OR): Taunt OR Distortion -> all 3 cards match
    const orThreeSearch = await searchCatalog(
      { keywords: ["Taunt", "Distortion"], keywordsMatchMode: "any" },
      db
    );
    expect(orThreeSearch.total).toBe(3);

    // 5. Case-insensitivity check
    const caseSearch = await searchCatalog({ keywords: ["distortion"] }, db);
    expect(caseSearch.total).toBe(1);
    expect(caseSearch.cards[0].slug).toBe("alice-distorted-queen");
  });
});
