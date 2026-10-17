# 0011: Compile-Time Typed i18n Dictionary and Game Nomenclature Preservation

Status: accepted

## Context
Collectors in Brazil use both the Next.js Web Application (`src/`) and the Expo Companion Scanner (`apps/mobile/`). While application UI chrome, workflows, and collection management concepts benefit from full Brazilian Portuguese (`pt-BR`) localization, Grand Archive TCG cards are printed exclusively in English, and the Brazilian competitive community universally uses canonical English **Game Nomenclature** (Elements, Rarities, Deck zones like `Main Deck` / `Material Deck` / `Sideboard`, and `Foil` / `Normal` finishes). Furthermore, routing-based i18n (`/en/...`, `/pt-BR/...`) would fracture existing deep links, QR scanner pairing URLs (`/scan/[token]`), and OAuth callback paths, while untyped JSON translation catalogs risk silent missing-key drift as AI agents and developers add new UI surfaces.

## Decision
1. **Shared Compile-Time Typed Dictionary in `@ga/contracts`**:
   - Define `SupportedLocale = "en" | "pt-BR"` and house the canonical `en` and `pt-BR` translation dictionaries inside `@ga/contracts` so both the Next.js Web App and the React Native Companion Scanner consume a single source of truth.
   - Enforce strict compile-time key parity by typing the `pt-BR` dictionary against the exact shape of `en` (`TranslationCatalog`), supplemented by a Vitest suite that verifies key completeness, interpolation placeholder parity, and non-empty strings across all locales.

2. **In-Place Locale Switching, Detection & Persistence**:
   - Keep URL paths unprefixed (`/collection`, `/decks`, `/marketplace`, `/scan/[token]`) and switch language in-place via React context/store.
   - Auto-detect initial locale from browser/device settings (`pt*` → `pt-BR`, fallback `en`).
   - On **Web**, expose a quick language switcher in the top `Navbar` as well as in `SettingsModal` ("Collector Preferences"), persisting the selection to `localStorage`/cookie and syncing to `users.locale` in Turso for authenticated Collectors.
   - On **Mobile**, auto-detect device language, propagate `locale` inside `PairingQrPayload` when pairing with a desktop session, and provide a manual language selector inside the Mobile Settings modal/screen.

3. **UI Localization vs. Canonical Game Nomenclature**:
   - Translate all static UI copy, navigation, actions, statuses, and collection concepts into natural Brazilian Portuguese—specifically mapping **Shortages** to **Cartas Necessárias**, **Hard Shortage** to **Compra Necessária** / **Sem Cópia Suficiente**, and **Shared Shortage** to **Revezamento entre Decks**.
   - Preserve official Grand Archive **Game Nomenclature** (Elements, Rarities, Deck zones, Finishes, and Card names) in canonical English across all locales.

## Consequences
- Any missing translation key in `pt-BR` or `en` fails `tsc` typechecking and Vitest immediately across both Web and Mobile workspaces.
- Brazilian Collectors get a native `pt-BR` experience with familiar community TCG terminology without breaking deep links or QR scanner pairing.
