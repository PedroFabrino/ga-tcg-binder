# Ticket 2: LigaStore Latest-Card Parser & URL Builder Extension

## Metadata

- **Ticket ID**: 2
- **Feature**: `ligastore-latest-card-detection-and-bot-notifications`
- **Status**: ready-for-agent
- **Blocked by**: Ticket 1 (needs `lastLatestCardRefId` column)
- **Blocks**: Ticket 3

## Summary

Extend the LigaStore parser and URL builder to support the latest-additions search mode (`txt_order=12&ultimas=1`) and extract the `refId` of the most recently added card.

## Requirements

### URL Builder Extension

1. Modify `buildLigaStoreSearchUrl()` in [`src/services/market-check.ts`](src/services/market-check.ts) to accept an optional `sort` parameter:
   - `'count'` (default, existing behavior): `txt_order=6`
   - `'latest'`: `txt_order=12&ultimas=1`

2. The function signature changes from:
   ```ts
   function buildLigaStoreSearchUrl(store: EnabledMarketStore): string | null
   ```
   to:
   ```ts
   function buildLigaStoreSearchUrl(store: EnabledMarketStore, sort?: 'count' | 'latest'): string | null
   ```

### Latest-Card Parser

3. Add a new exported function `parseLigaStoreLatestCardRefId` in [`src/services/ligastore-parser.ts`](src/services/ligastore-parser.ts):
   ```ts
   export function parseLigaStoreLatestCardRefId(html: string): string | null
   ```

4. The function SHALL:
   - Parse the LigaStore search results HTML (from `txt_order=12&ultimas=1` URL).
   - Extract the `refId` from the first product item in the results.
   - Return `null` if the page is empty, has no items, or the HTML structure cannot be parsed.
   - Use the same regex-based approach as existing parser functions (no new dependencies).

5. The `refId` is typically found in an attribute like `data-ref` or within a product link URL on the search results page. Inspect the actual LigaStore HTML to determine the exact extraction pattern.

### Implementation Notes

- Keep the parser pure (no side effects, no HTTP calls).
- Follow the existing pattern in `ligastore-parser.ts`: dependency-free regex helpers.
- Add JSDoc comments describing the expected HTML structure.

### Acceptance Criteria

- [ ] `buildLigaStoreSearchUrl(store, 'latest')` produces URL with `txt_order=12&ultimas=1`.
- [ ] `buildLigaStoreSearchUrl(store, 'count')` produces URL with `txt_order=6` (backward compatible).
- [ ] `buildLigaStoreSearchUrl(store)` (no sort arg) defaults to `'count'` (backward compatible).
- [ ] `parseLigaStoreLatestCardRefId` returns correct `refId` for valid LigaStore HTML.
- [ ] `parseLigaStoreLatestCardRefId` returns `null` for empty/malformed HTML.
- [ ] Unit tests for both functions in [`src/services/__tests__/ligastore-parser.test.ts`](src/services/__tests__/ligastore-parser.test.ts).

## References

- Spec: [`docs/specs/ligastore-latest-card-detection-and-bot-notifications-spec.md`](../../docs/specs/ligastore-latest-card-detection-and-bot-notifications-spec.md) — FR5
- ADR: [`docs/adr/0016-root-bot-notifications-and-latest-card-detection.md`](../../docs/adr/0016-root-bot-notifications-and-latest-card-detection.md)
