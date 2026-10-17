## Parent

#51 (`docs/myp-fulfillment-spec.md`)

## What to build

Extend the auditable Tampermonkey userscript (`public/scripts/myp-watchlist-sync.user.js`) so that when a Collector visits `https://mypcards.com/<nick>/vendas`, they can select pending **Fulfillment Orders**, scrape each `/pedido/<id>` with polite sequential pacing, enrich items via `/api/marketplace/fulfillment`, and use an interactive 2-phase Pick & Pack overlay modal directly on MyP Cards:

1. **In-Page `/vendas` Controls**:
   - Inject a selection checkbox into each row of the **Aguard. envio** table (checked by default) plus a select-all toggle and an optional checkbox to include **Em separação** rows.
   - Inject a **"📦 Separar Envios"** action button in the `/vendas` header (alongside a configurable `appUrl` setting defaulting to the local/production Grand Archive TCG Binder origin).
2. **Polite Sequential `/pedido/<id>` Scraper & `sessionStorage` Cache**:
   - Iterate through selected order IDs sequentially (`for ... of`) with a 400–600ms delay between `GET /pedido/<id>` requests and a live progress bar (`Lendo pedido X de Y (#654326)...`).
   - Cache parsed order items in `sessionStorage` keyed by `orderId` so reopening the modal or changing selection does not re-fetch already-loaded orders.
   - Strictly ignore the `Comprador` PII block (`CPF`, full legal name, street address), extracting only `orderId`, `orderDate`, `buyerNick`, `shippingMethod`, `status`, and the `Itens` rows.
3. **Interactive Two-Phase Modal & Handoff**:
   - Call `POST ${appUrl}/api/marketplace/fulfillment` to enrich the scraped orders with canonical **Elements** (`Norm`, `Fire`, `Water`, etc.).
   - **Tab 1 — Pick List (Por Elemento)**: Render each canonical **Element** group (`Norm:`, `Fire:`, ...) and its alphabetically sorted cards (`Card Name [SET #NUM · Cond] xQty` + loud `[FOIL]` badge), with persistent `localStorage` checkboxes to check off cards as they are pulled from storage boxes.
   - **Tab 2 — Buyer Packs (Por Comprador e Pedido)**: Render buyer groups (`Betinho3 — 5 pedidos · Enviar juntos`) highlighting paid shipping methods (`PAC`, `Frete Fixo`) over `Frete combinado`, sub-grouped by each individual **Fulfillment Order** (`Pedido #654326`). Include per-item checkboxes, an **"Order Completed / Photographed"** checkbox per order `#` (persisted in `localStorage`), and a direct `"Abrir #654326 ↗"` link.
   - **Non-Grand Archive Callout**: Render any non-Grand Archive orders (e.g., Pokémon) in a distinct notice banner (`Pedido #653529 (Buyer) — Não é Grand Archive`) with a direct link to `/pedido/<id>`.
   - **Export & Handoff Actions**: Include a **"📋 Copiar Texto"** button (copying the formatted Element Pick List + Buyer Breakdown) and an **"🔗 Abrir no GA Binder"** button that hands off the enriched report to the web application.

## Acceptance criteria

- [ ] Visiting `https://mypcards.com/*/vendas` with the userscript active renders per-row checkboxes on `Aguard. envio` (checked by default), an optional `Em separação` toggle, and the `"📦 Separar Envios"` button without breaking existing `#ga_watchlist_sync=` functionality.
- [ ] Clicking `"📦 Separar Envios"` fetches selected `/pedido/<id>` pages sequentially with 400–600ms pacing, caches results in `sessionStorage`, and never reads or transmits buyer `CPF` or physical address fields.
- [ ] The on-page modal displays **Phase 1 (Pick List by Element)** and **Phase 2 (Buyer Packs grouped by Buyer $\rightarrow$ sub-grouped by Order `#`)** with persistent `localStorage` checkboxes for pulled items and completed/photographed orders.
- [ ] Non-Grand Archive orders (such as `pokemon_*`) appear in a dedicated notice banner with a clickable link to `/pedido/<id>` and do not appear in the Grand Archive Element counts.
- [ ] Clicking `"📋 Copiar Texto"` copies the clean text breakdown (`Norm:\nVoid's Cloak [RDO #029 · NM] x1...`) to the clipboard, and clicking `"🔗 Abrir no GA Binder"` opens the web application with the fulfillment batch ready to view.
- [ ] Automated unit/integration tests verify the userscript's DOM extraction and formatting helpers.

## Blocked by

- #52
