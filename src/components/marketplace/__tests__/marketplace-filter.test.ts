import { describe, expect, it } from "vitest";
import type {
  GlobalMarketplaceCardItem,
  MarketplaceCardItem,
} from "@/services/marketplace";
import {
  computeMarketplaceFilterCounts,
  filterGlobalMarketplaceCards,
  filterPersonalMarketplaceCards,
  matchesMarketplaceQuery,
  type GlobalMarketplaceFilterState,
} from "../filter";

function makeGlobalCard(
  overrides: Partial<GlobalMarketplaceCardItem> = {}
): GlobalMarketplaceCardItem {
  return {
    id: "mc_1",
    storeId: "myp",
    storeName: "MyP Cards",
    storePlatform: "myp",
    cardSlug: "sample-card",
    editionId: "ed_1",
    rawName: "Sample Card",
    cardName: "Sample Card",
    setPrefix: "DOA",
    element: "NORM",
    class: "ALL",
    type: "ACTION",
    rarity: 1,
    imageUrl: null,
    quantity: 1,
    personalStoreQuantity: 0,
    netExternalStock: 1,
    price: "R$ 10,00",
    priceNumeric: 10,
    tcgPrice: "R$ 10,00",
    tcgPriceNumeric: 10,
    priceFairness: {
      tier: "NORMAL",
      ratio: 1,
      markupPercent: 0,
      tcgPrice: "R$ 10,00",
      tcgPriceNumeric: 10,
    },
    isFoil: false,
    mypItemId: "item_1",
    mypProductUrl: "https://mypcards.com/item_1",
    productUrl: "https://mypcards.com/item_1",
    deckNeeds: [],
    peakMissing: 0,
    concurrentMissing: 0,
    totalBinderOwned: 0,
    shortageTier: "NONE",
    isBuyableShortage: false,
    ...overrides,
  };
}

function makePersonalCard(
  overrides: Partial<MarketplaceCardItem> = {}
): MarketplaceCardItem {
  return {
    id: "myp_1",
    cardSlug: "sample-card",
    editionId: "ed_1",
    rawName: "Sample Card",
    cardName: "Sample Card",
    setPrefix: "DOA",
    element: "NORM",
    class: "ALL",
    type: "ACTION",
    rarity: 1,
    imageUrl: null,
    quantity: 1,
    price: "R$ 10,00",
    priceNumeric: 10,
    quality: "NM",
    isFoil: false,
    mypItemId: "item_1",
    mypProductUrl: "https://mypcards.com/item_1",
    deckNeeds: [],
    totalDeckDemand: 0,
    totalBinderOwned: 0,
    concurrentMissing: 0,
    isShortageOffset: false,
    ...overrides,
  };
}

const DEFAULT_GLOBAL_FILTERS: GlobalMarketplaceFilterState = {
  selectedStoreId: null,
  shortageFilter: "ALL_MARKET",
  priceFilter: "ALL",
  selectedElements: [],
  selectedRarities: [],
  query: "",
};

describe("matchesMarketplaceQuery", () => {
  it("matches cardName, rawName, setPrefix, and set + name combinations", () => {
    const card = {
      cardName: "Merlin, Kingslayer",
      rawName: "Merlin, Kingslayer (Foil)",
      setPrefix: "PTM",
    };

    expect(matchesMarketplaceQuery(card, "")).toBe(true);
    expect(matchesMarketplaceQuery(card, "   ")).toBe(true);
    expect(matchesMarketplaceQuery(card, "merlin")).toBe(true);
    expect(matchesMarketplaceQuery(card, "Foil")).toBe(true);
    expect(matchesMarketplaceQuery(card, "ptm")).toBe(true);
    expect(matchesMarketplaceQuery(card, "PTM Merlin")).toBe(true);
    expect(matchesMarketplaceQuery(card, "DOA")).toBe(false);
  });
});

