# Specification: Persistent MyP Order Fulfillment, Superfrete Shipping Tickets & Collector Settings

**Status:** `ready-for-agent`

## Problem Statement

Order Fulfillment currently imports MyP sales into volatile browser storage only long enough to render a Pick List and Buyer Pack checklist. The Collector must then manually copy seller and buyer address data into Superfrete, create labels one order at a time, wait for payment and tracking release, and manually enter tracking codes into each MyP shipping-confirmation form.

This workflow has four primary failures:

1. Imported order state, card data, address data, and fulfillment progress are lost after browser storage is cleared, refreshed, or accessed from another device.
2. Multiple orders from the same buyer are not treated as a consolidated physical package, causing unnecessary shipping work and potentially duplicated labels.
3. Superfrete ticket status, tracking numbers, and printable labels are not persisted or synchronized with fulfillment state.
4. Collector configuration is fragmented between a compact navbar modal and hardcoded Price Fairness thresholds, while Superfrete credentials need secure storage.

The application must provide a persistent, user-scoped order fulfillment lifecycle that starts with MyP order import, consolidates orders into Buyer Packs, creates Superfrete cart tickets, synchronizes released tracking information, and supports assisted or batch MyP shipping confirmation.

## Solution

Introduce a persistent Fulfillment domain backed by Turso/libSQL and organized around three lifecycle states:

- **Open**: imported MyP Fulfillment Orders that have not yet been submitted to Superfrete.
- **Processed**: orders attached to a created Superfrete Shipping Ticket and awaiting payment, tracking release, posting, or MyP shipping confirmation.
- **Sent**: orders whose tracking information has been confirmed on MyP.

The Fulfillment view will expose corresponding **Open Orders**, **Processed**, and **Sent** tabs. Open Orders retain the existing Element-grouped Pick List and Buyer Pack workflow, while adding durable Ready/Photographed state per order. A Buyer Pack is always the consolidation of all eligible Open orders for the same `buyerNick`; one selected Buyer Pack produces one Shipping Ticket and transitions all included orders to Processed.

Generating shipping will quote all configured Superfrete services for selected Buyer Packs, apply the carrier-priority rule, and display a review modal before tickets are created. Ready/Photographed Buyer Packs are selected by default; unphotographed packs remain available but are visibly warned and unselected by default.

The Processed tab will synchronize stored Shipping Tickets with Superfrete. Released tracking codes will be available for two MyP confirmation flows: assisted validation, which pre-fills but does not submit the MyP confirmation form, and batch auto-submit, which submits eligible forms and persists orders as Sent.

A dedicated Settings page will centralize MyP username and sync preferences, encrypted Superfrete API credentials, and configurable Price Fairness thresholds used consistently by Marketplace and Deck Shortages.

## User Stories

