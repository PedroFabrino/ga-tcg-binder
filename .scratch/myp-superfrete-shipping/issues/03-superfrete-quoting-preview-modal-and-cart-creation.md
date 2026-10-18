## Parent

#56

## What to build

Implement the **"Gerar Fretes / Generate Shipping"** workflow in the `Open Orders` tab. The application consolidates all Open orders for the same `buyerNick` into a single **Buyer Pack** (standard A4 envelope: `2 x 21 x 30 cm`, `1 kg`), quotes shipping via Superfrete `POST /api/v0/calculator` with declared value insurance (`subtotal + buyer shipping` clamped to carrier minimum floors and aligned with declared products), and automatically applies the carrier preference rule (cheapest valid option between Loggi `31` and Jadlog `3` first; falling back to cheapest valid Correios `1 / 2 / 17`). A Ticket Preview & Validation Modal displays all consolidated Buyer Packs (with Ready/Photographed packs checked by default and unphotographed packs warned and unchecked by default). On Collector confirmation, calls Superfrete `POST /api/v0/cart` to create `pending` **Shipping Tickets** in the Collector's Superfrete panel (`https://web.superfrete.com/#/minhas-etiquetas`), atomically transitioning those orders to the `Processed` tab.

## Acceptance criteria

- [ ] Buyer Pack consolidation correctly combines multiple Open orders with the same `buyerNick` into a single physical parcel quote.
- [ ] Superfrete calculator integration (`POST /api/v0/calculator`) uses standard A4 envelope package (`2 x 21 x 30 cm`, `1 kg`) and calculates insurance (`subtotal + buyer shipping`), respecting carrier minimum insurance floors.
- [ ] Carrier selection deterministically selects the cheapest valid quote between Loggi (`31`) and Jadlog (`3`) first, falling back to cheapest valid Correios (`1: PAC`, `2: SEDEX`, `17: Mini Envios`).
- [ ] Ticket Preview & Validation Modal renders all consolidated Buyer Packs with Ready/Photographed packs pre-checked, unphotographed packs warned, and a service dropdown selector.
- [ ] Confirming the modal calls Superfrete `POST /api/v0/cart` (`non_commercial: true`, itemized card products) using the decrypted Superfrete token, persists the created `shipping_tickets` row (`status: 'pending'`), and updates all included `fulfillment_orders` to `processed`.
- [ ] Integration tests using mocked Superfrete HTTP responses and in-memory libSQL verify quoting, priority selection, modal confirmation, and atomic order transitions.

## Blocked by

- #57
- #58
