## Problem Statement

When a Collector manually browses external Grand Archive storefronts — such as a seller's storefront or catalog on MyP Cards, search grids on LigaStore storefronts (TabletopSorocaba, Brandão Card Game), or the catalog on Lootcards — they have no immediate visual signal telling them which in-stock listings on the current page match their **Aggregate Wantlist** (**Hard Shortages**, **Shared Shortages**, **Personal Wants**) or **Staple Deficits**. On dense catalog pages (up to 120 cards per page on LigaStore, where broken stock filters mix out-of-stock cards with in-stock cards), a Collector must manually cross-reference every card title, edition, and finish against their decks and wantlist.

Furthermore, the existing browser userscript bundles seller-only order fulfillment and shipping helpers alongside buyer watchlist tools, and can only be copied from the seller fulfillment empty state. Non-seller Collectors lack a clean, buyer-focused companion script and a place in their settings to copy it with zero manual token configuration. Finally, refreshing a **Store Session Secret** (Cloudflare clearance cookie plus browser User-Agent) for automated crawls requires manually extracting `HttpOnly` cookies and User-Agent strings from browser developer tools.

## Solution

Introduce the **Wantlist Radar** across three tiered Tampermonkey userscripts, backed by persistent per-user radar filter preferences and a dedicated **Wantlist Radar & Browser Companion** section in Settings:

1. **In-Browser Wantlist Radar Overlay**: As a Collector browses MyP Cards, TabletopSorocaba, Brandão Card Game, or Lootcards (on both catalog grids and single-card detail pages), the userscript fetches their weighted **Aggregate Wantlist** and **Staple Deficits** alongside their persistent radar filter preferences. It evaluates every listing on the page, ignores out-of-stock items, and highlights in-stock matches directly on the card tiles with severity badges (`🔴 Hard Shortage`, `🎯 Personal Want`, `🟡 Shared Shortage`, `⚡ Staple Deficit`) showing needed quantities and deck names. An expandable corner pill summarizes the matches on the current page (or shows a compact `🛡️ 0 matches` state), allows clicking any match to smoothly scroll to and pulse that card tile on the page, and provides live filter toggles that persist back to the Collector's profile.
2. **Tiered Collector vs. Seller Userscript Distribution**: In Settings, a new **Wantlist Radar & Browser Companion** section lets any Collector configure their persistent radar filter preferences and click **"Copy My Userscript"**. If **Seller Mode** is enabled, it copies the full Seller userscript (Wantlist Radar + MyP Watchlist Sync + Order Fulfillment & Shipping helpers). If **Seller Mode** is disabled, it copies a clean Collector userscript containing only the Wantlist Radar and MyP Watchlist Sync without order fulfillment code. Both scripts are dynamically pre-seeded with the Collector's application URL and sync token so they work across all supported storefronts immediately upon installation.
3. **Standalone Admin Store Session Secret Exporter**: A separate, operator-only userscript uses Tampermonkey's privileged cookie API (`GM_cookie`) and `navigator.userAgent` on supported storefronts to read `HttpOnly` Cloudflare cookies (`cf_clearance`) and provide one-click JSON copy and `<storeId>.json` download for local **Store Session Secret** files.

## User Stories

