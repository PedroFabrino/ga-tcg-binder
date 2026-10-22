# ADR 0022: MyP Marketplace Listing Parity and Notifications

## Status

Accepted — 2026-10-22. Amends ADR 0016, which excluded MyP from latest-card detection.

## Context

The MyP global marketplace sync (`syncGlobalMarketplace`) historically refreshed its snapshot by deleting every `market_cards` row for the `myp` store and inserting a fresh set. That made MyP a coarse, all-or-nothing refresh:

- `firstSeenAt` was reset on every scan, so individual listings had no discovery timestamp.
- `lastSeenAt` was not meaningful because rows were recreated instead of refreshed.
- Removed listings disappeared instead of being reconciled to zero quantity.
- No notification outbox entries were written for MyP, so newly listed cards were never announced.

LigaStore and Lootcards already use the shared marketplace granularity: stable per-listing identity, `upsertMarketCards`, `reconcileStoreListings`, latest-card change detection, and `writeMarketNotifications` + delivery sinks. MyP should behave the same way.

MyP's in-stock Grand Archive catalog is returned in insertion order (newest first). The first card block on the default catalog page is therefore the most recently listed item, so the existing count-poll request already carries both signals: the total listing count and the newest listing identifier. No extra request is needed.

## Decision

### 1. Per-listing upsert and reconciliation

`syncGlobalMarketplace` will:

1. Fetch all catalog pages as before.
2. Resolve each listing against the local catalog.
3. Upsert listings into `market_cards` by a stable `(storeId="myp", itemId)` key. The MyP item id (`data-ga-item-id`) is authoritative; product URL and, as a last resort, a composite of raw name/set/quality/finish provide a stable fallback.
4. Reconcile missing listings to `quantity = 0` only when the page count was parsed and every page of the scan succeeded.

A safety ceiling bounds the number of pages fetched per scan. If the catalog reports more pages than the ceiling, the scan is treated as incomplete, so reconciliation never zeroes listings on pages that were not fetched.

Existing `firstSeenAt` values are preserved because `upsertMarketCards` never updates that column. Cached TCGPlayer prices and vendor details continue to be merged into the upserted rows.

A partial scan (one or more failed `load-more` pages) still upserts the listings it observed, but it does not reconcile absent listings and does not advance `lastFullScanAt`. This follows ADR 0015's rule that partial scans must not mark stock unavailable.

### 2. Latest-card detection

The MyP count check parses both the total count and the first card's `data-ga-item-id` from the same response. The parsed identifier is compared with `market_stores.last_latest_card_ref_id`. A difference (or no previous baseline) signals a change and triggers the normal full-sync dispatch. MyP no longer needs a separate latest-card request.

This detection assumes MyP keeps the default catalog page in insertion order. If that ordering changes, the latest-card signal degrades (it may signal a change that is not a new listing, or miss a single-card swap), but full reconciliation and count-based detection still keep the catalog correct.

### 3. Notifications

`scripts/sync-market.ts` now writes MyP discoveries to `market_notifications` and delivers them through the same Discord/Root sinks as the other stores.

Because MyP already has a populated catalog when notification support is introduced, the first notification run records a baseline `lastNotifiedAt` and writes no back-stock notifications. Subsequent runs notify only listings whose `firstSeenAt` is after the baseline. The bootstrap is exposed as a `bootstrapIfNeverNotified` option on `writeMarketNotifications`; stores with an existing notification baseline keep the normal behavior.

Collector numbers are derived from MyP item ids (`grandarchive_<set>_<number>`) when the raw listing name does not contain a `(#NNN)` suffix.

## Consequences

### Positive

- MyP now has the same listing identity, discovery timestamps, reconciliation, and notification behavior as LigaStore and Lootcards.
- A single MyP request supplies both count and latest-card signals.
- New MyP inventory can reach Discord and the Root outbox without a separate crawler or schema.
- Partial MyP scans no longer risk zeroing stock that was simply not fetched.

### Negative

- MyP upserts are per-row rather than a bulk `INSERT`, so a full catalog refresh performs more write round-trips than the old chunked insert.
- Latest-card detection depends on MyP's default insertion ordering.
- The first notification run for an existing MyP catalog is intentionally silent; operators who want an initial announcement must do it explicitly.
- Reconciliation keeps removed listings as zero-quantity rows, so `market_cards` grows with historical listings instead of being wiped each scan.

## References

- [ADR 0012: Layered Architecture and Code Limits](./0012-layered-architecture-and-code-limits.md)
- [ADR 0015: Multi-Marketplace Catalog and LigaStore Crawling](./0015-multi-marketplace-catalog-and-ligastore-crawling.md)
- [ADR 0016: Root Bot Notifications and Latest-Card Detection](./0016-root-bot-notifications-and-latest-card-detection.md)
- [ADR 0018: Discord Market Notification Sink](./0018-discord-market-notification-sink.md)
- [ADR 0019: Lootcards Store Integration and Direct API Crawling](./0019-lootcards-store-integration-and-direct-api-crawling.md)
