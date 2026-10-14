# 01 — Phase 1 Meta Table Ingestion & Schema Evolution

**What to build:** An automated ingestion service that crawls `https://grandarchivestats.com/meta` in a single HTTP request, parsing all competitive archetypes, their native tiers (`Tier 1`, `Tier 2`, `Tier 3`), match win rates, meta share percentages, primary elements, and signature card thumbnails, upserting them into SQLite. Previously tracked archetypes that drop off the active tournament list are soft-demoted to `"Rogue"` rather than deleted.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] The `meta_archetypes` table schema is migrated to make `decklist` nullable, and adds columns for `element`, `signature_card_name`, `signature_card_image_url`, `deck_count`, and `detail_url`.
- [ ] The HTML parser parses each archetype row from `grandarchivestats.com/meta`, extracting archetype name, slug ID, native tier (`Tier 1`, `Tier 2`, `Tier 3`), total decks, meta share, win rate, element pip, and signature card metadata.
- [ ] Archetypes already in the database that are absent from the incoming table sync are retained and soft-demoted to `"Rogue"`.
- [ ] Ingestion is idempotent: running sync repeatedly updates metrics and timestamps without duplicating records.
- [ ] Integration tests verify parsing against offline HTML fixtures and accurate database upserts.
