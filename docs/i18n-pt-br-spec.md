# Specification: Full Application Localization (English & Brazilian Portuguese) & Compile-Time Static Text Policy

**Status:** `ready-for-agent`

## Problem Statement

Grand Archive **Collectors** in Brazil use both the Next.js Web Application and the Expo **Companion Scanner** mobile app to manage their physical **Binders**, construct **Decks**, inspect **Shortages**, and evaluate **Market Listings** and **Store Listings** on MyP Cards. Currently, every static UI label, empty state, modal, toast, filter, and instruction across both applications is hardcoded in English.

This creates three problems:
1. **Language Barrier for Brazilian Collectors**: Non-English or Portuguese-first players face friction navigating collection filters, shortage analysis, MyP store sync workflows, and camera pairing instructions.
2. **Terminology Mismatch Between UI Chrome and Game Nomenclature**: Grand Archive cards are printed exclusively in English, and the Brazilian competitive community universally preserves canonical English **Game Nomenclature** (Card names, Elements, Rarities, Deck zones `Main Deck` / `Material Deck` / `Sideboard`, and `Foil` / `Normal` finishes), while discussing collection and shortage concepts in natural Brazilian Portuguese (e.g., **Cartas Necessárias** for **Shortages**, **Compra Necessária** for **Hard Shortages**, and **Revezamento entre Decks** for **Shared Shortages**). Naive machine translation of game rules or literal translations like *"falta crítica"* feel unnatural to TCG players.
3. **Silent Translation Drift**: Without compile-time dictionary parity and an explicit policy in `AGENTS.md`, future features added by developers or AI agents inevitably introduce hardcoded strings or leave `pt-BR` keys missing.

## Solution

We introduce full **English (`en`)** and **Brazilian Portuguese (`pt-BR`)** localization across both the Web App and the **Companion Scanner** mobile app (`ADR-0011`):

1. **Shared Compile-Time Typed i18n Catalog (`@ga/contracts`)**:
   - Define `SupportedLocale = "en" | "pt-BR"` and house the canonical `en` and `pt-BR` dictionaries plus a zero-dependency translator (`createTranslator(locale)`, `t(key, vars)`, `formatLocaleNumber`, `formatLocaleDate`) in `@ga/contracts`.
   - Enforce strict compile-time key parity (`const ptBR: TranslationCatalog = ...` where `TranslationCatalog` is derived from `en`) so any missing key fails `tsc --noEmit` immediately across both Web and Mobile workspaces.
2. **In-Place Locale Detection, Switching & Multi-Surface Persistence**:
   - Keep all URLs unprefixed (`/collection`, `/decks`, `/marketplace`, `/scan/[token]`) and switch language in-place without page reloads.
   - Auto-detect initial language from the browser or mobile device (`pt*` → `pt-BR`, fallback `en`).
   - On **Web**, provide a quick language switcher directly in the top `Navbar` as well as inside `SettingsModal` ("Collector Preferences"), persisting the choice in `localStorage`/cookie for instant hydration and syncing to `users.locale` in SQLite/Turso for signed-in Collectors.
   - On **Mobile (`Companion Scanner`)**, auto-detect device language, propagate `locale` inside `PairingQrPayload` when pairing with a desktop **Scanner Session**, and expose a manual language selector inside a dedicated Mobile Settings modal/screen.
3. **Domain-Accurate `pt-BR` Terminology & Game Nomenclature Preservation**:
   - Translate 100% of static UI copy, navigation, modals, tooltips, toasts, and accessibility labels across Web and Mobile.
   - Map **Shortages** to **Cartas Necessárias**, **Hard Shortage** to **Compra Necessária** / **Sem Cópia Suficiente**, **Shared Shortage** to **Revezamento entre Decks**, and **Binder** to **Fichário**, while strictly preserving **Game Nomenclature** (Elements, Rarities, Deck zones, Finishes, and Card names) in canonical English.
4. **Static Text Policy & Automated Verification**:
   - Enforce via `AGENTS.md`, TypeScript dictionary parity, and Vitest completeness/guardrail tests that any and all static user-facing entries are covered by translations in both `en` and `pt-BR`.

---

## User Stories

