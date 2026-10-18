## Parent

#56

## What to build

Build the operational UI and synchronization workflow for the **`Processed`** tab. Collectors can view all active Superfrete **Shipping Tickets** (`pending`, `released`, `posted`), their carrier badge, service name, declared insurance, price, linked MyP orders, and a direct link to the Superfrete panel (`https://web.superfrete.com/#/minhas-etiquetas`) to pay for pending tickets. A **"Sincronizar Rastreios / Sync Tracking"** button queries Superfrete `GET /api/v0/order/info/{id}` for all stored tickets, persisting updated statuses, postal tracking codes (`tracking`), and printable PDF label links (`print.url`) in libSQL and updating the UI in place.

## Acceptance criteria

- [ ] `Processed` tab displays all tickets with provider status badges (`pending`, `released`, `posted`), carrier, price, and linked orders.
- [ ] Direct link to the Superfrete web panel (`https://web.superfrete.com/#/minhas-etiquetas`) allows Collectors to complete payment for pending labels.
- [ ] **"Sincronizar Rastreios / Sync Tracking"** button calls `/api/marketplace/fulfillment/shipping/sync`, querying Superfrete `GET /api/v0/order/info/{id}` for each stored ticket.
- [ ] Tickets with status `released` or `posted` receive their postal tracking code and printable PDF label URL (`print.url`), updating `shipping_tickets` and rendering a clickable print button.
- [ ] Tests verify idempotent tracking sync, status transitions (`pending` -> `released`), and correct handling of provider error responses.

## Blocked by

- #59
