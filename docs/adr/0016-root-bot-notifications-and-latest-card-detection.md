# ADR 0016: Root Bot Notifications and Latest-Card Change Detection

## Status

Proposed

## Context

The marketplace sync pipeline currently detects LigaStore inventory changes solely by comparing listing counts (`lastCount` vs observed count from `txt_order=6`). This count-based approach has a blind spot: if one card sells and the store adds one replacement card between sync intervals, the total count remains unchanged and no full sync is triggered.

Additionally, there is no mechanism to notify users of market changes in real time. The project has a new `apps/ga-tcg-binder-bot/` directory containing a Root SDK server-bot (`@rootsdk/server-bot`) that can send messages to Root community channels. This bot needs to be integrated with the sync pipeline to deliver market update notifications.

## Decision

### 1. Latest-Card Change Detection for LigaStore

For LigaStore platforms, the `checkMarketStores()` function will perform a **dual check**:

- **Count check** (existing): Fetch `txt_order=6` URL, parse total count, compare against `marketStores.lastCount`.
- **Latest-card check** (new): Fetch `txt_order=12&ultimas=1` URL (sorted by newest additions, limit 1), parse the first item's `refId`, compare against `marketStores.lastLatestCardRefId`.

If **either** check signals a change, a full sync is dispatched. This catches both bulk changes (count) and single-card swaps (latest-card).

### 2. Schema Changes

#### `marketStores` additions

| Column | Type | Description |
|---|---|---|
| `lastLatestCardRefId` | `text` (nullable) | The `refId` of the most recently observed latest card |
| `lastNotifiedAt` | `integer` (timestamp, nullable) | When the last notification was sent for this store |

#### `marketCards` additions

| Column | Type | Description |
|---|---|---|
| `firstSeenAt` | `integer` (timestamp, not null) | When this listing was first observed. Set on insert, never updated on upsert. |

#### New table: `market_notifications`

| Column | Type | Description |
|---|---|---|
| `id` | `text` (PK) | UUID |
| `storeId` | `text` (FK → marketStores.id) | Which store this notification is for |
| `cardName` | `text` | Resolved card name |
| `setPrefix` | `text` | Edition set prefix |
| `collectorNumber` | `text` | Collector number |
| `isFoil` | `integer` (boolean) | Foil status |
| `price` | `text` | Formatted price string |
| `refId` | `text` | LigaStore product ref ID |
| `imageUrl` | `text` (nullable) | Card image URL |
| `detectedAt` | `integer` (timestamp) | When the new card was detected |
| `sentAt` | `integer` (timestamp, nullable) | When the bot sent the notification (null = pending) |
| `messageId` | `text` (nullable) | Root message ID after successful send |
| `createdAt` | `integer` (timestamp) | Row creation timestamp |

### 3. Notification Outbox Pattern

The sync process (running in `scripts/sync-daemon.ts` / `scripts/sync-market.ts`) and the bot process (`apps/ga-tcg-binder-bot/`) communicate through the shared SQLite/libSQL database using an **outbox pattern**:

1. **Sync side**: After a full sync detects new cards (where `marketCards.firstSeenAt > marketStores.lastNotifiedAt`), it inserts rows into `market_notifications` and updates `marketStores.lastNotifiedAt`.
2. **Bot side**: The bot polls `market_notifications` for rows where `sentAt IS NULL`, sends a Root channel message for each batch (grouped by store), and marks rows as sent (`sentAt = now`, `messageId = rootMessageId`).

This avoids introducing new infrastructure (message queues, webhook servers) and leverages the existing database connection both processes already have.

### 4. Bot Application Architecture

The bot at `apps/ga-tcg-binder-bot/`:

- Uses `@rootsdk/server-bot` for Root platform integration.
- On startup (`onStarting` lifecycle hook), begins polling `market_notifications` at a configurable interval (`ROOT_BOT_POLL_INTERVAL_MS`, default 30 seconds).
- Reads the target channel ID from `ROOT_BOT_MARKET_CHANNEL_ID` environment variable.
- Sends plain-text Markdown messages to the configured channel.
- Imports database access from the monorepo's `src/db/` (shared Drizzle schema and repository layer).