1. As a Brazilian Collector visiting the Web App for the first time with a Portuguese browser (`pt-BR` or `pt`), I want the interface to automatically render in Brazilian Portuguese (`pt-BR`), so that I can use the application immediately in my native language.
2. As an English-speaking Collector (or a visitor whose browser language is not Portuguese), I want the interface to default to English (`en`), so that the default experience remains clear and familiar.
3. As a Collector on the Web App (whether signed in or logged out), I want a quick language switcher directly in the top navigation bar (`EN` / `PT-BR`), so that I can toggle the interface language in one click from any page.
4. As a Collector on the Web App, I want to view and change my preferred language inside the Collector Preferences (`SettingsModal`), so that all my account preferences live in one place.
5. As a signed-in Collector, I want my selected language (`en` or `pt-BR`) saved to my user profile in the database as well as locally (`localStorage`/cookie), so that my language preference persists across browser refreshes and syncs across devices.
6. As a Collector switching languages on `/collection`, `/decks`, `/marketplace`, `/meta`, `/catalog`, or `/friends`, I want the language to update in-place without adding `/en` or `/pt-BR` prefixes to the URL, so that bookmarks, shared links, OAuth callbacks, and QR scanner pairing URLs (`/scan/[token]`) never break.
7. As a Collector viewing the Home Dashboard (`/`) in `pt-BR`, I want time-of-day greetings, collection metric cards (*Cópias Físicas*, *Raridades Low Pop*, *Staples de Torneio*, *Cópias Livres*, *Decks Ativos*), summary sentences, and quick-jump tiles fully localized in Portuguese, so that my dashboard overview is completely natural.
8. As a Collector using the Command Palette (`Ctrl+K` / `Cmd+K`), Sign-In Panel, or Login Modal in `pt-BR`, I want all search placeholders, keyboard hints, OAuth sign-in prompts, and status toasts localized in Portuguese.
9. As a Collector managing my **Binder** (*Fichário*) in `/collection`, I want view tabs, search filters, ownership toggles (*Carta Dedicada* vs. *Carta Compartilhada*), Quick Add modals, and Bulk Import instructions fully translated into `pt-BR`, so that I can catalog cards effortlessly.
10. As a Collector managing my personal **Store Listings** in the MyP Store view, I want sync controls, username onboarding, claim actions (*Resgatar para o Fichário*), **Shortage Offset** alerts, and **Staple Deficit** badges localized in `pt-BR`, so that I clearly understand which listed cards I should withdraw from sale.
11. As a Collector browsing the **Card Catalog** (`/catalog`) and Card Hover Previews in `pt-BR`, I want filter controls, circulation/population labels (*Tiragem*), and empty states localized in Portuguese while keeping official **Game Nomenclature** (Card names, Elements like `Wind`/`Crux`/`Norm`, Rarities like `Super Rare`/`Collector`, and `Foil`/`Normal`) in canonical English.
12. As a Collector constructing or editing a **Deck** (`/decks` and `/decks/[id]`) in `pt-BR`, I want deck creation modals, Omnidex import instructions, visibility toggles, and action buttons localized in Portuguese while keeping canonical Deck zones (`Main Deck`, `Material Deck`, `Sideboard`) in English.
13. As a Collector reviewing **Shortages** across single or multiple Decks in `pt-BR`, I want **Shortages** labeled as **Cartas Necessárias**, **Hard Shortages** (`peakMissing > 0`) labeled as **Compra Necessária** / **Sem Cópia Suficiente**, and **Shared Shortages** (`concurrentMissing > 0`, `peakMissing = 0`) labeled as **Revezamento entre Decks**, so that the distinction between cards I must buy versus cards I can swap between decks is immediately clear in natural Brazilian TCG terminology.
14. As a Collector browsing the Global **Marketplace** (`/marketplace`) in `pt-BR`, I want shortage filters, **Price Fairness** badges (*Preço Justo*, *Acima do Preço*, *Muito Acima do Preço* against **Preço TCG Player**), vendor grouping headers, and **Watchlist Ledger** sync modals localized in Portuguese.
15. As a Collector exploring the **Meta Explorer** (`/meta`) in `pt-BR`, I want **Archetype Completion** badges, ownership breakdowns (*Fichário* + *Loja MyP*), Cost-to-Complete summaries, and 1-click deck import prompts localized in Portuguese while keeping **Meta Tier** labels (`Tier 1`, `Tier 2`, `Tier 3`, `Rogue`) and archetype names in canonical English.
16. As a Collector using **Friend Links** (`/friends`) in `pt-BR`, I want friend code sharing, linking inputs, and friend **Idle Copy** (*Cópias Livres*) browsing localized in Portuguese.
17. As a Collector opening the **Companion Scanner** mobile app (`apps/mobile/`), I want the app to automatically detect my phone's OS locale (`pt*` → `pt-BR`, else `en`) on startup, so that pairing instructions and camera prompts appear in my language right away.
18. As a Collector pairing the **Companion Scanner** mobile app with my desktop via QR code, I want the desktop's active `locale` included in the `PairingQrPayload`, so that the mobile scanner automatically aligns with my desktop session's language upon pairing.
19. As a Collector using the **Companion Scanner** mobile app, I want a Settings modal/screen where I can manually switch the mobile app language between English (`en`) and Português (`pt-BR`) alongside scanner preferences, rather than crowding the camera viewfinder header with a language toggle.
20. As a Collector scanning cards on the **Companion Scanner** mobile app in `pt-BR`, I want all pairing screens, manual code entry modals, **Quality Gate** HUD hints (*Aproxime a carta*, *Reflexo detectado*, *Mantenha firme*), **Rapid-Fire Mode** pills, candidate drawers, recent scan lists, and suite preview screens localized in Portuguese.
21. As a Collector viewing numbers and dates across the application, I want population counts, quantities, and timestamps formatted according to the active locale (`1.000` and `dd/mm/aaaa` in `pt-BR` vs. `1,000` and `mm/dd/yyyy` in `en`), while keeping BRL (`R$`) marketplace prices formatted consistently.
22. As a Developer or AI Agent modifying the codebase, I want TypeScript compilation (`tsc --noEmit`) and automated Vitest tests to fail immediately if any translation key is missing in either `en` or `pt-BR`, if interpolation placeholders (`{count}`) mismatch between locales, or if a component introduces uncovered static text.

