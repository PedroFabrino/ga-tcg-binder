# Specification: Meta Staples Indexer, Collection-Aware Deck Recommendations & Sequential Sync Pipeline

**Status:** `ready-for-agent`

## Problem Statement

Competitive Grand Archive **Collectors** managing both an active **Binder** and personal **Store Listings** on MyP Cards face three connected blind spots when deciding what cards to keep, sell, or build toward:

1. **No Visibility into Competitive Format Staples**: While the application tracks cards shared across the Collector's own saved **Decks**, it has no awareness of format-wide **Meta Staples** (`grandarchivestats.com/cards/staples` across Divine Relics, Material Decks, Elemental Main Decks, and Sideboards). As a result, a Collector can unknowingly list a high-demand format staple for sale in their personal MyP Store even when they own fewer copies in their Binder than a competitive playset (**Staple Deficit**). Conversely, if a Collector already owns a full playset in their Binder and lists a 5th surplus copy on MyP, naive staple tagging would nag them to delist a card they intentionally put up for sale.
2. **No Proactive Meta Deck Recommendations or Completion Cost**: Previously, evaluating a **Meta Archetype** required clicking *"Compare to Binder"* one archetype at a time (`ADR-0004` lazy Phase 2). Collectors cannot see at a glance which competitive **Meta Archetypes** they already own 80%+ of across their combined **Binder** and personal **Store Listings** (**Archetype Completion**), nor can they see how many of the remaining missing cards are actively in stock on the global MyP market (**Market Listings**) and what it would cost in BRL to finish the deck.
3. **Unordered Synchronization Pipelines**: Because **Meta Staples**, personal **Store Listings**, global **Market Listings**, and **Meta Archetypes** depend on one another for accurate cross-referencing, running their synchronization jobs independently or out of order causes **Archetype Completion**, **Staple Deficits**, and **Cost-to-Complete** metrics to evaluate against stale inventory or outdated external stock.

## Solution

We introduce a **Playset-Aware Meta Staples Indexer**, **Collection-Aware Meta Deck Recommendations**, and a **Strict Sequential Sync Pipeline** (`ADR-0009`):

1. **Playset-Aware Meta Staples (`Meta Sync` — Staples)**:
   - Crawl `https://grandarchivestats.com/cards/staples?window=60` across all 7 competitive sections (*Divine Relics*, *Material Deck*, *Fire Main Deck*, *Water Main Deck*, *Wind Main Deck*, *Norm Main Deck*, and *Sideboard Tech*), filtering out low-sample outliers (`low-n` / `< 2%` inclusion).
   - Deduplicate by canonical **Card** slug, recording all matched staple categories, maximum tournament inclusion rate, and canonical `recommendedCopies` (`1` for Material/Divine Relics, `Math.min(4, Math.ceil(maxAvgCopies))` for Main Deck and Sideboard staples).
   - Repurpose the `STAPLES` smart view in the Collection hub to filter the Collector's Binder by indexed **Meta Staples**.
   - In the Collector's personal **MyP Store** tab, badge every **Meta Staple** with playset awareness: flag a high-priority **Staple Deficit** (*"🔥 Meta Staple · Keep in Binder! (Binder: X/Y)"*) sorted right after **Shortage Offsets** when `binderOwned < recommendedCopies`, or display a neutral *"Meta Staple · Playset Owned in Binder (Y/Y)"* badge when the Collector already holds a full playset in their Binder.
