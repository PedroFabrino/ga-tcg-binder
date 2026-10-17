## Parent

- #34

## What to build

Deliver end-to-end language switching (`en` and `pt-BR`) on the Web App alongside the shared compile-time typed translation catalog in `@ga/contracts` and user locale persistence in SQLite/Turso:

1. **Shared `@ga/contracts` i18n Catalog & Translator**:
   - Define `SupportedLocale = "en" | "pt-BR"`, `SUPPORTED_LOCALES`, `DEFAULT_LOCALE`, `resolveLocale`, `formatLocaleNumber`, `formatLocaleDate`, and `createTranslator(locale)`.
   - Define the canonical `en` and `pt-BR` translation dictionaries in `@ga/contracts` with strict compile-time key parity (`const ptBR: TranslationCatalog = ...`), covering all Web and Mobile namespaces (`common`, `nav`, `settings`, `auth`, `home`, `collection`, `mypStore`, `catalog`, `decks`, `shortages`, `marketplace`, `meta`, `friends`, `scanner`, `mobile`) while preserving canonical English **Game Nomenclature** (`Elements`, `Rarities`, `Main Deck`, `Material Deck`, `Sideboard`, `Foil`, `Normal`) and mapping **Shortages** to **Cartas Necessárias**, **Hard Shortage** to **Compra Necessária**, and **Shared Shortage** to **Revezamento entre Decks**.
   - Extend `PairingQrPayload` with optional `locale?: SupportedLocale`.
2. **User Profile Locale Persistence**:
   - Add `locale` (`"en" | "pt-BR"`, default `"en"`) to the `users` schema and database initialization routine.
   - Update `/api/settings` (`GET` and `POST`) to return and persist `locale` alongside `lowPopThreshold` and `friendCode`.
3. **Web `I18nProvider`, Auto-Detection, Switchers & Core Shell Localization**:
   - Create `I18nProvider` and `useTranslation()` hook for the Web App, auto-detecting browser language (`pt*` → `pt-BR`, fallback `en`), persisting to `localStorage`/cookie and syncing with `/api/settings`, and updating `<html lang={locale}>` in-place without URL route prefixes.
   - Add a quick `EN / PT-BR` language switcher in the top `Navbar` (desktop and mobile sheet) and a Language selector inside `SettingsModal` ("Collector Preferences").
   - Localize all static texts in the Home Dashboard (`/`), `Navbar`, `SettingsModal`, `LoginModal`, `SignInPanel`, `CommandPalette`, and shared UI primitives (`common.tsx`).

## Acceptance criteria

- [ ] `@ga/contracts` exports `SupportedLocale`, `en` and `pt-BR` catalogs with compile-time `TranslationCatalog` parity, `createTranslator`, `resolveLocale`, `formatLocaleNumber`, and `formatLocaleDate`.
- [ ] Vitest tests in `@ga/contracts` verify 100% key parity between `en` and `pt-BR`, non-empty strings, identical `{placeholder}` tokens across locales, translator interpolation, and locale formatting.
- [ ] `users.locale` is persisted in SQLite/Turso and read/updated via `GET /api/settings` and `POST /api/settings`, verified by persistence unit tests.
- [ ] First-time visitors with a `pt*` browser locale automatically see `pt-BR`; others default to `en`.
- [ ] Collectors can switch between `en` and `pt-BR` from both the top `Navbar` and `SettingsModal` without changing URL paths.
- [ ] Home Dashboard (`/`), `Navbar`, `SettingsModal`, `LoginModal`, `SignInPanel`, `CommandPalette`, and `common.tsx` have zero hardcoded static strings and render completely in both `en` and `pt-BR`.

## Blocked by

- None — can start immediately