1. As a Collector, I want imported MyP orders to persist in my account, so that my fulfillment progress survives refreshes, browser changes, and device changes.
2. As a Collector, I want each imported order to retain its sold Printings, buyer address, sender address, and monetary totals, so that I do not need to revisit MyP to manually copy shipment data.
3. As a Collector, I want imported orders to begin in Open status, so that I can distinguish work that has not entered shipping processing.
4. As a Collector, I want Open Orders organized into an Element-grouped Pick List, so that I can efficiently separate all sold cards.
5. As a Collector, I want all Open orders for the same buyer nickname consolidated into one Buyer Pack, so that I prepare one physical shipment and one Superfrete ticket for that buyer.
6. As a Collector, I want to mark an order as Ready/Photographed, so that the shipping workflow indicates whether the package has passed my preparation checkpoint.
7. As a Collector, I want Buyer Packs containing only Ready/Photographed orders selected by default for shipping generation, so that I am protected from accidentally creating labels for unprepared packages.
8. As a Collector, I want unphotographed Buyer Packs to remain selectable with a warning, so that I can intentionally process an exception when needed.
9. As a Collector, I want shipping dimensions standardized to an A4 envelope under 1 kg, so that common card shipments can be quoted without repeatedly entering package measurements.
10. As a Collector, I want the application to quote all supported Superfrete services for every selected Buyer Pack, so that I can review realistic delivery options before creating tickets.
11. As a Collector, I want insurance value based on the buyer's consolidated purchase subtotal plus shipping paid, so that declared value reflects the commercial transaction.
12. As a Collector, I want minimum carrier insurance floors applied when necessary, so that Superfrete requests remain valid for low-value shipments.
13. As a Collector, I want Loggi or Jadlog to be automatically preferred when valid and cheaper, so that I receive the intended carrier preference without manually comparing every quote.
14. As a Collector, I want the cheapest valid Correios option selected when Loggi and Jadlog are unavailable, so that a destination CEP without preferred-carrier coverage remains shippable.
15. As a Collector, I want to see all Buyer Pack ticket previews in a validation modal, so that I can verify recipients, declared values, services, and readiness before creating pending tickets.
16. As a Collector, I want to change a preselected service in the validation modal, so that I can use an acceptable alternative quote for a specific Buyer Pack.
17. As a Collector, I want generated Superfrete tickets to include itemized card products where possible, so that shipment contents are represented accurately in the carrier cart.
18. As a Collector, I want a grouped product fallback when card-level itemization cannot be represented, so that a valid ticket can still be created without losing the shipment workflow.
19. As a Collector, I want all orders included in a created ticket to move to Processed together, so that lifecycle state matches the consolidated package rather than individual browser actions.
20. As a Collector, I want Processed orders to display their Superfrete ticket status, tracking code, and printable-label link, so that I can see what remains to be paid, printed, posted, or confirmed.
21. As a Collector, I want to synchronize tracking data from Superfrete, so that pending tickets can become released or posted without manually copying tracking codes.
22. As a Collector, I want assisted MyP confirmation to open a pre-filled confirmation form without submitting it, so that I can visually validate carrier and tracking information before confirming shipment.
23. As a Collector, I want the MyP form to select the correct carrier value for Correios, Loggi, Jadlog, or Other, so that MyP receives a compatible carrier selection.
24. As a Collector, I want batch auto-submit to process all released Processed orders, so that I can efficiently confirm a large shipment batch after I have chosen to bypass per-order review.
25. As a Collector, I want batch confirmation to mark only successfully submitted orders as Sent, so that failures remain actionable instead of being falsely completed.
26. As a Collector, I want Sent orders retained in a dedicated tab, so that completed fulfillment history remains available without cluttering active work.
27. As a Collector, I want a dedicated Settings page for MyP username and sync preferences, so that integration configuration is discoverable and not split across transient UI.
28. As a Collector, I want my Superfrete production API key encrypted at rest and never shown in plaintext after saving, so that sensitive credentials are protected.
29. As a Collector, I want to know whether a Superfrete API key is configured without seeing its value, so that I can safely manage integration readiness.
30. As a Collector, I want configurable Slightly Overpriced and Heavily Overpriced multipliers, so that Price Fairness matches my own pricing tolerance.
31. As a Collector, I want the same saved Price Fairness thresholds applied in Marketplace and Deck Shortages, so that pricing classifications are consistent throughout the product.
32. As a maintainer, I want fulfillment persistence, Superfrete integration, MyP automation, and settings logic separated behind repositories and services, so that the implementation remains testable and conforms to repository layering rules.
33. As a Portuguese-speaking Collector, I want all new interface text translated in Brazilian Portuguese and English, so that the application remains fully localized.

## Implementation Decisions

### Domain lifecycle and invariants

A Fulfillment Order belongs to one user and has exactly one lifecycle status:

```ts
type FulfillmentOrderStatus = "open" | "processed" | "sent";
type ShippingTicketStatus = "pending" | "released" | "posted" | "unknown";
```

Lifecycle transitions are constrained as follows:

