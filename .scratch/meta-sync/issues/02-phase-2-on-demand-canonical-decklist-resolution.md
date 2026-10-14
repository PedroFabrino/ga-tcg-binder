# 02 — Phase 2 On-Demand Canonical Decklist Resolution

**What to build:** An on-demand decklist resolver that fetches an archetype's detail page on `grandarchivestats.com`, selects the highest-finishing tournament event list (prioritizing Worlds > Ascent > Regional > Store Championship), extracts the clean Omnidex list from `<textarea id="omnidex-src">`, and caches it in the database. When a player clicks "Compare to Binder" on an unresolved archetype, the system transparently resolves the decklist on the fly and returns the shortage comparison.

**Blocked by:** 01 — Phase 1 Meta Table Ingestion & Schema Evolution

**Status:** ready-for-agent

- [ ] Archetype detail scraper parses event links from `/meta/archetypes/<name>`, ranking event categories by competitive prestige (Worlds > Ascent > Regional > Store Championship).
- [ ] Tournament deck scraper fetches the selected event deck page and extracts the raw Omnidex string from the export textarea.
- [ ] The resolved Canonical Decklist and source URL are cached on the corresponding `meta_archetypes` row.
- [ ] The `/api/meta/compare` endpoint checks whether `decklist` is null or marked stale, resolving it before executing the shortage calculation against the user's binder.
- [ ] Gracefully handles fetch or parsing errors if target deck pages are unavailable, returning descriptive feedback to the user without crashing the comparison flow.
- [ ] Integration tests exercise the full flow from missing decklist to resolved Canonical Decklist and shortage report using recorded HTML fixtures.
