# Spec: LigaStore Latest-Card Change Detection & Root Bot Notifications

## Metadata

- **Feature slug**: `ligastore-latest-card-detection-and-bot-notifications`
- **Status**: Proposed
- **ADR**: [0016 - Root Bot Notifications and Latest-Card Change Detection](../adr/0016-root-bot-notifications-and-latest-card-detection.md)
- **Domain terms**: Latest Card Detection, Notification Outbox, Root Bot, Bot Channel (see [`CONTEXT.md`](../../CONTEXT.md))

## Summary

Enhance the LigaStore marketplace sync pipeline with dual change detection (count + latest-card), and implement a Root SDK bot that notifies a configured Root community channel when new cards are detected on monitored stores.

## Motivation

- **Blind spot in count-based detection**: If one card sells and the store adds one replacement between sync intervals, the total count remains unchanged and no sync is triggered.
- **No real-time market awareness**: Users have no notification mechanism for new store inventory.
- **Bot infrastructure exists**: `apps/ga-tcg-binder-bot/` is scaffolded with `@rootsdk/server-bot` but has no business logic.

## Design

See [ADR 0016](../adr/0016-root-bot-notifications-and-latest-card-detection.md) for full rationale. Key decisions:

1. **Dual detection**: Count check (`txt_order=6`) + latest-card check (`txt_order=12&ultimas=1`) for LigaStore platforms.
2. **Outbox pattern**: `market_notifications` table decouples sync from bot.
3. **Bot polls outbox**: Configurable interval, sends Markdown messages to configured Root channel.
4. **Schema additions**: `lastLatestCardRefId` + `lastNotifiedAt` on `marketStores`, `firstSeenAt` on `marketCards`, new `market_notifications` table.

## Functional Requirements

### FR1: Latest-Card Change Detection

- **FR1.1**: For each enabled LigaStore (`platform = 'liga_store'`), `checkMarketStores()` SHALL fetch the store's latest-additions URL (`txt_order=12&ultimas=1`) and parse the first item's `refId`.
- **FR1.2**: The parsed `refId` SHALL be compared against `marketStores.lastLatestCardRefId`. If different (or `lastLatestCardRefId` is null), a change is signaled.
- **FR1.3**: The latest-card check SHALL run alongside the existing count check. If EITHER signals a change, a full sync SHALL be dispatched.
- **FR1.4**: After a successful latest-card check, `marketStores.lastLatestCardRefId` SHALL be updated to the observed `refId`.
- **FR1.5**: The latest-card check SHALL NOT apply to MyP stores (`platform = 'myp'`), which continue to use count-based detection only.

### FR2: Notification Outbox

- **FR2.1**: After a full sync completes for a LigaStore, the sync process SHALL query `marketCards` for rows where `storeId = ? AND firstSeenAt > marketStores.lastNotifiedAt` (or `lastNotifiedAt IS NULL`).
- **FR2.2**: For each newly detected card, the sync process SHALL insert a row into `market_notifications` with: `id` (UUID), `storeId`, `cardName`, `setPrefix`, `collectorNumber`, `isFoil`, `price`, `refId`, `imageUrl`, `detectedAt` (now).
- **FR2.3**: After inserting notifications, the sync process SHALL update `marketStores.lastNotifiedAt` to the current timestamp.
- **FR2.4**: The notification outbox write SHALL happen immediately after a successful sync, before the sync process exits.

### FR3: Root Bot Notification Delivery

- **FR3.1**: On startup (`onStarting` lifecycle), the bot SHALL begin polling `market_notifications` for rows where `sentAt IS NULL`, ordered by `createdAt ASC`.
- **FR3.2**: The poll interval SHALL be configurable via `ROOT_BOT_POLL_INTERVAL_MS` environment variable (default: `30000`).
- **FR3.3**: The bot SHALL group pending notifications by `storeId` and send one message per store batch.
- **FR3.4**: The bot message format SHALL be: `**{storeName}** updated their stock!\nNew cards since {lastSyncDate}:\n• {cardName} — {setPrefix} {collectorNumber} {foilStatus} — {price}` where `{foilStatus}` is "(Foil)" for foil cards, omitted for non-foil.
- **FR3.5**: The target channel SHALL be read from `ROOT_BOT_MARKET_CHANNEL_ID` environment variable.
- **FR3.6**: After successfully sending a message, the bot SHALL update all corresponding `market_notifications` rows: `sentAt = now`, `messageId = rootMessageId`.
- **FR3.7**: If message send fails, rows SHALL remain with `sentAt IS NULL` for retry on next poll.
- **FR3.8**: The bot SHALL NOT send duplicate notifications for already-sent rows.

### FR4: Schema Changes

- **FR4.1**: Add `lastLatestCardRefId TEXT` (nullable) to `market_stores` table.
- **FR4.2**: Add `lastNotifiedAt INTEGER` (timestamp, nullable) to `market_stores` table.
- **FR4.3**: Add `firstSeenAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))` to `market_cards` table. Set on INSERT only, never updated on UPSERT.
- **FR4.4**: Create `market_notifications` table with columns: `id TEXT PK`, `storeId TEXT NOT NULL FK→market_stores(id) CASCADE`, `cardName TEXT NOT NULL`, `setPrefix TEXT NOT NULL`, `collectorNumber TEXT NOT NULL`, `isFoil INTEGER NOT NULL DEFAULT 0`, `price TEXT NOT NULL`, `refId TEXT NOT NULL`, `imageUrl TEXT`, `detectedAt INTEGER NOT NULL`, `sentAt INTEGER`, `messageId TEXT`, `createdAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))`.

