"use strict";
/**
 * Shared contracts for featured set shortage ranking and checklist browsing.
 * These types are consumed by the web app, mobile app, and the set-shortage service.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchesSetChecklistFilters = matchesSetChecklistFilters;
// ---------------------------------------------------------------------------
// Filter Helper
// ---------------------------------------------------------------------------
/**
 * Pure filter predicate for set checklist cards.
 * Returns true when the card matches the given filters.
 */
function matchesSetChecklistFilters(card, filters) {
    if (filters.prefix !== null && !card.prefixes.includes(filters.prefix)) {
        return false;
    }
    if (filters.element && card.element.toUpperCase() !== filters.element.toUpperCase()) {
        return false;
    }
    // Match when the selected rarity is INCLUDED in the card's rarities array
    if (filters.rarity != null && !card.rarities.includes(filters.rarity)) {
        return false;
    }
    const search = filters.search?.trim().toLowerCase();
    if (search && !card.cardName.toLowerCase().includes(search)) {
        return false;
    }
    switch (filters.status) {
        case "shortages":
            return card.isShortage;
        case "owned":
            return card.ownedQuantity > 0;
        case "unowned":
            return card.ownedQuantity === 0;
        case "all":
        default:
            return true;
    }
}
