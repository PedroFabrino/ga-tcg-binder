# 0008: Global MyP Market Scanner and Personal Store Relocation to Collection

Status: accepted
Supersedes: parts of ADR-0007 (UI placement of personal Store Listings)

## Context
ADR-0007 introduced `myp_cards` to track a Collector's own MyP Cards store listings and detect **Shortage Offsets** (cards the Collector already owns on sale that can be claimed back into their Binder). However, Collectors also need to scan the entire public MyP Grand Archive catalog (`exibirSomenteVenda=1`, ~1,626 active product printings across ~55 pages) to discover third-party **Market Listings** that can be purchased to resolve active Deck Shortages (**Buyable Shortages**).

Because the Collector's own MyP listings are physically part of their collection, keeping `/marketplace` exclusively for personal store listings left no dedicated surface for browsing the wider market. Furthermore, scraping individual seller tables across all 1,626 product pages on every sync would require 1,600+ HTTP requests and risk rate limiting.

## Decision
1. **Relocate Personal Store Listings (`myp_cards`) to `/collection`**:
   - Move the Collector's personal MyP store management (`@username`, Store Sync, Shortage Offset alerts, and Claim-to-Binder workflow) into a dedicated **MyP Store** tab inside `/collection`, while keeping `myp_cards` strictly isolated from `collection_items` in the database so listed cards do not mask deck shortages until claimed.

2. **Repurpose `/marketplace` for Global Market Listings (`myp_market_cards`)**:
   - Create a global `myp_market_cards` table storing the active MyP Grand Archive catalog snapshot (`exibirSomenteVenda=1`), resolved against `cards` and `card_editions` at ingestion time.
   - Crawl `/produto/load-more?marca=grandarchive&ProdutoSearch[exibirSomenteVenda]=1` using polite batched concurrency (3–4 requests per batch with short delays) rather than scraping 1,626 individual product pages.
   - Provide both an on-demand **Sync MyP Market** trigger in `/marketplace` and an automated GitHub Actions workflow (`.github/workflows/market-sync.yml`) running every 6 hours (`0 */6 * * *`) plus a CLI script (`pnpm sync:market`).

3. **Net External Stock & Self-Listing Collision Handling**:
   - Cross-reference `myp_market_cards` against the Collector's personal `myp_cards` snapshot by printing/item ID to compute `netExternalStock = Math.max(0, globalQty - myStoreQty)`.
   - Only flag a card as an external **Buyable Shortage** when `netExternalStock > 0`. If `myStoreQty > 0`, badge the card to show that copies are sitting in the Collector's own MyP Store (and warn if the only copies on MyP are the Collector's own listings).

4. **Two-Tier Shortage Prioritization & Direct Deck Links**:
   - Prioritize and filter Market Listings by:
     - **Hard Shortages** (Red alert, `peakMissing > 0`): Copies needed to make a single deck playable.
     - **Shared Shortages** (Yellow/Amber alert, `concurrentMissing > 0` and `peakMissing === 0`): Copies needed to eliminate card-sharing across multiple decks.
     - **All Market Listings**: The complete in-stock MyP Grand Archive catalog.
   - Surface direct **"Buy on MyP · R$ X,XX (N avail)"** badges in `/decks` (`AllShortagesView` and `ShortageTable`) linking straight to the lowest-priced available MyP product page.

## Consequences
- Avoids 1,600+ per-product HTTP scrapes by combining the 55-page global catalog summary with the Collector's existing `myp_cards` snapshot to subtract self-owned stock.
- Aligns UI navigation with the domain model: `/collection` holds everything the Collector owns (Binder + Personal MyP Store), while `/marketplace` scans the external market for cards to buy.