### FR5: LigaStore Parser Extension

- **FR5.1**: `buildLigaStoreSearchUrl()` in `market-check.ts` SHALL accept a `sort` parameter (`'count'` for `txt_order=6`, `'latest'` for `txt_order=12`).
- **FR5.2**: A new function `parseLigaStoreLatestCardRefId(html: string): string | null` SHALL extract the `refId` from the first item in the latest-additions search results.

### FR6: Configuration

- **FR6.1**: `ROOT_BOT_MARKET_CHANNEL_ID` — (required) Root channel ID for notifications.
- **FR6.2**: `ROOT_BOT_POLL_INTERVAL_MS` — (optional, default `30000`) Outbox polling interval in milliseconds.

## Non-Functional Requirements

- **NFR1**: All new and modified code SHALL follow the layered architecture in ADR 0012.
- **NFR2**: No source file SHALL exceed 400 lines.
- **NFR3**: Every behavior change SHALL ship with a `vitest` test.
- **NFR4**: The latest-card check HTTP request SHALL use the same `fetchHtml()` helper with 15-second timeout and curl fallback.
- **NFR5**: Bot messages SHALL use game nomenclature in canonical English per CONTEXT.md.
- **NFR6**: No new dependency without an ADR. `@rootsdk/server-bot` is documented in ADR 0016.

## Edge Cases

- **EC1**: If the latest-additions URL returns an empty page, `refId` is null. This SHALL NOT trigger a change if `lastLatestCardRefId` is also null.
- **EC2**: If the LigaStore HTML structure changes and `refId` cannot be parsed, the check SHALL log a warning and not trigger a false positive.
- **EC3**: If the bot cannot connect to the database, it SHALL log an error and retry on the next poll interval.
- **EC4**: If `ROOT_BOT_MARKET_CHANNEL_ID` is not set, the bot SHALL log a warning and skip notification delivery (no crash).
- **EC5**: Duplicate detection prevention: `firstSeenAt > lastNotifiedAt` ensures each card is notified exactly once.
- **EC6**: If a full sync finds zero new cards, no notifications SHALL be written and `lastNotifiedAt` SHALL NOT be updated.

## Test Plan

### Unit Tests

1. `parseLigaStoreLatestCardRefId` — valid HTML returns refId, empty HTML returns null, malformed HTML returns null.
2. `buildLigaStoreSearchUrl` with `sort: 'latest'` — produces correct URL with `txt_order=12&ultimas=1`.
3. `buildLigaStoreSearchUrl` with `sort: 'count'` — produces correct URL with `txt_order=6`.
4. Outbox query — verifies `firstSeenAt > lastNotifiedAt` filter logic.
5. Bot message formatting — verifies correct Markdown output for various card combinations.

### Integration Tests

6. `checkMarketStores` with LigaStore — verifies both count and latest-card checks run, change detected on either.
7. `checkMarketStores` with MyP — verifies only count check runs.
8. Full sync → outbox write — verifies notifications are inserted after sync completes.
9. Bot poll → send → mark sent — verifies end-to-end notification delivery.
10. Bot poll with empty outbox — verifies no messages sent.

## References

- [ADR 0016: Root Bot Notifications and Latest-Card Change Detection](../adr/0016-root-bot-notifications-and-latest-card-detection.md)
- [ADR 0012: Layered Architecture and Code Limits](../adr/0012-layered-architecture-and-code-limits.md)
- [ADR 0015: Multi-Marketplace Catalog and LigaStore Crawling](../adr/0015-multi-marketplace-catalog-and-ligastore-crawling.md)
- [CONTEXT.md](../../CONTEXT.md)
- [Root Bot Documentation](https://docs.rootapp.com/docs/bot-docs/develop/)

- **FR1.1**: For each enabled LigaStore (`platform = 'liga_store'`), `checkMarketStores()` SHALL fetch the store's latest-additions URL (`txt_order=12&ultimas=1`) and parse the first item's `refId`.
- **FR1.2**: The parsed `refId` SHALL be compared against `marketStores.lastLatestCardRefId`. If different (or `lastLatestCardRefId` is null), a change is signaled.
- **FR1.3**: The latest-card check SHALL run alongside the existing count check. If EITHER signals a change, a full sync SHALL be dispatched.
- **FR1.4**: After a successful latest-card check, `marketStores.lastLatestCardRefId` SHALL be updated to the observed `refId`.
- **FR1.5**: The latest-card check SHALL NOT apply to MyP stores (`platform = 'myp'`), which continue to use count-based detection only.

### FR2: Notification Outbox

- **FR2.1**: After a full sync completes for a LigaStore, the sync process SHALL query `marketCards` for rows where `storeId = ? AND firstSeenAt > marketStores.l