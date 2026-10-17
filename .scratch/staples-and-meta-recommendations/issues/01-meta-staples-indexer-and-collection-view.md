## Parent

#23

## What to build

Crawl `https://grandarchivestats.com/cards/staples?window=60` across all 7 competitive staple sections (*Divine Relics*, *Material Deck*, *Fire Main Deck*, *Water Main Deck*, *Wind Main Deck*, *Norm Main Deck*, and *Sideboard Tech*), filtering out low-sample outliers (`low-n` tiles or `< 2%` inclusion), deduplicating by canonical **Card** slug, and computing each staple's canonical `recommendedCopies` (`1` for Material/Divine Relics, `Math.min(4, Math.ceil(maxAvgCopies))` for Main Deck and Sideboard cards). Repurpose the `STAPLES` smart view in `/collection` (`/collection?view=STAPLES`) so Collectors can view their owned **Meta Staples** with tournament inclusion percentages, matched categories, and playset completion progress (`owned / recommendedCopies`).

## Acceptance criteria

- [ ] Running Meta Staples Sync fetches `https://grandarchivestats.com/cards/staples?window=60`, excludes cards marked `low-n` or under `2.0%` inclusion, resolves cards against the canonical **Card Catalog**, and persists deduplicated records with all matched categories, highest `inclusionRate`, and `recommendedCopies` (`1` for Material/Divine Relics, `Math.ceil(avgCopies)` up to `4` for Main/Sideboard).
- [ ] If a Meta Staples Sync fetch fails, existing cached **Meta Staples** remain intact.
- [ ] Selecting the `Staples` tab in `/collection` (`/collection?view=STAPLES`) filters the Collector's Binder to owned **Meta Staples** and displays each card's staple categories, tournament inclusion rate, and playset progress (`binderOwned / recommendedCopies`).
- [ ] An on-demand sync endpoint allows authenticated Collectors or bearer-token jobs to trigger Meta Staples Sync and inspect updated staple counts.
- [ ] Service-seam tests using offline HTML fixtures verify `low-n` exclusion, multi-section deduplication (e.g. cards appearing in both Main Deck and Sideboard), `Math.ceil` playset calculation, and the `/collection?view=STAPLES` filter output.

## Blocked by

None — can start immediately
