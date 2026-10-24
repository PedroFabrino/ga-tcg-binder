# 0025: Retire LigaStore crawling; unify MyP + Lootcards behind one Market Crawl engine

## Status

Accepted

## Context

Market Sync originally crawled three Marketplace Platforms — MyP Cards, LigaStore, and Lootcards — each with its own fetch helper, BRL price parser, HTML decoder, Listing Resolver, pagination, and retry logic (see the `market-notification-sync-consolidation` spec). LigaStore's Grand Archive catalog is essentially dormant, so its crawler is dead weight: it still costs maintenance and its price semantics (US-decimal `R$ 12.50`) diverge from the other two stores.

At the same time, MyP and Lootcards read the *same* underlying objects — Grand Archive Cards and Printings — so their crawlers should converge on one normalized Listing object rather than three parallel shapes.

## Decision

1. **Retire LigaStore crawling.** LigaStore is removed from the active crawl path (Count Poll and Full Rescan no longer dispatch it). Its parser and sync modules are retained in the tree for reference only, documented as retired. Reintroducing it is a new adapter behind the engine, not a re-enable flag.

2. **One Market Crawl engine, two adapters.** `MarketCrawl` owns fetch, pagination, pacing, fail detection, and rescan. Two platform adapters (MyP, Lootcards) supply page parsing and platform metadata. Both adapters emit the same normalized `CrawledListing` object:

   ```
   { itemId, rawName, cardName, setPrefix, collectorNumber,
     price, priceBrl, quantity, isFoil, productUrl, editionUuid? }
   ```

3. **Prices are BRL.** Every Listing's asking price is Brazilian Real (`priceBrl`). MyP additionally carries the TCG Player benchmark as a separate USD reference field (`tcgPriceUsd`), never as the Listing's own price. There is one comma-decimal `parseBrlPrice`; the retired LigaStore US-decimal parser is removed.

4. **Pacing is per adapter.** Each adapter declares its own `pageDelayMs` and `retryDelayMs`; the engine does not hardcode them.

5. **Engine flags, reusable for future crawlers.** The engine takes flags — `cloudflareGuard` (treat a Cloudflare challenge page as a failure), `failDetection` (surface upstream status instead of a generic error), `rescanOnError` (retry with backoff) — so another store can be added as a new adapter without new orchestration code.

## Consequences

- Two active crawlers (MyP, Lootcards), one normalized Listing object, one Listing Resolver, one Outbox/Delivery pipeline.
- LigaStore is no longer refreshed; its historical behavior is preserved in this ADR and the (retained, retired) modules.
- New stores are adapters, not new sync services.
