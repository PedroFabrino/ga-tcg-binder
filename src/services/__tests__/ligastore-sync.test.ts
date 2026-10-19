import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../db/test-utils";
import { cards, cardEditions, marketCards, marketStores } from "../../db/schema";
import {
  getMarketCards,
  getMarketStoreById,
} from "../../db/repositories/marketplace-repository";
import { resolveLigaStoreItem, syncLigaStore } from "../ligastore-sync";
import { loadCatalogResolutionData } from "../marketplace";

const SAMPLE_SEARCH_HTML = `
  <table class="ecomresp-tab">
    <tr><td class="textoMaior"> 1-2 de <b>2</b></td></tr>
  </table>

  <div class="card-item">
    <div class="card-desc">
      <div class="title">
        <a href="https://www.brandaocardgame.com.br/?view=ecom/item&refid=ref_flame_136">
          Flame-Rune Swordsman (#136)
        </a>
      </div>
      <div class="qty">3 unid.</div>
      <div class="card-preco">R$ 15,00</div>
    </div>
  </div>

  <div class="card-item">
    <div class="card-desc">
      <div class="title">
        <a href="https://www.brandaocardgame.com.br/?view=ecom/item&refid=ref_frost_28b">
          Frostbind (028) (#28b)
        </a>
      </div>
      <div class="qty">1 unid.</div>
      <div class="card-preco">R$ 8,50</div>
    </div>
  </div>

  <div class="card-item">
    <div class="card-desc">
      <div class="title">
        <a href="https://www.brandaocardgame.com.br/?view=ecom/item&refid=ref_unknown_999">
          Unannounced Secret Card (#999)
        </a>
      </div>
      <div class="qty">1 unid.</div>
      <div class="card-preco">R$ 99,00</div>
    </div>
  </div>
`;

const SAMPLE_DETAIL_HTML_FLAME = `
  <div class="table-cards-body-cell quality">NM</div>
  <div class="table-cards-body-cell tooltip-item text-center">
    <img alt="Inglês" src="/images/en.png">
  </div>
  <div class="table-cards-body-cell tooltip-item">5 unid.</div>
  <div class="table-cards-body-cell card-preco">R$ 14,00</div>
  <span class="siglaEdicao">DOA</span>
`;

