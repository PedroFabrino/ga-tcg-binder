# 0009: Eager Meta Decklist Indexing, Playset-Aware Staples, and Sequential Sync Pipeline

Status: accepted
Supersedes: Phase 2 (Lazy On-Demand Decklist Resolution) of ADR-0004

## Context
`ADR-0004` originally deferred fetching **Canonical Decklists** for **Meta Archetypes** until a Collector explicitly clicked "Compare to Binder" (Lazy Phase 2). However, two new capabilities require upfront, cross-referenced data across both competitive meta sources (`grandarchivestats.com`) and secondary market snapshots (`mypcards.com`):
1. **Collection-Wide Meta Deck Recommendations**: Proactively computing **Archetype Completion** (`85% Owned`) across all active Tier 1–3 archetypes using the Collector's combined physical holdings (**Binder** `collection_items` + personal **Store Listings** `myp_cards`), along with the **Cost-to-Complete** for the remaining missing cards using global **Market Listings** (`myp_market_cards`).
2. **Playset-Aware Meta Staple Tagging**: Ingesting format-wide **Meta Staples** (`grandarchivestats.com/cards/staples?window=60`, excluding `low-n` outliers `< 2%`) with a canonical playset target (`1` for Material/Divine Relics, `Math.ceil(avgCopies)` up to `4` for Main/Sideboard) so that personal **Store Listings** in `/collection?view=MYP_STORE` are flagged as a **Staple Deficit** (*"Keep in Binder!"*) only when `binderOwned < recommendedCopies`.

If decklists are only fetched lazily on click, the system cannot rank or recommend archetypes by completion percentage across the metagame. Furthermore, if meta, store, and market syncs run in arbitrary order, deck recommendations and staple alerts will evaluate against stale store inventories or outdated external stock counts.

## Decision
1. **Eager Cached Canonical Decklist Indexing (Superseding ADR-0004 Phase 2)**:
   - During **Meta Sync**, after ingesting the `/meta` table, the synchronizer eagerly resolves and caches the **Canonical Decklist** (highest tournament cut: Worlds > Ascent > Regional > Store Championship) for all active Tier 1–3 archetypes using polite batched concurrency.
   - To minimize upstream traffic on daily runs, each archetype caches its `sampleEventDeckUrl` and only re-fetches the event deck page when a newer or higher-ranked tournament placement replaces it.

2. **Playset-Aware Meta Staples (`meta_staples`)**:
   - Ingest `https://grandarchivestats.com/cards/staples?window=60`, filtering out low-sample tiles (`low-n` / `< 2%` inclusion) and deduplicating by `cardSlug`.
   - Compute `recommendedCopies` as `1` for Material-only / Divine Relics and `Math.min(4, Math.ceil(maxAvgCopies))` for Main Deck / Sideboard cards.
   - Repurpose the `/collection?view=STAPLES` view to filter by `meta_staples`, and badge personal **Store Listings** (`myp_cards`) with a high-priority **Staple Deficit** warning when `binderOwned < recommendedCopies` (or a neutral *"Playset Owned in Binder"* badge when `binderOwned >= recommendedCopies`).

3. **Archetype Completion & MyP Cost-to-Complete Formula**:
   - Compute **Archetype Completion** over the core playable deck (**Material Deck + Main Deck**, 72 cards) using all physical copies owned by the Collector (`Binder (Shared + Dedicated) + Personal MyP Store`), displaying the split (`X% Owned: A in Binder + B in MyP Store`).
   - Cross-reference any remaining missing cards against `myp_market_cards` (`netExternalStock > 0`) to display immediate MyP availability and lowest BRL cost to complete the deck.
   - Clicking **"Import to My Decks"** creates the Deck non-destructively and prompts the Collector with a direct link to `/collection?view=MYP_STORE` if any required copies are currently listed in their personal MyP Store.

4. **Strict Sequential Sync Pipeline (`/api/sync/pipeline` & `pnpm sync:pipeline`)**:
   - Orchestrate scheduled daily synchronization (`0 8 * * *` UTC) in strict dependency order so each stage consumes fresh data from the previous stage:
     1. **Catalog Sync Check** (`api.gatcg.com` -> `cards`, `card_editions`)
     2. **Meta Staples Sync** (`grandarchivestats.com/cards/staples?window=60` -> `meta_staples`)
     3. **Personal MyP Store Sync** (`mypcards.com/<username>` -> `myp_cards` for registered users, enriched with `meta_staples`)
     4. **Global MyP Market Sync** (`mypcards.com/grandarchive?exibirSomenteVenda=1` -> `myp_market_cards`, computing `netExternalStock` against Stage 3)
     5. **Meta Archetypes & Canonical Decklists Sync** (`grandarchivestats.com/meta` -> `meta_archetypes`, immediately ready for **Archetype Completion** and **Cost-to-Complete** evaluation against Stages 3 & 4).

## Consequences
- Enables instant (< 5ms) collection-wide deck recommendations and live BRL completion cost estimates across all competitive archetypes without per-archetype click latency.
- Prevents alert fatigue on personal MyP listings by distinguishing true **Staple Deficits** from intentional sales of 5th+ surplus copies.
- Guarantees deterministic data freshness across dependent tables via sequential pipeline execution.
