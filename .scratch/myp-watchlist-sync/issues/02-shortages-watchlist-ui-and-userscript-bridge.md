## Parent

#29 (`docs/myp-watchlist-sync-spec.md`)

## Objective

Surface the Watchlist Ledger status badges, Quota Policy toggles, **Watchlist Sync Action Bar**, and the auditable **Browser Userscript Bridge** (complete with a **Security & Transparency Modal** linking directly to the unminified GitHub source file and `/api/watchlist/confirm` callback) on `/decks?view=shortages`.

## Context

Read [`CONTEXT.md`](../../CONTEXT.md), [`docs/adr/0010-hybrid-myp-watchlist-sync-and-ledger.md`](../../docs/adr/0010-hybrid-myp-watchlist-sync-and-ledger.md), and [`docs/myp-watchlist-sync-spec.md`](../../docs/myp-watchlist-sync-spec.md) before starting.

## Deliverable

1. **Shortages Watchlist UI & Quota Policy Toggles (`src/components/decks/AllShortagesView.tsx`, `src/app/decks/page.tsx`)**:
   - Add **Watchlist Quota Policy** toggles (`Hard` [Default], `Shared`, `Staples`) that persist to `users` and recalculate shortages and queued ledger items.
   - Render per-printing **Watchlist Status Badges** on each Shortage Card (`Watching` in emerald, `Queued Add` / `Queued Update` in amber, `Queued Remove` in rose, and `Ignored on MyP` in muted slate with a 1-click *"Re-enable Watch"* button).
   - Render the **Watchlist Sync Action Bar** summarizing pending mutations (`+X to Watch`, `~Y Qty Updates`, `-Z Filled Quotas to Remove`).
2. **Security & Transparency Modal & Auditable Userscript (`public/scripts/myp-watchlist-sync.user.js`)**:
   - Clicking *"Sync via Browser Bridge"* opens a mandatory **Security & Transparency Modal** before any install or sync redirect:
     - Explains the exact scope (reads `#sync=...` hash payload, uses active `mypcards.com` session + `_csrf`, never reads or transmits passwords or cookies).
     - Displays a direct clickable link to `https://github.com/PedroFabrino/ga-tcg-binder/blob/main/public/scripts/myp-watchlist-sync.user.js` and an inline collapsible source preview.
   - Create `public/scripts/myp-watchlist-sync.user.js` (unminified, readable, zero external dependencies):
     - Runs only on `https://mypcards.com/*` when `#ga_watchlist_sync=...` is present in `window.location.hash`.
     - Displays an on-page confirmation dialog on `mypcards.com` listing the exact cards to add/update/remove before executing `POST` requests with `350ms` pacing.
     - Calls `/api/watchlist/confirm` upon completion to transition confirmed items in `myp_watchlist` to `watching` (or delete confirmed `pending_remove` rows).

## Out of Scope

- Per-user encrypted MyP credentials in `/settings` (covered in Ticket 03).
- Automated server-side FlareSolverr mutation runner (covered in Ticket 04).

## Acceptance Criteria

- [ ] Users can toggle their Watchlist Quota Policy (`Hard`, `Shared`, `Staples`) from `/decks?view=shortages` and immediately see updated deficits and watchlist badges.
- [ ] Cards with `ignored` printings display a *"Re-enable Watch"* action that transitions the row back to `pending_add`.
- [ ] Clicking *"Sync via Browser Bridge"* opens the **Security & Transparency Modal** with the direct GitHub source link (`https://github.com/PedroFabrino/ga-tcg-binder/blob/main/public/scripts/myp-watchlist-sync.user.js`) and inline source preview before launching `mypcards.com`.
- [ ] `POST /api/watchlist/confirm` is authenticated for the current user and transitions confirmed `pending_add` / `pending_update` items to `watching` and deletes confirmed `pending_remove` items, verified by unit/integration tests.
- [ ] `npm test` and `npm run build` pass with zero errors.

## Blocked by

#30
