## Parent

#18

## What to build

An automated background synchronization workflow in GitHub Actions (running every 6 hours and on manual dispatch) plus a standalone `pnpm sync:market` CLI script that refreshes the global MyP Grand Archive Market Listings snapshot safely without manual user intervention.

## Acceptance criteria

- [ ] `/api/marketplace/market-sync` authenticates requests via `Authorization: Bearer <CRON_SECRET>` or an active user session and executes the global Market Sync pipeline.
- [ ] A standalone CLI command `pnpm sync:market` executes the global Market Sync directly and logs total synced printings, matched catalog cards, and execution time.
- [ ] A GitHub Actions workflow (`.github/workflows/market-sync.yml`) runs every 6 hours (`0 */6 * * *`) and supports manual `workflow_dispatch`, triggering the market sync and reporting status clearly in workflow logs.

## Blocked by

- #20
