# Specification: Global MyP Market Scanner & Collection Store Relocation

**Status:** `ready-for-agent`

## Problem Statement

Collectors building competitive Grand Archive Decks often face card **Shortages**—either **Hard Shortages** (where they do not own enough copies in their Binder to sleeve even a single Deck) or **Shared Shortages** (where cards must be physically swapped between multiple Decks). While the application previously added a personal store crawler (`myp_cards`) to detect **Shortage Offsets** in the Collector's own MyP Cards profile, Collectors had no visibility into what cards are actively for sale across the broader Brazilian secondary market (`mypcards.com/grandarchive?ProdutoSearch[exibirSomenteVenda]=1`).

Without a global market scanner:
- Collectors must manually search MyP Cards card-by-card for dozens of missing deck slots, only to find most out of stock (`0 un.`).
- Cards listed in the Collector's own MyP store were housed on `/marketplace`, leaving no dedicated surface for browsing external market supply while separating personal sales stock from the `/collection` hub.
- If a Collector looks at global MyP stock, their own active Store Listings are mixed into the global count, risking false "buyable" alerts for cards where the Collector is the only seller.

## Solution

We introduce a **Global MyP Market Scanner** paired with a **Collection Store Relocation**:
1. **Relocate Personal Store Listings to `/collection`**: Move the Collector's personal MyP Store (`@username`, **Store Sync**, **Shortage Offset** detection, and Claim-to-Binder workflow) into a dedicated **MyP Store** tab inside `/collection`, keeping `myp_cards` decoupled from `collection_items` until claimed.
2. **Global Market Sync on `/marketplace`**: Repurpose `/marketplace` to scan and browse the entire active MyP Grand Archive catalog (`exibirSomenteVenda=1`, ~1,626 in-stock printings across ~55 pages of `/produto/load-more`). Store the global snapshot in `myp_market_cards`, refreshed both via an on-demand **"Sync MyP Market"** button and an automated GitHub Actions workflow running every 6 hours (`0 */6 * * *`).
3. **Smart Net External Stock**: Cross-reference global **Market Listings** against the Collector's personal **Store Listings** (`myp_cards`) to compute `netExternalStock = Math.max(0, globalQuantity - personalStoreQuantity)`. Only flag a card as an external **Buyable Shortage** when `netExternalStock > 0`, while badging any copies sitting in the Collector's own MyP Store.
4. **Two-Tier Shortage Prioritization & Direct Deck Purchase Links**:
   - In `/marketplace`, categorize and sort listings by **Hard Shortages** (🔴 Red alert, `peakMissing > 0`), **Shared Shortages** (🟡 Yellow/Amber alert, `concurrentMissing > 0` with `peakMissing === 0`), and **All Market Listings**.
   - In `/decks` (both the consolidated Shortages view and individual Deck Shortage tables), display direct **"Buy on MyP · R$ X,XX (N avail)"** badges on any missing card with `netExternalStock > 0`, linking straight to the lowest-priced MyP product page.

---

## User Stories

1. As a Collector, I want my personal MyP Cards store (`@username`) to live under a dedicated **MyP Store** tab inside `/collection`, so that all physical cards I own (active Binder + cards I have listed for sale) are managed in one unified place.
2. As a Collector, I want my personal **Store Listings** to remain isolated from my active Binder copies until I explicitly claim them, so that cards I am actively trying to sell do not falsely mask Deck Shortages.
3. As a Collector, I want to claim copies from my **MyP Store** tab inside `/collection` directly into my Binder and have the MyP product page open in a new tab, so that I can immediately delist or decrement the card on MyP Cards.
4. As a Collector, I want `/marketplace` to display all active **Market Listings** for Grand Archive across MyP Cards (`exibirSomenteVenda=1`), so that I can see every card currently available to purchase in Brazil without leaving the app.
5. As a Collector, I want `/marketplace` to highlight **Hard Shortages** (`peakMissing > 0`) with a high-priority red alert (*"Missing X to play [Deck Name]"*), so that I immediately know which purchasable cards will make an unplayable Deck tournament-ready.
6. As a Collector, I want `/marketplace` to highlight **Shared Shortages** (`concurrentMissing > 0`, `peakMissing = 0`) with a secondary yellow/amber alert (*"Sharing X across [Decks]"*), so that I can spot affordable extra copies to stop swapping cards between Decks.
7. As a Collector, I want **Market Listings** on `/marketplace` to sort **Hard Shortages** first, **Shared Shortages** second, and remaining market items by price, so that the most urgent purchases always appear at the top.
8. As a Collector, I want one-click summary filter cards on `/marketplace` to toggle between **Hard Shortages**, **Shared Shortages**, **All Deck Shortages**, and **All Market Listings**, so that I can either focus strictly on deck needs or browse the entire market.
9. As a Collector, I want the system to subtract my own synced **Store Listings** from the global MyP stock count (`netExternalStock = Math.max(0, globalQty - myStoreQty)`), so that I am never told to buy a card from MyP when the only copies listed for sale are my own.
10. As a Collector, when a **Market Listing** also exists in my personal **Store Listings**, I want to see a clear badge (*"You have X in your MyP Store"*) alongside the net external stock from other sellers, so that I know I can claim my own copy instead of buying one.
11. As a Collector who has not yet connected a personal MyP username, I want the global **Market Sync** and **Buyable Shortage** alerts to work out-of-the-box assuming `myStoreQty = 0`, so that I can shop for missing deck cards even if I don't sell on MyP.
12. As a Collector viewing the consolidated Shortages tab or an individual Deck page in `/decks`, I want to see a **"Buy on MyP · R$ X,XX (N avail)"** badge on any missing card that has external stock on MyP, so that I can jump straight to the MyP product page and buy it in one click.
13. As a Collector viewing `/decks`, if I own copies of a missing card in my personal MyP Store, I want the **"X in MyP Store"** badge to link directly to `/collection?view=MYP_STORE`, so that I can claim it into my Binder.
14. As a Collector, I want to filter **Market Listings** on `/marketplace` by search query (card name, edition code, or deck name), Element, and Rarity, so that I can quickly find specific printings or staples.
15. As a Collector, I want an on-demand **"Sync MyP Market"** button in `/marketplace` that crawls the global MyP Grand Archive catalog and displays when the market snapshot was last updated, so that I can refresh prices and stock whenever I am ready to buy.
16. As a System Administrator, I want an automated GitHub Actions workflow running every 6 hours (`0 */6 * * *`) and a `pnpm sync:market` CLI command that refreshes the global **Market Listings** snapshot using polite batched requests, so that market availability and prices stay fresh throughout the day without manual intervention or IP-ban risk.
17. As a Developer, I want failed or interrupted **Market Sync** runs to preserve the existing `myp_market_cards` snapshot untouched, so that temporary network or Cloudflare issues never wipe out the user's market data.

