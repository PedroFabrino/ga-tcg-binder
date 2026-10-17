## Parent

#51 (`docs/myp-fulfillment-spec.md`)

## What to build

Build the **Fulfillment / Separação de Envios** view inside the Grand Archive TCG Binder's **MyP Store** tab (`src/components/collection/`), complete with bilingual (`en` and `pt-BR`) i18n dictionary coverage in `@ga/contracts`:

1. **Bilingual i18n Catalog Keys (`@ga/contracts`)**:
   - Add translation keys for the Fulfillment view (headings, Phase 1 **Pick List** and Phase 2 **Buyer Packs** tabs, progress counters, non-Grand Archive order notices, shipping badges, *"Order Completed / Photographed"* toggles, copy-to-clipboard toast messages, and empty/onboarding instructions) to both `en` and `pt-BR` dictionaries simultaneously while keeping canonical English **Game Nomenclature** (`Norm`, `Fire`, `Water`, `Foil`, `Normal`) untouched.
2. **Modular Fulfillment UI Component (`<400` lines per file per ADR 0012)**:
   - Integrate a mode toggle or sub-panel inside the **MyP Store** view (`Listings` vs. `Fulfillment / Envios`) that automatically activates when opened via the Tampermonkey handoff (`#ga_fulfillment=` or `localStorage` batch) or when clicked by the Collector.
   - **Phase 1 — Pick List by Element**: Render collapsible or sectioned cards per canonical **Element** using `ElementBadge`, `RarityGem`, `FoilBadge`, and `CardPreviewTrigger` (hover card art), showing `[SET #NUM · Cond] xQty` and persistent checkboxes for each row.
   - **Phase 2 — Buyer Packs**: Render buyer cards showing `buyerNick`, total order count (`Enviar juntos` badge when `> 1`), and shipping method badges (`PAC` / `Frete Fixo` highlighted over `Frete combinado`), sub-grouped by each individual **Fulfillment Order** (`#orderId`). Each sub-order lists its items with checkboxes, an **"Order Completed / Photographed"** toggle, and a direct `"Open #orderId on MyP ↗"` link.
   - **Non-Grand Archive Callout Banner**: Render any `nonGrandArchiveOrders` (such as Pokémon orders) in a clear warning card with buyer nickname, detected TCG, and a direct link to `/pedido/<id>`.
   - **Clipboard Export & Clear Batch**: Include buttons to copy the formatted text breakdown (`Norm:\nVoid's Cloak...`) and to clear/reset the active fulfillment batch.

## Acceptance criteria

- [ ] All user-facing static strings in the Fulfillment view use shared translation keys in `@ga/contracts` with 100% `en` and `pt-BR` parity (`tsc --noEmit` and i18n completeness tests pass).
- [ ] All new or modified component files remain strictly under the 400-line limit (`ADR 0012`) and never import `src/db/*` or server-only services directly.
- [ ] Opening the **MyP Store** tab from the Tampermonkey handoff (or with an active batch in `localStorage`) renders both **Phase 1 (Pick List by Element)** and **Phase 2 (Buyer Packs grouped by Buyer $\rightarrow$ sub-grouped by Order `#`)** with `ElementBadge`, `FoilBadge`, and `CardArt` hover previews.
- [ ] Checking off items in the **Pick List**, items inside a **Fulfillment Order**, or the per-order **"Order Completed / Photographed"** toggle persists across reloads in `localStorage`.
- [ ] Non-Grand Archive orders (e.g., Pokémon) display in the dedicated notice banner with working external links to `https://mypcards.com/pedido/<id>`.
- [ ] Component/integration tests in `vitest` verify rendering of Element groups, multi-order Buyer Packs, non-GA order notices, and checkbox state persistence.

## Blocked by

- #52
- #53
