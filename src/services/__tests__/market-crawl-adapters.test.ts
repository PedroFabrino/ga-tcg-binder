import { describe, expect, it } from "vitest";
import {
  lootcardsCardToCrawledListing,
  lootcardsCrawlAdapter,
  mypCrawlAdapter,
  mypItemToCrawledListing,
} from "../market-crawl-adapters";
import { parseMypHtml } from "../marketplace";
import { parseLootcardsCatalogResponse } from "../lootcards-parser";

const MYP_HTML = [
  '<div class="card">',
  '<div class="card-name"><h3>Fracturize</h3></div>',
  '<span class="card-edicao">DOA</span>',
  '<span class="quantidade-num">3</span>',
  '<span class="card-preco">R$ 12,50</span>',
  '<a class="card-img-link" href="/grandarchive/produto/fracturize-doa"><img></a>',
  '<span title="NM - Near Mint">NM</span>',
  '<div data-ga-item-id="grandarchive_doa_001"></div>',
  "</div>",
].join("");

describe("market crawl adapters normalize to the same listing object", () => {
  it("maps a MyP item", () => {
    const item = parseMypHtml(MYP_HTML)[0];
    const listing = mypItemToCrawledListing(item);

    expect(listing).toMatchObject({
      itemId: "grandarchive_doa_001",
      cardName: "Fracturize",
      setPrefix: "DOA",
      collectorNumber: "001",
      priceBrl: 12.5,
      quantity: 3,
      isFoil: false,
      productUrl: "https://mypcards.com/grandarchive/produto/fracturize-doa",
    });
  });

  it("maps a Lootcards card", () => {
    const card = parseLootcardsCatalogResponse({
      cards: [
        {
          uuid: "u1",
          slug: "fracturize",
          name: "Fracturize",
          edition_uuid: "ed-1",
          set_prefix: "DOA",
          collector_number: "001",
          min_price_cents: 1250,
          total_stock: 3,
          has_stock: true,
          has_foil: false,
          has_curio_foil: false,
        },
      ],
    }).cards[0];
    const listing = lootcardsCardToCrawledListing(card, "https://lootcards.store");

    expect(listing).toMatchObject({
      itemId: "u1",
      cardName: "Fracturize",
      setPrefix: "DOA",
      collectorNumber: "001",
      priceBrl: 12.5,
      quantity: 3,
      isFoil: false,
      editionUuid: "ed-1",
      productUrl: "https://lootcards.store/carta/fracturize",
    });
  });

  it("both adapters expose the same crawl interface", () => {
    for (const adapter of [mypCrawlAdapter, lootcardsCrawlAdapter]) {
      expect(adapter.platform).toBeTruthy();
      expect(typeof adapter.parsePage).toBe("function");
      expect(typeof adapter.parseTotalCount).toBe("function");
      expect(adapter.pageDelayMs).toBeGreaterThanOrEqual(0);
      expect(adapter.retryDelayMs).toBeGreaterThanOrEqual(0);
    }
  });
});