- Import creates or updates an order in `open` state unless it is already linked to a Shipping Ticket or has reached `sent` state.
- Creating a Shipping Ticket transitions every selected order in the consolidated Buyer Pack from `open` to `processed` atomically with persisted ticket linkage.
- Synchronization updates Shipping Ticket status, tracking, and label metadata but does not itself mark an order Sent.
- A successful MyP shipping confirmation transitions an individual Processed order to `sent`.
- An order may not be added to a second active Shipping Ticket.
- A Buyer Pack is derived, not independently mutable: it is the set of eligible Open orders sharing a normalized `buyerNick` for one user.
- A ticket must contain one or more orders, all owned by the same user and all assigned to the same normalized buyer nickname.

The existing Pick List remains a derived presentation of Open order Printings, grouped using English Game Nomenclature for Element names.

### Prototype-derived TypeScript contracts

The following contracts define the application boundary. API DTOs may contain provider-specific additional fields, but persistence and UI should depend on normalized application contracts.

```ts
type MoneyCents = number;

type PostalAddress = {
  fullName: string;
  document: string | null;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  stateAbbr: string;
  postalCode: string;
};

type OrderTotals = {
  subtotalCents: MoneyCents;
  shippingCents: MoneyCents;
  totalCents: MoneyCents;
  shippingMethod: string | null;
};

type FulfillmentPrinting = {
  id: string;
  fulfillmentOrderId: string;
  printingId: string | null;
  cardName: string;
  setCode: string | null;
  collectorNumber: string | null;
  condition: string | null;
  language: string | null;
  quantity: number;
};

type FulfillmentOrder = {
  id: string;
  userId: string;
  mypOrderId: string;
  buyerNick: string;
  buyer: PostalAddress;
  sender: PostalAddress;
  totals: OrderTotals;
  status: FulfillmentOrderStatus;
  isPhotographed: boolean;
  shippingTicketId: string | null;
  mypConfirmedAt: string | null;
  importedAt: string;
  updatedAt: string;
  printings: FulfillmentPrinting[];
};

type BuyerPack = {
  buyerNick: string;
  recipient: PostalAddress;
  orderIds: string[];
  orders: FulfillmentOrder[];
  subtotalCents: MoneyCents;
  buyerShippingCents: MoneyCents;
  totalCents: MoneyCents;
  isReadyForShipping: boolean;
  containsUnphotographedOrders: boolean;
  products: Array<{ description: string; quantity: number; unitaryValueCents: MoneyCents }>;
};

type ShippingServiceCode = "1" | "2" | "17" | "3" | "31";

type CarrierCode = "correios" | "loggi" | "jadlog" | "outro";

type ShippingQuote = {
  serviceCode: ShippingServiceCode;
  serviceName: string;
  carrier: CarrierCode;
  priceCents: MoneyCents | null;
  deliveryDays: number | null;
  hasError: boolean;
  errorMessage: string | null;
  rawProviderData: unknown;
};

type ShippingTicket = {
  id: string;
  userId: string;
  superfreteOrderId: string;
  buyerNick: string;
  status: ShippingTicketStatus;
  carrier: CarrierCode;
  serviceCode: ShippingServiceCode;
  serviceName: string;
  quotedPriceCents: MoneyCents | null;
  insuranceValueCents: MoneyCents;
  trackingCode: string | null;
  printUrl: string | null;
  providerPayload: unknown | null;
  createdAt: string;
  synchronizedAt: string | null;
  updatedAt: string;
};

type SuperfreteCredentialsState = {
  configured: boolean;
  updatedAt: string | null;
};

type UserFulfillmentSettings = {
  mypUsername: string | null;
  mypSyncEnabled: boolean;
  slightlyOverpricedMultiplier: number;
  heavilyOverpricedMultiplier: number;
  superfrete: SuperfreteCredentialsState;
};
```

### Persistence schema

