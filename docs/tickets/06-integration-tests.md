# Ticket 6: Integration Tests & End-to-End Verification

## Metadata

- **Ticket ID**: 6
- **Feature**: `ligastore-latest-card-detection-and-bot-notifications`
- **Status**: ready-for-agent
- **Blocked by**: Ticket 1, Ticket 2, Ticket 3, Ticket 4, Ticket 5
- **Blocks**: None

## Summary

Write comprehensive tests for all new and modified behavior: parser, change detection, outbox writer, and bot message formatting. Verify end-to-end flow.

## Requirements

### Unit Tests

1. **`parseLigaStoreLatestCardRefId`** in [`src/services/__tests__/ligastore-parser.test.ts`](src/services/__tests__/ligastore-parser.test.ts):
   - Valid LigaStore HTML with one item → returns correct `refId`.
   - Empty results page → returns `null`.
   - Malformed HTML → returns `null`.
   - Page with no product items → returns `null`.

2. **`buildLigaStoreSearchUrl`** in [`src/services/__tests__/ligastore-parser.test.ts`](src/services/__tests__/ligastore-parser.test.ts):
   - `sort: 'latest'` → URL contains `txt_order=12&ultimas=1`.
   - `sort: 'count'` → URL contains `txt_order=6`.
   - No sort arg → defaults to `txt_order=6` (backward compatible).

3. **`formatMarketNotificationMessage`** in a new test file [`apps/ga-tcg-binder-bot/src/__tests__/market-notifier.test.ts`](apps/ga-tcg-binder-bot/src/__tests__/market-notifier.test.ts):
   - Single card, non-foil → correct format.
   - Single card, foil → includes "(Foil)".
   - Multiple cards → bullet list.
   - Empty card list → appropriate message or empty string.
   - Store name and date correctly interpolated.

### Integration Tests

4. **`checkMarketStores` with LigaStore** in [`src/services/__tests__/market-check.test.ts`](src/services/__tests__/market-check.test.ts) (create if not exists):
   - Both count and latest-card checks run.
   - Count change only → `changed = true`.
   - Latest-card change only → `changed = true`.
   - No changes → `changed = false`.
   - Latest-card check failure → no false positive, count result preserved.

5. **`checkMarketStores` with MyP** in same file:
   - Only count check runs.
   - No latest-card check attempted.

6. **`writeMarketNotifications`** in [`src/services/__tests__/market-notifications.test.ts`](src/services/__tests__/market-notifications.test.ts):
   - Cards with `firstSeenAt > lastNotifiedAt` → notifications written.
   - No new cards → 0 returned, `lastNotifiedAt` unchanged.
   - `lastNotifiedAt IS NULL` → all cards written.
   - After write → `lastNotifiedAt` updated.

### End-to-End Test

7. **Full flow** in a new test file:
   - Seed a LigaStore with `lastLatestCardRefId = 'old-ref'`.
   - Mock HTTP to return a new `refId` and new card data.
   - Run `checkMarketStores` → change detected.
   - Run `syncLigaStore` → cards upserted with `firstSeenAt`.
   - Run `writeMarketNotifications` → notifications inserted.
   - Verify `getPendingNotifications` returns the expected rows.
   - Verify message formatting produces correct output.

### Implementation Notes

- Use the existing test infrastructure: `vitest`, in-memory SQLite via `src/db/test-utils.ts`.
- Mock HTTP calls using `vi.fn()` or the existing mock fetch pattern.
- Tests SHALL NOT require actual LigaStore network access.
- Follow the existing test patterns in the codebase.

### Acceptance Criteria

- [ ] All unit tests pass.
- [ ] All integration tests pass.
- [ ] End-to-end test passes.
- [ ] No regression in existing tests.
- [ ] Test coverage for all new functions.

## References

- Spec: [`docs/specs/ligastore-latest-card-detection-and-bot-notifications-spec.md`](../../docs/specs/ligastore-latest-card-detection-and-bot-notifications-spec.md) — Test Plan
- ADR: [`docs/adr/0016-root-bot-notifications-and-latest-card-detection.md`](../../docs/adr/0016-root-bot-notifications-and-latest-card-detection.md)
