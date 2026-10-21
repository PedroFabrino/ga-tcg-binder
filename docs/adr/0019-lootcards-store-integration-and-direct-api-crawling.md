# 0019: Lootcards Store Integration and Direct-API Crawling

Status: accepted

## Context

Grand Archive TCG Binder currently supports MyP Cards (platform `myp`) and Brandão Card Game (platform `liga_store`) as marketplace sources under ADR 0015, ADR 0016, and ADR 0018.

The application requires support for **Lootcards** (`https://lootcards.store/`), a Brazilian singles store specializing in Grand Archive TCG. Unlike LigaStore, which requires HTML scraping and CSS sprite decoding to obtain price and quantity, Lootcards runs on Astro SSR and exposes a structured JSON endpoint at `/api/cards`.

Furthermore, Lootcards uses the official Grand Archive catalog `edition_uuid` and `card_uuid` directly within its API payloads, removing the ambiguity of text-based card matching.

## Decision

### 1. Store Registration

Lootcards is registered in `market_stores` with:
- `id`: `"lootcards"`
- `platform`: `"lootcards"`
- `name`: `"Lootcards"`
- `baseUrl`: `"https://lootcards.store"`
- `tcgId`: `"grandarchive"`
- `enabled`: `true`

It is added to `seedMarketStores()` in `src/services/seed.ts` so that it is initialized in all development, test, and production databases.

### 2. Two-Tier Crawling Pipeline

Lootcards crawling uses a two-tier strategy modeled after ADR 0015:

#### Broad in-stock scan
The primary catalog crawler queries `/api/cards?so_estoque=1&pagina=N`.
- By filtering for active stock (`so_estoque=1`), the crawler ingests all purchasable inventory (~450 items) across ~19 pages (~200ms per page, ~4s total) instead of querying the full 2,500+ card catalog.
- Each listing maps directly to the local catalog using `edition_uuid` -> `card_editions.id`.
- Vanished stock is automatically cleared (`quantity = 0`) at the end of each scan via `reconcileStoreListings()`.

#### Selective detail-page enrichment
For cards where `has_foil: true` or that match active Deck Shortages or Meta Staples, the crawler fetches the card detail page at `/carta/[slug]` to extract variant-level finish (`NONFOIL` vs `FOIL`), condition (`NM`, `SP`, etc.), and precise pricing from the embedded `CardPurchasePanel` island props.
- Detail-page fetches run sequentially with a 200ms delay to respect Cloudflare limits.
- If a detail-page request fails, the pipeline falls back gracefully to broad-scan surface data without failing the sync.

### 3. Listing Keying & Identity

To prevent foil copies from being aggregated into non-foil playsets, listings in `market_cards` are keyed deterministically:
- `id`: `mkt-lootcards-${edition_uuid}-${finish.toLowerCase()}`
- `itemId`: `${edition_uuid}-${finish.toLowerCase()}`

Broad scan creates the base non-foil listing (or foil if foil-only). Selective enrichment splits or updates individual finish records.

### 4. Dual-Check Change Detection (`/api/cron/check-market-stores`)

Lightweight polling checks for inventory changes before triggering expensive synchronization:
- URL: `https://lootcards.store/api/cards?ordem=chegaram_agora&so_estoque=1`
- **Count check**: `totalCards` compared against `marketStores.lastCount`.
- **Latest-card check**: The first item's `${edition_uuid}:${min_price_cents}` compared against `marketStores.lastLatestCardRefId`.

If either metric differs, the endpoint updates the store record and dispatches a full synchronization workflow.

### 5. Notification & Marketplace UI Parity

- **Outbox & Notifications**: Newly detected cards write to `market_notifications` and are delivered via Discord webhook and Root bot, linking directly to `https://lootcards.store/carta/[slug]`.
- **Marketplace UI**: Lootcards is automatically included in the `/marketplace` store selector, supporting Buyable Shortages grouping, Price Fairness evaluations against Preço TCG Player, and vendor package views.
- **CLI Sync**: `scripts/sync-market.ts --store lootcards` allows targeted manual synchronization.

## Consequences

- Full feature parity with MyP and Brandão without custom scraping gymnastics or sprite decoders.
- Direct UUID matching eliminates catalog resolution misses.
- Network footprint remains minimal (~19 lightweight JSON calls per scan).
- Zero schema migrations needed, as `market_stores.platform` and `market_cards` accommodate the `lootcards` platform natively.
