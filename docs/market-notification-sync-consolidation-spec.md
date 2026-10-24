# Specification: Market Notification & Sync Consolidation

**Feature slug:** `market-notification-sync-consolidation`
**Status:** ready-for-agent

## Problem Statement

Collectors and the operator of the Collector Assistant currently get the same market data delivered through **three divergent notification paths** (the Root community channel, the Discord webhook, and per-Collector Discord direct messages), each with its own message formatter, chunker, Markdown escaper, and transport. The same market-sync concern is likewise duplicated: three platform crawlers each re-implement the Full Rescan, fetch/retry, BRL price parsing, HTML decoding, and Listing Resolver, while two cron pipelines (daily and 6-hourly) partially overlap and can dispatch Deal Alerts twice against the same Listings. Definitions drift between files (`Destination` vs `channel` vs `sink`, `Market Store` vs `Marketplace Store` vs `platform`, `itemId` vs `mypItemId`, `rawName` vs `rawTitle`), so a header, a price rule, or a resolver fix must be made in several places and silently disagrees.

## Solution

Consolidate the duplication behind a small number of deep modules and a single vocabulary, so every destination formats messages the same way, every platform resolves and crawls Listings the same way, and every pipeline emits Deal Alerts and the Notification Outbox exactly once.

The work separates into **one formatting seam** and **two delivery seams**:

- **Formatting seam**: one `MarketNotificationMessage` module turns grouped market changes into Markdown chunks (format, chunk-to-limit, escape, date). Root, Discord channel, and Discord DM all call it.
- **Channel delivery seam**: one `ChannelDeliverySink` sends formatted chunks to a shared channel, with adapters for the Root community channel and the Discord channel/webhook.
- **Direct-message delivery seam**: one `DirectMessageSink` replaces a per-Collector rolling message, with a Discord DM adapter now and a Root DM adapter reserved for later.

Both delivery seams write to one Notification Outbox + per-`Destination` Delivery table.

## User Stories

1. As an operator, I want every market-update message (Root channel, Discord channel, Discord DM) formatted by the same module, so that a header or price-format change is made once and reads identically everywhere.
2. As an operator, I want message chunking to the platform character limit implemented once, so that no destination truncates differently or overflows.
3. As an operator, I want Markdown escaping applied consistently, so that card names containing special characters render correctly on both Root and Discord.
4. As a Collector, I want my Deal Alert DM to keep using the rolling single-message behavior (previous message deleted before the new one), so that my inbox is not spammed.
5. As a future operator, I want to add a Root direct-message delivery without touching the formatter or the Outbox, so that a new platform is only a new adapter.
6. As a Collector, I want a Listing matched to its canonical Card and Printing the same way regardless of which marketplace it came from, so that shortages and Buyable Shortages are consistent across stores.
7. As an operator, I want Full Rescan, Count Poll, BRL price parsing, and HTML decoding implemented once, so that a scrape bug is fixed for MyP, LigaStore, and Lootcards simultaneously.
8. As an operator, I want one pipeline runner with an explicit scope, so that the daily and 6-hourly schedules never dispatch the same Deal Alert twice.
9. As a developer, I want a single set of vocabulary terms and constants for `Destination`, `Marketplace Platform`, and external item identifiers, so that reading and extending the code does not require reconciling three names for the same concept.

## Implementation Decisions

- **Vocabulary & constants (prefactor)**: introduce a single source of truth for `Destination` (`root`, `discord`, `discord-dm`, with `root-dm` reserved), `Marketplace Platform` (`myp`, `liga_store`, `lootcards`), and one message character-limit constant. Align `CONTEXT.md` so `Market Store` and `Marketplace Store` are one term. Rename the divergent field aliases (`mypItemId` → `itemId`, `rawTitle` → `rawName`) via expand–contract (add the canonical name beside the old one, migrate call sites, then delete the old).
- **Formatting seam**: `MarketNotificationMessage` exposes a small interface — format grouped notifications into chunks, split arbitrary text to the limit, escape Markdown, and format a store-timestamp header. The four existing formatters and the deal-alert formatter collapse into it; the three duplicate length constants are removed.
- **Delivery seams**: `ChannelDeliverySink` (`send(channel, chunks)`) and `DirectMessageSink` (`replace(recipient, message)`) sit on the existing Notification Outbox. The Discord DM rolling-message path migrates onto `DirectMessageSink` and a `discord-dm` `Destination`; Root DM is a reserved adapter.
- **Listing Resolver**: one `resolve(raw) → { cardSlug, editionId } | null`. Platform-specific title/collector-number normalization stays in each platform parser; the canonical lookup (name → slug → edition, double-faced `//` fallback, collector-number fallback) is shared. The duplicated `normalize*`/`lookupCatalogCard` helpers are removed.
- **Market Crawl**: one `rescan(store)` / `poll(store)` engine with shared `parseBrlPrice`, `decodeHtml`, and `fetchHtml` (FlareSolverr/retry/UA), plus per-platform parser adapters. Listing Reconciliation stays shared and is called with a uniform external item id.
- **Pipeline**: one runner with a `scope` argument; the thin CLI wrapper is deleted; Deal Alert dispatch and Outbox emission happen exactly once per run.
- **ADR status**: ADR-0018 (Root and Discord emit identical text) is reinforced, not contradicted. No new dependency or language; everything stays in TypeScript inside existing modules.

## Testing Decisions

- **Seam**: test at the highest seams — the formatter (`MarketNotificationMessage`), the two delivery sinks (with a fake transport per destination), the `ListingResolver`, the `MarketCrawl` engine (with injected fetch and fixed HTML fixtures), and the pipeline runner (with injected stages). No end-to-end network calls.
- **What makes a good test**: assert observable output, not internals — identical Markdown across destinations, chunk boundaries never exceeding the limit, correct escaping, resolver returning the same canonical identity for the same external input regardless of platform, and the pipeline emitting Deal Alerts/Outbox exactly once.
- **Prior art**: `src/services/__tests__/watchlist.test.ts` and `watchlist-remote.test.ts` (in-memory DB + injected fetch fixtures), `src/services/__tests__/myp-marketplace-sync.test.ts`, and the existing notification/discord formatter tests.

## Out of Scope

- Placing paid orders, cart checkout, or fulfillment write-backs (unchanged from existing specs).
- A Root direct-message adapter — it is *reserved* by the seam, not built.
- Migrating any other subsystem; this is limited to notifications and market-sync.
- Changing the message *content* or policy (only its consolidation and consistent rendering).

## Further Notes

- This is an architecture-deepening change, not a user-facing feature; the acceptance criteria are "no behavioral regression + identical output across destinations/platforms."
- Wide renames (`mypItemId` → `itemId`, `rawTitle` → `rawName`) follow expand–contract so each batch lands green.