---

## Implementation Decisions

### 1. Shared `@ga/contracts` i18n Module & Compile-Time Type Parity
We extend `@ga/contracts` with a dedicated i18n module exported from the package root so both the Next.js Web App and the Expo React Native Mobile App consume the exact same types, catalog, and translator functions:

```typescript
export type SupportedLocale = "en" | "pt-BR";

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ["en", "pt-BR"] as const;
export const DEFAULT_LOCALE: SupportedLocale = "en";

// Derived from the canonical English dictionary object; pt-BR must satisfy this exact type
export type TranslationCatalog = typeof enCatalog;

export interface PairingQrPayload {
  action: "pair_scanner";
  sessionId: string;
  wsEndpoint: string;
  token: string;
  webFallbackUrl?: string;
  locale?: SupportedLocale;
}
```

- **Key Structure & Interpolation**: Translation keys are organized by domain namespace (`common`, `nav`, `settings`, `auth`, `home`, `collection`, `mypStore`, `catalog`, `decks`, `shortages`, `marketplace`, `meta`, `friends`, `scanner`, `mobile`) and addressed via dot-notation (`t("shortages.hardShortageTitle")`) with typed `{param}` token interpolation (`t("home.heroSummary", { totalCards, decksCount, idleCount })`).
- **Locale Detection Helper (`resolveLocale(input?: string | null): SupportedLocale`)**: Normalizes any BCP-47 tag starting with `pt` (case-insensitive, e.g., `pt-BR`, `pt-PT`, `pt`) to `"pt-BR"`, and defaults all other inputs to `"en"`.
- **Locale-Aware Formatting Helpers**:
  - `formatLocaleNumber(value: number, locale: SupportedLocale): string` uses `Intl.NumberFormat(locale === "pt-BR" ? "pt-BR" : "en-US")`.
  - `formatLocaleDate(value: Date | number | string, locale: SupportedLocale, options?: Intl.DateTimeFormatOptions): string` uses `Intl.DateTimeFormat(locale === "pt-BR" ? "pt-BR" : "en-US", options)`.

### 2. User Locale Persistence & Settings API Contract
- **Database Schema (`users` table)**: Add `locale: text("locale").notNull().default("en")` to the `users` table (with idempotent column migration in the database initialization routine alongside existing columns).
- **Settings API (`GET /api/settings` & `POST /api/settings`)**:
  - `GET /api/settings` returns `user.locale` (`"en" | "pt-BR"`).
  - `POST /api/settings` accepts optional `locale: SupportedLocale` alongside `lowPopThreshold`, validating via `resolveLocale` and persisting to `users.locale`.

### 3. Web Application i18n Provider & Switcher UX
- **Client Context (`I18nProvider` & `useTranslation()`)**:
  - Wraps the application in `RootLayout`.
  - Hydrates initial locale from `localStorage` (`ga_locale`) / cookie, falling back to `navigator.language` via `resolveLocale`.
  - When a signed-in Collector's `/api/settings` profile loads (or when they toggle language), synchronizes `locale` between client storage, React state, `<html lang={locale}>`, and `/api/settings`.
- **Dual Web Switcher Placement**:
  - **Top `Navbar`**: A compact `EN` / `PT` language toggle button visible to both signed-in and logged-out users on desktop and mobile navigation sheets.
  - **`SettingsModal` ("Collector Preferences")**: A dedicated Language / Idioma segmented control (`English (EN)` / `Português (PT-BR)`) inside the preferences modal.

### 4. Mobile Companion Scanner i18n Store & Settings UX
- **Mobile Locale State**:
  - Initializes from the device's OS locale (`Intl.DateTimeFormat().resolvedOptions().locale`) via `resolveLocale`.
  - When `pair(payload)` is called with a `PairingQrPayload` containing `locale`, adopts `payload.locale` unless the user has explicitly overridden it in Mobile Settings.