2. **Eager Canonical Decklist Indexing & Collection-Aware Deck Recommendations**:
   - Supersede lazy on-demand decklist fetching (`ADR-0004` Phase 2) by eagerly indexing the top tournament placement **Canonical Decklist** (`Worlds > Ascent > Regional > Store Championship`) for every active **Tier 1**, **Tier 2**, and **Tier 3** **Meta Archetype**, caching by event deck URL so repeat syncs skip already-indexed lists.
   - Compute **Archetype Completion** across the core playable deck (**Material Deck + Main Deck**, 72 cards) using the Collector's total physical holdings (`Binder (Shared + Dedicated) + Personal MyP Store`), displaying the exact ownership split (e.g., *"85% Owned · 55 Binder + 6 MyP Store"*).
   - Cross-reference the remaining missing cards against global **Market Listings** (`netExternalStock > 0`) to surface immediate **Cost-to-Complete on MyP** (e.g., *"8/11 missing on MyP · from R$ 114,50"*) directly on archetype cards and comparison modals.
   - Surface a **"Recommended for Your Collection"** highlight rail in the Meta Explorer (and a quick-import widget in the Decks hub) with a 1-click **"Import to My Decks"** action that saves the deck and prompts the Collector to claim any needed copies sitting in their personal MyP Store.
3. **Strict Sequential Sync Pipeline**:
   - Orchestrate daily automated synchronization (`0 8 * * *` UTC) and CLI/API pipeline execution in strict dependency order:
     **Stage 0 (Card Catalog)** $\rightarrow$ **Stage 1 (Meta Staples)** $\rightarrow$ **Stage 2a (Personal MyP Store Sync)** $\rightarrow$ **Stage 2b (Global MyP Market Sync)** $\rightarrow$ **Stage 3 (Meta Archetypes & Canonical Decklists)**.

---

## User Stories

