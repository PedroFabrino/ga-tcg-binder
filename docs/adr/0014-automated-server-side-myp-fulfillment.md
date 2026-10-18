# ADR-0014: Automated Server-Side MyP Fulfillment with Tampermonkey Fallback

- **Status:** Accepted
- **Date:** 2026-10-18
- **Decision makers:** ga-tcg-binder maintainers
- **Related areas:** MyP order ingestion, Superfrete shipping, dashboard, fulfillment reconciliation, PII protection

## Context

The application currently relies on Tampermonkey-assisted workflows to access and process MyP marketplace orders.

This workflow requires manual browser interaction and is therefore limited in reliability, observability, and scalability. The application needs a server-side mechanism capable of reading MyP sales and order details so that fulfillment status can be monitored and eventually coordinated with Superfrete shipping workflows.

MyP may require browser-like session behavior and may be protected by anti-bot mechanisms. Therefore, a regular HTTP client alone may not reliably access authenticated MyP pages. FlareSolverr is proposed as the session/browser-solving component for the server-side integration.

The migration must not remove the current Tampermonkey workflow before the new mechanism is proven reliable. Tampermonkey remains valuable as a manual and operational fallback.

The domain also includes sensitive buyer information, order cancellation requests, and paid shipping tickets. These cases require explicit safety rules before any automation is allowed to mutate external systems.

## Decision

### 1. Keep Tampermonkey as an active parallel fallback

Tampermonkey will remain enabled and supported.

It is not removed, disabled, or replaced immediately. The server-side engine will operate alongside it until the new workflow has demonstrated sufficient reliability and operational confidence.

Tampermonkey remains available for:

- Manual order inspection.
- Recovery from server-side automation failures.
- Exceptional operational scenarios.
- Transitional support while the automated engine is being introduced.

### 2. Introduce a server-side MyP read integration through FlareSolverr

The application will introduce a server-side MyP integration that uses FlareSolverr for authenticated browser-like access and content extraction.

The initial responsibility of this integration is limited to reading MyP data required for order discovery and inspection.

The integration will be designed behind an explicit adapter boundary so that FlareSolverr, MyP parsing, and session handling are isolated from fulfillment domain logic:

- `MypClient` or `MypGateway`: authenticated MyP access and HTML/content retrieval.
- `MypOrderParser`: conversion of MyP pages into application-level order data.
- `OrderReconciliationService`: comparison of MyP order state and Superfrete state.
- `FulfillmentRepository`: persistence of normalized order and reconciliation records.

### 3. Perform a strictly read-only feasibility spike before implementation

Before building recurring automation, the team will implement and run a read-only spike script.

The spike is restricted to:

1. Authentication/login flow.
2. `GET /vendas`.
3. `GET /pedido/<id>`.

The spike must not perform any mutating operation, including:

- Creating or editing orders.
- Changing MyP order status.
- Sending messages.
- Requesting or confirming cancellation.
- Creating, purchasing, voiding, or refunding Superfrete tickets.
- Updating fulfillment records in external systems.
- Triggering any action that changes marketplace or shipping state.

The spike may write local development diagnostics only if those diagnostics do not contain unencrypted PII and do not expose credentials, cookies, session tokens, addresses, phone numbers, or buyer names.

### 4. Use conservative polling

The automated server-side engine will use conservative polling:

- At most once per hour in scheduled operation.
- A manual on-demand refresh action available in the dashboard.

Higher-frequency polling is not adopted at this stage because selling volume is modest and conservative access reduces load, session churn, and anti-bot risk.

The scheduler must prevent overlapping runs. If a previous run is still active, a subsequent scheduled run must be skipped or safely coalesced.

### 5. Reconcile buyer cancellation requests with Superfrete ticket state

When MyP indicates that a buyer requested cancellation, the system must reconcile that request with the associated Superfrete ticket state.

#### Unpaid Superfrete ticket

If the related Superfrete cart ticket has status `pending`, the dashboard must show a safe warning indicating:

- The buyer requested cancellation on MyP.
- The Superfrete ticket has not been paid.
- The order can be safely cancelled.
- The pending cart ticket can be discarded.

The system must not automatically cancel the MyP order or discard the ticket during this phase. The warning supports an informed user action.

#### Paid Superfrete ticket

If the related Superfrete ticket is already paid, the dashboard must show a high-severity alert indicating:

- The buyer requested cancellation on MyP.
- The Superfrete ticket was already purchased.
- The case requires manual intervention and, if appropriate, a refund or other resolution in Superfrete.

The system must not automatically cancel, refund, void, or otherwise alter the paid Superfrete ticket.

### 6. Protect PII through encryption, redaction, and minimal retention

Personally identifiable information obtained from MyP, including buyer and delivery information, must be handled according to the following rules:

