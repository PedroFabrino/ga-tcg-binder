"use strict";
/**
 * Shared Fulfillment domain models and contracts for Grand Archive TCG Collector.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CANONICAL_ELEMENT_ORDER = exports.UNMATCHED_ELEMENT = void 0;
exports.createEmptyFulfillmentReport = createEmptyFulfillmentReport;
exports.normalizeBuyerNick = normalizeBuyerNick;
exports.UNMATCHED_ELEMENT = "UNMATCHED";
exports.CANONICAL_ELEMENT_ORDER = [
    "Norm",
    "Fire",
    "Water",
    "Wind",
    "Tera",
    "Crux",
    "Umbra",
    "Luxem",
    "Exalted",
    "Astra",
    "Exia",
    "Arcane",
    "Neos",
    exports.UNMATCHED_ELEMENT,
];
function createEmptyFulfillmentReport() {
    const pickListByElement = {};
    for (const el of exports.CANONICAL_ELEMENT_ORDER) {
        pickListByElement[el] = [];
    }
    return {
        generatedAt: Math.floor(Date.now() / 1000),
        totalGrandArchiveOrders: 0,
        totalGrandArchiveCopies: 0,
        pickListByElement,
        buyerPacks: [],
        nonGrandArchiveOrders: [],
    };
}
function normalizeBuyerNick(nick) {
    return nick.trim().replace(/\s+/g, " ").toLowerCase();
}
