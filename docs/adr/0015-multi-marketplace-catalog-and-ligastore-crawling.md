# ADR 0015: Multi-Marketplace Catalog and LigaStore Crawling

## Context

Grand Archive TCG Binder currently has marketplace support centered on MyP. MyP is both a marketplace source and the only supported platform for user selling, personal store synchronization, carts, wantlists, and fulfillment workflows.

The application must additionally support Brandao / LigaStore as a buy-side marketplace source. LigaStore exposes a large catalog of Grand Archive products, but visiting every product detail page to obtain stock and pricing would require hundreds of requests per scan and would be unnecessarily slow and fragile.

LigaStore catalog search pages contain CSS image sprites, including classes such as `.vidgmi` and `.xWrSf`, which encode listing price and stock information. These search pages can provide marketplace-wide listing data in one or two requests, avoiding a full detail-page crawl for every listing.

The system also needs to support multiple marketplaces without duplicating marketplace tables and synchronization logic for each provider. Marketplace listings must be linked to the local official Grand Archive card catalog where possible, while preserving unmatched external products for review rather than discarding them.

Store-wide listing-count changes should trigger more expensive full synchronization only when needed. The system should continue to perform periodic full reconciliation even when a count change is not detected.

## Decision

### Multi-marketplace data model

Marketplace support will use a unified store and listing model.

#### `market_stores`

`market_stores` is the registry of supported external marketplace stores.

It contains:

- `id`
- `platform` — `'myp' | 'liga_store'`
- `name`
- `base_url`
- `tcg_id`
- `enabled`
- `last_count`
- `last_count_checked_at`
- `last_full_scan_at`

The initial stores are:

- MyP, using platform `myp`
- Brandao, using platform `liga_store`

A store represents a specific marketplace source or vendor integration, not merely a marketplace technology. Multiple stores may use the same platform in the future.

#### `market_cards`

`market_cards` is the unified table for current observed marketplace listings. It replaces and migrates the existing `myp_market_cards` model.

It contains:

- `store_id`
- `card_slug`
- `edition_id`
- `raw_name`
- `card_name`
- `set_prefix`
- `quantity`
- `price`
- `price_numeric`
- `quality`
- `is_foil`
- `product_url`
- `item_id`
- `vendor_name`
- `vendor_url`
- `tcg_price`
- `tcg_price_numeric`
- `last_seen_at`

Each row represents the most recently observed state of an external listing. It is not a purchase, inventory, fulfillment, or cart record.

`card_slug` and `edition_id` are populated when a listing can be resolved to the official local card catalog. They may remain empty for unmatched listings.

Existing MyP marketplace data will be migrated into `market_cards` and associated with the MyP `market_stores` row.

### LigaStore catalog crawling

LigaStore crawling will use a two-level strategy.

#### Broad catalog scan

The normal LigaStore catalog scan will fetch the relevant catalog search page or pages and decode the CSS image sprites used by the marketplace, including `.vidgmi` and `.xWrSf`, to extract listing price and stock information.

This broad scan is the source of current listing availability and pricing for the marketplace catalog. It must avoid visiting every product detail page solely to obtain basic price and quantity data.

The crawler will retain the source title and URL for every observed listing.

#### Selective detail-page enrichment

LigaStore product detail pages will be fetched selectively rather than as part of every broad catalog scan.

Detail-page enrichment is permitted for listings relevant to:

- active user Shortages; and
- Meta Staples.

Selective detail-page requests may be used to obtain or verify details not reliably available from search pages, including:

- exact condition;
- language; and
- verified stock.

Detail-page enrichment supplements the broad scan. It does not replace the search-page crawler as the primary catalog synchronization strategy.

### Listing resolution

LigaStore search titles will be matched against the local official Grand Archive Card Catalog.

The expected external title format is:

```text
Name (#NNN)
```

The Listing Resolver will use the parsed card name and collector number, together with local `cards` and `card_editions` data, to resolve an external listing to the appropriate canonical card and edition.

When a listing cannot be resolved confidently:

- the listing will still be stored in `market_cards`;
- `raw_name`, marketplace metadata, and source URL will be retained;
- canonical card linkage fields may remain null; and
- the listing will be treated as an Unlinked Listing.

