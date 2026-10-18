## Parent

#56

## What to build

Extend the MyP `/pedido/<id>` DOM parser and Tampermonkey userscript bridge (`public/scripts/myp-watchlist-sync.user.js`) to extract Sender (`#vendedor-box`), Recipient (`#comprador-box`), and Totals/Shipping (`#valores-box`) alongside sold Printings. Persist imported Fulfillment Orders in Turso/libSQL via a dedicated `src/db/repositories/fulfillment-repository.ts` (`fulfillment_orders`, `fulfillment_order_printings`, `shipping_tickets`) instead of volatile `localStorage`. Reorganize the fulfillment UI into persistent `Open Orders`, `Processed`, and `Sent` tabs, with durable Pick List check states and order-level Ready/Photographed (`isPhotographed`) toggles.

## Acceptance criteria

- [ ] New database tables: `fulfillment_orders`, `fulfillment_order_printings`, and `shipping_tickets` (repository queries strictly inside `src/db/repositories/fulfillment-repository.ts` per ADR 0012).
- [ ] Parser extracts `#vendedor-box` (Sender), `#comprador-box` (Recipient), `#valores-box` (Subtotal, Shipping, Total), and item lines from `/pedido/<id>` HTML.
- [ ] Userscript imports and persists selected `/vendas` orders to `/api/marketplace/fulfillment/orders`, saving or updating them in `open` status idempotently.
- [ ] Fulfillment view renders 3 persistent tabs: `Open Orders`, `Processed`, and `Sent`.
- [ ] `Open Orders` tab renders the Element-grouped Pick List and Buyer Packs, with persistent per-order Ready/Photographed (`isPhotographed`) toggle persisted in the database.
- [ ] Unit & repository integration tests with in-memory libSQL and `myp-pedido.html` fixtures pass.

## Blocked by

- None — can start immediately