All database access is implemented through focused repositories. Route handlers, actions, UI components, browser scripts, and external-provider clients must not issue database queries directly. Repository methods must scope every read and write by authenticated `userId`.

The logical schema is:

```sql
CREATE TABLE fulfillment_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  myp_order_id TEXT NOT NULL,
  buyer_nick TEXT NOT NULL,
  buyer_full_name TEXT NOT NULL,
  buyer_document TEXT,
  buyer_street TEXT NOT NULL,
  buyer_number TEXT NOT NULL,
  buyer_complement TEXT,
  buyer_district TEXT NOT NULL,
  buyer_city TEXT NOT NULL,
  buyer_state_abbr TEXT NOT NULL,
  buyer_postal_code TEXT NOT NULL,
  sender_full_name TEXT NOT NULL,
  sender_document TEXT,
  sender_street TEXT NOT NULL,
  sender_number TEXT NOT NULL,
  sender_complement TEXT,
  sender_district TEXT NOT NULL,
  sender_city TEXT NOT NULL,
  sender_state_abbr TEXT NOT NULL,
  sender_postal_code TEXT NOT NULL,
  subtotal_cents INTEGER NOT NULL,
  shipping_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  shipping_method TEXT,
  status TEXT NOT NULL CHECK (status IN ('open', 'processed', 'sent')),
  is_photographed INTEGER NOT NULL DEFAULT 0,
  shipping_ticket_id TEXT,
  myp_confirmed_at TEXT,
  imported_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, myp_order_id)
);

CREATE TABLE fulfillment_order_printings (
  id TEXT PRIMARY KEY,
  fulfillment_order_id TEXT NOT NULL,
  printing_id TEXT,
  card_name TEXT NOT NULL,
  set_code TEXT,
  collector_number TEXT,
  card_condition TEXT,
  language TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (fulfillment_order_id) REFERENCES fulfillment_orders(id) ON DELETE CASCADE
);

CREATE TABLE shipping_tickets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  superfrete_order_id TEXT NOT NULL,
  buyer_nick TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'released', 'posted', 'unknown')),
  carrier TEXT NOT NULL CHECK (carrier IN ('correios', 'loggi', 'jadlog', 'outro')),
  service_code TEXT NOT NULL,
  service_name TEXT NOT NULL,
  quoted_price_cents INTEGER,
  insurance_value_cents INTEGER NOT NULL,
  tracking_code TEXT,
  print_url TEXT,
  provider_payload_json TEXT,
  synchronized_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, superfrete_order_id)
);

CREATE INDEX fulfillment_orders_user_status_idx
  ON fulfillment_orders(user_id, status, buyer_nick);
CREATE INDEX fulfillment_orders_shipping_ticket_idx
  ON fulfillment_orders(shipping_ticket_id);
CREATE INDEX fulfillment_printings_order_idx
  ON fulfillment_order_printings(fulfillment_order_id);
CREATE INDEX shipping_tickets_user_status_idx
  ON shipping_tickets(user_id, status);
```

The users table gains or uses these logical fields:

```sql
ALTER TABLE users ADD COLUMN myp_username TEXT;
ALTER TABLE users ADD COLUMN myp_sync_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN superfrete_api_key_encrypted TEXT;
ALTER TABLE users ADD COLUMN slightly_overpriced_multiplier REAL NOT NULL DEFAULT 1.2;
ALTER TABLE users ADD COLUMN heavily_overpriced_multiplier REAL NOT NULL DEFAULT 2.0;
```

Migrations must be idempotent where supported, preserve existing users, backfill the two threshold defaults, and validate that the heavily overpriced multiplier is greater than or equal to the slightly overpriced multiplier.

### MyP import and parsing

MyP import retrieves sale rows and their order detail pages, then parses the verified DOM structures:

- `#comprador-box` supplies recipient name/nickname, document, and address fields.
- `#vendedor-box` supplies sender document and address fields.
- `#valores-box` supplies subtotal, buyer-paid shipping, total, and shipping method.
- Sold card rows supply persisted Fulfillment Printing records.

