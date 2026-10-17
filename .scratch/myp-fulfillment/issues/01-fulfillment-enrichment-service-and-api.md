## Parent

#51 (`docs/myp-fulfillment-spec.md`)

## What to build

Build the end-to-end backend enrichment vertical slice for **Fulfillment Orders**:

1. **Catalog Lookup Repository**: Query the **Card Catalog** (`cards` and `card_editions`) to resolve sold MyP items by normalized `(setPrefix, collectorNumber)` extracted from `grandarchive_<set>_<number>` slugs, with fallbacks to `(cardName, setPrefix)` and `cardName`.
2. **HTML Parsers & PII Stripping**: Parse MyP `/vendas` table HTML (extracting `Aguard. envio` and `Em separação` rows) and `/pedido/<id>` order detail HTML (extracting item titles, `mypCode`, condition, language, foil flag, quantity, and unit price while strictly ignoring buyer `CPF`, legal name, and street address).
3. **Pick List & Buyer Pack Aggregation Service**:
   - Classify each item as Grand Archive (`grandarchive_*` or `/grandarchive/`) vs. non-Grand Archive (`pokemon_*`, etc.).
   - Isolate non-Grand Archive **Fulfillment Orders** into `nonGrandArchiveOrders` with `orderId`, `buyerNick`, `detectedTcg`, and `orderUrl` so they do not pollute the Grand Archive **Pick List**.
   - Aggregate Grand Archive items into `pickListByElement` ordered by canonical **Element** (`Norm`, `Fire`, `Water`, `Wind`, `Tera`, `Crux`, `Umbra`, `Luxem`, `Exalted`, `Astra`, `Exia`, `Arcane`, `Neos`, plus `UNMATCHED` fallback) and sorted alphabetically by **Card** name within each **Element**. Sum quantities across orders only when `(Printing, condition, isFoil)` are identical; keep distinct editions, conditions, or foil finishes on separate lines.
   - Group orders into `buyerPacks` by `buyerNick` (prioritizing paid/tracked shipping methods like `PAC` or `Frete Fixo com rastreio` over `Frete combinado com o vendedor`), sub-grouped by individual **Fulfillment Order** (`#orderId`) so each order's items can be photographed and verified separately before shipping together.
4. **Stateless API Boundary with CORS**: Expose `POST` and `OPTIONS` on `/api/marketplace/fulfillment` validated with Zod and configured with CORS headers so the Tampermonkey userscript on `https://mypcards.com` and the web application can enrich order batches statelessly.

## Acceptance criteria

- [ ] Repository module owns all database queries against `cards` and `card_editions` (no Drizzle/libSQL imports in services or routes per ADR 0012; all files under 400 lines).
- [ ] HTML parser tests verify extraction of `Aguard. envio` and `Em separação` rows from `/vendas` and item rows from `/pedido/<id>` while ensuring buyer `CPF` and address fields are never extracted.
- [ ] Service tests verify:
  - Resolving `grandarchive_rdo_029` / `Void's Cloak` to canonical **Element** `Norm`, set `RDO`, collector number `029`, rarity, and image URL.
  - Summing quantities of identical `(Printing, condition, isFoil)` across multiple orders while keeping Foil vs. Normal or different set editions separate.
  - Placing unrecognized Grand Archive slugs into the `UNMATCHED` bucket so zero items are silently dropped.
  - Consolidating multi-order buyers (e.g., 5 orders from `Betinho3`, 2 orders from `LOOTCARDS` with mixed `PAC` and `Frete combinado`) into a single **Buyer Pack** per buyer while preserving sub-grouped orders and their individual item lists.
  - Filtering non-Grand Archive orders (e.g., `pokemon_*`) out of `pickListByElement` and `buyerPacks` and returning them in `nonGrandArchiveOrders` with their `/pedido/<id>` URL.
- [ ] API route tests verify Zod validation and CORS headers (`Access-Control-Allow-Origin: https://mypcards.com`) on `OPTIONS` and `POST /api/marketplace/fulfillment`.
- [ ] `npx vitest run` and `npx tsc --noEmit` pass with zero errors.

## Blocked by

None — can start immediately