1. As a Collector, I want the system to index competitive **Meta Staples** from `grandarchivestats.com/cards/staples?window=60`, so that staple recommendations reflect the active 60-day tournament metagame.
2. As a Collector, I want low-sample outliers (`low-n` tiles or `< 2%` deck inclusion) excluded from **Meta Staples**, so that niche 0.1% playrate cards are not falsely flagged as must-keep staples.
3. As a Collector, I want each **Meta Staple** to track its canonical `recommendedCopies` (`1` for Material/Divine Relics, and `Math.ceil(avgCopies)` up to `4` for Main Deck and Sideboard cards), so that the system knows how many copies constitute a full competitive playset.
4. As a Collector, when a card appears in multiple staple sections (such as both Water Main Deck and Sideboard Tech), I want it deduplicated by card slug while preserving all matched category labels and the highest inclusion rate and recommended copy count, so that staple badges show complete context without duplicate rows.
5. As a Collector viewing my **Binder** under the `Staples` smart view, I want to see my owned **Meta Staples** along with their tournament inclusion percentage, staple categories, and playset progress (`owned / recommendedCopies`), so that I can audit the competitive core of my collection.
6. As a Collector viewing my personal **MyP Store** tab, I want any listing that has a **Staple Deficit** (`binderOwned < recommendedCopies`) to display a prominent **"🔥 Meta Staple · Keep in Binder! (Binder: X/Y)"** alert, so that I don't accidentally sell a competitive staple I still need for my playset.
7. As a Collector viewing my personal **MyP Store** tab, I want **Staple Deficit** listings sorted immediately after active **Shortage Offsets** (and ahead of regular listings), so that cards I should withdraw from sale are always surfaced at the top.
8. As a Collector viewing my personal **MyP Store** tab, when I already own a full playset of a **Meta Staple** in my Binder (`binderOwned >= recommendedCopies`), I want my extra MyP listing to display a neutral **"Meta Staple · Playset Owned in Binder (Y/Y)"** badge instead of a warning, so that I am not nagged to delist my 5th surplus copy.
9. As a Collector browsing the global **Marketplace**, I want to filter or see badges on **Meta Staples** (highlighting those where I have a **Staple Deficit**), so that I can proactively pick up affordable format staples even before building a specific deck.
10. As a Collector, I want **Meta Sync** to eagerly index both the metagame tier table (`Tier 1`, `Tier 2`, `Tier 3`, and soft-demoted `Rogue` archetypes) and each active archetype's **Canonical Decklist** from the highest-tier tournament placement (`Worlds > Ascent > Regional > Store Championship`), so that every meta deck is immediately ready for collection matching without clicking through 35 modals.
11. As a System Administrator, I want eager **Canonical Decklist** resolution to cache the source event deck URL and skip re-fetching unchanged tournament deck pages on subsequent syncs, so that daily syncs remain fast and polite to `grandarchivestats.com`.
12. As a Collector browsing the Meta Explorer, I want every **Meta Archetype** card to display my **Archetype Completion** percentage calculated across its core playable deck (**Material Deck + Main Deck**, 72 cards) using only my physical holdings (**Binder** + personal **MyP Store**), so that I immediately know how close I am to building each deck.
13. As a Collector, I want **Archetype Completion** to include both **Shared Cards** and **Dedicated Cards** in my Binder alongside my personal **Store Listings**, so that my match score reflects all physical copies I already own without needing to buy anything.
14. As a Collector, when part of my **Archetype Completion** comes from cards listed in my personal **MyP Store**, I want the badge to show the breakdown (e.g., *"85% Owned (55 Binder · 6 MyP Store)"*), so that I know how many cards are ready in my Binder versus sitting in my store inventory.
15. As a Collector browsing the Meta Explorer, I want each **Meta Archetype** card to also show how many of my remaining missing cards are currently available on the global MyP market (`netExternalStock > 0`) and the minimum BRL cost to buy them (e.g., *"8/11 missing on MyP · R$ 114,50"*), so that I can see which decks I can finish right now and at what price.
16. As a Collector, I want a **"Recommended for Your Collection"** highlight section at the top of the Meta Explorer (and a quick-discovery widget in the Decks hub) showcasing the active **Meta Archetypes** with my highest **Archetype Completion** percentage, so that the most buildable competitive decks jump out immediately.
17. As a Collector, I want to sort or filter the Meta Explorer by **Archetype Completion %** and **Lowest Cost to Complete**, in addition to **Meta Tier**, **Win Rate**, and **Meta Share**, so that I can prioritize either raw competitive power or budget buildability.
18. As a Collector, I want a 1-click **"Import to My Decks"** button directly on Recommended Deck cards and inside the Compare modal, so that I can adopt a competitive **Canonical Decklist** into my personal Decks list immediately.
19. As a Collector, when I click **"Import to My Decks"** on an archetype where some of my owned copies are sitting in my personal **MyP Store**, I want the deck created non-destructively and a toast/banner prompting me with a 1-click link to claim those copies from my **MyP Store** tab, so that I can withdraw and delist them from MyP Cards safely.
20. As a System Administrator, I want a single sequential synchronization pipeline (`POST /api/sync/pipeline` and `pnpm sync:pipeline`) that executes **Meta Staples Sync** $\rightarrow$ **Personal MyP Store Sync** $\rightarrow$ **Global MyP Market Sync** $\rightarrow$ **Meta Archetypes & Canonical Decklists Sync** in strict order, so that downstream shortage, staple deficit, and deck completion calculations always use fresh upstream data.
21. As a System Administrator, I want an automated daily GitHub Actions workflow (`0 8 * * *` UTC) running the sequential sync pipeline, while keeping the 6-hour global market delta sync active in between, so that tournament results, staples, and market availability stay continuously up to date.
22. As a Developer, I want any failure in an individual upstream scraper stage to preserve that stage's existing cached snapshot and proceed or report cleanly without corrupting downstream tables, so that temporary upstream downtime never breaks the application.

---

## Implementation Decisions

### 1. Schema Evolution (`meta_staples` & Enriched `meta_archetypes`)
We add a `meta_staples` table and extend `meta_archetypes` to support eager **Canonical Decklist** caching and rich tournament metadata:

```typescript
interface MetaStapleRecord {
  cardSlug: string;           // Primary key, references canonical cards.slug
  cardName: string;           // Canonical or scraped card name
  categories: string;         // JSON array of matched sections, e.g. '["Water Main Deck","Sideboard Tech"]'
  primaryCategory: string;    // Highest-inclusion section name
  element: string;            // "NORM" | "FIRE" | "WATER" | "WIND" | etc.
  inclusionRate: number;      // Numeric max inclusion percentage, e.g. 97.6
  avgCopies: number;          // Numeric max average copies where played, e.g. 3.9
  recommendedCopies: number;  // 1 for Material/Divine Relics; Math.min(4, Math.ceil(avgCopies)) for Main/Side
  deckCount: number;          // Number of tournament decks running the card in window
  imageUrl: string | null;    // Card image URL
  updatedAt: number;          // Unix epoch seconds
}

interface MetaArchetypeRecord {
  id: string;                 // Deterministic slug ID, e.g. "meta-wind-umbra-tristan"
  name: string;               // e.g. "Wind Umbra Tristan"
  tier: string;               // "Tier 1" | "Tier 2" | "Tier 3" | "Rogue"
  champion: string;           // Signature card / Champion name
  element: string;            // Primary element, e.g. "Wind"
  signatureCardImageUrl: string | null;
  shareRate: string;          // e.g. "3.1%"
  winRate: string;            // e.g. "42.3%"
  deckCount: number;          // Number of tournament decks in season
  detailUrl: string | null;   // e.g. "/meta/archetypes/Wind%20Umbra%20Tristan"
  sampleEventDeckUrl: string | null; // Cached source placement URL, e.g. "/events/62186/decks/3039"
  decklist: string;           // Eagerly resolved Omnidex decklist text
  updatedAt: number;          // Unix epoch seconds
}
```

### 2. Playset-Aware Meta Staples Ingestion & Deficit Logic
- **Scraper Source**: Fetches `https://grandarchivestats.com/cards/staples?window=60` in a single HTTP request.
- **Filtering & Deduplication**:
  - Ignores any `.gt-card-tile` containing the `low-n` class or having an inclusion rate `< 2.0%`.
  - Resolves card names against the canonical **Card Catalog** (with alphanumeric and front-face `//` fallback matching).
  - Deduplicates cards appearing across multiple sections by `cardSlug`: merges section names into `categories`, retains `max(inclusionRate)` and `max(avgCopies)`, and computes `recommendedCopies`:
    - If the card only appears in `Divine Relics` or `Material Deck` (or its catalog type is `CHAMPION`, `REGALIA`, `WEAPON`, `DOMAIN` material item): `recommendedCopies = 1`.
    - Otherwise (Main Deck / Sideboard cards): `recommendedCopies = Math.min(4, Math.max(1, Math.ceil(maxAvgCopies)))`.
- **Playset-Aware Enrichment**:
  - **Binder `STAPLES` Smart View**: Filters `collection_items` to cards present in `meta_staples`, returning `inclusionRate`, `categories`, `recommendedCopies`, and `isStapleComplete = binderOwned >= recommendedCopies`.
  - **Personal `MYP_STORE` Listings**: Enriches each `myp_cards` item with:
    - `isMetaStaple`: boolean
    - `stapleCategories`: `string[]`
    - `stapleInclusionRate`: `number | null`
    - `stapleRecommendedCopies`: `number | null`
    - `isStapleDeficit`: `isMetaStaple && totalBinderOwned < recommendedCopies`
  - **Sorting in `MYP_STORE`**:
    1. Active Deck **Shortage Offsets** (`isShortageOffset === true`)
    2. **Staple Deficits** (`isStapleDeficit === true`)
    3. Remaining listings by BRL price descending.

### 3. Eager Canonical Decklist Resolution & Collection-Aware Archetype Completion
- **Two-Step Eager Indexing with URL Caching**:
  1. Parse `https://grandarchivestats.com/meta` for all active seasonal archetypes (`Tier 1`, `Tier 2`, `Tier 3`). Any previously stored archetype absent from the table is soft-demoted to `tier = "Rogue"`.
  2. For each active Tier 1–3 archetype, fetch its archetype detail page (`/meta/archetypes/<name>`) in polite batches (3–4 concurrent requests) and rank the `<ol class="rp-list">` recent tournament placements by event prestige (`Worlds` > `Nationals` > `Ascent` > `Regionals` > `Store Championships` > `Online League`) and placement ordinal (`1st` > `2nd` > ...).
  3. Compare the winning placement's deck URL (`/events/<id>/decks/<id>`) against the archetype's cached `sampleEventDeckUrl`. Only fetch the event deck page and extract `<textarea id="omnidex-src">` if `sampleEventDeckUrl` changed or `decklist` is empty.