describe("filterGlobalMarketplaceCards", () => {
  const sampleListings: GlobalMarketplaceCardItem[] = [
    makeGlobalCard({
      id: "annul",
      storeId: "tabletop",
      storeName: "TabletopSorocaba",
      cardSlug: "annul-spell",
      rawName: "Annul Spell (#31)",
      cardName: "Annul Spell",
      setPrefix: "HVN",
      element: "NORM",
      rarity: 2,
      quantity: 1,
      netExternalStock: 1,
      shortageTier: "HARD",
      isBuyableShortage: true,
      deckNeeds: [
        {
          deckId: "d1",
          deckName: "Fire Crux Merlin Kingslayer",
          quantity: 1,
          zone: "main",
        },
      ],
      stapleCategories: ["Merlin Main Deck"],
    }),
    makeGlobalCard({
      id: "sacred",
      storeId: "myp",
      storeName: "MyP Cards",
      cardSlug: "sacred-engulfment",
      rawName: "Sacred Engulfment",
      cardName: "Sacred Engulfment",
      setPrefix: "PTM",
      element: "FIRE",
      rarity: 2,
      quantity: 12,
      netExternalStock: 12,
      shortageTier: "HARD",
      isBuyableShortage: true,
      deckNeeds: [
        {
          deckId: "d1",
          deckName: "Fire Crux Merlin Kingslayer",
          quantity: 2,
          zone: "main",
        },
      ],
      priceFairness: {
        tier: "SLIGHTLY_OVERPRICED",
        ratio: 1.5,
        markupPercent: 50,
        tcgPrice: "R$ 0,55",
        tcgPriceNumeric: 0.55,
      },
    }),
    makeGlobalCard({
      id: "merlin-hard",
      storeId: "myp",
      storeName: "MyP Cards",
      cardSlug: "merlin-kingslayer",
      rawName: "Merlin, Kingslayer",
      cardName: "Merlin, Kingslayer",
      setPrefix: "PTM",
      element: "CRUX",
      rarity: 5,
      quantity: 2,
      netExternalStock: 2,
      shortageTier: "SHARED",
      isBuyableShortage: true,
      isMetaStaple: true,
      priceFairness: {
        tier: "HEAVILY_OVERPRICED",
        ratio: 2.5,
        markupPercent: 150,
        tcgPrice: "R$ 20,00",
        tcgPriceNumeric: 20,
      },
    }),
    makeGlobalCard({
      id: "merlin-memory",
      storeId: "lootcards",
      storeName: "Lootcards",
      cardSlug: "merlins-memory",
      rawName: "Merlin's Memory",
      cardName: "Merlin's Memory",
      setPrefix: "HVN",
      element: "TERA",
      rarity: 3,
      quantity: 4,
      netExternalStock: 4,
      shortageTier: "NONE",
      isBuyableShortage: false,
      priceFairness: {
        tier: "BELOW_MARKET",
        ratio: 0.8,
        markupPercent: -20,
        tcgPrice: "R$ 15,00",
        tcgPriceNumeric: 15,
      },
    }),
  ];

  it("matches Merlin in card names and excludes cards that only mention Merlin in deckNeeds or stapleCategories", () => {
    const results = filterGlobalMarketplaceCards(sampleListings, {
      ...DEFAULT_GLOBAL_FILTERS,
      query: "Merlin",
    });

    expect(results.map((c) => c.id)).toEqual(["merlin-hard", "merlin-memory"]);
  });

  it("filters by set prefix and combined set + card name", () => {
    expect(
      filterGlobalMarketplaceCards(sampleListings, {
        ...DEFAULT_GLOBAL_FILTERS,
        query: "HVN",
      }).map((c) => c.id)
    ).toEqual(["annul", "merlin-memory"]);

    expect(
      filterGlobalMarketplaceCards(sampleListings, {
        ...DEFAULT_GLOBAL_FILTERS,
        query: "PTM Merlin",
      }).map((c) => c.id)
    ).toEqual(["merlin-hard"]);
  });

  it("filters by store, shortage tier, element aliases, rarity, and price fairness", () => {
    expect(
      filterGlobalMarketplaceCards(sampleListings, {
        ...DEFAULT_GLOBAL_FILTERS,
        selectedStoreId: "myp",
        shortageFilter: "ALL_SHORTAGES",
      }).map((c) => c.id)
    ).toEqual(["sacred", "merlin-hard"]);

    expect(
      filterGlobalMarketplaceCards(sampleListings, {
        ...DEFAULT_GLOBAL_FILTERS,
        shortageFilter: "HARD_ONLY",
      }).map((c) => c.id)
    ).toEqual(["annul", "sacred"]);

    expect(
      filterGlobalMarketplaceCards(sampleListings, {
        ...DEFAULT_GLOBAL_FILTERS,
        shortageFilter: "SHARED_ONLY",
      }).map((c) => c.id)
    ).toEqual(["merlin-hard"]);

    expect(
      filterGlobalMarketplaceCards(sampleListings, {
        ...DEFAULT_GLOBAL_FILTERS,
        shortageFilter: "STAPLES_ONLY",
      }).map((c) => c.id)
    ).toEqual(["merlin-hard"]);

    expect(
      filterGlobalMarketplaceCards(sampleListings, {
        ...DEFAULT_GLOBAL_FILTERS,
        selectedElements: ["EARTH"],
      }).map((c) => c.id)
    ).toEqual(["merlin-memory"]);

    expect(
      filterGlobalMarketplaceCards(sampleListings, {
        ...DEFAULT_GLOBAL_FILTERS,
        selectedRarities: [5],
      }).map((c) => c.id)
    ).toEqual(["merlin-hard"]);

    expect(
      filterGlobalMarketplaceCards(sampleListings, {
        ...DEFAULT_GLOBAL_FILTERS,
        priceFilter: "FAIR_ONLY",
      }).map((c) => c.id)
    ).toEqual(["annul", "merlin-memory"]);

    expect(
      filterGlobalMarketplaceCards(sampleListings, {
        ...DEFAULT_GLOBAL_FILTERS,
        priceFilter: "OVERPRICED_ONLY",
      }).map((c) => c.id)
    ).toEqual(["sacred", "merlin-hard"]);

    expect(
      filterGlobalMarketplaceCards(sampleListings, {
        ...DEFAULT_GLOBAL_FILTERS,
        priceFilter: "HEAVILY_OVERPRICED_ONLY",
      }).map((c) => c.id)
    ).toEqual(["merlin-hard"]);
  });
});

