## Parent
#1

## What to build
Implement cross-deck analysis to detect multi-deck contention. Add a "Multi-Deck Staples" smart view in the Collection Dashboard that lists all owned cards referenced across 2 or more decks, displaying badges showing which decks use each card. Deliver a "Dedicated (No-Sharing)" toggle (both as a global setting and per-card override): when enabled on a card, physical copies cannot be double-counted across decks. Provide explicit assignment of owned copies to specific decks, and surface deficit warnings on decks competing for unallocated copies.

## Acceptance criteria
- [ ] Cross-deck contention engine identifies all cards appearing in multiple active decks.
- [ ] Collection Dashboard includes a "Multi-Deck Staples" tab showing deck count badges and clickable links to the using decks.
- [ ] Deck cards display cross-deck usage indicators (e.g. `Used in: Fire Luxem, Water Diao Chan`).
- [ ] Dedicated toggle exists at both the global settings level and per-card level.
- [ ] Explicit allocation interface allows assigning owned physical copies of Dedicated cards to a specific deck.
- [ ] Decks lacking assigned copies of Dedicated cards report a shortage with notes on which deck holds the allocation.
- [ ] Automated tests verify contention calculations and allocation exclusivity rules.

## Blocked by
- #4 (Deck Builder, Omnidex Importer & Shortage Gap Analysis)