- Encrypt PII at rest using `src/lib/crypto.ts`.
- Redact PII from application logs, error reports, diagnostics, and job telemetry.
- Do not log credentials, cookies, session tokens, authorization headers, raw MyP pages, or raw buyer addresses.
- Retain PII only for the minimum period needed for fulfillment, shipping, reconciliation, support, and legally required records.
- Prefer storing normalized operational fields over raw page payloads.
- Restrict access to decrypted PII to application paths that require it for authorized fulfillment work.

## Consequences

### Positive consequences

- The application gains a path toward automated MyP order discovery without immediately losing the existing operational workflow.
- Tampermonkey provides a practical fallback while the server-side approach is validated.
- The read-only spike reduces the risk of accidental marketplace or shipping mutations.
- Conservative polling reduces operational load and anti-bot exposure.
- Explicit cancellation rules prevent unsafe handling of paid Superfrete tickets.
- Encryption and log redaction reduce PII exposure risk.

### Negative consequences

- The system will temporarily maintain two operational paths: Tampermonkey and server-side automation.
- FlareSolverr introduces infrastructure, operational monitoring, and session-management complexity.
- Read-only automation does not yet eliminate manual fulfillment work.
- Hourly polling may delay order visibility compared with real-time event-driven integrations.
- Manual intervention remains required for cancellation cases involving paid Superfrete tickets.

### Neutral and deferred consequences

The following decisions are intentionally deferred until the read-only spike succeeds:

- Whether automated MyP status updates are technically and operationally safe.
- Whether the system may create Superfrete carts automatically.
- Whether the system may purchase Superfrete tickets automatically.
- Whether cancellation actions can ever be automated.
- Whether polling frequency should be increased.
- Whether FlareSolverr remains the long-term integration mechanism.

## Implementation Guardrails

1. All initial MyP automation code must be read-only.
2. All HTTP methods used by the spike must be `GET`, except where an unavoidable authentication transport detail is required and explicitly reviewed. No request may cause a MyP or Superfrete state change.
3. The spike must use stored user credentials only with explicit operator approval.
4. Session credentials and cookies must be stored securely and never emitted to logs.
5. Raw HTML responses must not be persisted by default.
6. Parsed order data must be validated before it is displayed or persisted.
7. Dashboard alerts must clearly distinguish:
   - Buyer cancellation requested with pending/unpaid Superfrete ticket.
   - Buyer cancellation requested with paid Superfrete ticket.
8. No automated cancellation, ticket discard, ticket purchase, refund, or void action is authorized by this ADR.

## Empirical Spike Findings (2026-10-18)

A comprehensive feasibility spike was conducted across both environments:
1. **GitHub Actions (Datacenter IP)** via workflow `.github/workflows/spike-myp-order-sync.yml`
2. **Local Machine (Residential IP)** via local Docker FlareSolverr (`ghcr.io/flaresolverr/flaresolverr:latest` on port 8899)

### Technical Analysis & Root Causes:

1. **Direct HTTP Clients (Fetch/Got/Curl)**:
   - Blocked immediately by Cloudflare WAF with `HTTP 403 Forbidden` (`<title>Just a moment...</title>`). Cloudflare enforces TLS/JA4 ClientHello fingerprinting, preventing Node.js `fetch` from reusing `cf_clearance` cookies outside a real browser TLS stack.

2. **FlareSolverr Headless Session (`request.post`)**:
   - FlareSolverr cleanly passes the Cloudflare challenge on `GET /login`.
   - However, FlareSolverr's internal implementation of `request.post` (`flaresolverr_service.py: _post_request`) constructs a synthetic form (`hackForm`) and navigates to `data:text/html;charset=utf-8,...`.
   - This causes two fatal incompatibilities with MyP's Yii2 PHP framework:
     - **Origin Mismatch**: Navigation from `data:` yields `Origin: null`, which Yii2 CSRF protection strictly rejects.
     - **Double Encoding**: FlareSolverr applies `quote(name)` and `quote(value)` to form parameters. When Chromium submits the form, it URL-encodes `%` to `%25` (e.g., `LoginForm[username]` becomes `LoginForm%255Busername%255D`), corrupting the form parameter dictionary and the CSRF token.
   - Result: Both GitHub Actions and local residential Docker return `HTTP 400 Bad Request (Problema Encontrado!)`.

### Conclusion & Operational Directive:

- **Headless Server-Side MyP Login**: Proved unviable using off-the-shelf FlareSolverr `request.post` without maintaining a custom, dedicated Playwright/Puppeteer stealth runtime with native DOM input population.
- **Tampermonkey Architectural Role**: The user's directive to keep Tampermonkey enabled was completely validated. Running inside the user's real browser context bypasses Cloudflare WAF, TLS fingerprinting, and CSRF barriers effortlessly.
- **Next Operational Step**: Retain Tampermonkey as the primary order ingestion vector (`POST /api/marketplace/fulfillment`). Focus backend automation strictly on Superfrete shipping workflows, cart creation, tracking number updates, and fulfillment reconciliation.