1. As a Collector browsing a MyP Cards seller storefront or global Grand Archive catalog, I want in-stock cards that match my **Aggregate Wantlist** highlighted directly on the page, so that I can immediately spot cards I need without cross-referencing my decks manually.
2. As a Collector browsing TabletopSorocaba or Brandão Card Game on LigaStore, I want the **Wantlist Radar** to highlight matching in-stock cards while ignoring out-of-stock listings, so that broken storefront stock filters never mislead me into clicking unavailable cards.
3. As a Collector browsing Lootcards, I want the **Wantlist Radar** to automatically re-evaluate and highlight cards as I paginate or filter the dynamic catalog grid, so that client-side navigation stays annotated without refreshing the browser tab.
4. As a Collector viewing a single card's product detail page on MyP Cards, LigaStore, or Lootcards, I want to see a **Wantlist Radar** badge and pill indicating whether that card is in my **Aggregate Wantlist** or **Staple Deficits** and which Decks need it, so that I know how many copies to buy before adding to cart.
5. As a Collector, I want each matched card decorated with its specific demand weight (`🔴 Hard Shortage`, `🎯 Personal Want`, `🟡 Shared Shortage`, `⚡ Staple Deficit`), needed copy count, and demanding Deck names, so that I can prioritize high-urgency purchases first.
6. As a Collector whose needed card matches multiple categories simultaneously (for example, both a **Hard Shortage** for a constructed Deck and a **Personal Want**), I want all matching badges displayed on the card and sorted by highest priority weight in the radar pill, so that I have complete context on why I need the card.
7. As a Collector, I want a corner radar pill that shows the count of in-stock wantlist matches on the current page and expands on click to list every matched card, so that I can see all hits on a 120-card page at a glance.
8. As a Collector, I want clicking a matched card inside the expanded radar pill to smoothly scroll the page to that exact card tile and briefly pulse its highlight, so that I can jump straight to the listing in a dense grid.
9. As a Collector on a storefront page with zero matching in-stock cards, I want the corner pill to render in a compact muted state (`🛡️ 0 matches`), so that I can confirm the radar is active and still open the pill to adjust my filter toggles.
10. As a Collector, I want to toggle which demand categories (`Hard Shortages`, `Shared Shortages`, `Personal Wants`, `Staple Deficits`) are shown by the **Wantlist Radar**, and have those preferences persisted on my account across devices and storefronts.
11. As a Collector, I want a persistent **"Exact Edition Only"** toggle that restricts radar matches to listings whose set and collector number match my Deck's assigned printing or my Personal Want's specified edition, so that I can hunt for specific printings when desired.
12. As a Collector, I want a persistent **Foil Filter** (`Any Finish`, `Foil Only`, `Non-Foil Only`, or `Respect Personal Want`), so that I can filter storefront highlights to match my finish preferences.
13. As a Collector, I want to toggle my radar filter preferences either from the **Wantlist Radar & Browser Companion** section in Settings or directly inside the expandable corner pill on a storefront page, with changes immediately re-filtering the current page and saving to my profile.
14. As a Collector with **Seller Mode** disabled, I want clicking **"Copy My Userscript"** in Settings to give me a Collector-only userscript containing the **Wantlist Radar** and MyP Watchlist Sync without any seller order fulfillment or shipping code, so that my browser script only contains buyer features relevant to me.
15. As a Collector with **Seller Mode** enabled, I want clicking **"Copy My Userscript"** in Settings to give me the full Seller userscript containing the **Wantlist Radar**, MyP Watchlist Sync, and MyP order fulfillment and shipping confirmation tools, so that I only need a single unified script in Tampermonkey.
16. As a Collector copying my userscript from Settings, I want my application URL and per-user sync token automatically embedded into the copied script and stored in cross-domain userscript storage (`GM_setValue`), so that the **Wantlist Radar** works across MyP Cards, TabletopSorocaba, Brandão Card Game, and Lootcards immediately with zero manual token entry.
17. As a Collector, I want a manual refresh action inside the expandable corner pill that re-fetches my latest **Aggregate Wantlist** from the application, so that collection or deck updates reflect immediately without waiting for cache expiration.
18. As a Collector, I want all new Settings controls, labels, descriptions, and toasts localized in both English (`en`) and Brazilian Portuguese (`pt-BR`), so that the interface respects my selected language.
19. As an operator running local storefront crawls, I want a separate, admin-only Tampermonkey userscript that uses `GM_cookie` and `navigator.userAgent` to extract `HttpOnly` Cloudflare clearance cookies (`cf_clearance`) and my browser User-Agent on supported storefronts, so that I never have to copy cookies manually from DevTools.
20. As an operator using the admin session script, I want a compact bottom-left status badge indicating whether `cf_clearance` is present (`🟢 cf_clearance` vs `🟡 cookies`) with one-click **Copy JSON** and **Download `<storeId>.json`** buttons formatted for the store session loader, so that I can refresh `.secrets/<storeId>.json` in seconds.
21. As a Collector, I want `@grant GM_cookie` strictly excluded from both the Collector and Seller userscripts and isolated to the operator-only admin script, so that regular users are never prompted for browser cookie permissions.
22. As a Collector, I want existing server-side marketplace crawlers, notification pipelines, MyP Watchlist Sync, and MyP order fulfillment workflows to remain completely untouched by this feature, so that no existing functionality regresses.

## Implementation Decisions

- **Persistent Radar Preferences on User Profile**:
  - Extend the user profile schema with six persistent radar configuration fields:
    - `radarShowHard`: boolean, default `true`
    - `radarShowShared`: boolean, default `true`
    - `radarShowPersonalWants`: boolean, default `true`
    - `radarShowStaples`: boolean, default `false`
    - `radarExactEditionOnly`: boolean, default `false`
    - `radarFoilMode`: string enum (`"any"` | `"foil_only"` | `"non_foil_only"` | `"respect_want"`), default `"any"`
  - Expose these fields in the existing user settings read/write contracts and repository layer so they can be managed in Settings alongside existing user preferences.