Unlinked Listings are intentional records for later review, parser improvement, or catalog-data correction. They must not be silently dropped.

### Count polling and synchronization scheduling

A lightweight count-poll endpoint will be provided at:

```text
/api/cron/check-market-stores
```

The endpoint will run periodically, such as every five to ten minutes.

For each enabled store, it will retrieve only a lightweight total-listing count:

- Brandao / LigaStore: the displayed catalog count, for example `1-14 de <b>14</b>`;
- MyP: the marketplace summary count, for example `<strong>N</strong> itens`.

The endpoint will update `last_count` and `last_count_checked_at`.

When an observed count differs from the stored count, the system will trigger a full marketplace synchronization workflow. The preferred deployment mechanism is a GitHub Actions workflow dispatch through the GitHub API:

```text
.github/workflows/market-sync.yml
```

If the cron/API runtime has the required database credentials and is configured to run synchronization directly, it may execute the full synchronization workflow without GitHub Actions dispatch.

A full reconciliation will also continue to run on a fixed six-hour schedule through GitHub Actions, regardless of whether a count change was detected.

### Listing reconciliation

A successful full scan is authoritative for the scanned store.

During a successful full scan:

1. observed listings are inserted or updated in `market_cards`;
2. `last_seen_at` is updated for every observed listing;
3. listing availability, price, quantity, and related observed fields are refreshed; and
4. listings that were previously active but were not observed during the completed scan are marked out of stock or inactive.

Listings must not be marked inactive merely because a partial scan, failed request, parser error, or unsuccessful full scan did not return them.

`last_full_scan_at` is updated only after the relevant store has completed a successful full scan.

### Marketplace feature boundary

LigaStore / Brandao is strictly a buy-side source.

LigaStore listings may be used for:

- Buyable Shortages;
- marketplace browsing;
- price and availability comparison; and
- selective shortage and Meta Staples enrichment.

The following capabilities remain MyP-only:

- selling;
- personal store synchronization;
- cart mutation;
- wantlist mutation; and
- fulfillment workflows.

No LigaStore write-back, seller inventory synchronization, checkout automation, or fulfillment integration is introduced by this decision.

## Consequences

### Positive consequences

- Marketplace data is normalized behind a shared store and listing model rather than requiring marketplace-specific listing tables.
- Additional marketplace stores can be added without redesigning the core marketplace schema.
- Existing MyP marketplace behavior can continue while using the shared `market_cards` table.
- LigaStore catalog scans are substantially cheaper and faster because price and stock are extracted from search-page CSS sprites rather than requiring hundreds of detail-page requests.
- Detail-page requests are focused on records with direct user value: active Shortages and Meta Staples.
- The official local card catalog remains the canonical source for card and edition identity.
- Unmatched external products remain visible and reviewable as Unlinked Listings.
- Lightweight count polling reduces unnecessary full crawls while the six-hour reconciliation schedule provides eventual consistency.
- Full-scan reconciliation prevents removed listings from remaining incorrectly available indefinitely.
- The buy-side-only boundary prevents accidental expansion of MyP seller, cart, wantlist, or fulfillment assumptions to LigaStore.

### Negative consequences and trade-offs

- LigaStore CSS sprite parsing depends on external markup and stylesheet behavior. Changes to `.vidgmi`, `.xWrSf`, related sprite assets, or page structure can break price or stock extraction and require crawler maintenance.
- Search-page data may not include complete condition, language, or exact stock information. Those attributes may be absent or less reliable until selective detail-page enrichment occurs.
- Count changes are only a trigger heuristic. A store can change listings without changing its total count, which is why scheduled six-hour full reconciliation remains required.
- A changed count can trigger synchronization for changes that are not relevant to a specific user, such as unrelated additions or removals.
- Listing title matching can be ambiguous or fail when marketplace names differ from official catalog names, collector numbers are missing, or product titles contain variants not represented in the local catalog.
- Unlinked Listings require operational visibility and may need future review tooling.
- Migration from `myp_market_cards` to `market_cards` requires data migration, query updates, and compatibility verification for all existing MyP marketplace features.
- The system must distinguish successful full scans from failed or partial scans so temporary crawler failures do not incorrectly mark listings as unavailable.
- GitHub Actions workflow dispatch requires securely configured repository credentials when the cron runtime does not execute synchronization directly.
