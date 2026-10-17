## Parent

- #34

## What to build

Localize all static user-facing text, shortage classifications, marketplace fairness indicators, meta completion metrics, and playgroup friend views across Decks (`/decks`, `/decks/[id]`), Global Marketplace (`/marketplace`), Meta Explorer (`/meta`), and Playgroup Friends (`/friends`):

1. **Decks Hub & Shortage Views (`/decks`, `/decks/[id]`, `DeckList`, `DeckFormModal`, `DeckCardGrid`, `ShortageTable`, `AllShortagesView`)**:
   - Localize deck creation/editing modals, Omnidex list import instructions, visibility badges, and edition assignment menus while keeping canonical Deck zones (`Main Deck`, `Material Deck`, `Sideboard`) in English.
   - Localize all shortage analysis views using the agreed Brazilian TCG terminology in `pt-BR`:
     - **Shortage / Shortages** $\rightarrow$ **Cartas Necessárias**
     - **Hard Shortage** (`peakMissing > 0`) $\rightarrow$ **Compra Necessária** / **Sem Cópia Suficiente**
     - **Shared Shortage** (`concurrentMissing > 0`, `peakMissing = 0`) $\rightarrow$ **Revezamento entre Decks**
2. **Global Marketplace (`/marketplace`)**:
   - Localize market scan controls, TCGplayer enrichment buttons, shortage filter tabs, **Price Fairness** badges (*Preço Justo*, *Acima do Preço*, *Muito Acima do Preço* against **Preço TCG Player**), vendor grouping headers, and **Watchlist Ledger** sync/userscript consent modals.
3. **Meta Explorer (`/meta`) & Playgroup Friends (`/friends`)**:
   - Localize **Recommended for Your Collection** rails, **Archetype Completion** badges (*X% na Coleção · Y Fichário + Z Loja MyP*), Cost-to-Complete summaries, 1-click deck import modals/toasts, while preserving **Meta Tier** labels (`Tier 1`–`Tier 3`, `Rogue`) in canonical English.
   - Localize Friend Code sharing, friend linking forms, and friend **Idle Copy** (*Cópias Livres*) browsing on `/friends`.

## Acceptance criteria

- [ ] `/decks`, `/decks/[id]`, `DeckList`, `DeckFormModal`, `DeckCardGrid`, `ShortageTable`, and `AllShortagesView` contain zero hardcoded static strings and use **Cartas Necessárias**, **Compra Necessária**, and **Revezamento entre Decks** in `pt-BR`.
- [ ] Deck zone headings (`Main Deck`, `Material Deck`, `Sideboard`), Elements, and Rarities remain in canonical English.
- [ ] `/marketplace`, `/meta`, and `/friends` contain zero hardcoded user-facing static strings and format numbers/dates according to the active locale.
- [ ] All `tsc --noEmit` and `vitest` checks pass.

## Blocked by

- #35
