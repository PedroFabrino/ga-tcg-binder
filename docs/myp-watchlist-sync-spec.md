# Specification: Managed MyP Watchlist Ledger, Quota-Driven Shortages & Dual Opt-In Sync

**Status:** `ready-for-agent`

## Problem Statement

**Collectors** using MyP Cards' *Quero / Lista de Desejos* (watchlist) to monitor out-of-stock cards and optimize multi-card **Market Vendor** carts across their active Deck **Shortages** currently have to manage their MyP watchlist entirely by hand:

1. **Manual Addition of Multi-Printing Shortages**: When a **Deck** has a **Hard Shortage** (`peakMissing > 0`), **Shared Shortage** (`concurrentMissing > 0`), or **Staple Deficit**, a **Card** may have multiple **Standard Playable Printings** across sets (e.g., `DOA`, `AMB`, `RDO` non-foil reprints)—including `0`-stock Printings not currently listed for sale. Manually searching and adding every non-foil Printing on MyP Cards is tedious and error-prone.
2. **Stale Quantities & Fulfilled Quotas Left on Watchlist**: When a Collector adds copies to their **Binder**, their remaining deficit shrinks (e.g., `3 → 1`) or reaches `0` (filling their **Quota**). Without automated synchronization, fulfilled cards remain on the Collector's MyP watchlist indefinitely, cluttering multi-seller searches and signaling outdated demand.
3. **Risk of Destroying Manually-Watched Collector Printings**: Collectors often manually watch **Collector Printings** (Full Art, Collector Super Rare `CSR`, Curio `CUR`, or Foil cards—such as a Full Art *Zhang Jiao*) on MyP for collection goals. A naive full-mirror sync would either overwrite those entries with standard versions or delete them when the gameplay **Quota** is satisfied.
4. **Authenticated Mutation Constraints & Trust**: Because `mypcards.com` has no public OAuth/REST API and gates mutations behind Cloudflare Turnstile and Yii2 CSRF tokens, Collectors need a secure, transparent choice between hands-off daily automation (using per-user encrypted credentials on their profile) and a zero-credential auditable browser bridge.

## Solution

We introduce a **Managed Watchlist Ledger (`myp_watchlist`)**, **Configurable Quota Policy**, **Standard Playable Printing Resolution**, and **Dual Opt-In Sync Execution** (`ADR-0010`):

1. **Configurable Quota Policy & Shortage Evaluation**:
   - Store per-user **Quota** policy flags on the `users` profile (`watchlistHardShortages = true` by default, with optional toggles for `watchlistSharedShortages` and `watchlistStapleDeficits`), evaluated strictly against active **Binder** holdings (`collection_items`).
   - For each Card below its **Quota**, compute the exact remaining deficit (`missing = quota - binderOwned`).
2. **Standard Playable Printing Expansion & Unfiltered 0-Stock Catalog Discovery**:
   - Expand each Shortage Card into all of its **Standard Playable Printings** (non-foil, base rarities Common through Ultra Rare, excluding **Collector Printings** such as `rarity === 7`, Foil, `CSR`, `CUR`, `Full Art`, or promotional variants).
   - For any **Standard Playable Printing** lacking a cached `mypProductUrl` / `mypItemId` in `myp_market_cards` (because it currently has `0` copies for sale), query MyP's unfiltered catalog (`/grandarchive?ProdutoSearch[nome]=<cardName>`) during sync to discover and cache its MyP product metadata.
3. **Managed Watchlist Ledger (`myp_watchlist`) & Two-Way Reconciliation**:
   - Crawl the Collector's public MyP *Quero* list (`https://mypcards.com/<username>/grandarchive?ProdutoSearch[exibirSomenteCompra]=1`) during Personal Store Sync to reconcile live state:
     - **Adopt**: If a **Standard Playable Printing** of an active Shortage Card is already on the Collector's MyP *Quero* list, link it into `myp_watchlist` as `watching`.
     - **Protect Collector Printings**: Never adopt, mutate, or remove any **Collector Printing** (Full Art, CSR, Curio, Foil) or non-shortage card on the Collector's MyP *Quero* list.
     - **Respect Manual Unwatch**: If an entry was previously `watching` in `myp_watchlist` and is still in Shortage, but the Collector manually deleted it on MyP, transition it to `ignored` (with a 1-click *"Re-enable Watch"* action in the UI) rather than re-adding it behind their back.
   - **Batched State Transitions**:
     - New shortage Printing $\rightarrow$ `pending_add` with `wantedQuantity = missing`, Condition `NM`, Language `EN`, Finish `Normal`, and Target Price set to **Preço TCG Player** (falling back to `marketLowestPrice`, then `R$ 1,00`).
     - Partial progress in Binder (e.g., `missing` drops `3 → 1`) $\rightarrow$ `pending_update` with `wantedQuantity = 1`.
     - **Quota** filled in Binder (`missing === 0`) $\rightarrow$ `pending_remove` across **all** managed **Standard Playable Printings** of that Card.
