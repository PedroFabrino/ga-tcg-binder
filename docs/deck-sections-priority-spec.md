## Problem Statement

A Collector with several Decks can only tell the app that cards are shared across all of them. Competitive Decks that must always be sleeve-ready have no way to protect their copies from casual Decks, and there is no way to say which Deck matters most when copies run short. Today's shortage math pools every Deck together, so a Competitive Deck's missing cards are hidden inside a "Shared Shortage" (rotate copies) when they should be a "buy this" Hard Shortage. The Deck Advisor also cannot warn that a suggested card is already used elsewhere.

## Solution

Every Deck belongs to a **Deck Section**: `Competitive` (pt-BR *Competitivo*) or `4Fun` (pt-BR *Diversão*). Within each section the Collector orders Decks by **Deck Priority** (topmost first) using drag-and-drop in both the list and card views, including dropping a Deck into the other section.

- Competitive Decks reserve their copies and never share them. They are served top-down. Any gap becomes that Deck's Hard Shortage.
- 4Fun Decks pool whatever the Competitive Decks leave over. Pooled demand that fits is shown as "N copies shared between M Decks". Shortages are attributed to Decks in priority order.
- With no Competitive Decks, results are identical to today's.
- The Deck Advisor respects reservations and, for cards shared across several 4Fun Decks, suggests the best option plus up to 2 alternatives for the case where the Collector is using the card elsewhere.

## User Stories

1. As a Collector, I want to mark a Deck as Competitive, so that its cards are never counted as shared with my casual Decks.
2. As a Collector, I want my existing Decks to stay 4Fun after the feature ships, so that my shortage numbers do not change unexpectedly.
3. As a Collector, I want new Decks to start at the bottom of 4Fun, so that nothing gets reserved by accident.
4. As a Collector, I want to drag a Deck up or down inside its section in the list view, so that reordering is quick.
5. As a Collector, I want to drag a Deck in the card (grid) view, so that I can reorder from either layout.
6. As a Collector, I want to drag a Deck into the other section, so that I can promote or demote it without a separate form.
7. As a Collector, I want Move up / Move down / Move to Competitive / Move to 4Fun in a menu, so that I can reorder with keyboard or touch.
8. As a Collector, I want reorders to save immediately and show a toast if saving fails, so that I never lose my order silently.
9. As a Collector, I want Competitive Decks served in priority order, so that the most important Deck gets the copies when I own too few.
10. As a Collector, I want a Competitive Deck's missing copies to be a Hard Shortage, so that I know to buy them.
11. As a Collector, I want 4Fun Decks to see only copies the Competitive Decks leave over, so that I never sleeve a copy a Competitive Deck needs.
12. As a Collector, I want 4Fun demand beyond the leftovers to be a Hard Shortage when a single 4Fun Deck cannot be sleeved, so that I know a purchase is unavoidable.
13. As a Collector, I want pooled 4Fun demand that fits to read "2 copies shared between 3 Decks", so that I know no purchase is needed.
14. As a Collector, I want 4Fun shortages attributed to the topmost Deck first, so that my buy list follows my priorities.
15. As a Collector with no Competitive Decks, I want behavior identical to today, so that nothing regresses.
16. As a Collector, I want Sideboard, Material and Main cards all to count toward reservations, so that no zone is left unprotected.
17. As a Collector, I want the Deck-Partitioned Wantlist ordered by section then priority with a section badge, so that it matches my deck list.
18. As a Collector, I want the Collector Assistant and Discord commands to list Decks in the same order with a section badge, so that every surface agrees.
19. As a visitor of a Public Collector Profile, I want Target Decks in the Collector's order without seeing sections, so that private organization stays private.
20. As a Collector advising a 4Fun Deck, I want the Candidate Pool to exclude copies reserved by Competitive Decks, so that suggestions are sleeveable.
21. As a Collector advising a Competitive Deck, I want the pool to exclude only copies needed by higher-priority Competitive Decks, so that I see my full usable list.
22. As a Collector advising a 4Fun Deck, I want cards shared across many Decks to get the best suggestion plus a note "if you're using it elsewhere, try X and Y", so that I have a fallback.
23. As a Collector, I want X and Y drawn from owned/sleeveable cards first, then Store Listings, then unowned cards, capped at 2, so that fallbacks are realistic.
24. As a Portuguese-speaking Collector, I want all new labels, badges, toasts and aria-labels translated, so that the UI is fully localized.
25. As a maintainer, I want the allocation rule documented in an ADR and the glossary, so that the model is not re-litigated.

