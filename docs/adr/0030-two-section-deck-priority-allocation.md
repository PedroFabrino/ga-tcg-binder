# 0030: Two-Section Deck Priority Allocation and Shortage Attribution

## Status

Accepted

## Context

In Grand Archive TCG, a Collector frequently builds both high-stakes tournament lists (**Competitive Decks**) and casual experiment/kitchen-table lists (**4Fun Decks**). Previously, the system calculated shortages purely at an aggregated aggregate level across all decks:
- `peakMissing = max(0, peakDemand - totalOwned)`
- `concurrentMissing = max(0, totalDemand - totalOwned)`

Under this model, all decks shared copies equally in a single pool. If a Collector owned 2 copies of a card and both their main tournament Deck and casual test Deck required 2 copies, the tournament Deck's gap was classified as a **Shared Shortage** (implying the Collector could swap cards between decks), rather than identifying that the tournament Deck strictly required dedicated physical cards without card-swapping friction.

We explored two alternative approaches before settling on the section model:
1. **Per-Deck "Exclusive" Flag**: Allowing any deck to mark itself exclusive. However, if priority order interacts with an exclusive deck, circular dependency and ambiguity arise regarding whether priority dictates reservation or exclusivity overrides priority.
2. **Position-Based Exclusivity** (sharing only with decks placed above it): Reordering decks silently changes what "exclusive" means for each deck, creating unpredictable shortage swings and unintuitive rules.

## Decision

We introduce a two-partition deck hierarchy governed by **Deck Section** and **Deck Priority**:

1. **Deck Section (`section`)**:
   - `competitive`: Owned Copies are reserved top-down. Copies allocated to a Competitive deck are removed from subsequent decks. A Competitive deck never shares its allocated cards with casual decks or lower-priority decks. Any deficit in a Competitive deck is treated as a **Hard Shortage** (`peakMissing > 0`).
   - `4fun`: Decks share whatever inventory remains after all Competitive deck demands are fulfilled. Shared pool demand that fits within available leftovers is represented as pooled copies (`N copies shared between M decks`). Shortages in 4Fun decks are attributed in Deck Priority order.

2. **Deck Priority (`priority`)**:
   - An integer sequence scoped per user and section, ordered top-down (0, 1, 2...).
   - In `competitive`, priority decides which deck is served first when physical copies are scarce.
   - In `4fun`, priority decides which deck absorbs the shortage first on the Deck-Partitioned Wantlist and purchase recommendations.

3. **Allocation Algorithm**:
   - For a given card with $N$ total owned copies:
     1. Iterate through Competitive decks in priority order. For each deck with demand $D$, allocate $A = \min(D, \text{remaining})$. If $A < D$, record a Hard Shortage of $D - A$ for this deck. $\text{remaining} \leftarrow \text{remaining} - A$.
     2. Let $R$ be the remaining copies after all Competitive decks are evaluated.
     3. For 4Fun decks, calculate pooled demand: $\text{hard} = \max(0, \text{peakDemand}_{4fun} - R)$, attributed to the topmost 4Fun deck with highest demand.
     4. Calculate shared deficit: $\text{shared} = \max(0, \text{totalDemand}_{4fun} - R) - \text{hard}$, attributed in priority order.
   - If no Competitive decks exist, this math is completely backwards-compatible with the previous unranked pooling algorithm.

4. **Backward Compatibility & Defaults**:
   - Existing decks are backfilled to `4fun` ordered by `created_at`.
   - New decks default to `4fun` appended to the bottom.

5. **Interaction Model & Accessibility**:
   - Reordering is driven by a single unified `@dnd-kit` context wrapping both sections and empty drop targets, allowing frictionless dragging within and across sections.
   - For keyboard, mobile touch, and screen-reader users, a `DeckActionsMenu` provides direct actions (`Move Up`, `Move Down`, `Move to Competitive` / `Move to 4Fun`).
   - A layout toggle switches between compact list (`DeckSummaryRow`) and grid card (`DeckSummaryCard`) views while preserving the same reordering and actions capabilities.

## Consequences

- Competitive decks are guaranteed full reservation of physical cards without being contaminated by casual deck testing.
- Wantlists and buy orders clearly flag critical acquisitions needed to sleeve competitive decks.
- Deck Advisor respects reservations when calculating the Candidate Pool.
