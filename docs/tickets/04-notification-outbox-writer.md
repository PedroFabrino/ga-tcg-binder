# Ticket 4: Notification Outbox Writer in Sync Pipeline

## Metadata

- **Ticket ID**: 4
- **Feature**: `ligastore-latest-card-detection-and-bot-notifications`
- **Status**: ready-for-agent
- **Blocked by**: Ticket 1 (schema), Ticket 3 (dual detection triggers sync)
- **Blocks**: Ticket 5

## Summary

After a full LigaStore sync completes, write newly detected cards to the `market_notifications` outbox table so the bot can pick them up.

## Requirements

### Outbox Writer Service

1. Create a new service function `writeMarketNotifications()` in a new file [`src/services/market-notifications.ts`](src/services/market-notifications.ts) (or add to an existing service if it fits within 400 lines).

2. The function SHALL:
   - Accept `storeId: string` and optional `database` parameter.
   - Query `marketStores` for the store's `lastNotifiedAt`.
   - Query `marketCards` for rows where `storeId = ? AND firstSeenAt > ?` (using `lastNotifiedAt`, or all cards if `lastNotifiedAt IS NULL`).
   - For each matching card, create an `InsertMarketNotification` row with:
     - `id`: UUID (use `crypto.randomUUID()`)
     - `storeId`
     - `cardName`
     - `setPrefix`
     - `collectorNumber`
     - `isFoil`
     - `price`
     - `refId` (from `marketCards.itemId` or equivalent)
     - `imageUrl`
     - `detectedAt`: current timestamp
   - Insert all rows via `insertMarketNotifications()`.
   - Update `marketStores.lastNotifiedAt` to now via `updateStoreLastNotifiedAt()`.
   - Return the count of notifications written.

3. If zero new cards are found, SHALL NOT update `lastNotifiedAt` and SHALL return 0.

### Integration into Sync Pipeline

4. In [`scripts/sync-market.ts`](scripts/sync-market.ts), after a successful LigaStore sync (`syncLigaStore()`), call `writeMarketNotifications(store.id)`.

5. In [`src/services/sync-pipeline.ts`](src/services/sync-pipeline.ts), if the pipeline includes LigaStore sync stages, call `writeMarketNotifications()` after each LigaStore sync stage completes successfully.

6. The outbox write SHALL happen regardless of whether the sync was triggered by count change or latest-card change.

### Implementation Notes

- Follow layered architecture: repository functions for DB access (Ticket 1), service function for orchestration.
- Use `crypto.randomUUID()` for ID generation (available in Node 22+).
- The `refId` mapping: `marketCards.itemId` is the LigaStore product ref ID. Use this as `market_notifications.ref_id`.

### Acceptance Criteria

- [ ] `writeMarketNotifications` inserts rows for cards with `firstSeenAt > lastNotifiedAt`.
- [ ] `writeMarketNotifications` updates `lastNotifiedAt` after successful write.
- [ ] `writeMarketNotifications` returns 0 and does not update `lastNotifiedAt` when no new cards.
- [ ] `sync-market.ts` calls `writeMarketNotifications` after LigaStore sync.
- [ ] Unit tests for `writeMarketNotifications` with mock repository calls.

## References

- Spec: [`docs/specs/ligastore-latest-card-detection-and-bot-notifications-spec.md`](../../docs/specs/ligastore-latest-card-detection-and-bot-notifications-spec.md) — FR2
- ADR: [`docs/adr/0016-root-bot-notifications-and-latest-card-detection.md`](../../docs/adr/0016-root-bot-notifications-and-latest-card-detection.md)