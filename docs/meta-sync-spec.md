# Specification: GrandArchiveStats Live Meta Scraper & Synchronizer

## Problem Statement

Grand Archive TCG competitive players and collectors using the application currently see static mock seed archetypes (*Lorraine Wind Warrior*, *Rai Water Mage*, *Diana Fire Ranger*) rather than actual current tournament metagame data from `grandarchivestats.com`. Because metagame tiers, win rates, and card choices shift after major weekend events (Ascents, Regionals, and Store Championships), players cannot accurately evaluate which meta archetypes are currently dominating the format or test their physical binder against real tournament-winning lists.

Furthermore, eagerly scraping all 30+ archetypes and their individual event decklists on every visit or sync risks rate-limiting, IP blocking, and long request timeouts.

## Solution

A **Two-Phase Meta Synchronization** engine that integrates live tournament data from `grandarchivestats.com`:
1. **Phase 1 (Table Ingestion)**: An automated weekly synchronization (invoked by GitHub Actions on Mondays and available via an authenticated manual "Sync Meta" trigger) crawls `https://grandarchivestats.com/meta` in a single polite HTTP request, ingesting all active archetypes, their native tiers (`Tier 1`, `Tier 2`, `Tier 3`), play shares, win rates, elements, and signature card artwork. Archetypes that drop out of the active metagame are soft-demoted to `"Rogue"`.
2. **Phase 2 (On-Demand Canonical Decklist Resolution)**: When a collector clicks "Compare to Binder" on an archetype whose decklist is missing or invalidated by a recent sync, the system on-demand fetches that archetype's detail page, selects the highest tournament cut deck (Worlds > Ascent > Regional > Store Championship), extracts the clean Omnidex list from the source page's export textarea, and caches it in the database.
3. **UI Tier Alignment**: The `/meta` explorer displays the community-standard Tier 1, Tier 2, Tier 3, and Rogue groupings, with element badges, signature card art, and a last-synced timestamp.

---

## User Stories

1. As a competitive player, I want the Meta Explorer to display real-world Grand Archive archetypes from `grandarchivestats.com`, so that I can see the actual tournament meta instead of mock fixture data.
2. As a competitive player, I want archetypes organized by community-standard tiers (`Tier 1`, `Tier 2`, `Tier 3`, `Rogue`), so that the tier taxonomy matches tournament coverage and third-party tools.
3. As a competitive player, I want to see the meta share percentage and match win rate for each archetype, so that I can understand its tournament prevalence and competitive strength.
4. As a competitive player, I want to see the primary element pip and signature champion card for each archetype, so that I can visually identify the archetype at a glance.
5. As a competitive player, I want to click "Compare to Binder" on any Tier 1, 2, or 3 archetype, so that I immediately see a full shortage breakdown of missing cards against my physical collection.
6. As a competitive player, I want the system to resolve the Canonical Decklist on-demand when I compare an archetype, so that the application does not make dozens of wasteful background HTTP requests for decklists I never inspect.
7. As a competitive player, I want the Canonical Decklist to represent the highest-finishing tournament list (prioritizing Worlds, then Ascents, then Regionals, then Store Championships), so that I am comparing against verified high-tier competitive configurations rather than rogue test brews.
8. As a competitive player, I want archetypes that fall off the active tournament rankings to be categorized under "Rogue / Off-Meta" rather than deleted, so that I can still compare my binder against older or fringe archetypes.
9. As a collector, I want to see when the metagame data was last synchronized, so that I know whether the statistics reflect the latest weekend events.
10. As a collector, I want an on-demand "Sync Meta" button with rate-limiting controls, so that I can pull fresh tournament results immediately after a major tournament finishes without waiting for the scheduled job.
11. As a system administrator, I want a scheduled GitHub Actions workflow running on Mondays, so that the metagame tier list is automatically refreshed every week after weekend tournament results are posted.
12. As a system administrator, I want the synchronization endpoint to be protected with a bearer secret token, so that unauthorized external actors cannot spam or trigger resource-intensive scraping tasks.
13. As a developer, I want scraping failures (e.g. target site downtime or markup changes) to fail safely without corrupting or wiping existing cached archetypes, so that the app remains fully functional even during external outages.

