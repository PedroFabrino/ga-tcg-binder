## Parent

- #34

## What to build

Localize all static user-facing text, filters, modals, badges, toasts, and accessibility attributes across the Collection Hub (`/collection`), personal MyP Store view, and Card Catalog (`/catalog`) in both English (`en`) and Brazilian Portuguese (`pt-BR`):

1. **Collection Hub & Binder (`/collection`, `BinderView`, `CollectionSearchBar`, `CollectionTable`, `QuickAddBar`, `QuickAddModal`, `BulkImportModal`)**:
   - Localize smart view tabs (*Binder / Fichário*, *Low Pop*, *Staples*, *Idle / Cópias Livres*, *MyP Store / Loja MyP*), search inputs, element/rarity filter controls, table headers, Dedicated vs. Shared Card toggles (*Carta Dedicada* / *Carta Compartilhada*), Quick Add search/modal flows, and Bulk Import instructions/toasts.
2. **Personal MyP Store View (`MypStoreView`)**:
   - Localize MyP username onboarding, sync buttons and status toasts, filter modes, **Shortage Offset** badges (linked to **Cartas Necessárias**), **Staple Deficit** alerts (*Staple do Formato · Manter no Fichário!*), and 1-click claim actions (*Resgatar para o Fichário*).
3. **Card Catalog & Previews (`/catalog`, `CatalogCard`, `CardHoverPreview`)**:
   - Localize catalog headers, search & filter controls, population/circulation displays (*Tiragem* formatted with `formatLocaleNumber`), and empty/loading states while keeping official **Game Nomenclature** (Card names, Elements, Rarities, Finishes `Foil`/`Normal`) in canonical English.

## Acceptance criteria

- [ ] `/collection`, `BinderView`, `CollectionSearchBar`, `CollectionTable`, `QuickAddBar`, `QuickAddModal`, `BulkImportModal`, and `MypStoreView` contain zero hardcoded user-facing static strings and render accurately in both `en` and `pt-BR`.
- [ ] `/catalog`, `CatalogCard`, and `CardHoverPreview` contain zero hardcoded user-facing static strings and format circulation/population counts according to the active locale (`1,000` in `en`, `1.000` in `pt-BR`).
- [ ] Official Grand Archive **Game Nomenclature** (Elements, Rarities, Finishes) remains in canonical English across both locales.
- [ ] All `tsc --noEmit` and `vitest` checks pass.

## Blocked by

- #35