4. **Dual Opt-In Authenticated Execution Modes**:
   - **Mode 1 — Per-User Automated Pipeline Mode (Settings Opt-In)**: Collectors can optionally save their MyP login and password on their own `users` profile row in Turso via `/settings`, encrypted at rest using **AES-256-GCM** (keyed by `AUTH_SECRET`), with a 1-click *"Clear Saved Credentials"* button. During Stage 2d of the sequential sync pipeline (or manual *"Sync Now"*), the runner decrypts each opted-in user's credentials in memory, authenticates an isolated FlareSolverr session for that user, and executes their queued `pending_add` / `pending_update` / `pending_remove` mutations.
   - **Mode 2 — Auditable Browser Userscript Bridge (Zero-Credential Mode)**: For Collectors who prefer not to store credentials, provide an explicit **Security & Transparency Modal** in `/decks?view=shortages` with a direct link to the unminified source file on GitHub (`public/scripts/myp-watchlist-sync.user.js`) + inline code preview and consent checkbox. On `mypcards.com`, the script displays a confirmation banner listing the exact queued additions, quantity updates, and removals before executing same-origin `POST` requests.

---

## User Stories

1. As a Collector viewing `/decks?view=shortages`, I want to configure my **Quota** policy with checkboxes for **Hard Shortages** (enabled by default), **Shared Shortages**, and **Staple Deficits**, so that I control which deficits are automatically tracked on my MyP watchlist.
2. As a Collector, I want my **Quota** evaluated against my active **Binder** holdings (`collection_items`), so that a card is only considered fulfilled once the copies are physically in my playable Binder.
3. As a Collector, when a Card is below my **Quota**, I want the system to watch all of its **Standard Playable Printings** (non-foil, Common through Ultra Rare across all set releases), so that I catch available copies or multi-vendor cart matches regardless of which set reprint a seller lists.
4. As a Collector, when a **Standard Playable Printing** of a Shortage Card currently has `0` copies for sale on MyP (and is therefore absent from `myp_market_cards`), I want the sync pipeline to look up the card on MyP's unfiltered catalog (`/grandarchive?ProdutoSearch[nome]=<cardName>`), so that out-of-stock printings can still be added to my MyP watchlist.
5. As a Collector who manually watches a **Collector Printing** (such as a Full Art *Zhang Jiao*, a CSR, a Curio, or a Foil printing) on MyP because I love the art, I want the automated watchlist sync to still add and manage the normal non-foil **Standard Playable Printing(s)** for my deck shortage while never modifying or removing my watched **Collector Printing**.
6. As a Collector who manually added a non-deck collectible card to my MyP watchlist, I want the system's **Watchlist Ledger** (`myp_watchlist`) to only remove entries that it manages, so that my personal collector wantlist is never wiped.
7. As a Collector, when the sync pipeline crawls my public MyP *Quero* list (`exibirSomenteCompra=1`) and finds a **Standard Playable Printing** of an active Shortage Card already watched, I want it automatically adopted into my **Watchlist Ledger** as `watching`, so that it isn't added twice and will be automatically removed once I fill my **Quota**.
8. As a Collector, if I manually delete a managed **Standard Playable Printing** directly on `mypcards.com` while the card is still in Shortage, I want the reconciliation pass to mark that entry as `ignored` in my **Watchlist Ledger** rather than stubbornly re-adding it on the next sync, while giving me a 1-click *"Re-enable Watch"* button in `ga-tcg-binder`.
9. As a Collector, when a new **Watchlist Entry** is created on MyP, I want its default attributes set to Condition `NM`, Language `EN` (Inglês), Finish `Normal` (Non-Foil), Quantity equal to my remaining deficit (`missing`), and Target Price set to its **Preço TCG Player** (or lowest active MyP market price, falling back to `R$ 1,00`), so that my *Quero* list reflects realistic benchmark pricing.
10. As a Collector, when I add copies of a Shortage Card to my **Binder** that partially reduce my deficit (e.g., from `3` missing down to `1` missing), I want my **Watchlist Ledger** to queue a `pending_update` (`wantedQuantity = 1`) for the next daily or manual sync rather than firing live MyP HTTP requests on every Binder click, so that MyP receives polite, consolidated batch updates.
11. As a Collector, when my **Binder** holdings for a Card reach or exceed my **Quota** (`missing === 0`), I want **all** managed **Standard Playable Printings** of that Card transitioned to `pending_remove` and automatically deleted from my MyP watchlist on the next sync.
12. As a Collector viewing `/decks?view=shortages`, I want to see a **Watchlist Sync** status bar showing my queued changes (`+X to Watch · ~Y Qty Updates · -Z Fulfilled to Remove`) and per-card watchlist badges (`Watching on MyP`, `Pending Add`, `Pending Qty Update`, `Quota Filled · Pending Removal`, or `Ignored`) right on each shortage row.
13. As a Collector who wants hands-off daily automation, I want an opt-in section in `/settings` where I can save my MyP login and password on my `users` profile in Turso, encrypted at rest with **AES-256-GCM**, so that the daily sync pipeline can apply my watchlist changes automatically under my own MyP account.
14. As a Collector saving my MyP credentials in `/settings`, I want to see a clear explanation of how my password is encrypted (`AES-256-GCM`) and used, along with a 1-click **"Clear Saved Credentials"** button that permanently wipes them from my profile.
15. As a Collector who prefers not to save my MyP password, I want an auditable **Browser Userscript Bridge** option in `/decks?view=shortages` gated by an explicit **Security & Transparency Modal** that links directly to the unminified script on GitHub (`public/scripts/myp-watchlist-sync.user.js`) and renders the code inline for review before I enable it.
16. As a Collector using the **Browser Userscript Bridge** on `mypcards.com`, I want the script to display an on-screen confirmation banner listing the exact cards to add, update, or remove and wait for me to click **"Confirm & Apply"** before sending any `POST` requests to MyP.

