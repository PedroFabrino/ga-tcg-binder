## Parent

#23

## What to build

Build the unified sequential synchronization pipeline (`POST /api/sync/pipeline`, `pnpm sync:pipeline` CLI script, and `.github/workflows/daily-sync-pipeline.yml` scheduled at `0 8 * * *` UTC) that executes all data ingestion stages in strict dependency order: **Stage 0 (Card Catalog Check)** $\rightarrow$ **Stage 1 (Meta Staples Sync)** $\rightarrow$ **Stage 2a (Personal MyP Store Sync for all users with a configured `myp_username`)** $\rightarrow$ **Stage 2b (Global MyP Market Sync)** $\rightarrow$ **Stage 3 (Meta Archetypes & Canonical Decklists Sync)**. Ensure fault isolation so a failure in any single stage preserves that stage's existing cached snapshot and reports per-stage status without aborting or corrupting the remaining stages.

## Acceptance criteria

- [ ] `runFullSyncPipeline` executes **Meta Staples Sync** $\rightarrow$ **Personal MyP Store Sync** $\rightarrow$ **Global MyP Market Sync** $\rightarrow$ **Meta Archetypes & Canonical Decklists Sync** sequentially, returning a structured summary of items synced, duration, and status per stage.
- [ ] `POST /api/sync/pipeline` requires either an authenticated user session or `Authorization: Bearer <CRON_SECRET>`, runs the sequential pipeline, and returns the per-stage execution report.
- [ ] Running `pnpm sync:pipeline` executes the full sequential pipeline from the command line with progress logging.
- [ ] `.github/workflows/daily-sync-pipeline.yml` triggers daily at `0 8 * * *` UTC and supports manual `workflow_dispatch`.
- [ ] If an individual stage fails (e.g. upstream timeout), its existing cached rows are preserved and subsequent stages still execute cleanly.
- [ ] Service-seam tests verify the exact stage execution order and fault-isolated continuation when an upstream stage throws an error.

## Blocked by

- #25
- #27
- #22
