import { describe, it, expect } from "vitest";
import { createTestDb } from "../db/test-utils";
import { cards, cardEditions, users, decks, deckCards, collectionItems, mypCards, mypMarketCards, metaStaples } from "../db/schema";
import {
  parseMypHtml,
  syncUserMarketplace,
  getUserMarketplaceReport,
  claimMarketplaceCardForBinder,
  syncGlobalMarketplace,
  getGlobalMarketReport,
  calculateNetMarketStock,
} from "./marketplace";
import { calculateAggregatedShortages, calculateDeckShortage } from "./shortage";

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

  it("syncs global market catalog, subtracts personal store stock, classifies Hard vs Shared shortages, and enriches deck shortages", async () => {
    const { db } = await createTestDb();

    // 1. Seed user and catalog
    await db.insert(users).values({
      id: "user-buyer",
      name: "Buyer",
      friendCode: "BUY-01",
      mypUsername: "BuyerStore",
    });

    await db.insert(cards).values([
      {
        slug: "dungeon-guide",
        name: "Dungeon Guide",
        element: "NORM",
        class: "WARRIOR",
        type: "ALLY",
      },
      {
        slug: "fire-ball",
        name: "Fire Ball",
        element: "FIRE",
        class: "MAGE",
        type: "ACTION",
      },
      {
        slug: "spirit-blade",
        name: "Spirit Blade",
        element: "WATER",
        class: "WARRIOR",
        type: "ITEM",
      },
      {
        slug: "unrelated-card",
        name: "Unrelated Card",
        element: "WIND",
        class: "RANGER",
        type: "ACTION",
      },
    ]);

    await db.insert(cardEditions).values([
      {
        id: "ed-dg-alc",
        cardSlug: "dungeon-guide",
        setPrefix: "ALC",
        setName: "Alchemical",
        collectorNumber: "010",
        rarity: 2,
        imageUrl: "https://api.gatcg.com/dg.jpg",
      },
      {
        id: "ed-fb-alc",
        cardSlug: "fire-ball",
        setPrefix: "ALC",
        setName: "Alchemical",
        collectorNumber: "020",
        rarity: 1,
        imageUrl: "https://api.gatcg.com/fb.jpg",
      },
      {
        id: "ed-sb-alc",
        cardSlug: "spirit-blade",
        setPrefix: "ALC",
        setName: "Alchemical",
        collectorNumber: "030",
        rarity: 3,
        imageUrl: "https://api.gatcg.com/sb.jpg",
      },
      {
        id: "ed-unrelated",
        cardSlug: "unrelated-card",
        setPrefix: "ALC",
        setName: "Alchemical",
        collectorNumber: "099",
        rarity: 1,
        imageUrl: "https://api.gatcg.com/unrelated.jpg",
      },
    ]);

    // 2. Setup Decks:
    // Deck 1 needs 4x Dungeon Guide and 2x Fire Ball
    // Deck 2 needs 2x Fire Ball
    // User owns:
    // - 2x Dungeon Guide in binder -> peakMissing = 4 - 2 = 2 (HARD SHORTAGE!)
    // - 2x Fire Ball in binder -> Deck 1 needs 2, Deck 2 needs 2. peakDemand = 2, totalDemand = 4.
    //   peakMissing = 2 - 2 = 0, concurrentMissing = 4 - 2 = 2 (SHARED SHORTAGE!)
    // Deck 1 also needs 1x Spirit Blade (0 owned in binder).
    // But user has 1x Spirit Blade listed in their OWN myp_cards!
    // On the market, there is 1x Spirit Blade available.
    // Self-collision: netExternalStock = 1 - 1 = 0! (Only the user's copy is on MyP!)
    await db.insert(decks).values([
      { id: "deck-a", userId: "user-buyer", name: "Warrior Beatdown" },
      { id: "deck-b", userId: "user-buyer", name: "Mage Burn" },
    ]);

    await db.insert(deckCards).values([
      { id: "dc-dg", deckId: "deck-a", cardSlug: "dungeon-guide", zone: "main", quantity: 4 },
      { id: "dc-fb-a", deckId: "deck-a", cardSlug: "fire-ball", zone: "main", quantity: 2 },
      { id: "dc-sb", deckId: "deck-a", cardSlug: "spirit-blade", zone: "main", quantity: 1 },
      { id: "dc-fb-b", deckId: "deck-b", cardSlug: "fire-ball", zone: "main", quantity: 2 },
    ]);

    // Binder items
    await db.insert(collectionItems).values([
      { id: "ci-dg", userId: "user-buyer", editionId: "ed-dg-alc", quantity: 2, isDedicated: false },
      { id: "ci-fb", userId: "user-buyer", editionId: "ed-fb-alc", quantity: 2, isDedicated: false },
    ]);

    // Personal store listing (myp_cards): user is selling 1x Spirit Blade
    await db.insert(mypCards).values({
      id: "myp-sb-self",
      userId: "user-buyer",
      cardSlug: "spirit-blade",
      editionId: "ed-sb-alc",
      rawName: "Spirit Blade",
      cardName: "Spirit Blade",
      setPrefix: "ALC",
      quantity: 1,
      price: "R$ 20,00",
      mypItemId: "grandarchive_alc_030",
    });

    // 3. Mock global catalog HTML pages
    const GLOBAL_PAGE_1_HTML = `
    <div class="summary"><strong>60</strong> itens encontrados.</div>
    <div class="card" data-ga-item-id="grandarchive_alc_010">
      <a class="card-img-link" href="/grandarchive/produto/101/dungeon-guide"></a>
      <div class="card-name"><h3>Dungeon Guide</h3></div>
      <span class="card-edicao">ALC</span>
      <span class="quantidade-num">6</span>
      <span class="card-preco moeda">R$ 5,00</span>
    </div>
    <div class="card" data-ga-item-id="grandarchive_alc_020">
      <a class="card-img-link" href="/grandarchive/produto/102/fire-ball"></a>
      <div class="card-name"><h3>Fire Ball</h3></div>
      <span class="card-edicao">ALC</span>
      <span class="quantidade-num">3</span>
      <span class="card-preco moeda">R$ 1,50</span>
    </div>
    `;

    const GLOBAL_PAGE_2_JSON = JSON.stringify({
      success: true,
      html: `
      <div class="card" data-ga-item-id="grandarchive_alc_030">
        <a class="card-img-link" href="/grandarchive/produto/103/spirit-blade"></a>
        <div class="card-name"><h3>Spirit Blade</h3></div>
        <span class="card-edicao">ALC</span>
        <span class="quantidade-num">1</span>
        <span class="card-preco moeda">R$ 20,00</span>
      </div>
      <div class="card" data-ga-item-id="grandarchive_alc_099">
        <a class="card-img-link" href="/grandarchive/produto/104/unrelated-card"></a>
        <div class="card-name"><h3>Unrelated Card</h3></div>
        <span class="card-edicao">ALC</span>
        <span class="quantidade-num">10</span>
        <span class="card-preco moeda">R$ 0,50</span>
      </div>
      `,
    });

    const mockFetch = (async (url: string) => {
      if (url.includes("/produto/load-more")) {
        return {
          ok: true,
          json: async () => JSON.parse(GLOBAL_PAGE_2_JSON),
          text: async () => GLOBAL_PAGE_2_JSON,
        };
      }
      return {
        ok: true,
        text: async () => GLOBAL_PAGE_1_HTML,
      };
    }) as unknown as typeof fetch;

    // Run global market sync
    const syncResult = await syncGlobalMarketplace(db, mockFetch);
    expect(syncResult.totalSynced).toBe(4);
    expect(syncResult.matchedCount).toBe(4);

    const savedMarketRows = await db.select().from(mypMarketCards);
    expect(savedMarketRows).toHaveLength(4);

    // 4. Test Global Market Report
    const marketReport = await getGlobalMarketReport("user-buyer", db);
    expect(marketReport.summary.totalListings).toBe(4);
    expect(marketReport.summary.totalMarketCopies).toBe(20); // 6 + 3 + 1 + 10
    expect(marketReport.summary.hardShortagesCount).toBe(1); // Dungeon Guide
    expect(marketReport.summary.sharedShortagesCount).toBe(1); // Fire Ball

    // Check Dungeon Guide (HARD SHORTAGE)
    const dgItem = marketReport.cards.find((c) => c.cardSlug === "dungeon-guide");
    expect(dgItem).toBeDefined();
    expect(dgItem?.shortageTier).toBe("HARD");
    expect(dgItem?.peakMissing).toBe(2);
    expect(dgItem?.concurrentMissing).toBe(2);
    expect(dgItem?.isBuyableShortage).toBe(true);
    expect(dgItem?.netExternalStock).toBe(6);
    expect(dgItem?.personalStoreQuantity).toBe(0);
    expect(dgItem?.peakDeckName).toBe("Warrior Beatdown");

    // Check Fire Ball (SHARED SHORTAGE)
    const fbItem = marketReport.cards.find((c) => c.cardSlug === "fire-ball");
    expect(fbItem).toBeDefined();
    expect(fbItem?.shortageTier).toBe("SHARED");
    expect(fbItem?.peakMissing).toBe(0);
    expect(fbItem?.concurrentMissing).toBe(2);
    expect(fbItem?.isBuyableShortage).toBe(true);
    expect(fbItem?.netExternalStock).toBe(3);

    // Check Spirit Blade (SELF COLLISION: total market = 1, personal store = 1 -> net external = 0)
    const sbItem = marketReport.cards.find((c) => c.cardSlug === "spirit-blade");
    expect(sbItem).toBeDefined();
    expect(sbItem?.shortageTier).toBe("HARD");
    expect(sbItem?.personalStoreQuantity).toBe(1);
    expect(sbItem?.netExternalStock).toBe(0);
    expect(sbItem?.isBuyableShortage).toBe(false); // Can't buy from others, only your own listing exists!

    // Check Sorting: Hard shortages first, Shared shortages second, Unrelated last
    expect(marketReport.cards[0].cardSlug).toBe("dungeon-guide");
    expect(marketReport.cards[1].cardSlug).toBe("spirit-blade"); // Hard shortage, though not buyable from others
    expect(marketReport.cards[2].cardSlug).toBe("fire-ball"); // Shared shortage
    expect(marketReport.cards[3].cardSlug).toBe("unrelated-card"); // No shortage

    // 5. Test Deck Shortages Integration (Aggregated Shortages & Single Deck Shortage)
    const aggregatedReport = await calculateAggregatedShortages("user-buyer", db);
    const dgShortage = aggregatedReport.cards.find((c) => c.cardSlug === "dungeon-guide");
    expect(dgShortage).toBeDefined();
    expect(dgShortage?.marketAvailableCopies).toBe(6);
    expect(dgShortage?.marketLowestPriceBrl).toBe(5.0);
    expect(dgShortage?.marketLowestPriceStr).toBe("R$ 5,00");
    expect(dgShortage?.marketProductUrl).toBe("https://mypcards.com/grandarchive/produto/101/dungeon-guide");

    // Single deck shortage test
    const singleDeckReport = await calculateDeckShortage("deck-a", "user-buyer", db);
    const dgSingleItem = singleDeckReport.items.find((i) => i.cardSlug === "dungeon-guide");
    expect(dgSingleItem).toBeDefined();
    expect(dgSingleItem?.marketAvailableCopies).toBe(6);
    expect(dgSingleItem?.marketLowestPriceBrl).toBe(5.0);
    expect(dgSingleItem?.marketLowestPriceStr).toBe("R$ 5,00");

    // 6. Test Error Resilience: If network fails during crawl, existing records are preserved
    const failingFetch = (async () => {
      throw new Error("Cloudflare 500 Network Down");
    }) as unknown as typeof fetch;

    await expect(syncGlobalMarketplace(db, failingFetch)).rejects.toThrow();

    // Verify records were NOT wiped
    const preservedMarketRows = await db.select().from(mypMarketCards);
    expect(preservedMarketRows).toHaveLength(4);
  });

  it("correctly handles foil vs non-foil collision matching and distinct mypItemIds", () => {
    // 1. Distinct mypItemIds on same edition must NOT collide
    const foilListing = {
      mypItemId: "item_alc_010_foil",
      editionId: "ed-alc-010",
      isFoil: true,
      quantity: 1,
    };
    const nonFoilUserStore = [
      {
        mypItemId: "item_alc_010_reg",
        editionId: "ed-alc-010",
        isFoil: false,
        quantity: 1,
      },
    ];

    const result1 = calculateNetMarketStock(foilListing, nonFoilUserStore);
    expect(result1.personalStoreQuantity).toBe(0);
    expect(result1.netExternalStock).toBe(1);

    // 2. Identical mypItemId must collide
    const sameMypUserStore = [
      {
        mypItemId: "item_alc_010_foil",
        editionId: "ed-alc-010",
        isFoil: true,
        quantity: 1,
      },
    ];
    const result2 = calculateNetMarketStock(foilListing, sameMypUserStore);
    expect(result2.personalStoreQuantity).toBe(1);
    expect(result2.netExternalStock).toBe(0);

    // 3. Fallback matching without mypItemId requires matching foil finish
    const noIdListing = {
      editionId: "ed-alc-010",
      isFoil: true,
      quantity: 2,
    };
    const noIdDifferentFoil = [
      {
        editionId: "ed-alc-010",
        isFoil: false,
        quantity: 1,
      },
    ];
    const result3 = calculateNetMarketStock(noIdListing, noIdDifferentFoil);
    expect(result3.personalStoreQuantity).toBe(0);
    expect(result3.netExternalStock).toBe(2);

    const noIdSameFoil = [
      {
        editionId: "ed-alc-010",
        isFoil: true,
        quantity: 1,
      },
    ];
    const result4 = calculateNetMarketStock(noIdListing, noIdSameFoil);
    expect(result4.personalStoreQuantity).toBe(1);
    expect(result4.netExternalStock).toBe(1);
  });

  it("identifies staple deficits vs surplus playset in personal MyP store listings", async () => {
    const { db } = await createTestDb();

    // 1. User setup
    await db.insert(users).values({
      id: "u-staple-collector",
      name: "Staple Collector",
      friendCode: "GA-STAPLE",
      mypUsername: "StapleMaster",
    });

    // 2. Card setup
    await db.insert(cards).values([
      {
        slug: "fracturize",
        name: "Fracturize",
        element: "NORM",
        class: "WARRIOR",
        type: "ACTION",
        subtypes: "[]",
      },
      {
        slug: "apotheosis-rite",
        name: "Apotheosis Rite",
        element: "NORM",
        class: "WARRIOR",
        type: "REGALIA",
        subtypes: "[]",
      },
    ]);

    await db.insert(cardEditions).values([
      {
        id: "ed-frac-1",
        cardSlug: "fracturize",
        setPrefix: "DOA",
        setName: "Dawn of Ashes",
        collectorNumber: "001",
        rarity: 3,
        imageUrl: "https://example.com/frac.jpg",
      },
      {
        id: "ed-apo-1",
        cardSlug: "apotheosis-rite",
        setPrefix: "P24",
        setName: "Promotional",
        collectorNumber: "000",
        rarity: 9,
        imageUrl: "https://example.com/apo.jpg",
      },
    ]);

    // 3. Register Meta Staples:
    // Fracturize: recommendedCopies = 4
    // Apotheosis Rite: recommendedCopies = 1
    await db.insert(metaStaples).values([
      {
        cardSlug: "fracturize",
        cardName: "Fracturize",
        categories: JSON.stringify(["Water Main Deck", "Sideboard Tech"]),
        primaryCategory: "Water Main Deck",
        element: "NORM",
        inclusionRate: "88.0%",
        avgCopies: "3.2",
        recommendedCopies: 4,
        deckCount: 110,
        updatedAt: new Date(),
      },
      {
        cardSlug: "apotheosis-rite",
        cardName: "Apotheosis Rite",
        categories: JSON.stringify(["Divine Relics"]),
        primaryCategory: "Divine Relics",
        element: "NORM",
        inclusionRate: "95.0%",
        avgCopies: "1.0",
        recommendedCopies: 1,
        deckCount: 150,
        updatedAt: new Date(),
      },
    ]);

    // 4. Binder Inventory:
    // User owns 2 copies of Fracturize (< 4 -> Deficit!)
    // User owns 1 copy of Apotheosis Rite (>= 1 -> Full Playset!)
    await db.insert(collectionItems).values([
      {
        id: "coll-f1",
        userId: "u-staple-collector",
        editionId: "ed-frac-1",
        quantity: 2,
        isDedicated: false,
      },
      {
        id: "coll-a1",
        userId: "u-staple-collector",
        editionId: "ed-apo-1",
        quantity: 1,
        isDedicated: false,
      },
    ]);

    // 5. User MyP Store Listings:
    // Listing for Fracturize (1 copy listed on MyP)
    // Listing for Apotheosis Rite (1 surplus copy listed on MyP)
    await db.insert(mypCards).values([
      {
        id: "myp-f1",
        userId: "u-staple-collector",
        cardSlug: "fracturize",
        editionId: "ed-frac-1",
        rawName: "Fracturize",
        cardName: "Fracturize",
        setPrefix: "DOA",
        quantity: 1,
        price: "R$ 10,00",
        quality: "NM",
        isFoil: false,
      },
      {
        id: "myp-a1",
        userId: "u-staple-collector",
        cardSlug: "apotheosis-rite",
        editionId: "ed-apo-1",
        rawName: "Apotheosis Rite",
        cardName: "Apotheosis Rite",
        setPrefix: "P24",
        quantity: 1,
        price: "R$ 500,00",
        quality: "NM",
        isFoil: true,
      },
    ]);

    const report = await getUserMarketplaceReport("u-staple-collector", db);
    expect(report.summary.stapleDeficitCount).toBe(1);
    expect(report.summary.stapleDeficitCopies).toBe(1);

    const fracItem = report.cards.find((c) => c.cardSlug === "fracturize");
    expect(fracItem).toBeDefined();
    expect(fracItem?.isMetaStaple).toBe(true);
    expect(fracItem?.isStapleDeficit).toBe(true); // binder has 2, recommended is 4
    expect(fracItem?.stapleRecommendedCopies).toBe(4);
    expect(fracItem?.totalBinderOwned).toBe(2);

    const apoItem = report.cards.find((c) => c.cardSlug === "apotheosis-rite");
    expect(apoItem).toBeDefined();
    expect(apoItem?.isMetaStaple).toBe(true);
    expect(apoItem?.isStapleDeficit).toBe(false); // binder has 1, recommended is 1 -> playset owned!
    expect(apoItem?.stapleRecommendedCopies).toBe(1);
    expect(apoItem?.totalBinderOwned).toBe(1);

    // Sorting: Fracturize is a Staple Deficit, so it sorts ahead of Apotheosis Rite even though Apo is R$ 500 vs R$ 10
    expect(report.cards[0].cardSlug).toBe("fracturize");
    expect(report.cards[1].cardSlug).toBe("apotheosis-rite");
  });
});

