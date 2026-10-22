# Spec: Shared Market Notification Delivery Helper

## Metadata

- **Feature slug**: `market-notification-delivery-helper`
- **Status**: TODO (future work; not scheduled)
- **ADR**: [0022 - MyP Marketplace Listing Parity and Notifications](../adr/0022-myp-marketplace-listing-parity-and-notifications.md)

## Context

New-listing notifications (outbox writes + Discord/Root delivery) currently live inside `scripts/sync-market.ts` only. That script is the automated-sync entry point driven by `scripts/sync-daemon.ts`, so the scheduled path is covered.

However, the MyP sync function (`src/services/myp-sync.ts#syncGlobalMarketplace`) is also invoked from other entry points that never notify:

- `src/services/sync-pipeline.ts` (Stage 2b, `runFullSyncPipeline`)
- `POST /api/marketplace/market-sync`
- `POST /api/marketplace/market` (the manual "Sync" button)

Today that asymmetry is intentional (manual/pipeline syncs refresh data without spamming), but it is implicit and easy to break. The notification step should be a single reusable seam so any sync path can opt in consistently.

## Goal

Extract the "detect newly-seen listings → write outbox → deliver" step into a shared helper that every sync entry point can trigger, instead of duplicating it in `scripts/sync-market.ts`.

## Proposed design

- Create `src/services/market-notification-runner.ts` exporting `runMarketNotificationsForStore(storeId, database, options)` that composes:
  - `writeMarketNotifications(storeId, database, options)` (already exists),
  - `deliverDiscordNotifications(database)` (already exists).
- `options` carries the per-store behavior, e.g. `bootstrapIfNeverNotified` (MyP) and any future per-platform flags.
- `scripts/sync-market.ts` delegates to the runner; `runFullSyncPipeline` Stage 2b and the manual API routes may call it behind a flag (off by default, matching today's automated-only behavior).

## Requirements

- **FR1**: A single `runMarketNotificationsForStore` helper SHALL own the outbox-write + delivery step.
- **FR2**: Every sync entry point (`sync-market.ts`, `runFullSyncPipeline`, manual routes) SHALL call the helper rather than reimplementing it.
- **FR3**: The helper SHALL be idempotent across overlapping runs (the outbox + delivery records already deduplicate; keep that guarantee).
- **FR4**: The helper SHALL accept the `bootstrapIfNeverNotified` option so stores with a pre-existing catalog do not flood on first run.
- **FR5**: Manual/pipeline syncs SHALL keep notifications disabled by default (no behavior change), gated by an explicit opt-in.

## Non-goals

- No new delivery channels (Discord/Root only).
- No change to the outbox schema or repository functions.
- No per-user notification preferences in this change.

## References

- [ADR 0022](../adr/0022-myp-marketplace-listing-parity-and-notifications.md)
- [ADR 0016](../adr/0016-root-bot-notifications-and-latest-card-detection.md)
- [ADR 0018](../adr/0018-discord-market-notification-sink.md)