- **Stateless Cross-Origin Radar API (`/api/watchlist/radar`)**:
  - Provide `GET`, `POST`, and `OPTIONS` handlers with CORS headers permitting cross-origin requests (and `GM_xmlhttpRequest`) from external storefronts.
  - Authenticate requests via the Collector's revocable `watchlistSyncToken` (passed via `Authorization: Bearer <token>`, `x-watchlist-token`, or query/body parameter) or an active web session.
  - `GET` returns:
    - The Collector's current `preferences` (`radarShowHard`, `radarShowShared`, `radarShowPersonalWants`, `radarShowStaples`, `radarExactEditionOnly`, `radarFoilMode`).
    - Normalized `items` representing every card in the Collector's **Aggregate Wantlist** and **Staple Deficits**, where each entry includes `cardSlug`, `cardName`, normalized alphanumeric lookup keys, known `editions` (`editionId`, `setPrefix`, `collectorNumber`), and an array of `reasons` ordered by priority weight:
      1. `hard`: needed quantity (`peakMissing`), demanding deck names, and optional assigned edition IDs.
      2. `personal_want`: desired quantity, optional `editionId`, `setPrefix`, `collectorNumber`, optional `foil` boolean, and optional `targetMaxPrice`.
      3. `shared`: concurrent deficit (`concurrentMissing`), demanding deck names, and optional assigned edition IDs.
      4. `staple`: deficit quantity (`recommendedCopies - ownedCopies`) and primary staple category.
  - `POST` validates partial or full updates to the six radar preference fields using a schema validator, persists them via the user repository, and returns the updated preferences.

- **Settings UI ("Wantlist Radar & Browser Companion")**:
  - Add a dedicated section in Settings visible to all Collectors (regardless of **Seller Mode**).
  - Render controls for the six persistent radar preferences (`Hard Shortages`, `Shared Shortages`, `Personal Wants`, `Staple Deficits`, `Exact Edition Only`, and `Foil Mode`).
  - Render a **"Copy My Userscript"** action that fetches the appropriate userscript template based on `sellerModeEnabled` (full Seller script when enabled, Collector-only script when disabled), injects the Collector's current application origin (`DEFAULT_APP_URL`) and `watchlistSyncToken` into the script bootstrap constants, copies the resulting code to the clipboard, and triggers a localized confirmation toast.
  - Maintain full compile-time and runtime i18n parity across `en` and `pt-BR`.

- **Storefront DOM Extraction & In-Stock Filtering Engine**:
  - Support three **Marketplace Platforms** across catalog grids and single-card detail views:
    - **MyP Cards** (`mypcards.com`): Catalog/seller grid tiles (`div.card`) and product detail views (`/produto/...`). Extract card name, set prefix, collector number (from `grandarchive_<set>_<num>` slug or title), foil marker, price, and stock quantity (`> 0`).
    - **LigaStore** (`tabletoptcg.com.br`, `brandaocardgame.com.br`): Search grid tiles (`div.card-item` on `?view=ecom/itens`) and item detail views (`?view=ecom/item`). Extract card name, collector number `(#...)`, optional set prefix, foil badge (`img[alt="FOIL"]`), and enforce the binary in-stock rule (presence of price container `.price` / `.card-preco` and absence of out-of-stock markers).
    - **Lootcards** (`lootcards.store`): Dynamic catalog grid cards and `/carta/...` detail pages (`CardPurchasePanel` Astro island / rendered DOM). Observe DOM changes via a debounced `MutationObserver` so client-side pagination and filtering re-run radar matching automatically.
  - **Out-of-stock exclusion**: Listings with `quantity === 0` or missing a price block on LigaStore are never highlighted as active matches and do not increment the pill match counter.

- **Matching Rules & Expandable Corner Pill UX**:
  - Match extracted in-stock listings against the cached radar payload using canonical normalized card name and/or `(setPrefix, collectorNumber)`.
  - Apply active filter preferences (`radarShowHard`, `radarShowShared`, `radarShowPersonalWants`, `radarShowStaples`, `radarExactEditionOnly`, `radarFoilMode`, plus `targetMaxPrice` on **Personal Wants** whenever a numeric BRL price is readable in the DOM).
  - When a card matches multiple active reasons, display all matching badges on the card tile and in the pill list, sorted by highest priority weight (`🔴 Hard Shortage` > `🎯 Personal Want` > `🟡 Shared Shortage` > `⚡ Staple Deficit`).
  - Render a floating pill in the bottom-right corner:
    - When matches `> 0`: highlighted state showing total matched cards on the current page. Clicking expands a panel with quick filter toggles, a manual refresh button, and the list of matched cards on the page; clicking any card row smoothly scrolls the card tile into view and triggers a brief visual pulse.
    - When matches `=== 0`: compact muted state (`🛡️ 0 matches`) that still expands on click so the Collector can adjust filter toggles or refresh their wantlist cache.
  - Cache the fetched radar payload in Tampermonkey storage (`GM_setValue` / `GM_getValue`, with `localStorage` fallback) with a 5-minute TTL so navigating across pages is instantaneous.