The parser must normalize BRL values to integer cents, normalize CEP values for provider requests, preserve display-safe formatted values at the UI boundary, and reject incomplete addresses with actionable import errors. The buyer nickname comes from the buyer profile link when available; parsing must not derive identity solely from display name.

Imports are idempotent by `(userId, mypOrderId)`. Re-importing an Open order may refresh source metadata and replace its imported Printings transactionally. Re-importing Processed or Sent orders must not clear ticket linkage, tracking information, confirmation timestamps, or lifecycle status.

### Buyer Pack and Superfrete quoting

Buyer Packs are grouped by normalized `buyerNick` among Open orders. The application must not create separate packs for the same buyer due only to case, whitespace, or source formatting differences.

Every quote uses this fixed package:

```ts
const A4_ENVELOPE_PACKAGE = {
  height: 2,
  width: 21,
  length: 30,
  weight: 1
} as const;
```

The Superfrete calculator request uses service IDs `"1,2,17,3,31"`, `own_hand: false`, `receipt: false`, and `use_insurance_value: true`.

Insurance is calculated from the consolidated Buyer Pack's `subtotalCents + buyerShippingCents`. It must also be compatible with the sum of submitted product unit values multiplied by quantities. Carrier floors are applied to the selected service where needed:

- PAC (`1`) and SEDEX (`2`): minimum R$ 24,50.
- Mini Envios (`17`): minimum R$ 12,25.
- Loggi (`31`) and Jadlog (`3`): use the calculated declared value unless provider validation supplies a stricter requirement.

Quote selection is deterministic:

1. Exclude quotes with `has_error === true` or without a usable price.
2. Among valid Loggi (`31`) and Jadlog (`3`) quotes, select the cheapest.
3. If neither preferred carrier is valid, select the cheapest valid Correios quote among PAC (`1`), SEDEX (`2`), and Mini Envios (`17`).
4. If no service is valid, retain the pack in Open state, show the provider errors, and do not permit ticket creation for that pack.

The quote-preview modal displays recipient, included orders, readiness state, products, insured value, all quote options, current selection, and any errors. The modal defaults checked only for packs in which every included order is photographed. The Collector may select a warned pack explicitly and may choose another valid service before confirmation.

### Superfrete ticket creation and synchronization

Provider calls use the configured production API key only on the server-side integration boundary. Requests include:

- `Authorization: Bearer <token>`
- `User-Agent: GA TCG Binder v1.0 (<email>)`
- `Accept: application/json`
- `Content-Type: application/json`

Cart creation uses `POST /api/v0/cart`, `non_commercial: true`, the selected service, calculated insurance value, `platform: "GA TCG Binder"`, and product lines containing itemized card names. Product line construction should group identical card descriptions while preserving total quantity and declared value. If provider constraints prevent card-level lines, a grouped fallback description is allowed, but must still represent the package contents and declared total.

After a successful provider cart response, persistence of the Shipping Ticket and updates of all included orders must occur in one database transaction. If persistence fails, the operation must surface recovery information including the returned Superfrete order identifier; it must never silently create a duplicate ticket on retry.

Tracking synchronization requests `GET /api/v0/order/info/{id}` for each stored ticket selected for sync. It updates ticket status, tracking code, printable label URL, raw provider payload, and synchronization timestamp. Synchronization is idempotent and must preserve previously known non-empty tracking and print URL fields if an incomplete provider response omits them.

### MyP shipping confirmation integration

The userscript and application communicate through an explicit, versioned browser-safe payload containing only the MyP order ID, selected carrier, tracking code, mode, and a correlation identifier. Credentials and broader user data must never be passed to the userscript.

Carrier mapping is:

```ts
function toMypCarrier(carrier: CarrierCode): "correios" | "loggi" | "jadlog" | "outro" {
  if (carrier === "correios" || carrier === "loggi" || carrier === "jadlog") return carrier;
  return "outro";
}
```