- **Archetype Completion & Cost-to-Complete Calculation**:
  - For each archetype with a resolved `decklist`, parse its **Material Deck** and **Main Deck** requirements (typically 12 Material + 60 Main = 72 core playable cards; Sideboard is tracked separately as secondary metadata).
  - For each required `cardSlug` with required quantity $Q$:
    - `binderAvailable = Math.min(Q, totalBinderOwnedForSlug)` (including both Shared and Dedicated copies in `collection_items`).
    - `mypStoreAvailable = Math.min(Q - binderAvailable, personalMypStoreQtyForSlug)` (from `myp_cards`).
    - `ownedCount = binderAvailable + mypStoreAvailable`.
    - `missingCount = Q - ownedCount`.
  - If `missingCount > 0`, look up active **Market Listings** (`myp_market_cards`) for `cardSlug` where `netExternalStock > 0`:
    - `marketFulfillableCount = Math.min(missingCount, totalNetExternalStockForSlug)`.
    - `missingCostBrl`: greedily accumulate the lowest asking `priceNumeric` across available market printings for up to `missingCount` copies.
  - Aggregate across the archetype:
    - `completionPct = Math.round((totalOwnedInCore / totalCoreRequired) * 100)`
    - `binderPct` and `mypStorePct` (and exact card counts `binderCardsOwned`, `mypStoreCardsOwned`, `missingCardsCount`)
    - `missingAvailableOnMarketCount` and `estimatedCostToCompleteBrl`.
- **Recommendations & 1-Click Import Surface**:
  - `GET /api/meta` accepts `userId` (or uses session) and returns each archetype enriched with its **Archetype Completion** and **Cost-to-Complete** metrics, plus a top-level `recommendedArchetypes` list (top archetypes sorted by `completionPct` descending, tie-broken by `Tier` and `winRate`).
  - Clicking **"Import to My Decks"** posts the archetype's `decklist` to `/api/decks`. If `mypStoreCardsOwned > 0`, the UI displays an actionable prompt linking to `/collection?view=MYP_STORE` so the Collector can claim and delist those copies.

### 4. Sequential Synchronization Pipeline Orchestrator
- **Orchestrator Service (`runFullSyncPipeline`)**:
  Executes in strict sequence:
  1. **Catalog Check**: If `cards` table is empty (or `forceCatalog = true`), runs `syncCatalogFromApi`.
  2. **Stage 1 — Meta Staples Sync (`syncMetaStaples`)**: Populates `meta_staples`.
  3. **Stage 2a — Personal Store Sync (`syncAllUsersMarketplaces`)**: Iterates all users with a non-empty `mypUsername` and refreshes their `myp_cards` snapshot.
  4. **Stage 2b — Global Market Sync (`syncGlobalMarketplace`)**: Refreshes `myp_market_cards` so `netExternalStock` and **Buyable Shortages** reflect Stage 2a.
  5. **Stage 3 — Meta Archetypes & Canonical Decklists Sync (`syncMetaArchetypes`)**: Crawls `/meta`, resolves top tournament **Canonical Decklists**, and updates `meta_archetypes`.
- **Execution Surfaces**:
  - `POST /api/sync/pipeline`: Protected by `Authorization: Bearer <CRON_SECRET>` or authenticated user session.
  - `pnpm sync:pipeline`: CLI runner executing all stages sequentially with console progress output.
  - `.github/workflows/daily-sync-pipeline.yml`: Runs daily at `0 8 * * *` UTC.