describe("computeMarketplaceFilterCounts", () => {
  const listings: GlobalMarketplaceCardItem[] = [
    makeGlobalCard({
      id: "annul",
      storeId: "tabletop",
      cardName: "Annul Spell",
      rawName: "Annul Spell (#31)",
      setPrefix: "HVN",
      quantity: 1,
      netExternalStock: 1,
      shortageTier: "HARD",
      deckNeeds: [
        { deckId: "d1", deckName: "Fire Crux Merlin Kingslayer", quantity: 1, zone: "main" },
      ],
    }),
    makeGlobalCard({
      id: "merlin-1",
      storeId: "myp",
      cardName: "Merlin, Kingslayer",
      rawName: "Merlin, Kingslayer",
      setPrefix: "PTM",
      quantity: 2,
      netExternalStock: 2,
      shortageTier: "HARD",
      priceFairness: {
        tier: "HEAVILY_OVERPRICED",
        ratio: 2.5,
        markupPercent: 150,
        tcgPrice: "R$ 10,00",
        tcgPriceNumeric: 10,
      },
    }),
    makeGlobalCard({
      id: "merlin-2",
      storeId: "lootcards",
      cardName: "Merlin's Memory",
      rawName: "Merlin's Memory",
      setPrefix: "HVN",
      quantity: 5,
      netExternalStock: 5,
      shortageTier: "SHARED",
      priceFairness: {
        tier: "SLIGHTLY_OVERPRICED",
        ratio: 1.4,
        markupPercent: 40,
        tcgPrice: "R$ 5,00",
        tcgPriceNumeric: 5,
      },
    }),
  ];

  it("recalculates store, shortage, listing, copy, and price counts for the active query", () => {
    const counts = computeMarketplaceFilterCounts(listings, {
      ...DEFAULT_GLOBAL_FILTERS,
      query: "Merlin",
    });

    expect(counts.allStoresCount).toBe(2);
    expect(counts.storeCounts.get("tabletop")).toBeUndefined();
    expect(counts.storeCounts.get("myp")).toBe(1);
    expect(counts.storeCounts.get("lootcards")).toBe(1);
    expect(counts.hardCount).toBe(1);
    expect(counts.sharedCount).toBe(1);
    expect(counts.totalListings).toBe(2);
    expect(counts.totalMarketCopies).toBe(7);
    expect(counts.overpricedCount).toBe(2);
    expect(counts.heavilyOverpricedCount).toBe(1);
  });

  it("scopes shortage and price counts to the selected store while preserving cross-store tab counts", () => {
    const counts = computeMarketplaceFilterCounts(listings, {
      ...DEFAULT_GLOBAL_FILTERS,
      selectedStoreId: "myp",
      query: "Merlin",
      priceFilter: "HEAVILY_OVERPRICED_ONLY",
    });

    expect(counts.allStoresCount).toBe(1);
    expect(counts.storeCounts.get("myp")).toBe(1);
    expect(counts.hardCount).toBe(1);
    expect(counts.sharedCount).toBe(0);
    expect(counts.totalListings).toBe(1);
    expect(counts.totalMarketCopies).toBe(2);
    expect(counts.overpricedCount).toBe(1);
    expect(counts.heavilyOverpricedCount).toBe(1);
  });
});

