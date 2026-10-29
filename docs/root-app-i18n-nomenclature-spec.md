# Root App Bilingual Localization (`en` / `pt-BR`) & Domain Nomenclature Guide

## Problem Statement

Collectors using the Grand Archive Collector Assistant in the Root App (`@ga/root-app`) currently encounter two usability and comprehension barriers:

1. **Mixed-Language Interface & Unlocalized Channel Messages**: While the Root App top header and Community Admin card read the browser's locale (`pt-BR` or `en`), all other dashboard cards (Account Linking, Deal Alerts, Decks & Shortages, Deck Import/Edit forms, and Personal Wantlist) as well as all automated channel messages (global `#market` stock updates and personal `#deal-alerts-<user>` notifications) remain hardcoded in English. This results in a jarring half-Portuguese, half-English interface with no way for either a Collector or a community administrator to explicitly switch languages.
2. **Unexplained Domain Nomenclature**: New and returning Collectors frequently encounter domain-specific terms—such as **Shortages**, **Hard Shortages**, **Shared Shortages**, **Alert Scope (`All` vs. `Hard Only`)**, **Personal Wantlist**, and **Omnidex Format**—without in-app explanations of how each concept affects their Binder collection calculations and deal-alert notifications.

## Solution

Introduce a **Two-Tier Language Configuration (`en` | `pt-BR`)** across the Root App GUI and channel notification pipelines, paired with an always-visible **Nomenclature Guide** at the bottom of the Root App dashboard and interactive **`(i)` Term Badges** next to domain terms throughout the app:

1. **Community Broadcast Locale (`en` | `pt-BR`)**: Community administrators can configure the community-level language inside the **Community Market Channel** admin card (`RootCommunityConfig`). This governs the language of all subsequent global `#market` Broadcast Channel stock-update messages and serves as the default fallback GUI locale for unlinked community members who have not chosen a personal language.
2. **Personal Collector Locale (`en` | `pt-BR`)**: Any user can toggle their personal language (`EN` / `PT-BR`) directly in the Root App header next to the Refresh button. When unlinked, the preference is stored locally in `localStorage` (falling back to the Community Broadcast Locale, then browser locale). When linked to a Binder account, the preference syncs directly with the Collector's `locale` in the main database, governing:
   - The entire Root App GUI (every card, form, badge, button, tooltip, empty state, error message, and Nomenclature Guide entry).
   - Newly provisioned `#deal-alerts-<user>` welcome messages and all subsequent personal deal-alert channel messages and push notification summaries for that Collector.
3. **Game Nomenclature Preservation**: In accordance with ADR 0011, official Grand Archive **Game Nomenclature**—Card names, Set codes, Elements, Rarities, Deck zones (`Main Deck`, `Material Deck`, `Sideboard`), and Finishes (`Foil`, `Normal`)—remains in canonical English across both `en` and `pt-BR`.
4. **Bottom Nomenclature Guide & Interactive `(i)` Badges**:
   - An always-expanded, two-column **Nomenclature Guide** card at the bottom of the Root App page (above the footer) explains six core domain concepts in the user's active locale: **Shortages** (*Cartas Necessárias*), **Hard Shortages** (*Compra Necessária*), **Shared Shortages** (*Revezamento entre Decks*), **Alert Scope (`All` vs. `Hard Only`)** (*Escopo de Alerta*), **Personal Wantlist** (*Lista de Desejos*), and **Omnidex Format** (*Formato Omnidex*).
   - Interactive **`(i)` badges** placed next to those terms across the dashboard cards display a concise 1-sentence tooltip on hover or keyboard focus, and smoothly scroll to and highlight the corresponding entry in the bottom Nomenclature Guide when clicked.

## User Stories