---

## Implementation Decisions

### Two-Phase Ingestion Pattern
- **Phase 1 Ingestion**: Ingests `https://grandarchivestats.com/meta` table via standard server-side HTTP request with a descriptive user agent. Parses rows using standard HTML attribute selectors (`data-archetype`, `data-decks`, element classes, tier badges, win rate spans). Upserts into the persistence store.
- **Phase 2 Canonical Decklist Resolution**: Triggered lazily when an archetype's decklist is required. Queries `/meta/archetypes/<name>`, extracts tournament decklinks, ranks by event category (`Worlds` (weight 4) > `Ascent` (weight 3) > `Regionals` (weight 2) > `Store Championships` (weight 1)), fetches the top deck page, and parses the `<textarea id="omnidex-src">`. Stores the resulting decklist and source event URL on the archetype row.

### Data Schema Evolution
```typescript
interface MetaArchetypeRecord {
  id: string; // e.g. "meta-water-fractals-diao-chan"
  name: string; // e.g. "Water Fractals Diao Chan"
  tier: "Tier 1" | "Tier 2" | "Tier 3" | "Rogue";
  champion: string; // e.g. "Diao Chan, Enchantress"
  element?: string; // e.g. "Water", "Fire", "Wind"
  signatureCardImageUrl?: string;
  shareRate: string; // e.g. "9.0%"
  winRate: string; // e.g. "51.3%"
  deckCount?: number;
  decklist?: string | null; // Nullable; populated during Phase 2
  detailUrl?: string; // e.g. "/meta/archetypes/Water%20Fractals%20Diao%20Chan"
  sampleEventDeckUrl?: string | null;
  updatedAt: Date;
}
```

### Invalidation & Soft-Demotion Policy
- When Phase 1 runs:
  - Archetypes in the source table are inserted or updated with their latest stats and tier.
  - Existing archetypes in the database that are NOT in the source table are updated to `tier = "Rogue"`.
  - Cached `decklist` entries are marked for refresh (or nulled) so subsequent comparisons fetch the newest tournament winner.
- If scraping fails, the existing database records remain untouched, and an error is logged.

### Endpoint & Workflow Contracts
- `POST /api/meta/sync`: Protected route. Requires `Authorization: Bearer <CRON_SECRET>` or an authenticated user session with cooldown check. Returns summary of updated, demoted, and unchanged archetypes.
- `.github/workflows/meta-sync.yml`: Runs on schedule `0 12 * * 1` (Mondays at 12:00 UTC), dispatches a POST request to `/api/meta/sync` with secret bearer token.

---

## Testing Decisions

### What Makes a Good Test
- Tests must verify external behavior: verifying that raw HTML fixture responses from `grandarchivestats.com` parse into valid `MetaArchetypeRecord` entities with appropriate tiers, win rates, and signature cards.
- Tests must verify that soft-demotion marks vanished archetypes as `"Rogue"` without dropping their existing data.
- Tests must verify that Phase 2 correctly selects the highest tournament cut event, parses the Omnidex decklist, and caches it.
- Tests must run offline using recorded HTML fixtures to eliminate flakiness and external network dependencies.

### Modules Tested
- **Meta Parser & Service**: Evaluates table extraction, ranking heuristics, and Omnidex extraction.
- **Shortage & Comparison Seam**: Evaluates on-demand decklist resolution seamlessly chained into shortage reporting.
- **Sync Route Handler**: Verifies authentication boundaries and rate limiting.

### Prior Art
- Existing tests in `src/services/meta.test.ts` and `src/services/omnidex.test.ts`.

---

## Out of Scope
- Scraping individual player profiles or full tournament bracket match histories.
- Scraping non-Standard game formats (Standard constructed is the sole competitive format supported).
- Generating synthetic mathematical consensus decklists (actual tournament-placing lists are used).

---

## Further Notes
- `grandarchivestats.com` uses HTML-encoded characters in `og:title` and deck names (e.g. `&#39;`), which must be normalized through `decodeHtmlEntities`.
