# 0018: Discord Market-Notification Sink

Status: accepted

## Context

The marketplace sync pipeline already writes newly detected cards into the `market_notifications` outbox (`writeMarketNotifications`) and the Root bot polls that outbox to post Markdown to a Root community channel. Root is the only notification channel today.

Collectors and vendors also live on Discord, where store stock updates are more visible. Root cannot receive inbound webhooks (Root FAQ: inbound webhooks do not exist), so the Root bot must remain a database poller. Discord, by contrast, supports outbound webhooks, so Discord delivery can run inside the sync process itself and does not need its own poller.

The existing outbox tracks delivery with `sent_at` / `message_id`, which are the Root bot's state. Reusing those columns for Discord would couple two independent delivery channels and would break the Root bot's poll query (`sent_at IS NULL`). We need per-destination delivery tracking without disturbing Root.

## Decision

### 1. Delivery tracking (`notification_deliveries`)

Add a `notification_deliveries` table keyed by notification id plus destination:

| Column | Type | Description |
|---|---|---|
| `notification_id` | text (FK → `market_notifications.id`, cascade) | Outbox row this delivery belongs to |
| `destination` | text | Delivery channel, e.g. `discord` |
| `delivered_at` | integer (timestamp) | When the message was delivered |
| `message_id` | text | Message id captured from the sink |

The composite primary key is `(notification_id, destination)`. `sent_at` / `message_id` on `market_notifications` stay exactly as they are today as the Root state, so the Root bot and its tests are unchanged.

The migration backfills **every existing outbox row** as already delivered to `discord`, so the first run does not flood the channel with old stock. Future destinations reuse the same table.

### 2. Where delivery runs

Discord delivery runs in the sync process, immediately after `writeMarketNotifications()` in `scripts/sync-market.ts`. It selects every notification with no `notification_deliveries` row for `discord` and sends it. There is no separate poller. A failed or crashed run is retried on the next sync because the query re-selects undelivered rows.

### 3. Sink abstraction

A small sink abstraction — `MarketNotificationSink` with `formatGroup`, `send`, and `markDelivered` — decouples the delivery loop from any specific channel. `DiscordMarketNotificationSink` is the first implementation. Root remains the only pull-based consumer and does not use this abstraction.

### 4. Shared formatting

Grouping and formatting logic is shared, not copied. `formatMarketNotificationMessage` (Root) and `formatDiscordMarketNotificationMessage` (Discord) both draw on `groupMarketNotificationsByStore`, `sortMarketNotificationsByDetectedAt`, `formatMarketNotificationDate`, and `formatMarketNotificationCardDetails` in `src/services/market-notification-formatter.ts`. The Root message output is byte-for-byte identical, proven by a test.

### 5. Discord message format

Discord uses plain text `content`, not embeds, mirroring the Root message (English text, pt-BR date):

```
**{storeName}** updated their stock!
New cards since {date}:
• {cardName} — {setPrefix}{collectorNumber} (Foil) — {price}
```

- Each card name links to its store product page (the `image_url` value) only when it is a valid https URL. Real card thumbnails are a separate future feature.
- Messages are split into chunks of at most 2000 characters, breaking only on line boundaries.
- Requests send `allowed_mentions: { parse: [] }` to block `@everyone`, `@here`, and role pings.
- Requests send `flags: 4` (`SUPPRESS_EMBEDS`) and card URLs are formatted with `<...>` delimiters (`[card](<url>)`) to disable automatic link preview embed blocks while keeping the text hyperlinked.
- Markdown and mention characters in card and store names are escaped.
- HTTP 429 responses honor `retry_after` with bounded retries.
- `?wait=true` is appended so the Discord message id can be captured.
- Any non-2xx response (after retries) leaves the rows undelivered for the next run.

### 6. Webhook configuration

`DISCORD_WEBHOOK` is read from the environment. The URL embeds a secret token, so it is never printed or logged; every error message redacts the URL and its token (`redactWebhookSecret`). Validation requires https, a `discord.com` or `discordapp.com` host, and a path starting `/api/webhooks/`. A missing or invalid value disables the sink with a warning and never crashes the sync.

### 7. Language

Messages are English with pt-BR date formatting, matching Root messages. Moving both to the `@ga/contracts` i18n catalog is a separate future task.

## Production note: `mock-test-001`

An unsent test row with id `mock-test-001` (store `myp`) exists in the production Turso database. The migration backfill marks it delivered to `discord`, so it will not be sent to the Discord channel. To remove it manually:

```sql
DELETE FROM market_notifications WHERE id = 'mock-test-001';
```

The row has no impact on Root delivery unless it is still `sent_at IS NULL`, in which case the Root bot will eventually post it; deleting it removes that too.

## Consequences

- Discord notifications no longer depend on the Root bot being online, and vice versa.
- Per-destination delivery tracking enables future sinks (e.g. e-mail, Telegram) without schema changes.
- The webhook token is protected by validation and redaction; a dedicated test proves the redaction.
- The Root bot message output is unchanged, guarded by the byte-for-byte formatter test.