describe("ligastore-sync", () => {
  let testDb: any;

  beforeEach(async () => {
    const { db } = await createTestDb();
    testDb = db;

    await testDb.delete(marketCards);
    await testDb.delete(marketStores);
    await testDb.delete(cardEditions);
    await testDb.delete(cards);

    await testDb.insert(marketStores).values([
      {
        id: "brandao",
        platform: "liga_store",
        name: "Brandão Card Game",
        baseUrl: "https://www.brandaocardgame.com.br",
        tcgId: "21",
        enabled: true,
      },
    ]);

    await testDb.insert(cards).values([
      {
        slug: "flame-rune-swordsman",
        name: "Flame-Rune Swordsman",
        element: "FIRE",
        class: "WARRIOR",
        type: "ALLY",
      },
      {
        slug: "frostbind",
        name: "Frostbind",
        element: "WATER",
        class: "MAGE",
        type: "SPELL",
      },
    ]);

    await testDb.insert(cardEditions).values([
      {
        id: "ed-frs-136",
        cardSlug: "flame-rune-swordsman",
        setPrefix: "DOA",
        setName: "Dawn of Ashes",
        collectorNumber: "136",
        rarity: 1,
        imageUrl: "https://images.example/frs.jpg",
      },
      {
        id: "ed-fb-28b",
        cardSlug: "frostbind",
        setPrefix: "FTC",
        setName: "Fractured Crown",
        collectorNumber: "28b",
        rarity: 2,
        imageUrl: "https://images.example/fb.jpg",
      },
    ]);
  });

  it("resolveLigaStoreItem resolves matching cards and editions by name and collector number", async () => {
    const catalog = await loadCatalogResolutionData(testDb);

    const flameItem = {
      rawTitle: "Flame-Rune Swordsman (#136)",
      cardName: "Flame-Rune Swordsman",
      collectorNumber: "136",
      isFoil: false,
      productUrl: "/item?refid=1",
      refId: "1",
      imageUrl: "",
      price: "R$ 15,00",
      priceNumeric: 15,
      quantity: 3,
    };

    const resolvedFlame = resolveLigaStoreItem(flameItem, catalog);
    expect(resolvedFlame).toEqual({
      cardSlug: "flame-rune-swordsman",
      editionId: "ed-frs-136",
      setPrefix: "DOA",
    });

    const frostItem = {
      rawTitle: "Frostbind (028) (#28b)",
      cardName: "Frostbind",
      collectorNumber: "28b",
      isFoil: false,
      productUrl: "/item?refid=2",
      refId: "2",
      imageUrl: "",
      price: "R$ 8,50",
      priceNumeric: 8.5,
      quantity: 1,
    };

    const resolvedFrost = resolveLigaStoreItem(frostItem, catalog);
    expect(resolvedFrost).toEqual({
      cardSlug: "frostbind",
      editionId: "ed-fb-28b",
      setPrefix: "FTC",
    });
  });

  it("resolveLigaStoreItem safely returns null for unknown cards without crashing", async () => {
    const catalog = await loadCatalogResolutionData(testDb);

    const unknownItem = {
      rawTitle: "Unannounced Card (#999)",
      cardName: "Unannounced Card",
      collectorNumber: "999",
      isFoil: false,
      productUrl: "/item?refid=999",
      refId: "999",
      imageUrl: "",
      price: "R$ 99,00",
      priceNumeric: 99,
      quantity: 1,
    };

    const resolvedUnknown = resolveLigaStoreItem(unknownItem, catalog);
    expect(resolvedUnknown).toEqual({
      cardSlug: null,
      editionId: null,
      setPrefix: "UNKNOWN",
    });
  });

  it("syncLigaStore crawls search results, resolves catalog items, and persists to market_cards", async () => {
    const customFetch = async () => new Response(SAMPLE_SEARCH_HTML, { status: 200 });

    const stats = await syncLigaStore({
      storeId: "brandao",
      customFetch: customFetch as any,
      database: testDb,
    });

    expect(stats.totalSynced).toBe(3);
    expect(stats.matchedCount).toBe(2);
    expect(stats.unmatchedCount).toBe(1);

    const listings = await getMarketCards({ storeId: "brandao" }, testDb);
    expect(listings).toHaveLength(3);

    const flameListing = listings.find((l) => l.cardSlug === "flame-rune-swordsman");
    expect(flameListing).toBeDefined();
    expect(flameListing?.priceNumeric).toBe(15);
    expect(flameListing?.quantity).toBe(3);

    // Unlinked listing is retained
    const unlinkedListing = listings.find((l) => l.cardSlug === null);
    expect(unlinkedListing).toBeDefined();
    expect(unlinkedListing?.rawName).toBe("Unannounced Secret Card (#999)");

    // Store timestamps updated
    const store = await getMarketStoreById("brandao", testDb);
    expect(store?.lastCount).toBe(2);
    expect(store?.lastFullScanAt).toBeDefined();
  });

  it("syncLigaStore selectively enriches details for active shortages/neededSlugs", async () => {
    const requestedUrls: string[] = [];

    const customFetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);

      if (url.includes("ref_flame_136")) {
        return new Response(SAMPLE_DETAIL_HTML_FLAME, { status: 200 });
      }

      return new Response(SAMPLE_SEARCH_HTML, { status: 200 });
    };

    const stats = await syncLigaStore({
      storeId: "brandao",
      customFetch: customFetch as any,
      database: testDb,
      enrichShortages: true,
      neededSlugs: new Set(["flame-rune-swordsman"]),
    });

    expect(stats.enrichedCount).toBe(1);
    expect(requestedUrls.some((u) => u.includes("ref_flame_136"))).toBe(true);

    const listings = await getMarketCards({ storeId: "brandao" }, testDb);
    const flameListing = listings.find((l) => l.cardSlug === "flame-rune-swordsman");
    expect(flameListing?.priceNumeric).toBe(14);
    expect(flameListing?.quantity).toBe(5);
    expect(flameListing?.quality).toBe("NM");
  });

  it("syncLigaStore reconciles missing listings", async () => {
    // Initial scan with 3 items
    const customFetch1 = async () => new Response(SAMPLE_SEARCH_HTML, { status: 200 });
    await syncLigaStore({
      storeId: "brandao",
      customFetch: customFetch1 as any,
      database: testDb,
    });

    const initialListings = await getMarketCards({ storeId: "brandao", inStockOnly: true }, testDb);
    expect(initialListings).toHaveLength(3);

    // Second scan with only 1 item (flame-rune)
    const HTML_ONLY_FLAME = `
      <table class="ecomresp-tab"><tr><td class="textoMaior"> 1-1 de <b>1</b></td></tr></table>
      <div class="card-item">
        <div class="card-desc">
          <div class="title"><a href="/item?refid=ref_flame_136">Flame-Rune Swordsman (#136)</a></div>
          <div class="qty">2 unid.</div>
          <div class="card-preco">R$ 15,00</div>
        </div>
      </div>
    `;

    const customFetch2 = async () => new Response(HTML_ONLY_FLAME, { status: 200 });
    await syncLigaStore({
      storeId: "brandao",
      customFetch: customFetch2 as any,
      database: testDb,
    });

    const activeListings = await getMarketCards({ storeId: "brandao", inStockOnly: true }, testDb);
    expect(activeListings).toHaveLength(1);
    expect(activeListings[0].cardSlug).toBe("flame-rune-swordsman");

    const allListings = await getMarketCards({ storeId: "brandao" }, testDb);
    const frostListing = allListings.find((l) => l.itemId === "ref_frost_28b");
    expect(frostListing?.quantity).toBe(0);
  });
});
