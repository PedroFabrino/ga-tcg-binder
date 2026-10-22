import { describe, it, expect } from "vitest";
import {
  isWsClientMessage,
  isWsServerMessage,
  CARD_W,
  CARD_H,
  CARD_ASPECT,
  DEFAULT_QUALITY_GATE,
  DEFAULT_FEATURE_FLAGS,
  parseFeatureFlag,
  type WsJoinMessage,
  type WsScanIdentifyResponse,
  enCatalog,
  ptBRCatalog,
  createTranslator,
  resolveLocale,
  formatLocaleNumber,
  matchesSetChecklistFilters,
  type SetChecklistCard,
  type SetChecklistFilters,
} from "./index";

describe("@ga/contracts", () => {
  it("exports valid card aspect ratio and dimensions", () => {
    expect(CARD_W).toBe(630);
    expect(CARD_H).toBe(880);
    expect(CARD_ASPECT).toBeCloseTo(2.5 / 3.5, 4);
    expect(DEFAULT_QUALITY_GATE.minSharpness).toBe(70);
  });

  it("validates WsClientMessage type guard", () => {
    const validJoin: WsJoinMessage = {
      type: "SESSION_JOIN",
      sessionId: "sess_123",
      token: "tok_abc",
      role: "scanner",
      timestamp: Date.now(),
      deviceName: "iPhone 15 Pro",
    };
    expect(isWsClientMessage(validJoin)).toBe(true);

    expect(isWsClientMessage(null)).toBe(false);
    expect(isWsClientMessage({})).toBe(false);
    expect(isWsClientMessage({ type: "UNKNOWN", sessionId: "123" })).toBe(false);
  });

  it("validates WsServerMessage type guard", () => {
    const validResponse: WsScanIdentifyResponse = {
      type: "SCAN_IDENTIFY_RESPONSE",
      sessionId: "sess_123",
      requestId: "req_1",
      timestamp: Date.now(),
      candidates: [
        {
          editionId: "ed_1",
          cardSlug: "fire-slash",
          cardName: "Fire Slash",
          setPrefix: "DOA",
          collectorNumber: "001",
          imageUrl: "https://example.com/art.webp",
          confidence: 94.5,
          sVisual: 0.92,
          sOcr: 0.98,
          signals: { collectorMatch: true, ocrFallback: false },
        },
      ],
    };
    expect(isWsServerMessage(validResponse)).toBe(true);
    expect(isWsServerMessage({ type: "INVALID" })).toBe(false);
  });

  describe("FeatureFlags", () => {
    it("has scanner flag disabled by default", () => {
      expect(DEFAULT_FEATURE_FLAGS.scanner).toBe(false);
    });

    it("parses boolean and string feature flags correctly", () => {
      expect(parseFeatureFlag(true)).toBe(true);
      expect(parseFeatureFlag(false)).toBe(false);
      expect(parseFeatureFlag("true")).toBe(true);
      expect(parseFeatureFlag("TRUE")).toBe(true);
      expect(parseFeatureFlag("1")).toBe(true);
      expect(parseFeatureFlag("yes")).toBe(true);
      expect(parseFeatureFlag("on")).toBe(true);

      expect(parseFeatureFlag("false")).toBe(false);
      expect(parseFeatureFlag("0")).toBe(false);
      expect(parseFeatureFlag("no")).toBe(false);
      expect(parseFeatureFlag("off")).toBe(false);
      expect(parseFeatureFlag(undefined)).toBe(false);
      expect(parseFeatureFlag(null)).toBe(false);
      expect(parseFeatureFlag("")).toBe(false);
      expect(parseFeatureFlag("random", false)).toBe(false);
      expect(parseFeatureFlag("random", true)).toBe(true);
    });
  });

  describe("i18n Translation Catalog", () => {
    it("ensures exact key parity and non-empty strings between en and pt-BR", () => {
      const getKeys = (obj: any, prefix = ""): string[] => {
        let keys: string[] = [];
        for (const [k, v] of Object.entries(obj)) {
          const nextKey = prefix ? `${prefix}.${k}` : k;
          if (v && typeof v === "object") {
            keys = keys.concat(getKeys(v, nextKey));
          } else {
            keys.push(nextKey);
          }
        }
        return keys.sort();
      };

      const enKeys = getKeys(enCatalog);
      const ptKeys = getKeys(ptBRCatalog);

      expect(ptKeys).toEqual(enKeys);
      expect(enKeys.length).toBeGreaterThan(20);

      // Verify no empty strings
      const checkNonEmpty = (obj: any) => {
        for (const v of Object.values(obj)) {
          if (typeof v === "string") {
            expect(v.trim().length).toBeGreaterThan(0);
          } else if (typeof v === "object" && v !== null) {
            checkNonEmpty(v);
          }
        }
      };
      checkNonEmpty(enCatalog);
      checkNonEmpty(ptBRCatalog);
    });

    it("interpolates variables and translates keys correctly", () => {
      const tEn = createTranslator("en");
      const tPt = createTranslator("pt-BR");

      expect(tEn("watchlist.bannerWatching", { count: 5 })).toBe("5 Watching on MyP");
      expect(tPt("watchlist.bannerWatching", { count: 5 })).toBe("5 Acompanhadas no MyP");

      expect(tEn("settings.mypAutomationTitle")).toBe("Automated Daily Watchlist Sync (Opt-In)");
      expect(tPt("settings.mypAutomationTitle")).toBe("Sincronização Diária Automática (Opt-In)");

      expect(tEn("sets.shortageBadge", { count: 3 })).toBe("3 Shortages");
      expect(tPt("sets.shortageBadge", { count: 3 })).toBe("3 Necessárias");

      expect(tEn("sets.decksImpacted", { count: 2 })).toBe("2 Decks");
      expect(tPt("sets.decksImpacted", { count: 2 })).toBe("2 Decks");

      expect(tEn("sets.cardsOwned", { owned: 42, total: 100, percent: 42 })).toBe("42 / 100 Cards (42%)");
      expect(tPt("sets.cardsOwned", { owned: 42, total: 100, percent: 42 })).toBe("42 / 100 Cartas (42%)");

      expect(tEn("sets.hiddenCount", { count: 5 })).toBe("5 hidden");
      expect(tPt("sets.hiddenCount", { count: 5 })).toBe("5 ocultas");

      expect(tEn("sets.completion", { percent: 87 })).toBe("87% complete");
      expect(tPt("sets.completion", { percent: 87 })).toBe("87% completo");

      expect(tEn("sets.totalCards", { count: 150 })).toBe("150 cards");
      expect(tPt("sets.totalCards", { count: 150 })).toBe("150 cartas");

      expect(tEn("sets.checklist.requiredBy", { count: 3 })).toBe("Required by 3 deck(s)");
      expect(tPt("sets.checklist.requiredBy", { count: 3 })).toBe("Necessária em 3 deck(s)");

      expect(tEn("sets.checklist.ownedCopies", { count: 2 })).toBe("You own 2");
      expect(tPt("sets.checklist.ownedCopies", { count: 2 })).toBe("Você possui 2");

      expect(resolveLocale("pt-BR")).toBe("pt-BR");
      expect(resolveLocale("pt")).toBe("pt-BR");
      expect(resolveLocale("en-US")).toBe("en");
      expect(resolveLocale(null)).toBe("en");

      expect(formatLocaleNumber(1000, "pt-BR")).toBe("1.000");
      expect(formatLocaleNumber(1000, "en")).toBe("1,000");
    });
  });

  // -----------------------------------------------------------------------
  // matchesSetChecklistFilters
  // -----------------------------------------------------------------------
  describe("matchesSetChecklistFilters", () => {
    const makeCard = (overrides: Partial<SetChecklistCard> = {}): SetChecklistCard => ({
      cardSlug: "test-card",
      cardName: "Test Card",
      element: "FIRE",
      class: "MAGE",
      type: "ACTION",
      rarity: 3,
      imageUrl: null,
      prefixes: ["DOA 1st", "DOA Alter"],
      ownedQuantity: 1,
      requiredQuantity: 3,
      missingQuantity: 2,
      isShortage: true,
      requiringDeckIds: ["deck-1"],
      ...overrides,
    });

    it("matches all when status is 'all' and no prefix filter", () => {
      const filters: SetChecklistFilters = { prefix: null, status: "all" };
      expect(matchesSetChecklistFilters(makeCard(), filters)).toBe(true);
    });

    it("matches by prefix", () => {
      const filters: SetChecklistFilters = { prefix: "DOA 1st", status: "all" };
      expect(matchesSetChecklistFilters(makeCard(), filters)).toBe(true);
      expect(matchesSetChecklistFilters(makeCard({ prefixes: ["DOA Alter"] }), filters)).toBe(false);
    });

    it("filters by shortage status", () => {
      const filters: SetChecklistFilters = { prefix: null, status: "shortages" };
      expect(matchesSetChecklistFilters(makeCard({ isShortage: true }), filters)).toBe(true);
      expect(matchesSetChecklistFilters(makeCard({ isShortage: false }), filters)).toBe(false);
    });

    it("filters by owned status", () => {
      const filters: SetChecklistFilters = { prefix: null, status: "owned" };
      expect(matchesSetChecklistFilters(makeCard({ ownedQuantity: 1 }), filters)).toBe(true);
      expect(matchesSetChecklistFilters(makeCard({ ownedQuantity: 0 }), filters)).toBe(false);
    });

    it("filters by unowned status", () => {
      const filters: SetChecklistFilters = { prefix: null, status: "unowned" };
      expect(matchesSetChecklistFilters(makeCard({ ownedQuantity: 0 }), filters)).toBe(true);
      expect(matchesSetChecklistFilters(makeCard({ ownedQuantity: 1 }), filters)).toBe(false);
    });

    it("combines prefix and status filters", () => {
      const filters: SetChecklistFilters = { prefix: "DOA 1st", status: "shortages" };
      // Has DOA 1st and is a shortage -> match
      expect(matchesSetChecklistFilters(makeCard({ prefixes: ["DOA 1st"], isShortage: true }), filters)).toBe(true);
      // Has DOA 1st but not a shortage -> no match
      expect(matchesSetChecklistFilters(makeCard({ prefixes: ["DOA 1st"], isShortage: false }), filters)).toBe(false);
      // Is a shortage but wrong prefix -> no match
      expect(matchesSetChecklistFilters(makeCard({ prefixes: ["DOA Alter"], isShortage: true }), filters)).toBe(false);
    });
  });
});