1. As a community administrator, I want to configure the **Community Broadcast Locale** (`en` or `pt-BR`) in the Community Market Channel card, so that global `#market` stock-update broadcasts match our community's primary language.
2. As a community administrator, I want the Community Broadcast Locale to persist in the community's configuration store, so that automated market polling continues formatting `#market` messages in the chosen language across server restarts.
3. As an unlinked community member opening the Root App for the first time, I want the interface to default to the community's configured broadcast locale (or my browser locale if none is set), so that the app starts in a language appropriate for my community.
4. As an unlinked user in the Root App, I want to toggle my personal language between `EN` and `PT-BR` in the top header and have it remembered in my client storage, so that I can read the Account Link card and Nomenclature Guide in my preferred language before linking my Binder account.
5. As a linked Collector, I want my personal language toggle in the Root App header to sync with my Collector `locale` preference in the Binder database, so that my language choice stays consistent across the Web Binder and the Root App.
6. As a linked Collector, I want every card in the Root App—Account Linking, Deal Alerts, Decks & Shortages, Deck Import, Deck Edit, Personal Wantlist, Community Admin, and Nomenclature Guide—to immediately render in my selected language (`en` or `pt-BR`) without mixed-language text.
7. As a linked Collector who enables Deal Alerts for the first time, I want the initial welcome message posted in my provisioned `#deal-alerts-<user>` channel to be written in my personal Collector locale (`en` or `pt-BR`), so that I understand how my alert channel works.
8. As a linked Collector receiving automated Deal Alerts, I want the single-message alert status embed and push notification summary in `#deal-alerts-<user>` to be formatted in my personal Collector locale (`en` or `pt-BR`), so that store groupings, timestamps, and shortage reasons are in my language.
9. As a Grand Archive player reading the Root App or channel notifications in Portuguese (`pt-BR`), I want official **Game Nomenclature** (Card names, Set codes, `Main Deck`, `Material Deck`, `Sideboard`, `Foil`, `Normal`) to remain in canonical English while surrounding UI chrome and domain terms (*Cartas Necessárias*, *Compra Necessária*, *Revezamento entre Decks*, *Lista de Desejos*) are translated into Portuguese, so that decklists and card identifiers remain tournament-accurate.
10. As a new Collector scrolling to the bottom of the Root App page, I want an always-expanded, two-column **Nomenclature Guide** card explaining **Shortages**, **Hard Shortages**, **Shared Shortages**, **Alert Scope**, **Personal Wantlist**, and **Omnidex Format**, so that I can learn what each term means in one reference section.
11. As a Collector configuring my Deal Alerts card, I want `(i)` info badges next to **Alert Scope**, **All Shortages**, and **Hard Shortages Only**, so that I can check the difference between alert modes before choosing one.
12. As a Collector viewing the Decks & Shortages card, I want a compact legend with `(i)` info badges for **Shortages**, **Hard**, and **Shared** in the card header, so that I can understand what the badge counts on my decks mean even before expanding a deck.
13. As a Collector importing or editing a deck, I want an `(i)` info badge next to the **Omnidex URL or Decklist** field label, so that I know what URL or text decklist structure is accepted.
14. As a Collector viewing the Personal Wantlist card, I want an `(i)` info badge next to **Personal Wantlist**, so that I understand how standalone wantlist items differ from deck-derived shortages and how they trigger deal alerts.
15. As a Collector hovering over or focusing any `(i)` info badge, I want to see a concise 1-sentence tooltip immediately in place without losing my scroll position, so that I can get a quick reminder of the term.
16. As a Collector clicking any `(i)` info badge, I want the page to smoothly scroll down to the **Nomenclature Guide** and visually highlight the matching term card, so that I can read the full explanation and example.

## Implementation Decisions

