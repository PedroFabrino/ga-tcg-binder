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

      expect(resolveLocale("pt-BR")).toBe("pt-BR");
      expect(resolveLocale("pt")).toBe("pt-BR");
      expect(resolveLocale("en-US")).toBe("en");
      expect(resolveLocale(null)).toBe("en");

      expect(formatLocaleNumber(1000, "pt-BR")).toBe("1.000");
      expect(formatLocaleNumber(1000, "en")).toBe("1,000");
    });
  });
});