---

## Implementation Decisions

### 1. Schema Evolution (`myp_market_cards`)
We introduce a dedicated `myp_market_cards` table to store the global MyP Grand Archive in-stock snapshot (`exibirSomenteVenda=1`), completely separate from `myp_cards` (personal **Store Listings**) and `collection_items` (active **Binder**):

```typescript
interface MypMarketCardRecord {
  id: string;              // Deterministic or batch ID, e.g. "myp-mkt-<mypItemId>"
  cardSlug: string | null; // Resolved canonical Card slug
  editionId: string | null;// Resolved canonical Printing edition ID
  rawName: string;         // Raw product title from MyP
  cardName: string;        // Canonical Card name (or cleaned title)
  setPrefix: string;       // Edition prefix (e.g. "ALC", "DOA", "PTM")
  quantity: number;        // Total copies available across all sellers on MyP
  price: string;           // Formatted lowest asking price (e.g. "R$ 12,50")
  priceNumeric: number;    // Parsed numeric BRL value for sorting/aggregation
  isFoil: boolean;         // True if product entry is explicitly a Foil/Curio variant
  mypItemId: string | null;// e.g. "grandarchive_alc_012"
  mypProductUrl: string | null; // Direct link to "/grandarchive/produto/<id>/<slug>"
  updatedAt: number;       // Unix epoch seconds of the snapshot sync
}
```

### 2. Polite Batched Global Market Crawler (`Market Sync`)
- **Pagination Endpoint**: Fetches page 1 from `https://mypcards.com/grandarchive?ProdutoSearch%5BexibirSomenteVenda%5D=1` (extracting total item count from `ProdutoScrollInfinito` or `<div class="summary">` and parsing page 1 cards via `parseMypHtml`), then paginates `https://mypcards.com/produto/load-more?marca=grandarchive&ProdutoSearch%5BexibirSomenteVenda%5D=1&page=<N>`.
- **Polite Concurrency**: Pages 2..N (up to safety cap of 75 pages) are fetched in small batches of 3–4 concurrent requests with a ~300ms pause between batches, completing a ~55-page scan in ~10–15 seconds without triggering rate limits.
- **Atomic Snapshot Swap**: Only after at least page 1 succeeds and items are parsed and resolved against the **Card Catalog**, the table is refreshed in batches. If fetching fails before any items are parsed, the existing `myp_market_cards` snapshot is preserved untouched.

### 3. Net External Stock & Two-Tier Shortage Cross-Referencing
When generating the Global Market Report (`getGlobalMarketReport`) or enriching Deck Shortages (`calculateAggregatedShortages` and `calculateDeckShortage`):
- **Personal Store Subtraction**: Match each global `myp_market_cards` entry against the Collector's `myp_cards` rows (matching by `mypItemId` when present, or `editionId` + `setPrefix`).
  - `personalStoreQty`: copies the Collector has listed in their own MyP Store for that item.
  - `netExternalStock = Math.max(0, globalQuantity - personalStoreQty)`: copies available from *other* sellers.