---

## Implementation Decisions

### 1. Schema Evolution (`users` Settings & `myp_watchlist` Ledger)
We extend `users` with per-user **Quota** policy and encrypted credential columns, create a `myp_product_catalog` cache (or extend `myp_market_cards` / catalog mapping) for `0`-stock MyP product URLs, and create the `myp_watchlist` ledger table:

```typescript
// Additions to `users` table
interface UserWatchlistSettings {
  mypUsername: string | null;
  mypLogin: string | null;                 // Optional MyP login/email for automated sync
  mypPasswordEncrypted: string | null;     // AES-256-GCM encrypted payload (iv:authTag:ciphertext)
  mypAutoWatchlistEnabled: boolean;        // Opt-in toggle for headless pipeline mutations
  watchlistSyncToken: string | null;       // Revocable per-user token for Browser Userscript Bridge
  watchlistPolicyHard: boolean;            // Default: true (peakMissing > 0)
  watchlistPolicyShared: boolean;          // Default: false (concurrentMissing > 0)
  watchlistPolicyStaples: boolean;         // Default: false (binderOwned < stapleRecommendedCopies)
}

export type WatchlistStatus =
  | "pending_add"
  | "watching"
  | "pending_update"
  | "pending_remove"
  | "removed"
  | "ignored";

// New `myp_watchlist` table
interface MypWatchlistRecord {
  id: string;                              // Deterministic or UUID primary key
  userId: string;                          // References users.id (cascade delete)
  cardSlug: string;                        // References cards.slug
  editionId: string | null;                // References card_editions.id
  cardName: string;
  setPrefix: string;
  mypItemId: string | null;                // e.g. "grandarchive_doa_045"
  mypProductUrl: string | null;            // e.g. "https://mypcards.com/grandarchive/produto/..."
  mypWishlistItemId: string | null;        // External MyP row/offer ID on the user's Quero list for updates/deletes
  wantedQuantity: number;                  // Target deficit quantity (1..4)
  syncedQuantity: number | null;           // Last confirmed quantity on MyP
  targetPriceBrl: number;                  // tcgPriceNumeric -> marketLowestPriceBrl -> 1.00
  targetPriceStr: string;                  // e.g. "R$ 12,50"
  isCollectorPrinting: boolean;            // Always false for managed rows
  status: WatchlistStatus;
  lastError: string | null;
  updatedAt: number;                       // Unix epoch seconds
}
```