## Implementation Decisions

- **Schema:** the Deck gains a section (`competitive` | `4fun`, default `4fun`) and an integer priority order, scoped per user and section. A migration backfills existing Decks to `4fun`, ordered by creation time.
- **Allocation (per card, N owned):**
  1. Walk Competitive Decks top-down. Each takes `min(demand, remaining)` with demand summed over all zones. Any gap is that Deck's Hard Shortage.
  2. Let R be the remaining copies. For 4Fun Decks: `hard = max(0, peakDemand − R)`, attributed to the topmost 4Fun Deck with the highest demand.
  3. `shared = max(0, totalDemand4Fun − R) − hard`, attributed in priority order.
  4. With no Competitive Decks this reduces to today's `peakMissing` / `concurrentMissing` math.
- **Dedicated Card** flag and its math are unchanged. Reconciliation with Deck Sections is a separate follow-up.
- **Reorder API:** a single endpoint accepting the target section and the new ordered ID list, validated with a schema at the boundary. The service performs the reorder through a Deck repository. No DB access outside repositories.
- **UI:** drag-and-drop in list and card views using a unified `@dnd-kit` context across sections with empty drop targets, plus a keyboard/touch dropdown menu (`DeckActionsMenu`) providing Move Up / Move Down / Move to Section actions. A persistent List/Grid toggle seamlessly alternates between `DeckSummaryRow` and `DeckSummaryCard`. Updates are optimistic with a toast on failure. All strings go through `@ga/contracts` (`en`, `pt-BR`). Section names are UI chrome, translated. Card and zone names stay in canonical English.
- **Surfaces:** the Deck-Partitioned Wantlist, Collector Assistant and Discord commands order by section then priority and show a badge. The Public Collector Profile uses the same order but hides the section. The Companion Scanner is unchanged.
- **Deck Advisor:** the Candidate Pool subtracts reservations as in the Competitive and 4Fun rules above. For 4Fun Decks it flags cards shared across several Decks and adds up to 2 alternatives from the existing acquisition-friction tiers.
- **Docs:** `CONTEXT.md` already has Deck Section and Deck Priority. ADR 0030 records the two-section priority allocation, including the rejected position-based and per-deck exclusive-flag alternatives. ADR 0031 records the `@dnd-kit` dependency.

## Testing Decisions

- A good test exercises external behavior: given Decks, sections, order and inventory, assert the reported shortages and the rendered order. It does not assert internals.
- **Primary seam:** the aggregated shortage calculation, run against the in-memory test database as existing shortage tests do. It covers the allocation scenarios, the no-Competitive regression case, and attribution order.
- **Secondary seams:** the reorder endpoint (validation, cross-section move, per-user isolation) and the Candidate Pool assembly for the advisor.
- **UI:** a component test for reorder and menu actions, including the failure toast.
- **i18n:** the existing catalog parity tests and `tsc --noEmit` cover the new keys.
- **Prior art:** existing shortage service tests, the `@ga/contracts` i18n completeness suite, and the Deck Advisor context tests.

## Out of Scope

- Reconciling Dedicated Cards with Deck Sections.
- Per-card or per-zone exclusivity.
- Sections beyond Competitive and 4Fun, or user-defined sections.
- Mobile Companion Scanner changes.
- Changing Public Collector Profile visibility rules.

## Further Notes

- Competitive demand always outranks 4Fun demand, regardless of position.
- Within 4Fun, order never changes who physically owns a copy. It only changes attribution and display.
