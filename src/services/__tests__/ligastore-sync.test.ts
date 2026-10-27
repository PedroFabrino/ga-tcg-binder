import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../db/test-utils";
import { cards, cardEditions, marketCards, marketStores } from "../../db/schema";
import {
  getMarketCards,
  getMarketStoreById,
  upsertMarketStore,
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

  it("syncLigaStore stores items directly from search page without opening detail pages", async () => {
    // Search page with sprite-encoded prices that the parser can't decode → R$ 0,00
    const HTML_SPRITE_PRICE = `
      <table class="ecomresp-tab"><tr><td class="textoMaior"> 1-1 de <b>1</b></td></tr></table>
      <div class="card-item">
        <div class="card-desc">
          <div class="title"><a href="https://store.example.com/?view=ecom/item&refid=ref_flame_136">Flame-Rune Swordsman (#136)</a></div>
          <div class="qty force-w"><div class="vidgmi"><div class="x">&nbsp;</div></div><div class="vidlbl">un.</div></div>
          <div class="price force-w"><div class="vidlbl">R$</div><div class="vidgmi"><div class="x">&nbsp;</div></div></div>
        </div>
      </div>
    `;

    const requestedUrls: string[] = [];
    const customFetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);
      return new Response(HTML_SPRITE_PRICE, { status: 200 });
    };

    const stats = await syncLigaStore({
      storeId: "brandao",
      customFetch: customFetch as any,
      database: testDb,
    });

    // Never fetched individual item detail page
    expect(requestedUrls).toHaveLength(1);
    expect(requestedUrls[0]).toContain("view=ecom/itens");
    expect(requestedUrls[0]).toContain("txt_estoque=1");
    expect(requestedUrls[0]).toContain("txt_order=6");
    expect(requestedUrls[0]).toContain("txt_limit=30");
    expect(requestedUrls.some((u) => u.includes("ref_flame_136"))).toBe(false);

    const listings = await getMarketCards({ storeId: "brandao" }, testDb);
    expect(listings).toHaveLength(1);
    expect(listings[0].cardSlug).toBe("flame-rune-swordsman");
    expect(listings[0].priceNumeric).toBe(0);
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



  it("syncLigaStore crawls TabletopSorocaba discarding out-of-stock items without price blocks", async () => {
    await upsertMarketStore(
      {
        id: "tabletopsorocaba",
        platform: "liga_store",
        name: "TabletopSorocaba",
        baseUrl: "https://www.tabletoptcg.com.br",
        tcgId: "21",
        enabled: true,
      },
      testDb
    );

    const TABLETOP_SEARCH_HTML = `
      <table class="ecomresp-tab">
        <tr><td class="textoMaior"> 1-2 de <b>2</b></td></tr>
      </table>

      <div class="card-item">
        <div class="card-desc">
          <div class="title">
            <a href="https://www.tabletoptcg.com.br/?view=ecom/item&id=546923&refid=ref_in_stock">
              Flame-Rune Swordsman (#136)
            </a>
          </div>
          <div class="qty">3 unid.</div>
          <div class="price ">
            <div class="card-preco">R$ 15,00</div>
          </div>
        </div>
      </div>

      <div class="card-item">
        <div class="card-desc">
          <div class="title">
            <a href="https://www.tabletoptcg.com.br/?view=ecom/item&id=546923&refid=ref_out_of_stock">
              Frostbind (028) (#28b)
            </a>
          </div>
          <div class="sem-estoque">Sem Estoque</div>
        </div>
      </div>
    `;

    const requestedUrls: string[] = [];
    const customFetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);
      return new Response(TABLETOP_SEARCH_HTML, { status: 200 });
    };

    const stats = await syncLigaStore({
      storeId: "tabletopsorocaba",
      customFetch: customFetch as any,
      database: testDb,
    });

    // Only in-stock item is synced; out-of-stock item without price block is discarded
    expect(stats.totalSynced).toBe(1);
    expect(requestedUrls).toHaveLength(1);
    expect(requestedUrls[0]).toContain("id=546923");
    expect(requestedUrls[0]).toContain("txt_limit=120");
    expect(requestedUrls[0]).toContain("txt_order=1");
    expect(requestedUrls[0]).not.toContain("txt_estoque=1");

    const allListings = await getMarketCards({ storeId: "tabletopsorocaba" }, testDb);
    expect(allListings).toHaveLength(1);
    expect(allListings[0].itemId).toBe("ref_in_stock");
  });

  it("syncLigaStore enforces parity check when pagination truncates and aborts without wiping store listings", async () => {
    let callCount = 0;
    const requestedUrls: string[] = [];

    // First page reports 60 items (2 pages of 30)
    const MULTI_PAGE_HTML = `
      <table class="ecomresp-tab">
        <tr><td class="textoMaior"> 1-30 de <b>60</b></td></tr>
      </table>
      <div class="card-item">
        <div class="card-desc">
          <div class="title">
            <a href="https://www.brandaocardgame.com.br/?view=ecom/item&refid=ref_p1">
              Flame-Rune Swordsman (#136)
            </a>
          </div>
          <div class="qty">1 unid.</div>
          <div class="card-preco">R$ 10,00</div>
        </div>
      </div>
    `;

    const customFetch = async (input: RequestInfo | URL) => {
      callCount += 1;
      const url = String(input);
      requestedUrls.push(url);

      if (url.includes("page=1")) {
        return new Response(MULTI_PAGE_HTML, { status: 200 });
      }

      if (url.includes("page=2")) {
        return new Response("Service Unavailable", { status: 503 });
      }

      return new Response("Not Found", { status: 404 });
    };

    await expect(
      syncLigaStore({
        storeId: "brandao",
        customFetch: customFetch as any,
        database: testDb,
      })
    ).rejects.toThrow(/Parity check failed/);
  });

  it("full lifecycle orchestration: crawls multi-page, filters stock, collapses variants, reconciles, and protects prior DB state on SessionExpiredError", async () => {
    await upsertMarketStore(
      {
        id: "tabletopsorocaba",
        platform: "liga_store",
        name: "TabletopSorocaba",
        baseUrl: "https://www.tabletoptcg.com.br",
        tcgId: "21",
        enabled: true,
      },
      testDb
    );

    // Build 2 pages with 120 items each (total 240 items)
    const buildCardBlock = (refId: string, name: string, inStock: boolean) => `
      <div class="card-item">
        <div class="card-desc">
          <div class="title">
            <a href="https://www.tabletoptcg.com.br/?view=ecom/item&refid=${refId}">
              ${name}
            </a>
          </div>
          ${
            inStock
              ? `<div class="qty">1 unid.</div><div class="price "><div class="card-preco">R$ 10,00</div></div>`
              : `<div class="qty">0 un.</div>`
          }
        </div>
      </div>
    `;

    const page1Cards = [
      buildCardBlock("ref_apostle_curio", "Apostle of the Woods (Curio Foil) (#46)", true),
      buildCardBlock("ref_out", "Abnegation (#178)", false),
      ...Array.from({ length: 118 }, (_, i) =>
        buildCardBlock(`ref_p1_${i}`, `Card P1 ${i}`, false)
      ),
    ].join("\n");

    const page2Cards = [
      buildCardBlock("ref_flame", "Flame-Rune Swordsman (#136)", true),
      ...Array.from({ length: 119 }, (_, i) =>
        buildCardBlock(`ref_p2_${i}`, `Card P2 ${i}`, false)
      ),
    ].join("\n");

    const PAGE1_HTML = `
      <table class="ecomresp-tab">
        <tr><td class="textoMaior"> 1-120 de <b>240</b></td></tr>
      </table>
      ${page1Cards}
    `;

    const PAGE2_HTML = `
      <table class="ecomresp-tab">
        <tr><td class="textoMaior"> 121-240 de <b>240</b></td></tr>
      </table>
      ${page2Cards}
    `;

    // 1. First run: succeeds and stores apostle and flame
    const customFetchSuccess = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("page=1")) return new Response(PAGE1_HTML, { status: 200 });
      return new Response(PAGE2_HTML, { status: 200 });
    };

    const firstStats = await syncLigaStore({
      storeId: "tabletopsorocaba",
      customFetch: customFetchSuccess as any,
      database: testDb,
    });

    expect(firstStats.totalSynced).toBe(2);
    const storedAfterRun1 = await getMarketCards({ storeId: "tabletopsorocaba" }, testDb);
    expect(storedAfterRun1).toHaveLength(2);

    // Verify Apostle of the Woods (Curio Foil) collapsed to canonical card
    const apostle = storedAfterRun1.find((c) => c.itemId === "ref_apostle_curio");
    expect(apostle?.cardName).toBe("Apostle of the Woods");

    // 2. Second run: session expires mid-crawl on page 2
    const { SessionExpiredError } = await import("../store-session");
    const customFetchExpired = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("page=1")) return new Response(PAGE1_HTML, { status: 200 });
      throw new SessionExpiredError("tabletopsorocaba", "Session expired", 403);
    };

    await expect(
      syncLigaStore({
        storeId: "tabletopsorocaba",
        customFetch: customFetchExpired as any,
        database: testDb,
      })
    ).rejects.toThrow(SessionExpiredError);

    // Negative invariant: prior DB state was left completely untouched
    const storedAfterFailedRun = await getMarketCards({ storeId: "tabletopsorocaba" }, testDb);
    expect(storedAfterFailedRun).toHaveLength(2);
    expect(storedAfterFailedRun.map((c) => c.itemId).sort()).toEqual(
      storedAfterRun1.map((c) => c.itemId).sort()
    );
  });
});