### 2. Standard Playable Printing Filter & Unfiltered Catalog Lookup
- **Standard Playable Printing Predicate (`isStandardPlayablePrinting`)**:
  - A catalog `card_edition` or MyP product is classified as a **Standard Playable Printing** if and only if:
    1. `isFoil === false`
    2. `rarity <= 5` (Common `1` through Ultra Rare `5`; excludes Collector Rarity `7`)
    3. Its name/collector number does not carry special collector tags (`(CSR)`, `(CUR)`, `(CPR)`, `(Full Art)`, `(Extended Art)`, `(Foil)`, `(Judge)`).
- **Unfiltered MyP Product Discovery (`discoverMypProductPrintings`)**:
  - When computing the watchlist diff for a Shortage Card, if any of its **Standard Playable Printings** lacks a known `mypProductUrl`, query `https://mypcards.com/grandarchive?ProdutoSearch%5Bnome%5D=${encodeURIComponent(cardName)}` (without `exibirSomenteVenda=1`).
  - Parse the returned `.card` tiles via `parseMypHtml`, filter to non-foil **Standard Playable Printings** matching the Card, and cache their `mypItemId` and `mypProductUrl`.

### 3. Two-Way Public Reconciliation & State Machine (`reconcileUserWatchlist`)
- **Step 1 — Read Live Public *Quero* List**:
  - Fetch `https://mypcards.com/${encodeURIComponent(username)}/grandarchive?ProdutoSearch%5BexibirSomenteCompra%5D=1` (and paginate via `/usuario/load-more?nick=...&marca=grandarchive&exibirSomenteCompra=1`).
  - Parse live *Quero* items, ignoring any **Collector Printings** (`isFoil === true` or special tags).
- **Step 2 — Evaluate Active Quota Per Card**:
  - For the user's active `watchlistPolicy` (`Hard`, `Shared`, `Staples`), compute `quota` per `cardSlug` and compare against `binderOwned` (`collection_items` quantity for `cardSlug`):
    - `missing = Math.max(0, quota - binderOwned)`.
- **Step 3 — Reconcile Ledger Transitions**:
  - If `missing > 0`:
    - For each **Standard Playable Printing** of `cardSlug`:
      - If present on the live MyP *Quero* list and not yet in `myp_watchlist`: insert as `status = "watching"` (or `"pending_update"` if live quantity $\neq$ `missing`).
      - If previously `status = "watching"` in `myp_watchlist`, but absent from the live MyP *Quero* list: transition to `status = "ignored"` (respecting manual deletion on MyP).
      - If `status = "ignored"`: keep `"ignored"` unless user explicitly triggers *"Re-enable Watch"*.
      - If not on live MyP *Quero* list and not `"ignored"`: set `status = "pending_add"`, `wantedQuantity = missing`, and `targetPriceBrl = tcgPriceNumeric ?? marketLowestPriceBrl ?? 1.00`.
      - If currently `status = "watching"` and `syncedQuantity !== missing`: transition to `status = "pending_update"` with `wantedQuantity = missing`.
  - If `missing === 0` (Quota filled in Binder):
    - For all rows of `cardSlug` in `myp_watchlist` where `status` is `"watching"`, `"pending_add"`, or `"pending_update"`:
      - If already on live MyP (`"watching"` or `"pending_update"`): transition to `status = "pending_remove"`.
      - If never pushed to MyP (`"pending_add"`): transition directly to `status = "removed"`.

### 4. Dual Execution Surfaces (AES-256-GCM Pipeline & Auditable Browser Bridge)
- **AES-256-GCM Credential Encryption (`src/lib/crypto.ts`)**:
  - Uses Node `crypto` (`aes-256-gcm`) with a 32-byte key derived via `scryptSync` / `sha256` from `process.env.AUTH_SECRET`.
  - Encrypts plaintext password into `ivHex:authTagHex:cipherHex` before writing to `users.myp_password_encrypted`. Never returns the password or ciphertext in any `GET` API response (only `hasSavedMypCredentials: boolean`).
