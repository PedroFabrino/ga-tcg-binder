# 0013: Persistent Order Fulfillment Lifecycle, Superfrete Shipping Tickets, and Collector Settings Page

Status: accepted

## Context
Previously, Order Fulfillment imported **Fulfillment Orders** from `mypcards.com/<nick>/vendas` and `/pedido/<id>` into volatile browser `localStorage` purely to render a temporary **Pick List** and **Buyer Pack** checklist. Once separated and photographed, the Collector still had to manually copy sender and buyer addresses into Superfrete (`https://api.superfrete.com`), quote and generate shipping labels one by one, wait for payment to release tracking numbers, and manually paste tracking codes into MyP's shipping confirmation form (`/pedido/confirmar-envio?id=<orderId>`). Furthermore, per-user settings (`mypUsername`, API credentials, and **Overpriced Listing** thresholds) were split between a compact navbar modal and hardcoded constants (`1.2x` / `2.0x`).

## Decision
1. **Persistent Fulfillment Order Lifecycle (`Open` → `Processed` → `Sent`)**:
   - Store imported **Fulfillment Orders**, their sold **Printings**, and parsed `#vendedor-box` (Sender) / `#comprador-box` (Recipient) / `#valores-box` (Subtotal, Shipping, Total) metadata in Turso/libSQL via a dedicated `src/db/repositories/fulfillment-repository.ts` (per ADR 0012).
   - Expose three lifecycle tabs in the Fulfillment view:
     - **`Open Orders`**: Card separation via the Element-grouped **Pick List** and consolidated **Buyer Packs**, allowing the Collector to mark orders as Ready/Photographed (`isPhotographed`).
     - **`Processed`**: Orders linked to a generated Superfrete **Shipping Ticket** awaiting payment in the Superfrete panel, tracking synchronization, or MyP shipping confirmation.
     - **`Sent`**: Completed orders whose tracking code has been confirmed on MyP.

2. **Consolidated Buyer Pack Quoting & Superfrete Cart Ticket Creation**:
   - Always consolidate multiple `Open` **Fulfillment Orders** from the same `buyerNick` into a single **Buyer Pack** and a single **Shipping Ticket**.
   - Standardize physical package dimensions to an A4 envelope under 1 kg (`height: 2` cm, `width: 21` cm, `length: 30` cm, `weight: 1` kg).
   - When the Collector clicks **"Gerar Fretes / Generate Shipping"**, quote all services (`"1,2,17,3,31"`) via `POST /api/v0/calculator` with `use_insurance_value: true` and `insurance_value` equal to the consolidated purchase subtotal plus shipping paid by the buyer (clamped to the carrier's minimum insurance floor when required).
   - **Carrier Priority**: Automatically pre-select the cheapest valid (`has_error === false`) quote between **Loggi (`31`)** and **Jadlog (`3`)**; if neither is available for the destination CEP, fall back to the cheapest valid **Correios** option (`1: PAC`, `2: SEDEX`, `17: Mini Envios`).
   - Present a validation modal with all consolidated **Buyer Pack** ticket previews (Ready/Photographed packs checked by default). On confirmation, call `POST /api/v0/cart` (`non_commercial: true`, itemized card names in `products`) to create `pending` **Shipping Tickets** in the Collector's Superfrete panel (`https://web.superfrete.com/#/minhas-etiquetas`) for individual payment, transitioning those orders to `Processed`.

3. **Tracking Synchronization & Dual-Mode MyP Shipping Confirmation**:
   - In the `Processed` tab, **"Sincronizar Rastreios / Sync Tracking"** queries Superfrete `GET /api/v0/order/info/{id}` for each stored **Shipping Ticket**, updating its status (`pending` → `released` / `posted`), `tracking` code, and printable label URL (`print.url`).
   - Extending the Tampermonkey userscript (`public/scripts/myp-watchlist-sync.user.js`) on `/pedido/confirmar-envio?id=<orderId>`, support two confirmation modes from the `Processed` tab:
     - **Assisted Validation Mode (Default)**: Opens `/pedido/confirmar-envio?id=<orderId>` and pre-fills `select#transportadorapedido` (`"loggi"`, `"jadlog"`, `"correios"`, or `"outro"`) and `input#pedido-numerorastreiopedido` without auto-submitting, allowing the Collector to visually verify and click `#btn-confirmar-envio`.
     - **Batch Auto-Submit Mode**: Automatically fills and submits `form#w0` across all `Processed` orders that have a released tracking code, transitioning them to `Sent`.

4. **Dedicated `/settings` Page & Configurable Price Fairness Thresholds**:
   - Create a dedicated `/settings` route hosting:
     - **MyP Username** (`mypUsername`) and MyP sync preferences.
     - **Superfrete Production API Key** (stored encrypted at rest on the `users` row using `src/lib/crypto.ts` AES-256-GCM, never exposed in plaintext after saving).
     - **Overpriced Listing Thresholds**: per-user configurable multipliers for **Slightly Overpriced** (default `1.2x`) and **Heavily Overpriced** (default `2.0x`) used by **Price Fairness** evaluation across Marketplace and Deck Shortages.

## Consequences
- Eliminates manual address transcription and per-order shipping form entry while preserving two human validation gates: (1) reviewing consolidated **Buyer Pack** quotes before pushing `pending` tickets to Superfrete's cart, and (2) optionally reviewing pre-filled tracking forms on MyP before submission.
- Persisting **Fulfillment Orders** and **Shipping Tickets** in Turso ensures order progress, Superfrete ticket IDs, and tracking numbers survive browser refreshes and devices while adhering strictly to the repository layering rules in ADR 0012.