On MyP confirmation pages, the userscript targets the verified controls:

- carrier select: `select#transportadorapedido`
- tracking input: `input#pedido-numerorastreiopedido`
- form: `form#w0`
- confirmation button: `#btn-confirmar-envio`

Assisted Validation Mode is the default. It opens one confirmation page per eligible order, selects the mapped carrier, fills the tracking code, and dispatches required `input` and `change` events. It leaves the textarea empty and never auto-submits.

Batch Auto-Submit Mode operates only on Processed orders with a released or posted ticket and a non-empty tracking code. It fills the same fields, submits `form#w0`, and reports a per-order result. The application marks an order Sent only after a successful confirmation result. Failures remain Processed and are shown with retry guidance.

### Settings, encryption, and Price Fairness

The Settings page replaces the fragmented settings experience for this scope. It provides MyP username, MyP sync preference, Superfrete credential management, and Price Fairness thresholds.

The Superfrete API key is encrypted before persistence using AES-256-GCM through the established crypto abstraction. Encryption must use a server-held key and a fresh random IV per encryption operation. The persisted ciphertext must contain or be associated with the IV and authentication tag needed for authenticated decryption. API responses return only configuration state and metadata, never the plaintext API key or decryptable material. Saving a blank key leaves the existing key unchanged unless the Collector explicitly chooses a supported credential-removal action.

Threshold validation requires finite positive values and `heavilyOverpricedMultiplier >= slightlyOverpricedMultiplier`. Defaults are `1.2` and `2.0`. Price Fairness evaluation receives user settings or resolved defaults as an explicit input; it must not use hardcoded threshold constants. Marketplace and Deck Shortages consume the same evaluation behavior.

### UI, localization, and operational constraints

All new user-visible strings, validation text, action labels, loading states, empty states, confirmation content, and error messages must be represented in the shared i18n contract for both `en` and `pt-BR`. Game Nomenclature remains English, including Element group labels.

Database files, repositories, services, UI modules, and userscript modules must remain focused and below the repository's file-size constraint. Provider payloads are isolated behind a Superfrete client/service boundary. Domain rules such as quote selection, insurance calculation, pack grouping, and lifecycle transition validation must be pure functions where practical.

## Testing Decisions

### Primary Testing Seams

Rather than scattering brittle unit tests across internal helpers, we test at two high-level behavioral seams backed by an in-memory Drizzle/libSQL database, anonymized HTML fixtures (`myp-pedido.html` and `myp-confirmar-envio.html`), and mocked `fetch` transport for Superfrete (`https://api.superfrete.com`):

1. **Fulfillment Lifecycle, Superfrete Service & DOM Parser Seam (`src/services/fulfillment*.ts` + `/api/marketplace/fulfillment/*`)**:
   - **MyP Order Page & Confirmation DOM Parsing**: Given anonymized `/pedido/<id>` HTML (`#comprador-box`, `#vendedor-box`, `#valores-box`, item rows) and `/pedido/confirmar-envio?id=<id>` HTML (`form#w0`, `select#transportadorapedido`, `input#pedido-numerorastreiopedido`), verify extraction of Sender, Recipient, BRL totals, sold Printings, and carrier/tracking form population in both Assisted Validation (no auto-submit) and Batch Auto-Submit modes.
   - **Persistent Order Lifecycle (`Open` → `Processed` → `Sent`)**: Against an in-memory libSQL database, verify idempotent order import, preservation of `Processed` / `Sent` state on re-import, `isPhotographed` toggling, and consolidated **Buyer Pack** grouping by `buyerNick`.
   - **Superfrete Calculator, Carrier Priority & Cart Ticket Creation**: Using mocked Superfrete HTTP responses (`POST /api/v0/calculator`, `POST /api/v0/cart`, `GET /api/v0/order/info/{id}`), verify:
     - A4 envelope package (`2 x 21 x 30 cm`, `1 kg`) and insurance calculation (`subtotal + buyer shipping`, clamped to `R$ 24,50` for PAC/SEDEX and `R$ 12,25` for Mini Envios when lower, aligned with declared `products` sum).
     - Carrier priority selecting the cheapest valid (`has_error === false`) option between **Loggi (`31`)** and **Jadlog (`3`)**, falling back to the cheapest valid **Correios (`1`, `2`, `17`)** option when neither is available.
     - Creating a `pending` **Shipping Ticket** transitions all orders in the consolidated **Buyer Pack** to `Processed`, and syncing a `released` ticket populates `trackingCode` and `printUrl`.
