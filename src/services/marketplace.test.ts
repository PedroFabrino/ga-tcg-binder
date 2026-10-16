import { describe, it, expect } from "vitest";
import { createTestDb } from "../db/test-utils";
import { cards, cardEditions, users, decks, deckCards, collectionItems, mypCards } from "../db/schema";
import {
  parseMypHtml,
  syncUserMarketplace,
  getUserMarketplaceReport,
  claimMarketplaceCardForBinder,
} from "./marketplace";
import { calculateAggregatedShortages } from "./shortage";

const SAMPLE_MYP_HTML_PAGE_1 = `
<div class="card" data-ga-item-id="grandarchive_ptm_086p1">
  <a class="card-img-link" href="/grandarchive/produto/384755/gilded-pyre-curio-foil">
    <div class="card-img-wrap">
      <img class="card-thumb" src="https://img.mypcards.com/test.jpg" alt="Gilded Pyre (Curio Foil) | Grand Archive">
    </div>
  </a>
  <div class="card-dados mostra-qualidade">
    <div class="card-name">
      <h3 title="Gilded Pyre (Curio Foil)"> Gilded Pyre (Curio Foil) </h3>
      <div class="card-subname">
        <span class="card-edicao" title="Phantom Monarchs">PTM</span>
      </div>
    </div>
    <div class="card-qualidade">
      <div>
        <span class="chip-verde chip-inline chip-com-bandeira" title="NM - Quase nova">NM</span>
      </div>
    </div>
    <div class="card-estatistica">
      <span class="quantidade"><span class="quantidade-num">1</span></span>
      <span class="card-preco moeda">R$&nbsp;800,00</span>
    </div>
  </div>
</div>
<div class="card" data-ga-item-id="grandarchive_rdo_122">
  <a class="card-img-link" href="/grandarchive/produto/390001/hymn-of-gaias-grace">
    <div class="card-img-wrap"></div>
  </a>
  <div class="card-dados mostra-qualidade">
    <div class="card-name">
      <h3 title="Hymn of Gaia&#039;s Grace"> Hymn of Gaia&#039;s Grace </h3>
      <div class="card-subname">
        <span class="card-edicao" title="Re:Collection">RDO</span>
      </div>
    </div>
    <div class="card-qualidade">
      <div>
        <span class="chip-verde chip-inline" title="NM - Quase nova">NM</span>
      </div>
    </div>
    <div class="card-estatistica">
      <span class="quantidade"><span class="quantidade-num">2</span></span>
      <span class="card-preco moeda">R$ 2,00</span>
    </div>
  </div>
</div>
<div class="card" data-ga-item-id="grandarchive_hvn_180">
  <a class="card-img-link" href="/grandarchive/produto/390002/wildgrowth-fatestone"></a>
  <div class="card-dados">
    <div class="card-name">
      <h3>Wildgrowth Fatestone // Elder Mandrill</h3>
      <div class="card-subname">
        <span class="card-edicao">HVN</span>
      </div>
    </div>
    <div class="card-estatistica">
      <span class="quantidade"><span class="quantidade-num">1</span></span>
      <span class="card-preco moeda">R$ 15,00</span>
    </div>
  </div>
</div>
`;

