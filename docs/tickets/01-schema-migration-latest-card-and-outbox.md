# Ticket 1: Database Schema Migration for Latest-Card Detection & Notification Outbox

## Metadata

- **Ticket ID**: 1
- **Feature**: `ligastore-latest-card-detection-and-bot-notifications`
- **Status**: ready-for-agent
- **Blocked by**: None
- **Blocks**: Ticket 2, Ticket 3, Ticket 4

## Summary

Add new columns to `market_stores` and `market_cards`, and create the new `market_notifications` table to support latest-card change detection and the notification outbox pattern.

## Requirements

### Schema Changes

1. **`market_stores` table** — Add columns:
   - `lastLatestCardRefId TEXT` (nullable) — The `refId` of the most recently observed latest card from `txt_order=12&ultimas=1`.
   - `lastNotifiedAt INTEGER` (timestamp, nullable) — When the last notification batch was sent for this store.

2. **`market_cards` table** — Add column:
   - `firstSeenAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))` — When this listing was first observed. Set on INSERT only; MUST NOT be updated on UPSERT.

3. **New table: `market_notifications`**:
   ```sql
   CREATE TABLE market_notifications (
     id TEXT PRIMARY KEY,
     store_id TEXT NOT NULL REFERENCES market_stores(id) ON DELETE CASCADE,
     card_name TEXT NOT NULL,
     set_prefix TEXT NOT NULL,
     collector_number TEXT NOT NULL,
     is_foil INTEGER NOT NULL DEFAULT 0,
     price TEXT NOT NULL,
     ref_id TEXT NOT NULL,
     image_url TEXT,
     detected_at INTEGER NOT NULL,
     sent_at INTEGER,
     message_id TEXT,
     created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
   );
   ```

### Implementation Notes

- Add the Drizzle ORM table definition to [`src/db/schema.ts`](src/db/schema.ts) alongside existing `marketStores` and `marketCards` definitions.
- Export TypeScript types: `MarketNotification`, `InsertMarketNotification`.
- Generate a new Drizzle migration SQL file in `drizzle/`.
- Update [`src/db/repositories/marketplace-repository.ts`](src/db/repositories/marketplace-repository.ts):
  - Add `updateStoreLatestCardRefId(storeId, refId)` function.
  - Add `updateStoreLastNotifiedAt(storeId, notifiedAt)` function.
  - Add `insertMarketNotifications(notifications: InsertMarketNotification[])` function.
  - Add `getPendingNotifications(): Promise<MarketNotification[]>` function.
  - Add `markNotificationsSent(ids: string[], messageId: string, sentAt: Date)` function.
  - Modify `upsertMarketCards()` to preserve `firstSeenAt` on conflict (do not update it).

### Acceptance Criteria

- [ ] `market_stores` has `lastLatestCardRefId` and `lastNotifiedAt` columns.
- [ ] `market_cards` has `firstSeenAt` column with correct default.
- [ ] `market_notifications` table exists with all specified columns and foreign key.
- [ ] Drizzle migration file generated.
- [ ] Repository functions added and exported.
- [ ] `upsertMarketCards` preserves `firstSeenAt` on conflict.
- [ ] All existing tests pass after migration.

## References

- Spec: [`docs/specs/ligastore-latest-card-detection-and-bot-notifications-spec.md`](../../docs/specs/ligastore-latest-card-detection-and-bot-notifications-spec.md) — FR4
- ADR: [`docs/adr/0016-root-bot-notifications-and-latest-card-detection.md`](../../docs/adr/0016-root-bot-notifications-and-latest-card-detection.md)
