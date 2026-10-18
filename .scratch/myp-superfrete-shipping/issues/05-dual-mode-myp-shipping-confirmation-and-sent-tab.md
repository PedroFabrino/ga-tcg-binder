## Parent

#56

## What to build

Bridge released tracking codes in the **`Processed`** tab to MyP's shipping confirmation form (`/pedido/confirmar-envio?id=<orderId>`) via the Tampermonkey userscript (`public/scripts/myp-watchlist-sync.user.js`). Support two selectable execution modes:
1. **Assisted Validation Mode (Default)**: Opens the MyP shipping confirmation page for an order, selects `select#transportadorapedido` (`"correios"`, `"loggi"`, `"jadlog"`, or `"outro"`), fills `input#pedido-numerorastreiopedido`, and dispatches required input/change events to enable `#btn-confirmar-envio` without auto-submitting, allowing the Collector to visually verify and click submit manually.
2. **Batch Auto-Submit Mode**: Dispatches fill-and-submit operations on `form#w0` across all eligible Processed orders with released tracking codes, reporting per-order outcomes.
Successfully confirmed orders are marked as `sent` in libSQL (`fulfillment_orders.status = 'sent'`, `myp_confirmed_at = now()`) and moved to the **`Sent`** tab.

## Acceptance criteria

- [ ] Userscript listens on `/pedido/confirmar-envio?id=<orderId>` and pre-fills `select#transportadorapedido` and `input#pedido-numerorastreiopedido` based on the payload.
- [ ] In **Assisted Validation Mode**, the form is pre-filled and validated without auto-submitting `#btn-confirmar-envio`.
- [ ] In **Batch Auto-Submit Mode**, `form#w0` is automatically submitted for each eligible order in the batch, and individual success/failure results are reported back to the application.
- [ ] Confirmed orders transition from `processed` to `sent` in `fulfillment_orders` and render in the persistent **`Sent`** tab with confirmed timestamp and tracking code.
- [ ] Tests verify DOM form filling against `myp-confirmar-envio.html`, carrier mapping, and status transition to `sent`.

## Blocked by

- #60