### 5. Bot Message Format

```
**{storeName}** updated their stock!
New cards since {lastSyncDate}:
• {cardName} — {setPrefix} {collectorNumber} {foilStatus} — {price}
• ...
```

Where:
- `{storeName}` is from `marketStores.name`
- `{lastSyncDate}` is the previous `marketStores.lastFullScanAt` formatted as a human-readable date
- `{foilStatus}` is "(Foil)" or omitted for non-foil
- Cards are listed in the order they were detected

### 6. Configuration

| Variable | Purpose | Default |
|---|---|---|
| `ROOT_BOT_MARKET_CHANNEL_ID` | Root channel to post notifications to | (required) |
| `ROOT_BOT_POLL_INTERVAL_MS` | Outbox polling interval in milliseconds | `30000` |

### 7. LigaStore Latest-Additions URL

The detection URL for Brandão Card Game:
```
https://www.brandaocardgame.com.br/?view=ecom/itens&page=1&id=207836&comdesconto=&tcg=21&txt_idioma=&txt_qualid=&ultimas=1&txt_filtro_multiestoque=&txt_extras%5B%5D=&txt_order=12&txt_raridade=&txt_cor=&txt_limit=30&txt_estoque=1&btFiltrar=Filtrar
```

Key parameters:
- `txt_order=12`: Sort by latest additions
- `ultimas=1`: Only newest items
- `txt_limit=30`: Page size
- `txt_estoque=1`: In-stock only

The existing `buildLigaStoreSearchUrl()` in `market-check.ts` will be extended with a `sort` parameter to support both `txt_order=6` (count check) and `txt_order=12` (latest-card check).

## Consequences

### Positive

- **No blind spots**: Single-card swaps are detected even when total count is unchanged.
- **Minimal schema change**: One new column on `marketStores`, one on `marketCards`, one new table.
- **No new infrastructure**: Outbox pattern uses existing SQLite/libSQL database.
- **Simple bot**: The bot has a single responsibility (poll outbox → send messages), making it easy to test and maintain.
- **Extensible**: The `market_notifications` table can support additional notification types (price drops, restocks) in the future.

### Negative

- **Polling latency**: Up to `ROOT_BOT_POLL_INTERVAL_MS` delay between detection and notification.
- **Dual HTTP request per check**: Each LigaStore check now makes two HTTP requests (count + latest-card). Mitigated by the existing 5-minute poll interval.
- **Bot depends on monorepo DB**: The bot must import from `src/db/`, coupling it to the main app's schema. Acceptable since both live in the same monorepo.
- **No retry/DLQ**: If a bot message send fails, the row remains `sentAt IS NULL` and will be retried on the next poll. No dead-letter queue for permanent failures.

## Alternatives Considered

### Direct HTTP webhook from sync to bot
Rejected because the Root SDK server-bot may not expose an HTTP server, and adding one would require additional infrastructure and security considerations.

### Separate message queue (Redis, RabbitMQ)
Rejected as overengineered for a single notification type with low throughput. The outbox table is sufficient.

### Replace count-based detection entirely
Rejected because count-based detection still catches bulk delistings and mass additions that latest-card detection would miss (e.g., 50 cards delisted, 50 new cards added — count unchanged but latest card also unchanged if the newest card wasn't affected).

## References

- [ADR 0012: Layered Architecture and Code Limits](./0012-layered-architecture-and-code-limits.md)
- [ADR 0015: Multi-Marketplace Catalog and LigaStore Crawling](./0015-multi-marketplace-catalog-and-ligastore-crawling.md)
- [Root Bot Documentation](https://docs.rootapp.com/docs/bot-docs/develop/)
- [`CONTEXT.md`](../../CONTEXT.md)
