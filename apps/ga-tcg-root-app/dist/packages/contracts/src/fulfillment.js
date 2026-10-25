"use strict";
/**
 * Shared Fulfillment domain models and contracts for Grand Archive TCG Collector.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CANONICAL_ELEMENT_ORDER = exports.UNMATCHED_ELEMENT = void 0;
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
function normalizeBuyerNick(nick) {
    return nick.trim().replace(/\s+/g, " ").toLowerCase();
}
