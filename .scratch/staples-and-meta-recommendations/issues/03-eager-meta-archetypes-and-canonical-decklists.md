## Parent

#23

## What to build

Supersede lazy on-demand decklist resolution (`ADR-0004` Phase 2, per `ADR-0009`) by building an eager **Meta Sync** pipeline that crawls `https://grandarchivestats.com/meta` for all active seasonal **Meta Archetypes** (`Tier 1`, `Tier 2`, `Tier 3`, soft-demoting vanished archetypes to `"Rogue"`) AND eagerly resolves each active archetype's highest-prestige tournament **Canonical Decklist** (`Worlds > Nationals > Ascent > Regionals > Store Championships > Online League`) using polite batched concurrency. Cache each archetype's `sampleEventDeckUrl` so subsequent sync runs skip re-fetching unchanged tournament deck pages.

## Acceptance criteria

- [ ] Running **Meta Sync** ingests all active archetypes from `https://grandarchivestats.com/meta` with their native **Meta Tier** (`Tier 1`, `Tier 2`, `Tier 3`), meta share, win rate, primary element, deck count, and signature card art, while soft-demoting any previously stored archetypes absent from the table to `"Rogue"`.
- [ ] For each active `Tier 1`, `Tier 2`, and `Tier 3` archetype, **Meta Sync** fetches the archetype's detail page, ranks recent tournament placements by event prestige and placement ordinal (`1st` > `2nd` > ...), fetches the winning event deck page, and extracts `<textarea id="omnidex-src">` as the cached **Canonical Decklist**.
- [ ] When an archetype's top placement deck URL matches its already-cached `sampleEventDeckUrl` and `decklist` is populated, **Meta Sync** skips re-fetching that event deck page.
- [ ] Scraping failures on `/meta` or individual archetype pages preserve existing cached database records without wiping or corrupting data.
- [ ] Service-seam tests using recorded HTML fixtures verify `/meta` table ingestion, `"Rogue"` soft-demotion, prestige-ranked **Canonical Decklist** extraction, and `sampleEventDeckUrl` cache-hit skipping.

## Blocked by

None — can start immediately
