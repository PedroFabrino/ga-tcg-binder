## Parent

#29 (`docs/myp-watchlist-sync-spec.md`)

## Objective

Build the Stage 2d Automated Pipeline Watchlist Mutation Runner (`src/services/watchlist-sync-runner.ts`) that decrypts each opted-in user's MyP credentials in memory, authenticates an isolated FlareSolverr session per user, executes queued `pending_add`, `pending_update`, and `pending_remove` mutations on `mypcards.com`, and updates the user's `myp_watchlist` ledger.

## Context

Read [`CONTEXT.md`](../../CONTEXT.md), [`docs/adr/0010-hybrid-myp-watchlist-sync-and-ledger.md`](../../docs/adr/0010-hybrid-myp-watchlist-sync-and-ledger.md), and [`docs/myp-watchlist-sync-spec.md`](../../docs/myp-watchlist-sync-spec.md) before starting.

## Deliverable

1. **Automated Watchlist Mutation Runner (`src/services/watchlist-sync-runner.ts`)**:
   - Implement `executeAutomatedWatchlistSync(userId, deps)`:
     - Checks that the user has `myp_login` and `myp_password_encrypted` saved and at least one pending row (`pending_add`, `pending_update`, or `pending_remove`) in `myp_watchlist`.
     - Decrypts `myp_password_encrypted` in memory via `decryptMypPassword`.
     - Creates an isolated FlareSolverr session (`sessions.create`), logs into `mypcards.com/site/login` as that specific user, extracts the session `_csrf` token, and executes each queued mutation (`pending_add` with `NM`, `EN`, `Normal`, `target_quantity`, `target_price_brl`; `pending_update` with the updated `target_quantity`; `pending_remove` removing the item from the user's *Quero* list) with `500ms` pacing between requests.
     - Transitions completed `pending_add` and `pending_update` rows to `watching`, deletes completed `pending_remove` rows from `myp_watchlist`, and always destroys the temporary FlareSolverr session (`sessions.destroy`) in a `finally` block.
2. **Pipeline & Manual Trigger Integration (`src/services/sync-pipeline.ts`, `src/app/actions.ts`, `src/components/decks/AllShortagesView.tsx`)**:
   - Wire `executeAutomatedWatchlistSync` into Stage 2d of `runSyncPipeline()` for all users with saved credentials and pending mutations.
   - Expose a *"Sync Watchlist Now"* server action and button in `AllShortagesView.tsx` for opted-in users so they can trigger an on-demand server sync in addition to the daily pipeline.

## Out of Scope

- Modifying the public *Quero* reconciliation algorithm (covered in Ticket 01).
- Modifying the Browser Userscript Bridge (covered in Ticket 02).

## Acceptance Criteria

- [ ] Integration tests in `src/services/__tests__/watchlist-sync-runner.test.ts` (using an injected mock FlareSolverr session transport) verify:
  - Only users with both `myp_login` and `myp_password_encrypted` and pending `myp_watchlist` entries trigger a FlareSolverr session.
  - Each user's sync runs in an isolated FlareSolverr session that is always destroyed (`sessions.destroy`), even if a mutation fails.
  - `pending_add` sends the expected *Quero* creation request (`NM`, `EN`, `Normal`, `target_quantity`, `target_price_brl`) and transitions the row to `watching`.
  - `pending_update` updates the watched quantity to `target_quantity` and transitions the row to `watching`.
  - `pending_remove` removes the watched printing from *Quero* and deletes the row from `myp_watchlist`.
  - Never touches Collector Printings or `ignored` rows.
- [ ] `npm test` and `npm run build` pass with zero errors.

## Blocked by

- #30
- #32
