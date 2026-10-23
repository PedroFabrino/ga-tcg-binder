# 0010: Managed MyP Watchlist Ledger and Dual Opt-In Sync Execution

Status: accepted

## Context
Collectors use MyP Cards' *Quero / Lista de Desejos* (watchlist) to monitor out-of-stock cards and optimize multi-card vendor carts across their active Deck Shortages. However, `mypcards.com` has no public OAuth or REST API and protects authenticated write operations (`POST` add, quantity update, and removal) behind Cloudflare Turnstile and Yii2 session CSRF tokens. Furthermore, Collectors often watch high-rarity **Collector Printings** (Full Art, CSR, Curio, Foil) manually on MyP for personal collection goals, which would be destructively wiped if a naive full-mirror sync pruned every card whose gameplay shortage reached zero.

## Decision
1. **Managed Watchlist Ledger (`myp_watchlist`) & Standard Playable Printing Isolation**:
   - Maintain a per-user `myp_watchlist` table in Turso tracking `card_slug`, `edition_id`, `myp_item_id`, `myp_product_url`, `wanted_quantity`, and `status` (`pending_add`, `watching`, `pending_update`, `pending_remove`, `removed`, `ignored`).
   - Configurable per-user **Quota** policy on `users` (defaulting to **Hard Shortages** `peakMissing > 0`, with optional toggles for **Shared Shortages** `concurrentMissing > 0` and **Staple Deficits**), evaluated against active **Binder** holdings (`collection_items`).
   - Expand each Shortage Card into all of its **Standard Playable Printings** (non-foil, base rarities Common–Ultra Rare), querying MyP's unfiltered catalog (`/grandarchive?ProdutoSearch[nome]=<cardName>`) to resolve product IDs even for `0`-stock printings.
   - Strictly ignore **Collector Printings** (Foil, CSR, Curio, Full Art) and manually-added non-shortage cards. When a Card's Binder holdings satisfy its **Quota** (`missing === 0`), transition all of its managed **Standard Playable Printings** to `pending_remove`.

2. **Two-Way Public Reconciliation & Batched Daily Diffs**:
   - During Personal Store Sync, crawl the Collector's public MyP *Quero* list (`exibirSomenteCompra=1`) to adopt already-watched **Standard Playable Printings** into the ledger and mark manually deleted entries as `ignored` rather than re-adding them without consent.
   - Batch quantity updates (e.g., deficit dropping `3 → 1`) and removals (`missing === 0`) into the daily sync pipeline (or manual *"Sync Now"* trigger) rather than firing live MyP HTTP requests on every Binder `+1/-1` click.
   - Populate new *Quero* entries with Condition `NM`, Language `EN`, Finish `Normal`, Quantity `missing`, and Target Price set to **Preço TCG Player** (falling back to `marketLowestPrice`, then `R$ 1,00`).

3. **Dual Opt-In Authenticated Execution Modes**:
   - **Per-User Automated Pipeline Mode (Settings Opt-In)**: Collectors may save their MyP login and password on their own `users` profile row in Turso via `/settings`, encrypted at rest using **AES-256-GCM** (keyed by the server's `AUTH_SECRET` environment key). During the daily sync pipeline, the runner decrypts each opted-in user's credentials in memory, authenticates an isolated FlareSolverr session per user, and applies their queued watchlist mutations.
   - **Auditable Browser Userscript Bridge (Zero-Credential Mode)**: For Collectors who prefer not to store credentials, provide an explicit Consent Modal linking directly to the unminified source script in the repository (`public/scripts/myp-watchlist-sync.user.js`) with an on-site confirmation prompt on `mypcards.com` that executes queued mutations using the Collector's local browser session. The queue travels to the script as a URL-hash payload (`#ga_watchlist_sync=…`) and is confirmed back through `POST /api/watchlist/confirm` (authenticated by the per-user `watchlistSyncToken`); there is no server-side `bridge` endpoint.

## Consequences
- Preserves multi-tenant isolation in Turso: each opted-in Collector's watchlist mutations execute under their own isolated MyP account, while passwords remain AES-256-GCM encrypted at rest.
- Protects manually-watched **Collector Printings** (such as Full Art or CSR cards) while ensuring all **Standard Playable Printings** of a Shortage Card are automatically watched—even at `0` market stock—and cleaned up once the Collector's **Quota** is met.
