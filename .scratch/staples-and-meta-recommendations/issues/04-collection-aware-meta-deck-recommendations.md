## Parent

#23

## What to build

Compute **Archetype Completion** across each **Meta Archetype**'s core playable **Canonical Decklist** (**Material Deck + Main Deck**, 72 cards) using only the Collector's combined physical holdings (**Binder** `collection_items`, including both Shared and Dedicated copies, plus personal **Store Listings** `myp_cards`), and cross-reference any remaining missing cards against global **Market Listings** (`myp_market_cards` with `netExternalStock > 0`) to calculate immediate **Cost-to-Complete on MyP** in BRL. Surface a **"Recommended for Your Collection"** highlight rail at the top of `/meta` (plus a quick-discovery widget in `/decks`), badge every archetype card with its ownership split (*"85% Owned: 55 Binder · 6 MyP Store"*) and MyP completion cost (*"8/11 missing on MyP · from R$ 114,50"*), and provide a 1-click **"Import to My Decks"** button that creates the Deck and prompts the Collector to claim any needed copies sitting in their personal MyP Store.

## Acceptance criteria

- [ ] Every **Meta Archetype** returned to `/meta` includes the Collector's **Archetype Completion** percentage calculated across **Material Deck + Main Deck** using `Binder (Shared + Dedicated) + Personal MyP Store` copies, along with the exact breakdown (`binderCardsOwned`, `mypStoreCardsOwned`, `missingCardsCount`).
- [ ] Every **Meta Archetype** cross-references its missing core cards against `myp_market_cards` (`netExternalStock > 0`) to report how many missing copies are available on MyP (`missingAvailableOnMarketCount`) and the lowest total BRL cost (`estimatedCostToCompleteBrl`), with direct MyP buy links inside the Compare modal.
- [ ] `/meta` renders a **"Recommended for Your Collection"** highlight rail featuring the Collector's highest-completion active archetypes, supports sorting/filtering archetypes by **Archetype Completion %** and **Lowest Cost to Complete**, and displays a 1-click **"Import to My Decks"** action on archetype cards and inside the Compare modal.
- [ ] `/decks` includes a compact *"Recommended Meta Decks"* discovery widget allowing 1-click import of high-completion meta decks.
- [ ] Clicking **"Import to My Decks"** creates the Deck non-destructively and, when `mypStoreCardsOwned > 0`, displays a toast/banner with a direct link to `/collection?view=MYP_STORE` so the Collector can claim and delist those copies.
- [ ] Service-seam tests verify Material+Main completion math, Shared + Dedicated + Personal MyP Store inclusion, net external stock cost-to-complete calculation, and recommendation ranking.

## Blocked by

- #26
- #19
- #20
