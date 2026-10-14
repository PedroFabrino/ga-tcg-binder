# 0004: Two-Phase Meta Archetype Synchronization from GrandArchiveStats

## Context
Competitive Grand Archive decklists and tier rankings are continuously compiled by the community on `grandarchivestats.com`. Previously, our `/meta` explorer displayed static hardcoded mock seed data (`SEED_META_ARCHETYPES`). Directly scraping all 30+ archetypes and their individual tournament event decklists eagerly on every sync would generate dozens of HTTP requests, risk rate-limiting, and slow down scheduled jobs.

## Decision
We implement a **Two-Phase Lazy Meta Synchronization** process:
1. **Phase 1 (Table Ingestion)**: A weekly automated job (GitHub Actions on Mondays calling protected route `/api/meta/sync`) crawls `https://grandarchivestats.com/meta`. It ingests all archetypes, their native tiers (`Tier 1`, `Tier 2`, `Tier 3`), share rates, win rates, elements, and signature card metadata into `meta_archetypes` in a single HTTP request. Archetypes that drop out of the source table are soft-demoted to `"Rogue"`.
2. **Phase 2 (On-Demand Canonical Decklist Resolution)**: Concrete Omnidex decklists are not fetched during the bulk table sync (`decklist` is nullable). When a collector clicks "Compare to Binder", if the archetype's decklist is missing or invalidated by the latest sync, the system fetches the archetype's detail page, selects the highest tournament cut deck (Worlds > Ascent > Regional > Store Championship), extracts the `<textarea id="omnidex-src">`, and caches it in `meta_archetypes`.
3. **Execution Surface**: Periodic sync is driven by a GitHub Actions workflow calling `/api/meta/sync` with a bearer `CRON_SECRET`. A manual "Sync Meta" button on the UI provides immediate sync with cooldown controls.

## Consequences
- Reduces external HTTP traffic from 40+ requests down to 1 request per weekly cron run.
- Guarantees collectors always compare against verified tournament-winning lists while keeping the scraper resilient and lightweight.
- Preserves historical and niche decks under a "Rogue / Off-Meta" tier rather than deleting them.
- Requires updating the `meta_archetypes` schema to allow nullable `decklist` and store element/signature card metadata.