- **Stage 2d — Automated Pipeline Watchlist Execution (`executeAutomatedWatchlistSync`)**:
  - For each user where `mypAutoWatchlistEnabled === true` and `mypPasswordEncrypted` is present:
    1. Reconciles their `myp_watchlist` ledger (`reconcileUserWatchlist`).
    2. If there are `pending_add`, `pending_update`, or `pending_remove` items, decrypts the user's MyP password in memory, creates an isolated FlareSolverr session (or authenticated cookie jar), logs into `mypcards.com`, applies the queued mutations, and updates `myp_watchlist` rows to `watching` (with `syncedQuantity = wantedQuantity`) or `removed`.
- **Browser Userscript Bridge (`public/scripts/myp-watchlist-sync.user.js` & API Endpoints)**:
  - `GET /api/marketplace/watchlist`: Returns the Collector's `myp_watchlist` ledger, policy settings, summary counts (`pendingAddCount`, `pendingUpdateCount`, `pendingRemoveCount`, `watchingCount`), and `hasSavedMypCredentials`.
  - `POST /api/marketplace/watchlist`: Updates policy flags, toggles `ignored` status back to `pending_add`, or triggers an on-demand reconciliation/sync.
  - `GET /api/marketplace/watchlist/bridge?token=<watchlistSyncToken>`: CORS-enabled endpoint returning the queued `pending_add`, `pending_update`, and `pending_remove` items for the authenticated token.
  - `POST /api/marketplace/watchlist/bridge`: Marks executed item IDs as `watching` or `removed`.

---

## Testing Decisions

### Primary Testing Seam
We test at the **Service Boundary Seam** (`watchlist`, `marketplace`, `shortage`, and `sync-pipeline` services backed by an in-memory SQLite/LibSQL test database and injected mock `fetch` fixtures), plus unit verification of the `AES-256-GCM` credential encryption module:
- **Why this seam**: It tests the entire domain lifecycle—from Binder changes and Quota policy toggles, through unfiltered 0-stock MyP HTML parsing, Collector Printing isolation, two-way *Quero* reconciliation, and state machine transitions (`pending_add` $\rightarrow$ `watching` $\rightarrow$ `pending_update` $\rightarrow$ `pending_remove` $\rightarrow$ `removed`)—without requiring live network calls to `mypcards.com`.

### What Makes a Good Test
- Tests assert observable domain outcomes rather than internal implementation details:
  1. **Standard Playable vs. Collector Printing Isolation**: Given a Shortage Card with `DOA` Non-Foil, `ALC` Non-Foil, `DOA` Foil, and `CSR` Full Art printings—and an existing Full Art *Zhang Jiao* on the user's live MyP *Quero* list—reconciliation queues `pending_add` only for the non-foil **Standard Playable Printings** and never adopts, modifies, or removes the Full Art or Foil **Collector Printings**.
  2. **0-Stock Unfiltered Catalog Discovery**: When a Shortage Printing is absent from `myp_market_cards`, the service queries the unfiltered MyP search fixture and resolves its `mypItemId` and `mypProductUrl`.
  3. **Partial Progress & Full Quota Removal (`3 → 1 → Remove`)**: Starting with `quota = 4, binderOwned = 1` (`pending_add` with `wantedQuantity = 3`), adding 2 copies to the Binder transitions the entry to `pending_update` (`wantedQuantity = 1`), and adding the 4th copy transitions all managed **Standard Playable Printings** of that Card to `pending_remove`.
  4. **Two-Way Reconciliation & Manual Unwatch (`ignored`)**: If a `watching` entry disappears from the live MyP *Quero* HTML while `missing > 0`, it transitions to `ignored` and is not re-added until explicitly re-enabled.
  5. **Per-User AES-256-GCM Credential Isolation**: Passwords saved via settings are encrypted with random IVs, round-trip cleanly on decryption, fail on tampered auth tags, and can be wiped cleanly.

### Prior Art
- Existing service-seam tests in `src/services/marketplace.test.ts`, `src/services/shortage.test.ts`, and `src/services/sync-pipeline.test.ts`.

---

## Out of Scope
- Automatically placing paid purchase orders or checking out shopping carts on MyP Cards (the system only manages the Collector's *Quero / Lista de Desejos* watchlist).
- Modifying or pruning non-Grand Archive TCG items (e.g., Magic, Pokémon, Yu-Gi-Oh!) on the Collector's MyP account.

---

## Further Notes
- Reference architecture decision: [`docs/adr/0010-hybrid-myp-watchlist-sync-and-ledger.md`](adr/0010-hybrid-myp-watchlist-sync-and-ledger.md).
- Domain vocabulary definitions: [`CONTEXT.md`](../CONTEXT.md).
