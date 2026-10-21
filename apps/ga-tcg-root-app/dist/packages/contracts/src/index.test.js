"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const index_1 = require("./index");
(0, vitest_1.describe)("@ga/contracts", () => {
    (0, vitest_1.it)("exports valid card aspect ratio and dimensions", () => {
        (0, vitest_1.expect)(index_1.CARD_W).toBe(630);
        (0, vitest_1.expect)(index_1.CARD_H).toBe(880);
        (0, vitest_1.expect)(index_1.CARD_ASPECT).toBeCloseTo(2.5 / 3.5, 4);
        (0, vitest_1.expect)(index_1.DEFAULT_QUALITY_GATE.minSharpness).toBe(70);
    });
    (0, vitest_1.it)("validates WsClientMessage type guard", () => {
        const validJoin = {
            type: "SESSION_JOIN",
            sessionId: "sess_123",
            token: "tok_abc",
            role: "scanner",
            timestamp: Date.now(),
            deviceName: "iPhone 15 Pro",
        };
        (0, vitest_1.expect)((0, index_1.isWsClientMessage)(validJoin)).toBe(true);
        (0, vitest_1.expect)((0, index_1.isWsClientMessage)(null)).toBe(false);
        (0, vitest_1.expect)((0, index_1.isWsClientMessage)({})).toBe(false);
        (0, vitest_1.expect)((0, index_1.isWsClientMessage)({ type: "UNKNOWN", sessionId: "123" })).toBe(false);
    });
    (0, vitest_1.it)("validates WsServerMessage type guard", () => {
        const validResponse = {
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
        (0, vitest_1.expect)((0, index_1.isWsServerMessage)(validResponse)).toBe(true);
        (0, vitest_1.expect)((0, index_1.isWsServerMessage)({ type: "INVALID" })).toBe(false);
    });
    (0, vitest_1.describe)("FeatureFlags", () => {
        (0, vitest_1.it)("has scanner flag disabled by default", () => {
            (0, vitest_1.expect)(index_1.DEFAULT_FEATURE_FLAGS.scanner).toBe(false);
        });
        (0, vitest_1.it)("parses boolean and string feature flags correctly", () => {
            (0, vitest_1.expect)((0, index_1.parseFeatureFlag)(true)).toBe(true);
            (0, vitest_1.expect)((0, index_1.parseFeatureFlag)(false)).toBe(false);
            (0, vitest_1.expect)((0, index_1.parseFeatureFlag)("true")).toBe(true);
            (0, vitest_1.expect)((0, index_1.parseFeatureFlag)("TRUE")).toBe(true);
            (0, vitest_1.expect)((0, index_1.parseFeatureFlag)("1")).toBe(true);
            (0, vitest_1.expect)((0, index_1.parseFeatureFlag)("yes")).toBe(true);
            (0, vitest_1.expect)((0, index_1.parseFeatureFlag)("on")).toBe(true);
            (0, vitest_1.expect)((0, index_1.parseFeatureFlag)("false")).toBe(false);
            (0, vitest_1.expect)((0, index_1.parseFeatureFlag)("0")).toBe(false);
            (0, vitest_1.expect)((0, index_1.parseFeatureFlag)("no")).toBe(false);
            (0, vitest_1.expect)((0, index_1.parseFeatureFlag)("off")).toBe(false);
            (0, vitest_1.expect)((0, index_1.parseFeatureFlag)(undefined)).toBe(false);
            (0, vitest_1.expect)((0, index_1.parseFeatureFlag)(null)).toBe(false);
            (0, vitest_1.expect)((0, index_1.parseFeatureFlag)("")).toBe(false);
            (0, vitest_1.expect)((0, index_1.parseFeatureFlag)("random", false)).toBe(false);
            (0, vitest_1.expect)((0, index_1.parseFeatureFlag)("random", true)).toBe(true);
        });
    });
    (0, vitest_1.describe)("i18n Translation Catalog", () => {
        (0, vitest_1.it)("ensures exact key parity and non-empty strings between en and pt-BR", () => {
            const getKeys = (obj, prefix = "") => {
                let keys = [];
                for (const [k, v] of Object.entries(obj)) {
                    const nextKey = prefix ? `${prefix}.${k}` : k;
                    if (v && typeof v === "object") {
                        keys = keys.concat(getKeys(v, nextKey));
                    }
                    else {
                        keys.push(nextKey);
                    }
                }
                return keys.sort();
            };
            const enKeys = getKeys(index_1.enCatalog);
            const ptKeys = getKeys(index_1.ptBRCatalog);
            (0, vitest_1.expect)(ptKeys).toEqual(enKeys);
            (0, vitest_1.expect)(enKeys.length).toBeGreaterThan(20);
            // Verify no empty strings
            const checkNonEmpty = (obj) => {
                for (const v of Object.values(obj)) {
                    if (typeof v === "string") {
                        (0, vitest_1.expect)(v.trim().length).toBeGreaterThan(0);
                    }
                    else if (typeof v === "object" && v !== null) {
                        checkNonEmpty(v);
                    }
                }
            };
            checkNonEmpty(index_1.enCatalog);
            checkNonEmpty(index_1.ptBRCatalog);
        });
        (0, vitest_1.it)("interpolates variables and translates keys correctly", () => {
            const tEn = (0, index_1.createTranslator)("en");
            const tPt = (0, index_1.createTranslator)("pt-BR");
            (0, vitest_1.expect)(tEn("watchlist.bannerWatching", { count: 5 })).toBe("5 Watching on MyP");
            (0, vitest_1.expect)(tPt("watchlist.bannerWatching", { count: 5 })).toBe("5 Acompanhadas no MyP");
            (0, vitest_1.expect)(tEn("settings.mypAutomationTitle")).toBe("Automated Daily Watchlist Sync (Opt-In)");
            (0, vitest_1.expect)(tPt("settings.mypAutomationTitle")).toBe("Sincronização Diária Automática (Opt-In)");
            (0, vitest_1.expect)((0, index_1.resolveLocale)("pt-BR")).toBe("pt-BR");
            (0, vitest_1.expect)((0, index_1.resolveLocale)("pt")).toBe("pt-BR");
            (0, vitest_1.expect)((0, index_1.resolveLocale)("en-US")).toBe("en");
            (0, vitest_1.expect)((0, index_1.resolveLocale)(null)).toBe("en");
            (0, vitest_1.expect)((0, index_1.formatLocaleNumber)(1000, "pt-BR")).toBe("1.000");
            (0, vitest_1.expect)((0, index_1.formatLocaleNumber)(1000, "en")).toBe("1,000");
        });
    });
});
