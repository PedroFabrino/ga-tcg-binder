# Ticket 5: Root Bot Outbox Poller & Message Sender

## Metadata

- **Ticket ID**: 5
- **Feature**: `ligastore-latest-card-detection-and-bot-notifications`
- **Status**: ready-for-agent
- **Blocked by**: Ticket 1 (schema), Ticket 4 (outbox writer)
- **Blocks**: None

## Summary

Implement the Root bot's core logic: poll the `market_notifications` outbox table, format pending notifications as Markdown messages, send them to the configured Root channel, and mark rows as sent.

## Requirements

### Bot Database Access

1. The bot at [`apps/ga-tcg-binder-bot/`](apps/ga-tcg-binder-bot/) SHALL import database access from the monorepo:
   - Import `db` from `../../src/db` (or the appropriate relative path).
   - Import repository functions from `../../src/db/repositories/marketplace-repository`:
     - `getPendingNotifications()`
     - `markNotificationsSent()`
     - `getMarketStoreById()`

2. Ensure the bot's `tsconfig.json` paths allow importing from `../../src/`. If not, add a path alias or adjust `rootDir`/`include` settings.

### Outbox Poller

3. Create a new module [`apps/ga-tcg-binder-bot/src/market-notifier.ts`](apps/ga-tcg-binder-bot/src/market-notifier.ts) that exports a `startMarketNotifier()` function.

4. `startMarketNotifier()` SHALL:
   - Read `ROOT_BOT_POLL_INTERVAL_MS` from environment (default `30000`).
   - Read `ROOT_BOT_MARKET_CHANNEL_ID` from environment.
   - If `ROOT_BOT_MARKET_CHANNEL_ID` is not set, log a warning and return (no crash).
   - Start a `setInterval` loop at the configured interval.
   - On each tick:
     - Query `getPendingNotifications()`.
     - Group results by `storeId`.
     - For each store group, format and send a message.
     - Mark sent notifications via `markNotificationsSent()`.

### Message Formatting

5. Create a `formatMarketNotificationMessage()` function that produces:
   ```
   **{storeName}** updated their stock!
   New cards since {lastSyncDate}:
   • {cardName} — {setPrefix} {collectorNumber} {foilStatus} — {price}
   • ...
   ```
   Where:
   - `{storeName}`: From `getMarketStoreById(storeId).name`
   - `{lastSyncDate}`: The store's `lastFullScanAt` formatted as a human-readable date (e.g., `toLocaleDateString('pt-BR')` or ISO date).
   - `{foilStatus}`: `(Foil)` if `isFoil` is truthy, empty string otherwise.
   - Cards listed in `detectedAt` order.

### Message Sending

6. Use the Root SDK's `rootServer.community.channelMessages.create()` API:
   ```ts
   import { rootServer, ChannelMessageCreateRequest } from "@rootsdk/server-bot";

   const request: ChannelMessageCreateRequest = {
     channelId: process.env.ROOT_BOT_MARKET_CHANNEL_ID,
     content: formattedMessage,
   };
   const message = await rootServer.community.channelMessages.create(request);
   ```

7. After successful send, call `markNotificationsSent(notificationIds, message.id, new Date())`.

8. If send fails, catch the error, log it, and leave rows unsent for retry on next poll.

### Bot Lifecycle Integration

9. In [`apps/ga-tcg-binder-bot/src/main.ts`](apps/ga-tcg-binder-bot/src/main.ts):
   - Remove the example code import and call.
   - Import `startMarketNotifier` from `./market-notifier`.
   - Call `startMarketNotifier()` inside the `onStarting` callback.

10. Update [`apps/ga-tcg-binder-bot/root-manifest.json`](apps/ga-tcg-binder-bot/root-manifest.json):
    - Set `id` to a real bot ID (e.g., `ga-tcg-binder-market-bot`).
    - Ensure `package.server.launch` points to `dist/main.js`.

### Implementation Notes

- The bot runs as a separate process. It connects to the same SQLite/libSQL database as the main app.
- Keep the bot code minimal — it's a thin polling loop, not a complex service.
- Use `console.log` / `console.error` for logging (Root SDK may provide its own logging; check docs).
- Game nomenclature (Card names, Elements, Rarities, Finishes) SHALL remain in canonical English per CONTEXT.md.

### Acceptance Criteria

- [ ] Bot starts polling on `onStarting`.
- [ ] Bot reads channel ID from `ROOT_BOT_MARKET_CHANNEL_ID`.
- [ ] Bot gracefully handles missing channel ID (logs warning, no crash).
- [ ] Pending notifications are grouped by store.
- [ ] Messages are formatted correctly with store name, date, card list.
- [ ] Messages are sent to the configured Root channel.
- [ ] Sent notifications are marked with `sentAt` and `messageId`.
- [ ] Failed sends leave rows for retry.
- [ ] No duplicate sends for already-sent rows.
- [ ] Example code removed from `main.ts`.
- [ ] `root-manifest.json` has a real bot ID.

## References

- Spec: [`docs/specs/ligastore-latest-card-detection-and-bot-notifications-spec.md`](../../docs/specs/ligastore-latest-card-detection-and-bot-notifications-spec.md) — FR3, FR6
- ADR: [`docs/adr/0016-root-bot-notifications-and-latest-card-detection.md`](../../docs/adr/0016-root-bot-notifications-and-latest-card-detection.md)
- [Root Bot Documentation](https://docs.rootapp.com/docs/bot-docs/develop/)