- **Two-Tier Locale Resolution Hierarchy**:
  - **Personal GUI Locale**: Resolved on the client in priority order:
    1. Explicit user selection (synced from the linked Collector's persisted `locale` returned in the status payload, or stored in `localStorage` under a dedicated key when unlinked).
    2. The community's configured `broadcastLocale` returned in `AdminSettingsResponse` (via `getAdminSettings`).
    3. Client browser locale detection (`navigator.language` matching `pt*` -> `pt-BR`, else `en`).
  - **Personal Deal-Alert Channel Locale**: Resolved per recipient from the linked Collector's `locale` column (`"en" | "pt-BR"`) in the database, defaulting to `"en"` when unspecified.
  - **Community Broadcast Channel Locale**: Resolved from the community configuration store (`RootCommunityConfig.market.broadcastLocale`, `"en" | "pt-BR"`, defaulting to `"en"`).
- **Non-Retroactive Channel Message Switching**:
  - Toggling either the Personal Collector Locale or the Community Broadcast Locale immediately updates the Root App GUI and governs newly provisioned `#deal-alerts-<user>` welcome messages plus all subsequent scheduled/triggered `#deal-alerts-<user>` and `#market` dispatches. Existing historical messages in chat channels are not retroactively rewritten on toggle.
- **RPC & Setting Contract Extensions**:
  - Extend `AdminSettingsResponse` and community admin settings in the Root App contract with `broadcastLocale` (`string`, validated to `"en" | "pt-BR"`).
  - Extend `StatusResponse` with the linked Collector's `locale` (`string`, `"en" | "pt-BR"`).
  - Extend `SetPreferencesRequest` with an optional `locale` field so toggling the personal language when linked persists via the existing preferences RPC flow (or allow `setPreferences` to update `locale` independently of alert subscription flags).
- **Backend API & Service Contracts**:
  - The Root Bot status payload includes the Collector's persisted `locale` from the `users` repository.
  - The Root Bot preferences update payload accepts an optional `locale` (`"en" | "pt-BR"`) and persists it to the Collector's `users.locale` record via the user repository.
  - The market notifications endpoint accepts a `locale` query parameter (`"en" | "pt-BR"`, defaulting to `"en"`) and passes it to the market notification chunk formatter so the store stock-update header is localized while card lines (`Card Name`, edition code, `Foil`, BRL price) remain in canonical format.
  - The deal-alert planner reads each matched Collector's `locale` from their user record, formats both the full channel message (`formatDealAlertMessage`) and push notification summary (`formatDealAlertNotificationSummary`) in that Collector's locale, and includes the resolved `locale` on each planned recipient payload so the Root App deal-alert notifier can also post localized welcome messages when provisioning a new `#deal-alerts-<user>` channel.
- **Shared `@ga/contracts` i18n Catalog Organization**:
  - All user-facing strings across every Root App component, tooltip, Nomenclature Guide entry, and notification formatter must live in `@ga/contracts` with strict compile-time `en` and `pt-BR` parity.
  - To respect ADR 0012's 400-line file limit and avoid worsening existing size debt in the root catalog file, extract the Root App and notification dictionary entries into a dedicated submodule imported and spread into the canonical `en` and `pt-BR` catalogs.
- **Nomenclature Guide & `(i)` Badge Interaction**:
  - Define a typed set of six nomenclature term identifiers: `'shortages' | 'hardShortages' | 'sharedShortages' | 'alertScope' | 'wantlist' | 'omnidexFormat'`.
  - `InfoTermBadge` renders an accessible `<button type="button">` with an `(i)` indicator and an inline tooltip visible on hover/focus containing the term's 1-sentence summary.
  - Clicking `InfoTermBadge` invokes a callback `onSelectTerm(termId)` that scrolls the matching `#nomenclature-term-<termId>` card in `NomenclatureGuideCard` into view (`scrollIntoView({ behavior: 'smooth', block: 'center' })`) and sets an active highlight state on that card for clear visual feedback.

## Testing Decisions

- **What Makes a Good Test**:
  - Assert observable behavior at module and UI boundaries—rendered localized text, RPC request payloads, persisted repository state, formatted Markdown channel messages, tooltip visibility, and target card highlight state—rather than internal component state hooks or private helper functions.
- **Testing Seams & Modules Under Test**:
  1. **Shared i18n Contract Seam (`@ga/contracts` i18n tests)**:
     - Verify compile-time and runtime key parity between `en` and `pt-BR`, placeholder token parity (`{storeName}`, `{count}`, `{date}`, etc.), and preservation of canonical English **Game Nomenclature** (`Main Deck`, `Material Deck`, `Sideboard`, `Foil`, `Normal`).
  2. **Backend Service & Formatter Seam (`root-bot-service`, `deal-alert-planner`, `deal-alert-format`, `market-notification-message` tests)**:
     - Verify `getRootBotStatus` returns the Collector's `locale`, `updateNotifyPreferences` updates `users.locale`, `formatMarketNotificationChunks` renders both `en` and `pt-BR` headers, and `planCommunityDealAlerts` / `formatDealAlertMessage` / `formatDealAlertNotificationSummary` produce `en` and `pt-BR` output per recipient `locale`.
  3. **Root App Server RPC & Notifier Seam (`assistant-service`, `market-notifier`, `deal-alert-notifier` tests)**:
     - Verify `setCommunityConfig` and `getCommunityConfig` persist and return `broadcastLocale`, `market-notifier` passes the community's `broadcastLocale` when fetching market notification chunks, and `deal-alert-notifier` posts the localized welcome message when creating a new `#deal-alerts-<user>` channel.
  4. **Root App Client Integration Seam (`App.test.tsx`)**:
     - Verify full dashboard rendering in both `en` and `pt-BR` with zero untranslated strings across all cards and forms, personal header language toggle persistence (`localStorage` when unlinked + `setPreferences` RPC when linked), admin broadcast language selector, `(i)` badge hover/focus tooltip display, and `(i)` badge click scrolling to and highlighting the target Nomenclature Guide entry.
- **Prior Art**:
  - Contract parity tests in `packages/contracts/src/__tests__/i18n.test.ts`.
  - Root App client integration tests in `apps/ga-tcg-root-app/client/src/__tests__/App.test.tsx`.
  - Notifier and service unit tests in `apps/ga-tcg-root-app/src/__tests__/` and `src/services/__tests__/`.

## Out of Scope

- Adding locales beyond English (`en`) and Brazilian Portuguese (`pt-BR`).
- Translating official Grand Archive **Game Nomenclature** (Card names, Set names/codes, Elements, Rarities, Deck zones, or Finishes).
- Retroactively editing historical messages already posted in `#market` or `#deal-alerts-<user>` prior to a language toggle (existing `#deal-alerts-<user>` status messages will naturally update to the new language on the next alert dispatch).
- Adding text-chat slash commands (`!lang`, `/lang`); all configuration remains strictly GUI-driven per ADR 0020.

## Further Notes

- Follows ADR 0011 (*Compile-Time Typed i18n Catalog*), ADR 0012 (*Layered Architecture and Code Limits*), and ADR 0020 (*Personal Wants and Collector Assistant Interaction Model*).
- Domain terms **Collector** (synced `locale`), **Community Broadcast Locale**, and **Omnidex Format** are recorded in `CONTEXT.md`.
