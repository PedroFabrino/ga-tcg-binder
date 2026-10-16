# 0007: Isolated Marketplace Listings with Bidirectional Shortage Offsetting

## Context
Collectors often list spare or high-value physical cards on external secondary marketplaces (specifically `mypcards.com` in Brazil). These cards are physically owned by the collector, but listed for sale rather than stored in their primary active binder.

Previously, there was no integration with marketplace inventory. When building decks, collectors had no visibility into whether a missing card ("Shortage") was actually sitting in their external sales inventory. Conversely, collectors risked selling cards that were actively needed in their tournament decks.

Directly importing marketplace cards into the main `collection_items` table would pollute collection statistics, total population metrics, friend trade pools, and binder views with cards intended for commerce.

## Decision
1. **Isolated Schema (`myp_cards`)**:
   - Create a dedicated `myp_cards` table completely decoupled from `collection_items`.
   - Store external listing attributes (`raw_name`, `set_prefix`, `quantity`, `price`, `quality`, `is_foil`, `myp_item_id`, `myp_product_url`).
   - Store Collector's handle (`myp_username`) on their `users` record.

2. **On-Demand Catalog Resolution**:
   - A manual sync button triggers an authenticated crawler pipeline (`/api/marketplace/sync`) that paginates the public store `https://mypcards.com/<username>`.
   - Card names and set prefixes are resolved against canonical `cards` and `card_editions` records at ingestion time.

3. **Bidirectional Shortage Cross-Referencing**:
   - The `/marketplace` view cross-references listings with the collector's active deck requirements to flag Shortage Offsets (`Needed in [Deck Name] xN`).
   - The consolidated shortages view (`/decks`) checks the collector's `myp_cards` and flags missing cards that are available in their MyP inventory.

4. **Claim / Delisting Workflow**:
   - When a collector claims an offset card for a deck, it atomically moves into `collection_items` (binder), decrements/removes from `myp_cards`, and opens the direct `myp_product_url` in a new tab so the collector can immediately delist the card from the external marketplace.

## Consequences
- Preserves the integrity of the collector's binder, deck allocation, and friend trade pools without complex filter conditions across existing collection queries.
- Gives instant bidirectional visibility between competitive deck needs and secondary market listings.
- Requires manual delisting on MyPCards by the collector since no write/delist public API exists for third-party marketplace accounts.