describe("Marketplace (MyPCards) Sync, Shortage Offset & Claim Seam", () => {
  it("parses MyPCards HTML blocks cleanly with entities, foil status, price, and product URLs", () => {
    const parsed = parseMypHtml(SAMPLE_MYP_HTML_PAGE_1);
    expect(parsed).toHaveLength(3);

    expect(parsed[0]).toMatchObject({
      rawName: "Gilded Pyre (Curio Foil)",
      cleanName: "Gilded Pyre",
      setPrefix: "PTM",
      quantity: 1,
      price: "R$ 800,00",
      quality: "NM - Quase nova",
      isFoil: true,
      mypItemId: "grandarchive_ptm_086p1",
      mypProductUrl: "https://mypcards.com/grandarchive/produto/384755/gilded-pyre-curio-foil",
    });

    expect(parsed[1]).toMatchObject({
      rawName: "Hymn of Gaia's Grace",
      cleanName: "Hymn of Gaia's Grace",
      setPrefix: "RDO",
      quantity: 2,
      price: "R$ 2,00",
      isFoil: false,
      mypItemId: "grandarchive_rdo_122",
      mypProductUrl: "https://mypcards.com/grandarchive/produto/390001/hymn-of-gaias-grace",
    });

    expect(parsed[2]).toMatchObject({
      rawName: "Wildgrowth Fatestone // Elder Mandrill",
      cleanName: "Wildgrowth Fatestone // Elder Mandrill",
      setPrefix: "HVN",
      quantity: 1,
      price: "R$ 15,00",
      mypItemId: "grandarchive_hvn_180",
    });
  });

  it("syncs marketplace listings, isolates them from collection_items, detects shortage offsets, and claims cards to binder", async () => {
    const { db } = await createTestDb();

    // 1. Seed user and catalog cards
    await db.insert(users).values({
      id: "user-fabrino",
      name: "Fabrino",
      friendCode: "FAB-01",
    });

    await db.insert(cards).values([
      {
        slug: "gilded-pyre",
        name: "Gilded Pyre",
        element: "FIRE",
        class: "MAGE",
        type: "ACTION",
      },
      {
        slug: "hymn-of-gaias-grace",
        name: "Hymn of Gaia's Grace",
        element: "TERA",
        class: "TAMER",
        type: "ACTION",
      },
      {
        slug: "wildgrowth-fatestone",
        name: "Wildgrowth Fatestone",
        element: "WIND",
        class: "TAMER",
        type: "REGALIA",
      },
    ]);

    await db.insert(cardEditions).values([
      {
        id: "ed-gilded-ptm",
        cardSlug: "gilded-pyre",
        setPrefix: "PTM",
        setName: "Phantom Monarchs",
        collectorNumber: "086",
        rarity: 7,
        imageUrl: "https://api.gatcg.com/gilded.jpg",
      },
      {
        id: "ed-hymn-rdo",
        cardSlug: "hymn-of-gaias-grace",
        setPrefix: "RDO",
        setName: "Re:Collection",
        collectorNumber: "122",
        rarity: 2,
        imageUrl: "https://api.gatcg.com/hymn.jpg",
      },
      {
        id: "ed-wg-hvn",
        cardSlug: "wildgrowth-fatestone",
        setPrefix: "HVN",
        setName: "Heaven",
        collectorNumber: "180",
        rarity: 3,
        imageUrl: "https://api.gatcg.com/wg.jpg",
      },
    ]);

    // 2. Seed a Deck needing 3x Hymn of Gaia's Grace (0 owned in binder -> 3 missing!)
    // And needing 1x Gilded Pyre (1 already owned in binder -> 0 missing!)
    await db.insert(decks).values({
      id: "deck-silvie",
      userId: "user-fabrino",
      name: "Fire Slimes Silvie",
      champion: "Silvie",
    });

    await db.insert(deckCards).values([
      {
        id: "dc-1",
        deckId: "deck-silvie",
        cardSlug: "hymn-of-gaias-grace",
        zone: "main",
        quantity: 3,
      },
      {
        id: "dc-2",
        deckId: "deck-silvie",
        cardSlug: "gilded-pyre",
        zone: "main",
        quantity: 1,
      },
    ]);

    // User already owns 1x Gilded Pyre in their binder
    await db.insert(collectionItems).values({
      id: "ci-gilded",
      userId: "user-fabrino",
      editionId: "ed-gilded-ptm",
      foil: true,
      quantity: 1,
      isDedicated: false,
    });

    // 3. Mock fetcher for MyP crawl
    const mockFetch = (async (url: string) => {
      if (url.includes("/usuario/load-more")) {
        return {
          ok: true,
          json: async () => ({ success: false, html: "" }),
        };
      }
      return {
        ok: true,
        text: async () => SAMPLE_MYP_HTML_PAGE_1,
      };
    }) as unknown as typeof fetch;

    const syncStats = await syncUserMarketplace("user-fabrino", "Fabrino", db, mockFetch);
    expect(syncStats.totalSynced).toBe(3);
    expect(syncStats.matchedCount).toBe(3);
    expect(syncStats.unmatchedCount).toBe(0);

    // Verify isolation: collection_items still only has the 1 original item
    const binderRows = await db.select().from(collectionItems);
    expect(binderRows).toHaveLength(1);

    // 4. Verify Marketplace Report & Shortage Offset detection
    const report = await getUserMarketplaceReport("user-fabrino", db);
    expect(report.mypUsername).toBe("Fabrino");
    expect(report.summary.totalListings).toBe(3);
    expect(report.summary.totalCopies).toBe(4); // 1 + 2 + 1
    expect(report.summary.totalValueBrl).toBeCloseTo(819.0, 1); // 800*1 + 2*2 + 15*1 = 819
    expect(report.summary.shortageOffsetCount).toBe(1); // Only Hymn of Gaia's Grace is missing in deck!

    const hymnListing = report.cards.find((c) => c.cardSlug === "hymn-of-gaias-grace");
    expect(hymnListing).toBeDefined();
    expect(hymnListing?.isShortageOffset).toBe(true);
    expect(hymnListing?.concurrentMissing).toBe(3);
    expect(hymnListing?.deckNeeds).toHaveLength(1);
    expect(hymnListing?.deckNeeds[0].deckName).toBe("Fire Slimes Silvie");

    const gildedListing = report.cards.find((c) => c.cardSlug === "gilded-pyre");
    expect(gildedListing?.isShortageOffset).toBe(false); // Covered by binder copy

    // 5. Verify Bidirectional Cross-Reference in Consolidated Shortages
    const shortageReport = await calculateAggregatedShortages("user-fabrino", db);
    const hymnShortage = shortageReport.cards.find((c) => c.cardSlug === "hymn-of-gaias-grace");
    expect(hymnShortage).toBeDefined();
    expect(hymnShortage?.mypAvailableCopies).toBe(2);

    // 6. Claim 1 copy of Hymn of Gaia's Grace from MyP into Binder
    const claimResult = await claimMarketplaceCardForBinder("user-fabrino", hymnListing!.id, 1, db);
    expect(claimResult.success).toBe(true);
    expect(claimResult.claimedQuantity).toBe(1);
    expect(claimResult.mypProductUrl).toBe(
      "https://mypcards.com/grandarchive/produto/390001/hymn-of-gaias-grace"
    );

    // Verify binder now has Hymn of Gaia's Grace (quantity 1) and MyP listing decremented from 2 -> 1
    const updatedReport = await getUserMarketplaceReport("user-fabrino", db);
    const updatedHymn = updatedReport.cards.find((c) => c.cardSlug === "hymn-of-gaias-grace");
    expect(updatedHymn?.quantity).toBe(1);
    expect(updatedHymn?.concurrentMissing).toBe(2); // Was 3, now 2 missing!
  });
});