2. **Collector Settings & Price Fairness Seam (`src/services/settings.ts` + `evaluatePriceFairness`)**:
   - Verify saving/replacing `superfreteApiKey` encrypts the token at rest with AES-256-GCM and never returns plaintext in `SafeUser` / `GET /api/settings`.
   - Verify custom `slightlyOverpricedThreshold` (default `1.2`) and `heavilyOverpricedThreshold` (default `2.0`) persist on `users` and dynamically drive `evaluatePriceFairness` across Marketplace and Deck Shortages.
   - Verify i18n dictionary completeness (`en` and `pt-BR`) via the existing `@ga/contracts` parity test suite.

### What Makes a Good Test

A good test verifies observable domain outcomes at the service/API boundary—persisted lifecycle state, outbound Superfrete request payloads, normalized quote selection, and MyP form mutations—never internal implementation details.

### Prior Art

Follows the established in-memory Drizzle/libSQL + fixture test patterns in `src/services/marketplace.test.ts`, `src/services/__tests__/watchlist.test.ts`, and `src/app/api/watchlist/__tests__/watchlist-api.test.ts`.

## Out of Scope

- Direct payment of Superfrete tickets from the application.
- Printing Superfrete labels inside the application rather than linking to the provider's printable URL.
- Automatic carrier pickup scheduling, drop-off booking, or postal manifest generation.
- Support for package types, dimensions, or weights other than the standardized A4 envelope under 1 kg.
- Splitting one buyer's eligible Open orders into multiple tickets based on package capacity, shipment date, or manually selected subsets.
- Multi-sender selection or sender-address editing within the fulfillment workflow.
- Automatic MyP shipping confirmation without either an explicit batch-mode action or the Collector clicking confirmation in assisted mode.
- Scraping, storing, or transmitting MyP passwords.
- Automatic cancellation, refund, relabeling, or voiding of Superfrete tickets.
- Carrier-specific service guarantees beyond the Superfrete response and the stated selection policy.
- Historical migration of data that existed only in expired browser localStorage.
- Broad redesign of Marketplace, Deck Shortages, or unrelated settings beyond wiring configurable Price Fairness thresholds.

## Further Notes

- Monetary values are stored and calculated as integer BRL cents to avoid floating-point errors. Formatting into `R$` is a presentation concern.
- Timestamps should be stored in UTC ISO-8601 form and formatted in the user's locale at the UI boundary.
- The sender attached to a Buyer Pack is expected to be consistent across its orders. If import data detects materially conflicting sender addresses for the same buyer pack, creation must be blocked with a clear resolution message rather than silently selecting one.
- A generated Superfrete cart ticket is intentionally `pending`; the application must communicate that payment and label release happen in the Superfrete panel.
- Provider API failures must be actionable and preserve enough safe diagnostic information for support, while never logging or returning the Superfrete token.
- Ticket creation should use idempotency protection at the application boundary where supported by the provider, and always check existing order-to-ticket linkage before retrying.
- The Sent transition represents successful MyP confirmation, not merely a released Superfrete tracking code or physical carrier posting event.
- Accessibility requirements apply to tabs, checkboxes, dialogs, warning badges, service selectors, loading indicators, and status messages. The validation modal must support keyboard navigation and a clear cancel action.
