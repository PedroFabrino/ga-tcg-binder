# Ticket 3: Dual Change Detection in checkMarketStores

## Metadata

- **Ticket ID**: 3
- **Feature**: `ligastore-latest-card-detection-and-bot-notifications`
- **Status**: ready-for-agent
- **Blocked by**: Ticket 1 (schema), Ticket 2 (parser)
- **Blocks**: Ticket 4

## Summary

Modify `checkMarketStores()` in [`src/services/market-check.ts`](src/services/market-check.ts) to perform dual change detection for LigaStore platforms: count check + latest-card check.

## Requirements

### Dual Detection Logic

1. In `checkMarketStores()`, for each enabled store with `platform === 'liga_store'`:
   - Perform the existing count check (fetch `txt_order=6`, parse `parseLigaStoreTotalCount`, compare with `lastCount`).
   - Additionally perform a latest-card check:
     - Build the latest-additions URL via `buildLigaStoreSearchUrl(store, 'latest')`.
     - Fetch the HTML.
     - Parse `refId` via `parseLigaStoreLatestCardRefId`.
     - Compare with `store.lastLatestCardRefId`.
   - If EITHER check detects a change, set `result.changed = true` and dispatch the full sync (existing GitHub workflow dispatch or local spawn behavior).

2. For `platform === 'myp'` stores:
   - Continue with only the count check (no latest-card check).

3. After a successful latest-card check (regardless of change status), update `marketStores.lastLatestCardRefId` to the observed `refId` via [`updateStoreLatestCardRefId()`](src/db/repositories/marketplace-repository.ts).

### Result Reporting

4. Extend `MarketStoreCheckResult` to include:
   - `latestCardRefId: string | null` — the observed latest card refId.
   - `previousLatestCardRefId: string | null` — the previously stored value.
   - `latestCardChanged: boolean` — whether the latest-card check detected a change.

5. The `changed` field SHALL be `true` if either `countChanged` OR `latestCardChanged` is true.

### Error Handling

6. If the latest-card check fails (HTTP error, parse returns null):
   - Log a warning.
   - Do NOT signal a change based on latest-card (no false positive).
   - Still allow the count check result to stand on its own.

### Implementation Notes

- Follow the existing pattern of `fetchStoreCount()`. Add a parallel `fetchStoreLatestCardRefId(store, customFetch)` helper.
- Keep the function under 400 lines; extract helpers as needed.
- Use the existing `fetchHtml()` helper for HTTP with curl fallback.

### Acceptance Criteria

- [ ] LigaStore stores get both count and latest-card checks.
- [ ] MyP stores get only count check.
- [ ] `changed` is true when either check signals change.
- [ ] `lastLatestCardRefId` is updated after each successful latest-card check.
- [ ] Latest-card check failure does not cause false positive.
- [ ] Unit/integration tests in [`src/services/__tests__/`](src/services/__tests__/) cover: both-check-success, count-only-change, latest-only-change, myp-count-only, latest-check-failure-no-false-positive.

## References

- Spec: [`docs/specs/ligastore-latest-card-detection-and-bot-notifications-spec.md`](../../docs/specs/ligastore-latest-card-detection-and-bot-notifications-spec.md) — FR1
- ADR: [`docs/adr/0016-root-bot-notifications-and-latest-card-detection.md`](../../docs/adr/0016-root-bot-notifications-and-latest-card-detection.md)