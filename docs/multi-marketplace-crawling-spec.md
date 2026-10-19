# Specification: Multi-Marketplace Catalog and LigaStore Crawling

## Problem Statement

Currently, Grand Archive TCG Binder only supports MyP Cards as an external marketplace source. Collectors who wish to complete their physical decks (resolving Hard Shortages and Shared Shortages) or acquire Meta Staples are limited to listings on MyP. Other major Brazilian card shops using the LigaMagic/lmcorp e-commerce platform (such as Brandão Card Game) frequently list Grand Archive cards with separate stock and pricing that the application cannot discover.

Furthermore, scanning external catalogs currently requires downloading dozens of paginated search pages or hundreds of product pages on fixed schedules, with no lightweight mechanism to detect whether a store's stock has actually changed. Collectors also lack a way to distinguish between different retail stores when evaluating Buyable Shortages and price fairness.

## Solution

Expand the marketplace subsystem into a multi-marketplace architecture:
1. **Multi-Store Registry & Unified Listings**: Register external stores under a unified model (`market_stores` and `market_cards`) that stores observed listings across all platforms (`myp` and `liga_store`) without duplicating tables or shortage calculations.
2. **LigaStore Crawler & CSS Sprite Decoding**: Implement a high-performance crawler for LigaMagic-based stores that extracts card titles, numbers, and decodes CSS image sprites (`.vidgmi`, `.xWrSf`) on catalog search pages to capture price and stock across all cards in 1–2 requests, with selective detail-page verification for active Shortages and Meta Staples.
3. **Official Catalog Resolution**: Automatically match raw store titles (`Name (#NNN)`) against the synced official Grand Archive Card Catalog, safely retaining unresolved cards as Unlinked Listings.
4. **Lightweight Count Polling**: Provide a low-overhead periodic endpoint that checks whether a store's total listed card count has changed (e.g. `1-14 de 14` on LigaStore or `N itens` on MyP) and dispatches a full rescan only when updates occur.
5. **Multi-Store Shortage Views & Badging**: Surface store provenance badges and filters across `/marketplace` and `/decks` so Collectors can see exactly which store has their needed cards.

## User Stories

1. As a Collector, I want the system to crawl Brandão Card Game alongside MyP Cards, so that I can find purchasable copies of my missing deck cards from multiple stores.
2. As a Collector, I want to see which store is offering a card in the Marketplace and Shortage views, so that I know where to place my order.
3. As a Collector, I want my Hard Shortages and Shared Shortages to match against in-stock listings from Brandão Card Game, so that I can eliminate shortages faster.
4. As a Collector, I want price fairness evaluations (comparing listing prices to canonical TCGPlayer benchmark prices) to work uniformly for Brandão listings, so that I avoid overpaying.
5. As a Collector, I want Brandão listings to be accurately linked to official Grand Archive cards and editions (set prefix and collector number), so that I see correct card imagery and metadata.
6. As a Collector, I want newly listed cards that are not yet in the official card catalog to be saved as Unlinked Listings, so that they remain visible for review without crashing deck shortage calculations.
7. As an Operator, I want the crawler to decode LigaStore CSS image sprites on search pages, so that all card prices and stocks are captured in 1–2 requests without overloading the store with hundreds of page hits.
8. As a Collector, I want verified condition, language, and exact stock for my active Shortages and Meta Staples by having the crawler selectively inspect their product detail pages, so that I have complete confidence before buying.
9. As an Operator, I want a lightweight count poll to check every few minutes whether a store's total card count has changed, so that rescans are triggered immediately when new stock arrives.
10. As an Operator, I want the system to trigger a GitHub Actions full sync when a count change is detected, so that heavy crawling remains centralized and resource-efficient.
11. As an Operator, I want scheduled full rescans to run every 6 hours regardless of count checks, so that price modifications and stock removals that don't change the total count are reconciled.
12. As a Collector, I want listings that disappear from a store during a successful full scan to be marked inactive/out-of-stock, so that I don't see phantom offers that no longer exist.
13. As an Operator, I want partial or failed crawls to preserve the existing active inventory snapshot, so that temporary network blips do not wipe out purchasable shortage recommendations.
14. As a Collector, I want to filter the Marketplace view by store (All Stores, MyP Cards, Brandão Card Game), so that I can browse specific vendors.
15. As a Collector, I want all store labels, badges, filters, and status messages to be fully translated in English and Portuguese (`pt-BR`), so that I have a consistent localized experience.
16. As a Developer, I want a database-driven `market_stores` registry, so that new LigaMagic/LigaPokemon-style stores can be added without altering the core database schema.
17. As a Developer, I want `myp_market_cards` to be cleanly migrated into `market_cards` using an expand-contract sequence, so that zero downtime or query breakage occurs.

