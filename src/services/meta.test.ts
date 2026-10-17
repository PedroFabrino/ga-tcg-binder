import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../db/test-utils";
import { users, cards, cardEditions, collectionItems, metaArchetypes, mypCards, mypMarketCards } from "../db/schema";
import {
  seedMetaArchetypes,
  getMetaArchetypes,
  compareMetaDeckAgainstCollection,
  parseMetaTableHtml,
  rankPlacements,
  syncMetaArchetypes,
} from "./meta";

describe("Tournament Meta Explorer Seam", () => {
  it("seeds meta archetypes and runs shortage comparison against personal collection", async () => {
    const { db } = await createTestDb();

    // 1. Seed user
    await db.insert(users).values({
      id: "u-meta",
      name: "Meta Competitor",
      friendCode: "GA-META1",
      lowPopThreshold: 1000,
    });

    // 2. Insert card in catalog
    await db.insert(cards).values({
      slug: "fracturize",
      name: "Fracturize",
      element: "NORM",
      class: "WARRIOR",
      type: "ACTION",
      subtypes: "[]",
    });

    await db.insert(cardEditions).values({
      id: "ed-frac",
      cardSlug: "fracturize",
      setPrefix: "DOA",
      setName: "Dawn of Ashes",
      collectorNumber: "001",
      rarity: 3,
      imageUrl: "https://example.com/frac.jpg",
    });

    // User owns 2 copies of Fracturize
    await db.insert(collectionItems).values({
      id: "coll-1",
      userId: "u-meta",
      editionId: "ed-frac",
      quantity: 2,
      isDedicated: false,
    });

    // 3. Seed meta archetypes
    await seedMetaArchetypes(db);
    const archetypes = await getMetaArchetypes(db);
    expect(archetypes.length).toBeGreaterThanOrEqual(3);

    const lorraine = archetypes.find((a) => a.id === "meta-lorraine-wind");
    expect(lorraine).toBeDefined();
    expect(lorraine?.tier).toBe("S");

    // 4. Compare Lorraine Wind Warrior against user collection
    // Lorraine uses 4 Fracturize. User owns 2. Shortage should report missing: 2!
    const report = await compareMetaDeckAgainstCollection("meta-lorraine-wind", "u-meta", db);
    expect(report.deckName).toBe("Meta: Lorraine Wind Warrior");

    const fracItem = report.items.find((i) => i.cardSlug === "fracturize");
    expect(fracItem).toBeDefined();
    expect(fracItem?.requiredQuantity).toBe(4);
    expect(fracItem?.availableQuantity).toBe(2);
    expect(fracItem?.missingQuantity).toBe(2);
  });

  it("parses meta table HTML and ranks tournament placements by event prestige and ordinal", () => {
    const SAMPLE_META_TABLE = `
      <table>
        <tr>
          <td><span class="meta-tier">Tier 1</span></td>
          <td>
            <a href="/meta/archetypes/Wind%20Umbra%20Tristan">Wind Umbra Tristan</a>
            <span class="champion">Tristan, Shadow Stalker</span>
          </td>
          <td>18.5%</td>
          <td>56.2%</td>
          <td><span class="deck-count">48</span> decks</td>
        </tr>
      </table>
    `;

    const parsed = parseMetaTableHtml(SAMPLE_META_TABLE);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe("Wind Umbra Tristan");
    expect(parsed[0].tier).toBe("Tier 1");
    expect(parsed[0].element).toBe("Wind");
    expect(parsed[0].champion).toBe("Tristan, Shadow Stalker");
    expect(parsed[0].shareRate).toBe("18.5%");
    expect(parsed[0].winRate).toBe("56.2%");
    expect(parsed[0].deckCount).toBe(48);

    const SAMPLE_DETAIL_HTML = `
      <ol class="rp-list">
        <li>
          <span>Store Championship</span> - <span>1st Place</span>
          <a href="/events/100/decks/1001">Decklist</a>
        </li>
        <li>
          <span>World Championship</span> - <span>Top 4</span>
          <a href="/events/200/decks/2001">Decklist</a>
        </li>
        <li>
          <span>National Championship</span> - <span>1st Place</span>
          <a href="/events/300/decks/3001">Decklist</a>
        </li>
      </ol>
    `;

    const ranked = rankPlacements(SAMPLE_DETAIL_HTML);
    expect(ranked).toHaveLength(3);
    // Prestige order: Worlds (100) > Nationals (80) > Store Champs (20)
    expect(ranked[0].deckUrl).toBe("/events/200/decks/2001"); // Worlds
    expect(ranked[1].deckUrl).toBe("/events/300/decks/3001"); // Nationals 1st
    expect(ranked[2].deckUrl).toBe("/events/100/decks/1001"); // Store Champ 1st
  });

  it("eagerly syncs meta archetypes, caches deck URL, and soft-demotes vanished archetypes to Rogue", async () => {
    const { db } = await createTestDb();

    // Insert an existing archetype that will not be present in the new table (should become Rogue)
    await db.insert(metaArchetypes).values({
      id: "meta-old-archetype",
      name: "Old Archetype",
      tier: "Tier 1",
      champion: "Old Champion",
      shareRate: "10%",
      winRate: "50%",
      decklist: "# Material Deck\n1 Old Champion\n# Main Deck\n",
    });

    const mockMetaHtml = `
      <table>
        <tr>
          <td><span class="meta-tier">Tier 1</span></td>
          <td>
            <a href="/meta/archetypes/Wind%20Umbra%20Tristan">Wind Umbra Tristan</a>
            <span class="champion">Tristan, Shadow Stalker</span>
          </td>
          <td>18.5%</td>
          <td>56.2%</td>
          <td>48 decks</td>
        </tr>
      </table>
    `;

    const mockDetailHtml = `
      <ol class="rp-list">
        <li>
          <span>Ascent</span> - <span>1st Place</span>
          <a href="/events/500/decks/5001">Deck</a>
        </li>
      </ol>
    `;

    const mockDeckHtml = `
      <textarea id="omnidex-src">
# Material Deck
1 Tristan, Shadow Stalker

# Main Deck
4 Fracturize
4 Swift Strike
      </textarea>
    `;

    let fetchCount = 0;
    const customFetch = async (url: string) => {
      fetchCount++;
      if (url.includes("/meta/archetypes/")) {
        return { ok: true, text: async () => mockDetailHtml };
      }
      if (url.includes("/events/")) {
        return { ok: true, text: async () => mockDeckHtml };
      }
      return { ok: true, text: async () => mockMetaHtml };
    };

    // First sync: fetches meta, detail, and deck
    const result1 = await syncMetaArchetypes(db, customFetch as any);
    expect(result1.syncedArchetypes).toBe(1);
    expect(result1.decklistsFetched).toBe(1);
    expect(result1.decklistsCacheHits).toBe(0);

    // Verify vanished archetype is soft-demoted to Rogue
    const oldRow = await db.select().from(metaArchetypes).where(eq(metaArchetypes.id, "meta-old-archetype")).get();
    expect(oldRow?.tier).toBe("Rogue");

    // Second sync: URL is cached, should hit cache without re-fetching deck
    const result2 = await syncMetaArchetypes(db, customFetch as any);
    expect(result2.decklistsCacheHits).toBe(1);
  });

  it("calculates Archetype Completion over Material+Main using Binder + MyP Store and evaluates market cost-to-complete", async () => {
    const { db } = await createTestDb();

    // 1. User setup
    await db.insert(users).values({
      id: "u-rec-user",
      name: "Recommendation User",
      friendCode: "GA-REC1",
    });

    // 2. Catalog cards
    await db.insert(cards).values([
      { slug: "tristan", name: "Tristan, Shadow Stalker", element: "NORM", class: "ASSASSIN", type: "CHAMPION", subtypes: "[]" },
      { slug: "fracturize", name: "Fracturize", element: "NORM", class: "WARRIOR", type: "ACTION", subtypes: "[]" },
      { slug: "swift-strike", name: "Swift Strike", element: "WIND", class: "WARRIOR", type: "ATTACK", subtypes: "[]" },
    ]);

    await db.insert(cardEditions).values([
      { id: "ed-t", cardSlug: "tristan", setPrefix: "DOA", setName: "Dawn", collectorNumber: "001", rarity: 1, imageUrl: "https://example.com/t.jpg" },
      { id: "ed-f", cardSlug: "fracturize", setPrefix: "DOA", setName: "Dawn", collectorNumber: "002", rarity: 3, imageUrl: "https://example.com/f.jpg" },
      { id: "ed-s", cardSlug: "swift-strike", setPrefix: "DOA", setName: "Dawn", collectorNumber: "003", rarity: 2, imageUrl: "https://example.com/s.jpg" },
    ]);

    // 3. User holdings:
    // Core requires: 1 Tristan, 4 Fracturize, 4 Swift Strike = 9 core cards
    // User Binder: 1 Tristan, 2 Fracturize (Total binder = 3)
    // User MyP Store: 1 Fracturize (Total store = 1)
    // Total owned = 4/9 (44% completion)
    // Missing: 1 Fracturize, 4 Swift Strike = 5 cards missing
    await db.insert(collectionItems).values([
      { id: "c-t", userId: "u-rec-user", editionId: "ed-t", quantity: 1, isDedicated: false },
      { id: "c-f", userId: "u-rec-user", editionId: "ed-f", quantity: 2, isDedicated: false },
    ]);

    await db.insert(mypCards).values([
      { id: "myp-f", userId: "u-rec-user", cardSlug: "fracturize", editionId: "ed-f", rawName: "Fracturize", cardName: "Fracturize", setPrefix: "DOA", quantity: 1, price: "R$ 5,00", quality: "NM", isFoil: false },
    ]);

    // 4. Global Market listings:
    // 1 Fracturize at R$ 6,00
    // 2 Swift Strike at R$ 2,50 each (total R$ 5,00)
    // (Remaining 2 Swift Strike out of stock)
    await db.insert(mypMarketCards).values([
      { id: "mkt-f", cardSlug: "fracturize", editionId: "ed-f", rawName: "Fracturize", cardName: "Fracturize", setPrefix: "DOA", quantity: 1, price: "R$ 6,00", priceNumeric: 6.0, isFoil: false },
      { id: "mkt-s", cardSlug: "swift-strike", editionId: "ed-s", rawName: "Swift Strike", cardName: "Swift Strike", setPrefix: "DOA", quantity: 2, price: "R$ 2,50", priceNumeric: 2.5, isFoil: false },
    ]);

    // 5. Meta Archetype
    await db.insert(metaArchetypes).values({
      id: "meta-tristan-wind",
      name: "Tristan Wind Assassin",
      tier: "Tier 1",
      champion: "Tristan, Shadow Stalker",
      element: "Wind",
      shareRate: "15%",
      winRate: "55%",
      decklist: `# Material Deck\n1 Tristan, Shadow Stalker\n\n# Main Deck\n4 Fracturize\n4 Swift Strike\n`,
    });

    const archetypes = await getMetaArchetypes(db, "u-rec-user");
    expect(archetypes).toHaveLength(1);
    const tristan = archetypes[0];

    expect(tristan.totalCoreRequired).toBe(9);
    expect(tristan.binderCardsOwned).toBe(3); // 1 Tristan + 2 Fracturize
    expect(tristan.mypStoreCardsOwned).toBe(1); // 1 Fracturize from store
    expect(tristan.totalCoreOwned).toBe(4);
    expect(tristan.completionPct).toBe(44); // 4 / 9 = 44%
    expect(tristan.missingCardsCount).toBe(5);

    // Market fulfillable: 1 Fracturize + 2 Swift Strike = 3 cards available on MyP
    // Cost: 1 * 6.0 + 2 * 2.5 = R$ 11.00
    expect(tristan.missingAvailableOnMarketCount).toBe(3);
    expect(tristan.estimatedCostToCompleteBrl).toBe(11);
  });
});
