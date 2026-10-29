# 0028: Storefront Wantlist Radar and Tiered Browser Userscripts

Status: accepted

## Context

Collectors manually browse external Grand Archive storefronts — MyP Cards (`mypcards.com`), LigaStore storefronts (`tabletoptcg.com.br`, `brandaocardgame.com.br`), and Lootcards (`lootcards.store`) — and need immediate on-page visibility into which in-stock listings match their **Aggregate Wantlist** (**Hard Shortages**, **Shared Shortages**, **Personal Wants**) or **Staple Deficits**.

Previously, the repository shipped a single userscript (`public/scripts/myp-watchlist-sync.user.js`) scoped exclusively to `mypcards.com` that bundled both buyer watchlist synchronization and seller-only `/vendas` order fulfillment. Meanwhile, refreshing Cloudflare `cf_clearance` session secrets (`.secrets/<storeId>.json`) for server-side `curl-impersonate` crawls (ADR 0027) required manually inspecting `HttpOnly` cookies and `User-Agent` strings in browser DevTools.

## Decision

1. **Three Tiered Userscripts by Capability & Role**:
   - **Collector Userscript (`public/scripts/ga-collector-radar.user.js`)**: Served to Collectors without **Vendor Capability** (`sellerModeEnabled = false`). Includes the cross-store **Wantlist Radar** (`mypcards.com`, `tabletoptcg.com.br`, `brandaocardgame.com.br`, `lootcards.store`) and the MyP *Quero* Watchlist Sync bridge, omitting all `/vendas` order fulfillment and shipping code.
   - **Seller Userscript (`public/scripts/myp-watchlist-sync.user.js`)**: Served to Collectors with `sellerModeEnabled = true` from the **Wantlist Radar & Browser Companion** section on `/settings`. Includes the full **Wantlist Radar**, MyP Watchlist Sync bridge, `/vendas` Pick & Pack fulfillment assistant, and shipping confirmation helpers.
   - **Admin Session Secret Exporter (`scripts/tampermonkey/ga-admin-session-secret.user.js`)**: A separate operator-only userscript stored outside `public/` that uses `@grant GM_cookie` to read `HttpOnly` Cloudflare cookies (`cf_clearance`) and `navigator.userAgent`, providing 1-click JSON copy and `<storeId>.json` download (`tabletopsorocaba.json`, `brandao.json`, `myp.json`, `lootcards.json`). Isolating `@grant GM_cookie` in this admin script keeps Collector and Seller scripts free of privileged cookie-reading permissions.

2. **Cross-Domain Wantlist Radar & Persistent Per-User Preferences**:
   - When a Collector clicks **"Copy My Userscript"** in `/settings`, the client injects their `DEFAULT_APP_URL` and `watchlistSyncToken` into the copied script, which persists them in Tampermonkey's cross-domain storage (`GM_setValue` / `GM_getValue`) and fetches `/api/watchlist/radar` via `GM_xmlhttpRequest`.
   - Per-user radar filter preferences (`radarShowHard`, `radarShowShared`, `radarShowPersonalWants`, `radarShowStaples`, `radarExactEditionOnly`, `radarFoilMode`) are persisted on `users` and synchronized between `/settings` and the on-page expandable corner pill.
   - On storefront grids and single-card detail pages (observed via debounced `MutationObserver` for dynamic views like Lootcards), only **in-stock** listings (`quantity >= 1` / active price block) trigger highlights and count toward the expandable jump-list pill; zero-match pages render a compact muted pill (`🛡️ 0 matches`) so filter controls remain accessible.

## Consequences

- Non-seller Collectors receive an auditable, buyer-focused script without seller fulfillment bloat, while Sellers retain a single unified script.
- Regular Collectors are never prompted for `GM_cookie` permissions; operator session secret extraction is isolated to the local admin script.
- Existing server-side market crawlers and fulfillment pipelines remain untouched.
