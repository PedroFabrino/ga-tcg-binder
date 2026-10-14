# 03 — Meta Explorer UI Native Tiers & Manual Sync

**What to build:** An updated Tournament Meta Explorer page displaying the real community metagame organized into native sections (`Tier 1`, `Tier 2`, `Tier 3`, and `Rogue`), accompanied by element pips, signature card thumbnails, sample deck counts, and a "Last Synced" timestamp. Includes an authenticated manual "Sync Meta" button with spinning loader feedback and client-side cooldown to pull immediate tournament updates.

**Blocked by:** 02 — Phase 2 On-Demand Canonical Decklist Resolution

**Status:** ready-for-agent

- [ ] The `/meta` page displays archetypes grouped by native tiers: `Tier 1`, `Tier 2`, `Tier 3`, and `Rogue`.
- [ ] Each archetype card renders the archetype name, champion, primary element badge, signature card thumbnail, total tournament decks, meta share bar, and win rate bar.
- [ ] Clicking "Compare to Binder" opens the shortage modal, displaying a "Fetching latest tournament deck..." state if Phase 2 lazy resolution is actively underway.
- [ ] A "Sync Meta" button is available in the page header with spinning icon state, trigger confirmation toast, and cooldown disabling.
- [ ] The page header displays when the metagame data was last refreshed (e.g. "Last synced 2 hours ago").
- [ ] An authenticated `/api/meta/sync` endpoint triggers Phase 1 synchronization and returns sync summary statistics.
