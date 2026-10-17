## Parent

#29 (`docs/myp-watchlist-sync-spec.md`)

## Objective

Introduce the `myp_watchlist` database table and per-user Quota policy settings (`watchlist_policy_hard`, `watchlist_policy_shared`, `watchlist_policy_staples`), implement **Standard Playable Printing** expansion (including `0`-stock catalog discovery), and build the two-way public MyP *Quero* (`exibirSomenteCompra=1`) reconciliation engine (`reconcileUserWatchlist`) wired into Stage 2c of the daily sync pipeline.

## Context

Read [`CONTEXT.md`](../../CONTEXT.md), [`docs/adr/0010-hybrid-myp-watchlist-sync-and-ledger.md`](../../docs/adr/0010-hybrid-myp-watchlist-sync-and-ledger.md), and [`docs/myp-watchlist-sync-spec.md`](../../docs/myp-watchlist-sync-spec.md) before starting.

## Deliverable

1. **Schema & Migrations (`src/db/schema.ts`, `src/db/index.ts`)**:
   - Add `watchlistPolicyHard` (`integer`, default `1`), `watchlistPolicyShared` (`integer`, default `0`), and `watchlistPolicyStaples` (`integer`, default `0`) to `users`.
   - Create `myp_watchlist` table with columns `id`, `user_id`, `card_name`, `edition_slug`, `collector_number`, `myp_item_id`, `myp_product_url`, `target_quantity`, `target_price_brl`, `status` (`watching` | `pending_add` | `pending_update` | `pending_remove` | `ignored`), and `updated_at`, with unique constraint `(user_id, edition_slug, collector_number)`.
   - Add idempotent runtime DDL migrations in `src/db/index.ts` for existing databases.
2. **Configurable Quota Policy (`src/services/shortage.ts`)**:
   - Update `getAllDeckShortages(userId)` to evaluate the user's configured Quota policy (`Hard` = sum across decks, `Shared` = max across decks, `Staples` = cap at 4) against active Binder holdings (`collection_items`).
3. **Public Quero Scraper & 0-Stock Standard Playable Printing Discovery (`src/services/marketplace.ts`, `src/services/watchlist.ts`)**:
   - Implement `fetchPublicQueroList(mypVendorSlug)` to parse the Collector's public `?Lista=1&exibirSomenteCompra=1` HTML into watched items (`cardName`, `editionSlug`, `collectorNumber`, `mypItemId`, `mypProductUrl`, `quantity`, `priceBrl`, `isFoil`).
   - Implement `resolveStandardPlayablePrintings(cardName)` querying `gatcg_cards` for non-foil Standard Playable Printings (`rarity <= 5`, excluding CSR, Curio, Full Art, Promo, Foil) and resolving `mypItemId` / `mypProductUrl` from `myp_market_cards` with fallback to an unfiltered MyP catalog query (`/grandarchive?ProdutoSearch[nome]=<cardName>`).
   - Implement `reconcileUserWatchlist(userId, deps)`:
     - Adopts existing public *Quero* Standard Playable Printings of active Shortage Cards as `watching`.
     - Leaves Collector Printings and non-shortage manual cards completely untouched.
     - Transitions `watching` entries missing from public *Quero* while `missing > 0` to `ignored`.
     - Queues `pending_add` for unwatched Standard Playable Printings of Shortage Cards with target price = `tcgPriceNumeric` (from `myp_market_cards`) $\rightarrow$ `marketLowestPriceBrl` $\rightarrow$ `R$ 1,00`.
     - Queues `pending_update` when `missing` drops below `target_quantity` (`0 < missing < target_quantity`).
     - Queues `pending_remove` for all managed Standard Playable Printings of a Card when `missing === 0` (Quota filled).
   - Wire `reconcileUserWatchlist` into Stage 2c of `src/services/sync-pipeline.ts` and expose server actions to toggle Quota policy and re-enable `ignored` entries (`ignored → pending_add`).

## Out of Scope

- UI components in `AllShortagesView.tsx` and the Browser Userscript Bridge (covered in Ticket 02).
- Encrypted MyP credentials in `/settings` (covered in Ticket 03).
- Stage 2d authenticated FlareSolverr mutation execution (covered in Ticket 04).

## Acceptance Criteria

- [ ] Integration tests in `src/services/__tests__/watchlist.test.ts` verify:
  - Quota calculation under `Hard`, `Shared`, and `Staples` policies.
  - Expansion of a Shortage Card into all Standard Playable Printings (including `0`-stock printings resolved via catalog fallback) while excluding Collector Printings (`rarity > 5`, Full Art, CSR, Foil).
  - Adoption of already-watched Standard Playable Printings as `watching` without touching manually watched Collector Printings (e.g., Full Art *Zhang Jiao*).
  - Detection of manual deletion on MyP (`watching` absent from public *Quero* while `missing > 0` transitions to `ignored` and is not re-added until `reEnableWatchlistEntry` is called).
  - Partial shortage reduction (`3 → 1`) transitions `watching` to `pending_update` with `target_quantity = 1`.
  - Full Quota completion (`missing === 0`) transitions all managed Standard Playable Printings of that Card to `pending_remove`.
- [ ] `npm test` and `npm run build` pass with zero errors.

## Blocked by

None