---

## Testing Decisions

### Primary Testing Seam
We test at the **Service Boundary Seam** (`meta`, `marketplace`, `collection`, and `sync-pipeline` services backed by an in-memory SQLite/LibSQL test database and injected mock `fetch` fixtures):
- **Why this seam**: A single service-level seam accepts recorded HTML/JSON fixtures from `grandarchivestats.com` (`/cards/staples`, `/meta`, `/meta/archetypes/...`, `/events/.../decks/...`) and `mypcards.com` at the top, runs real catalog resolution and SQLite persistence in the middle, and outputs the exact enriched objects (**Staple Deficits**, **Archetype Completion %**, **Cost-to-Complete BRL**, and **Sequential Pipeline Stats**) consumed by the UI and API routes at the bottom.

### What Makes a Good Test
- Tests assert observable behavior and domain invariants at the service boundary rather than internal regexes or private helpers:
  1. **Staples Ingestion & Playset Rounding**: Given a `grandarchivestats.com/cards/staples` HTML fixture, `syncMetaStaples` excludes `low-n` (`< 2%`) cards, deduplicates multi-section cards (like `Song of Frost` and `Safeguard Amulet`), sets `recommendedCopies = 1` for Material/Relics and `Math.ceil(avgCopies)` (up to `4`) for Main/Sideboard cards, and powers `/collection?view=STAPLES`.
  2. **Playset-Aware MyP Staple Deficit Tagging**: When a Collector owns `2x Creative Shock` in their Binder (`recommendedCopies = 4`) and lists `1x` in their MyP Store (`myp_cards`), `getUserMarketplaceReport` flags `isStapleDeficit = true` and sorts it ahead of normal listings. When the Collector owns `4x` in their Binder and lists a 5th copy on MyP, `isMetaStaple = true` and `isStapleDeficit = false`.
  3. **Eager Canonical Decklist Indexing & URL Caching**: Given `/meta`, archetype detail, and event deck HTML fixtures, `syncMetaArchetypes` selects the highest-prestige tournament placement, extracts `<textarea id="omnidex-src">`, soft-demotes vanished archetypes to `"Rogue"`, and skips re-fetching the event deck URL on subsequent syncs when `sampleEventDeckUrl` is unchanged.
  4. **Archetype Completion (`Binder + MyP Store`) & Cost-to-Complete (`myp_market_cards`)**: Given a Collector's Binder (`collection_items`, both Shared and Dedicated), personal MyP Store (`myp_cards`), and global market (`myp_market_cards`), `getMetaArchetypesWithRecommendations` computes accurate Material+Main completion %, Binder vs. MyP Store card split, and lowest BRL cost to purchase the remaining missing cards (respecting `netExternalStock` self-collision subtraction).
  5. **Sequential Pipeline Ordering**: `runFullSyncPipeline` executes Staples $\rightarrow$ Personal Store $\rightarrow$ Global Market $\rightarrow$ Meta Archetypes in strict sequence, and if an upstream fetch fails in one stage, preserves that stage's cached data without aborting or corrupting the remaining stages.

### Prior Art
- Existing service-seam tests in `src/services/marketplace.test.ts`, `src/services/shortage.test.ts`, `src/services/collection.test.ts`, and `src/services/meta.test.ts`.

---

## Out of Scope
- Synthesizing artificial decklists from the statistical Consensus Grid (we always use verified tournament-placing **Canonical Decklists** so imported decks are 100% format-legal).
- Automatically claiming and delisting cards from `myp_cards` without user confirmation when importing a recommended deck.
- Scraping historical match-by-match bracket logs or player ELO histories from `grandarchivestats.com`.

---

## Further Notes
- `grandarchivestats.com` HTML-encodes apostrophes and special characters (`&#39;`, `&amp;`), which must be decoded before matching against the **Card Catalog**.
- Spirit and Champion cards in Material Decks are always 1-of unique cards in Grand Archive constructed rules.