describe("filterPersonalMarketplaceCards", () => {
  const personalListings: MarketplaceCardItem[] = [
    makePersonalCard({
      id: "p1",
      cardName: "Annul Spell",
      rawName: "Annul Spell",
      setPrefix: "HVN",
      element: "NORM",
      rarity: 2,
      isShortageOffset: true,
      deckNeeds: [
        { deckId: "d1", deckName: "Fire Crux Merlin Kingslayer", quantity: 1, zone: "main" },
      ],
      stapleCategories: ["Merlin Staple"],
    }),
    makePersonalCard({
      id: "p2",
      cardName: "Merlin, Kingslayer",
      rawName: "Merlin, Kingslayer",
      setPrefix: "PTM",
      element: "CRUX",
      rarity: 5,
      isStapleDeficit: true,
    }),
  ];

  it("excludes personal listings whose only match is deckNeeds or stapleCategories", () => {
    const results = filterPersonalMarketplaceCards(personalListings, {
      filterMode: "ALL",
      onlyShortages: false,
      selectedElements: [],
      selectedRarities: [],
      query: "Merlin",
    });

    expect(results.map((c) => c.id)).toEqual(["p2"]);
  });

  it("respects shortage/staple modes alongside query and attribute filters", () => {
    expect(
      filterPersonalMarketplaceCards(personalListings, {
        filterMode: "SHORTAGES",
        onlyShortages: false,
        selectedElements: [],
        selectedRarities: [],
        query: "HVN",
      }).map((c) => c.id)
    ).toEqual(["p1"]);

    expect(
      filterPersonalMarketplaceCards(personalListings, {
        filterMode: "STAPLES",
        onlyShortages: false,
        selectedElements: ["CRUX"],
        selectedRarities: [5],
        query: "Merlin",
      }).map((c) => c.id)
    ).toEqual(["p2"]);
  });
});