- **Shortage Classification (per `cardSlug` across Collector's Decks)**:
  - `peakDemand`: maximum copies required by any single Deck.
  - `totalDemand`: sum of copies required across all Decks.
  - `totalBinderOwned`: copies in `collection_items`.
  - `peakMissing = Math.max(0, peakDemand - totalBinderOwned)` (**Hard Shortage** when `peakMissing > 0`).
  - `concurrentMissing = Math.max(0, totalDemand - totalBinderOwned)` (**Shared Shortage** when `concurrentMissing > 0` and `peakMissing === 0`).
  - `shortageTier`: `"HARD"` if `peakMissing > 0`, `"SHARED"` if `concurrentMissing > 0 && peakMissing === 0`, or `"NONE"`.
  - `isBuyableShortage`: `shortageTier !== "NONE" && netExternalStock > 0`.

### 4. UI Surface Restructuring
- **`/collection` (`MYP_STORE` Tab)**:
  - Extend `/collection` view tabs (`ALL`, `STAPLES`, `LOW_POP`, `IDLE`, `MYP_STORE`).
  - When `MYP_STORE` is active, render the Collector's personal MyP Store manager (username onboarding/edit, "Sync My Store", Shortage Offset callouts, and Claim-to-Binder controls).
- **`/marketplace` (Global MyP Market Scanner)**:
  - Displays global market summary cards (🔴 **Hard Shortages Available**, 🟡 **Shared Shortages Available**, 🌐 **Unique Printings on MyP**, 📦 **Total Market Copies**) plus `Last Synced` timestamp and **"Sync MyP Market"** button.
  - Supports one-click filtering by Shortage Tier (`ALL_SHORTAGES`, `HARD_ONLY`, `SHARED_ONLY`, `ALL_MARKET`), plus text search, Element chips, and Rarity chips.
  - Each row shows external stock (`netExternalStock`), lowest price (`price`), an amber **"X in your MyP Store"** badge if `personalStoreQty > 0` (or a warning if `netExternalStock === 0` so the user doesn't buy their own listing), red/yellow deck shortage badges, and a direct **"Buy on MyP"** external link button.
- **`/decks` (`AllShortagesView` & `ShortageTable`)**:
  - Enrich shortage items with `marketAvailableCopies` (`netExternalStock` summed across available printings for that `cardSlug`), `marketLowestPriceBrl`, `marketLowestPriceStr`, and `marketProductUrl` (the URL of the lowest-priced printing with `netExternalStock > 0`).
  - Render a direct **"Buy on MyP · R$ X,XX (N avail)"** link badge next to missing cards, and update the personal **"X in MyP Store"** badge link to `/collection?view=MYP_STORE`.

### 5. Automated 6-Hour Synchronization
- **`POST /api/marketplace/market-sync`**: Accepts either an authenticated user session or `Authorization: Bearer <CRON_SECRET>`. Executes `syncGlobalMarketplace()` and returns sync statistics and the updated report.
- **`.github/workflows/market-sync.yml`**: Scheduled at `0 */6 * * *` (every 6 hours) and `workflow_dispatch`, invoking `/api/marketplace/market-sync` (or running `pnpm sync:market`).

---

## Testing Decisions

### Primary Testing Seam
We test at the **Service Boundary Seam** (`marketplace` service + `shortage` service backed by an in-memory LibSQL/SQLite test database and injected mock `fetch` fixtures):
- **Why this seam**: A single service-level seam takes raw MyP HTML/JSON fixtures at the top, runs real catalog resolution and SQL persistence against an in-memory database, cross-references real `decks`, `collection_items`, and `myp_cards` records, and returns the exact data structures consumed by `/marketplace`, `/collection`, and `/decks`.

### What Makes a Good Test
- Tests verify observable behavior at the service seam rather than internal helper implementation details:
  1. **Global Market Sync & Pagination**: Given multi-page `/grandarchive` + `/produto/load-more` fixtures, `syncGlobalMarketplace` resolves cards against `cards` and `card_editions`, persists `myp_market_cards`, and preserves existing rows if an upstream fetch fails.
  2. **Net External Stock & Self-Collision**: When a Collector has `2x` of a card in `myp_cards` and the global market has `2x`, `netExternalStock` is `0` and `isBuyableShortage` is `false`. When the global market has `5x`, `netExternalStock` is `3` and `isBuyableShortage` is `true`.
  3. **Hard vs. Shared Shortage Prioritization**: Cards with `peakMissing > 0` are classified as `"HARD"` (sorted first), cards with `concurrentMissing > 0 && peakMissing === 0` are classified as `"SHARED"` (sorted second), and non-shortage market cards follow by price.
  4. **Deck Shortage Market Enrichment**: `calculateAggregatedShortages` and `calculateDeckShortage` include lowest price, net external stock, and direct MyP product URL for any shortage card available on the global market.

### Prior Art
- Existing integration tests in `src/services/marketplace.test.ts`, `src/services/shortage.test.ts`, and `src/services/meta.test.ts`.

---

## Out of Scope
- Automated checkout or cart manipulation on `mypcards.com` (users click through to the MyP product page to complete purchases and optimize multi-seller shipping directly on MyP).
- Scraping all 1,626 individual product detail pages for per-seller condition tables during the global sync.
- Tracking historical price charts over time (only the latest market snapshot is stored).

---

## Further Notes
- Because MyP Cards sits behind Cloudflare, `fetchMypText` automatically falls back from Node `fetch` to `curl` when TLS fingerprinting returns HTTP 403.