- **Mobile Settings Modal**:
  - Accessible via a Settings icon button in `PairingView` and `ScannerHeader` (keeping the camera viewfinder header clean of extra language pills).
  - Allows the Collector to switch between `English` and `Português (Brasil)` as well as toggle scanner feedback preferences.

### 5. Canonical Domain Terminology vs. Game Nomenclature Boundary
- **Translated Domain Concepts in `pt-BR`**:
  - **Shortage / Shortages** $\rightarrow$ **Cartas Necessárias**
  - **Hard Shortage** $\rightarrow$ **Compra Necessária** (badge/subtitle: *Sem Cópia Suficiente*)
  - **Shared Shortage** $\rightarrow$ **Revezamento entre Decks**
  - **Binder** $\rightarrow$ **Fichário**
  - **Collection** $\rightarrow$ **Coleção**
  - **Owned Copy / Idle Copy** $\rightarrow$ **Cópia na Coleção** / **Cópia Livre**
  - **Dedicated Card / Shared Card** $\rightarrow$ **Carta Dedicada** / **Carta Compartilhada**
  - **Population / Low Pop** $\rightarrow$ **Tiragem** / **Low Pop (Baixa Tiragem)**
  - **Store Listing / Claim to Binder** $\rightarrow$ **Anúncio na Loja** / **Resgatar para o Fichário**
  - **Price Fairness**: **Fair Price** $\rightarrow$ **Preço Justo**, **Slightly Overpriced** $\rightarrow$ **Acima do Preço**, **Heavily Overpriced** $\rightarrow$ **Muito Acima do Preço**
- **Preserved English Game Nomenclature**:
  - Card names, Set prefixes (`DOA`, `FTC`, `ALC`, `MRC`), Elements (`Norm`, `Fire`, `Water`, `Wind`, `Tera`, `Crux`, `Umbra`, `Luxem`, `Exalted`, `Astra`, `Exia`, `Arcane`, `Neos`), Rarities (`Common`, `Uncommon`, `Rare`, `Super Rare`, `Ultra Rare`, `Collector`), Deck zones (`Main Deck`, `Material Deck`, `Sideboard`), Finishes (`Foil`, `Normal`), and competitive loanwords (`Staple`, `Marketplace`, `Tier 1`–`Tier 3`, `Rogue`) remain in canonical English.

---

## Testing Decisions

### What Makes a Good Test
Tests verify observable external behavior at module boundaries rather than internal React implementation details:
1. **Shared `@ga/contracts` Catalog & Translator Seam (`packages/contracts/src/index.test.ts`)**:
   - Verifies that `en` and `pt-BR` have identical nested key trees, zero empty strings, and matching `{placeholder}` interpolation variables on every key.
   - Verifies `createTranslator("en")` and `createTranslator("pt-BR")` output for parameterized strings, domain terms (*Cartas Necessárias*, *Compra Necessária*, *Revezamento entre Decks*), and fallback handling.
   - Verifies `resolveLocale`, `formatLocaleNumber`, and `formatLocaleDate` across `"en"` and `"pt-BR"`.
2. **User Locale Persistence Seam (`src/services/auth-persistence.test.ts`)**:
   - Verifies that `users.locale` defaults to `"en"`, updates cleanly to `"pt-BR"` and back via settings persistence, and coexists with `lowPopThreshold` and `friendCode`.
3. **Static Text Coverage Guardrail Seam (`src/i18n/static-text-guard.test.ts`)**:
   - Verifies that localized Web and Mobile page/component modules wire into the translation hook/catalog and that all translation keys referenced in source files exist in the `@ga/contracts` catalog.

### Prior Art in the Codebase
- Contract unit tests in `packages/contracts/src/index.test.ts`.
- Database & user preference persistence tests in `src/services/auth-persistence.test.ts` and `src/db/schema.test.ts`.

---

## Out of Scope

- Translating official Grand Archive card names, card effect rules text, set names, or **Game Nomenclature** (Elements, Rarities, Deck zones, Finishes).
- Adding URL route prefixes (`/en/...`, `/pt-BR/...`) or multi-domain routing.
- Supporting additional languages beyond English (`en`) and Brazilian Portuguese (`pt-BR`) in this iteration.

## Further Notes

- Governed by [`CONTEXT.md`](../CONTEXT.md), [`docs/adr/0011-compile-time-typed-i18n-catalog.md`](adr/0011-compile-time-typed-i18n-catalog.md), and the **Internationalization (i18n) & Static Text Policy** in [`AGENTS.md`](../AGENTS.md).