## Implementation Decisions

1. **Multi-Marketplace Domain Schema (ADR 0015)**:
   - Introduce `market_stores` table representing configured external marketplace storefronts (`id`, `platform`, `name`, `base_url`, `tcg_id`, `enabled`, `last_count`, `last_count_checked_at`, `last_full_scan_at`).
   - Introduce `market_cards` table replacing `myp_market_cards`, indexing listings by `(store_id, card_slug, edition_id)` and storing observed prices, quantities, conditions, foil flags, product URLs, and `last_seen_at`.
   - Seed `market_stores` with default entries: `myp` (platform `myp`) and `brandao` (platform `liga_store`).
2. **Dedicated Marketplace Repository Layer (ADR 0012)**:
   - Build a `MarketplaceRepository` in the repository layer to encapsulate all Drizzle/libSQL queries for `market_stores` and `market_cards`. Services must orchestrate domain logic and call the repository.
3. **Pure LigaStore Parser & CSS Sprite Decoder**:
   - Create a pure parser module that takes LigaStore search HTML and extracts card titles in `Name (#NNN)` format, foil indicators (`alt="FOIL"`), and product URLs.
   - Decode dynamic CSS sprite classes (`.vidgmi`, `.xWrSf`) and background positions to parse digit sequences into numeric prices and stock quantities.
4. **Selective Detail Enrichment**:
   - During a LigaStore scan, search pages supply all listings.
   - For items whose canonical card slug matches an active user Shortage or Meta Staple, the crawler selectively fetches the item detail page to extract exact condition (`NM`), language (`Inglês`), and verified stock quantity.
5. **Catalog Resolution & Unlinked Listings**:
   - Match parsed card names and collector numbers against local `cards` and `card_editions` using normalized alphanumeric matching.
   - Matched cards link canonical `card_slug` and `edition_id`.
   - Unmatched cards remain stored with `card_slug = null` as `Unlinked Listings` for diagnostics and operator review.
6. **Count Polling & GitHub Actions Integration**:
   - Next.js API route `/api/cron/check-market-stores` performs a single GET request per enabled store to extract total count (`1-14 de 14` on LigaStore, `summary <strong>N</strong> itens` on MyP).
   - If `last_count` differs, it dispatches the GitHub Actions `market-sync.yml` workflow via GitHub REST API (or runs the sync directly if local credentials are provided).
   - Scheduled 6-hour cron on GitHub Actions continues to run to guarantee eventual consistency.
7. **Listing Reconciliation**:
   - Upon completion of a successful full scan for a store, items present in the database for that store but missing from the scan are marked inactive (`quantity = 0`).
   - If a scan fails or times out, no reconciliation takes place and prior listings are preserved.
8. **UI & i18n Boundaries**:
   - Update `/marketplace` and `/decks` shortage views to accept store filter selections and render store identity badges.
   - All static text must use `@ga/contracts` i18n keys across `en` and `pt-BR`. Official Grand Archive game terms remain in canonical English.

## Testing Decisions

- **Good Test Criteria**: Test observable behavior and domain invariants through the highest available seam. Mock only external HTTP boundaries (fetch); never mock database repositories in integration tests.
- **Modules to Test**:
  - `ligastore-parser.test.ts`: Pure unit tests validating CSS sprite coordinate decoding, number extraction, and regex parsing on realistic HTML fixtures.
  - `marketplace-sync.test.ts`: Integration tests for the ingestion pipeline verifying store sync, catalog resolution, unlinked item storage, and reconciliation.
  - `shortage-market.test.ts`: Tests verifying multi-store Buyable Shortages and price fairness calculations.
  - `check-market-stores.test.ts`: Tests verifying count poll delta detection and dispatch logic.
- **Prior Art**: Follow existing patterns in `src/services/marketplace.test.ts`, `src/services/catalog.test.ts`, and `src/services/shortage.test.ts`.

## Out of Scope

- User selling, personal inventory claiming, or store sync for Brandão (Brandão is buy-side only).
- Cart writing, automated checkout, or external wantlist mutation on Brandão / LigaStore.
- Historical price trend graphs or analytics (only current-state listings are modeled).
- Automatic OCR on card images.

## Further Notes

- Architecture is governed by [ADR 0015](file:///c:/Users/pfabr/Documents/Git/ga-tcg-binder/docs/adr/0015-multi-marketplace-catalog-and-ligastore-crawling.md).
- Domain terms are defined in [CONTEXT.md](file:///c:/Users/pfabr/Documents/Git/ga-tcg-binder/CONTEXT.md).