- **Tiered Userscript Artifacts & Admin Session Exporter Isolation**:
  - **Collector Userscript**: Contains the **Wantlist Radar** engine and MyP Watchlist Sync bridge; omits `/vendas` order scraping, Pick & Pack overlay, and shipping confirmation code. Uses `@grant GM_getValue`, `@grant GM_setValue`, `@grant GM_xmlhttpRequest`, and `@grant window.close`.
  - **Seller Userscript**: Contains everything in the Collector Userscript plus the existing `/vendas` fulfillment scraper, Pick & Pack overlay, and shipping confirmation helpers without altering their existing behavior.
  - **Admin Store Session Secret Exporter**: Stored in the repository scripts directory (outside public web assets). Declares `@grant GM_cookie` and `@grant GM_setClipboard` (or clipboard write). Maps `tabletoptcg.com.br` to `tabletopsorocaba`, `brandaocardgame.com.br` to `brandao`, `mypcards.com` to `myp`, and `lootcards.store` to `lootcards`. Calls `GM_cookie.list` for the current origin, serializes all cookies (`name=value` joined by `; `) alongside `navigator.userAgent` into `{ "cookie": "...", "userAgent": "..." }`, and provides one-click **Copy JSON** and **Download `<storeId>.json`** buttons in a compact bottom-left widget.

## Testing Decisions

- **What makes a good test**: Tests assert observable external behavior at module boundaries — HTTP responses, persisted database state, DOM/HTML extraction outputs, match badge calculation, and rendered component behavior — never internal regex details or private helper state.
- **Seam 1 — Radar API & Settings Persistence (`GET / POST /api/watchlist/radar` & `/api/settings`)**:
  - Test against an in-memory libSQL database (`createTestDb`).
  - Verify token authentication (`watchlistSyncToken`), aggregation of **Hard Shortages**, **Shared Shortages**, **Personal Wants**, and **Staple Deficits** into weighted radar items, default radar preference values, and persistence of preference updates via `POST`.
  - *Prior art*: Watchlist API tests and Settings API route tests.
- **Seam 2 — Storefront DOM Extraction, Radar Matching & Session Secret Formatting**:
  - Test pure extraction, matching, script token injection, and session secret formatting functions against realistic HTML/DOM fixtures for MyP Cards, LigaStore (TabletopSorocaba and Brandão Card Game, including out-of-stock tiles and CSS-sprite price blocks), and Lootcards.
  - Verify multi-reason badge ordering (`🔴 Hard` > `🎯 Personal Want` > `🟡 Shared` > `⚡ Staple`), `exactEditionOnly` filtering, `foilMode` filtering, zero-stock exclusion, Seller vs. Collector script bootstrap injection, and Admin `StoreSession` JSON serialization.
  - *Prior art*: Userscript fulfillment helper tests and LigaStore/MyP parser tests.
- **Seam 3 — Settings UI & i18n Completeness**:
  - Test the **Wantlist Radar & Browser Companion** Settings component: toggling persistent preferences, copying the Seller script when `sellerModeEnabled = true` vs. the Collector script when `sellerModeEnabled = false` with `appUrl` and `watchlistSyncToken` injected, and full `en` / `pt-BR` translation key parity.
  - *Prior art*: Settings MyP section component tests and i18n dictionary parity tests.

## Out of Scope

- Modifying any existing server-side marketplace crawlers, Count Polls, Full Rescans, or Discord/Root notification pipelines.
- Modifying existing MyP Watchlist Sync mutation logic or `/vendas` fulfillment and SuperFrete shipping workflows.
- Automatically solving Cloudflare challenges or automatically uploading `cf_clearance` cookies to remote servers.
- Decoding LigaStore CSS sprite prices on search grids (the radar relies on the binary price-block stock signal on LigaStore list pages and evaluates numeric prices where plain/attribute prices exist).

## Further Notes

- Follows ADR 0011 (compile-time typed `en` and `pt-BR` i18n parity), ADR 0012 (strict layering: database access confined to repositories, thin API routes, max 400 lines per source file), ADR 0027 (binary in-stock price-block rule on LigaStore and `.secrets/<storeId>.json` session format), and ADR 0028 (tiered userscripts and storefront Wantlist Radar architecture).
