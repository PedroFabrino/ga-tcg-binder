# 0021. Featured Set Groups and Hierarchical Shortage Ranking

## Context
Grand Archive TCG players maintain active constructed decks with card shortages and also collect full card sets. When deciding which booster boxes or packs to buy, collectors need to know which official set releases contain the highest number of missing cards needed across their active decks, while also tracking overall set completion. The official Grand Archive API exposes a hierarchical structure via `/featured-sets` (grouping parent releases like *Dawn of Ashes* with child set prefixes like `DOA 1st`, `DOA Alter`, and `DOASD`).

## Decision
1. **Local Schema & Ingestion**: We ingest Featured Set Groups (`featured_set_groups`) and child set definitions (`set_definitions`) into the local SQLite database as an integral step of the catalog synchronization pipeline (`catalog-sync.ts`), avoiding external network latency and rate limits on user queries.
2. **Multi-set Shortage Attribution**: When a card required by an active deck was printed in multiple sets (reprints or starter decks), its shortage copies are attributed to *every* set containing an eligible printing. This models real-world pack opening: cracking packs from either set offers a valid chance to pull the required gameplay card.
3. **Hierarchical Navigation**: Top-level browsing occurs at the Featured Set Group level (`/sets`) ranked by total deck shortages, with a dedicated set checklist route (`/sets/[groupSlug]`) providing prefix drilldown (`DOA 1st` vs `DOA Alter`), status filtering (Shortages, Unowned, Owned), and direct binder inventory management.
4. **Persisted Customization**: User set exclusions (`hidden_set_uuids`) are persisted in the database on the user aggregate so preferences synchronize across devices, with hidden sets grouped in a collapsible section for instant recovery.

## Considered Options
- **Attributing shortages only to the specific edition chosen in the deck**: Rejected because tournament decklists imported from Omnidex often reference promotional or specific printings, which would falsely hide the fact that a standard booster box contains a playable version of the card.
- **Flat set prefix listing**: Rejected because 35+ granular prefixes fragment the catalog and clutter the UI; collectors buy product at the expansion/box level.
- **On-the-fly API joining**: Rejected due to high latency, external availability risk, and inability to join efficiently against local collection and deck shortage queries.
