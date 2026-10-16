## Parent

#18

## What to build

An end-to-end global MyP market ingestion and cross-referencing pipeline that crawls all active Grand Archive Market Listings on MyP Cards (`exibirSomenteVenda=1`), resolves them against the Card Catalog into an isolated `myp_market_cards` snapshot, subtracts the Collector's own personal Store Listings (`netExternalStock = Math.max(0, globalQty - myStoreQty)`), and classifies matches into high-priority **Hard Shortages** (`peakMissing > 0`) and secondary **Shared Shortages** (`concurrentMissing > 0, peakMissing = 0`).

## Acceptance criteria

- [ ] A dedicated `myp_market_cards` table stores the global MyP Grand Archive in-stock snapshot (`cardSlug`, `editionId`, `rawName`, `cardName`, `setPrefix`, `quantity`, `price`, `priceNumeric`, `isFoil`, `mypItemId`, `mypProductUrl`, `updatedAt`) without polluting `collection_items` or `myp_cards`.
- [ ] The global Market Sync crawler paginates `mypcards.com/grandarchive?ProdutoSearch[exibirSomenteVenda]=1` and `/produto/load-more` in polite concurrent batches, resolves entries against the Card Catalog, and preserves existing `myp_market_cards` rows if an upstream fetch fails before parsing items.
- [ ] Cross-referencing computes `netExternalStock = Math.max(0, globalQuantity - personalStoreQuantity)` using the Collector's synced `myp_cards` snapshot (or `personalStoreQuantity = 0` if the Collector has not synced a personal MyP store), ensuring a listing is only flagged as a **Buyable Shortage** when `netExternalStock > 0`.
- [ ] Market Listings and Deck Shortages classify deficits into **Hard Shortages** (`peakMissing > 0`, needed to play a single Deck) and **Shared Shortages** (`concurrentMissing > 0` with `peakMissing = 0`, needed to avoid swapping Shared Cards across Decks), sorting Hard Shortages first and Shared Shortages second.
- [ ] Deck Shortage reports (`calculateAggregatedShortages` and `calculateDeckShortage`) include `marketAvailableCopies` (`netExternalStock`), lowest BRL price, and direct MyP product URL for any missing card available on the global market.
- [ ] Service-seam integration tests verify multi-page market ingestion, failure preservation, self-listing stock subtraction, and Hard vs. Shared Shortage prioritization using recorded HTML/JSON fixtures.

## Blocked by

None — can start immediately
