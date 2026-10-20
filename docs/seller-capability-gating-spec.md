## Problem Statement

A Collector currently encounters private MyP selling and SuperFrete shipping workflows alongside core Binder and Deck functionality regardless of whether they sell cards or have configured the required credentials. This exposes store synchronization, MyP order fulfillment, the browser userscript bridge, shipping-ticket operations, and shipping settings to regular collectors who only need to find cards for their Decks. Hidden UI alone would also leave direct routes and APIs callable without the required configuration.

## Solution

Introduce explicit **Seller Mode** and centrally evaluated capabilities. A Collector receives **Vendor Capability** only after explicitly enabling Seller Mode and saving complete MyP credentials. Vendor Capability unlocks private Store Listing, Store Sync, MyP Orders/Fulfillment, and userscript workflows. A Collector receives **Shipping Capability** only when Vendor Capability and a saved SuperFrete API key are both present; it unlocks all SuperFrete shipping operations and shipping-package settings.

Regular collectors retain core Binder, Deck, public Marketplace, and card-finding functionality. The managed MyP Watchlist remains a collector-facing card-finding aid governed by its own setting and MyP credentials, independently of Seller Mode. Unavailable independent pages and APIs behave as absent by returning 404; an unavailable MyP Store query subview falls back to the ordinary All Cards collection view.

## User Stories

1. As a regular Collector, I want core Binder and Deck features without seller workflows, so that the application remains focused on finding cards for my Decks.
2. As a regular Collector, I want public Marketplace data and shortage recommendations to remain available, so that I can locate cards without becoming a seller.
3. As a Collector, I want to save MyP credentials before choosing Seller Mode, so that private marketplace workflows cannot be enabled without required configuration.
4. As a Collector, I want an explicit Seller Mode opt-in, so that seller workflows are only exposed after deliberate consent.
5. As a Collector with incomplete MyP credentials, I want seller functionality to remain unavailable, so that incomplete configuration does not create a broken operational state.
6. As a Collector with Seller Mode disabled, I want private Store Listings to be hidden, so that my collection UI does not include irrelevant seller features.
7. As a Collector with Seller Mode disabled, I want Store Sync to be unavailable, so that private MyP store operations cannot be triggered accidentally.
8. As a Collector with Seller Mode disabled, I want the MyP Orders/Fulfillment area to be unavailable, so that buyer information and fulfillment controls are not exposed outside seller workflows.
9. As a Collector with Seller Mode disabled, I want the Tampermonkey/userscript bridge hidden, so that I am not asked to install seller-only browser tooling.
10. As a Collector with Vendor Capability, I want Store Listings and Store Sync available, so that I can manage cards listed in my external store.
11. As a Collector with Vendor Capability, I want MyP Orders/Fulfillment available even without a SuperFrete key, so that I can process private marketplace orders before configuring shipping.
12. As a Collector with Vendor Capability but no SuperFrete key, I want shipping actions omitted from fulfillment, so that unavailable shipment operations cannot be started.
13. As a Collector with Vendor Capability, I want SuperFrete configuration presented only when relevant, so that settings progressively reveal available workflows.
14. As a Collector with Shipping Capability, I want shipping quotes, ticket creation, label printing, tracking synchronization, and ticket cancellation available, so that I can fulfill orders through SuperFrete.
15. As a Collector without Shipping Capability, I want shipping-package settings hidden, so that I do not configure unused seller-only shipping defaults.
16. As a Collector, I want saved MyP credentials described as configured rather than verified, so that the UI does not claim validity before an external operation succeeds.
17. As a Collector, I want saved SuperFrete credentials described as configured rather than verified, so that the UI accurately represents the local configuration state.
18. As a Collector, I want clearing MyP credentials to disable Seller Mode automatically, so that I cannot retain an invalid seller configuration.
19. As a Collector, I want disabling Seller Mode to immediately revoke private seller access, so that I can stop using seller workflows without deleting my setup.
20. As a Collector, I want seller data and encrypted credentials retained after disabling Seller Mode, so that I can resume selling later without data loss.
21. As a Collector, I want clearing the SuperFrete key to revoke only Shipping Capability, so that MyP order processing remains available.
22. As a Collector, I want the managed MyP Watchlist to remain available without Seller Mode when I have its required MyP configuration, so that Deck shortage card-finding stays independent of selling.
23. As a Collector, I want legacy saved credentials not to activate Seller Mode automatically, so that existing accounts provide explicit consent before seller screens appear.
24. As a Collector without Vendor Capability, I want a direct request to an independent seller-only page to receive the ordinary 404 page, so that inaccessible functionality is not disclosed.
25. As a Collector without Vendor Capability, I want direct requests to private vendor APIs to receive 404, so that endpoint availability is not disclosed.
26. As a Collector without Shipping Capability, I want direct requests to shipping APIs to receive 404, so that shipping endpoints are not disclosed.
27. As a Collector without Vendor Capability, I want a `MYP_STORE` collection query to return me to All Cards rather than deny access to my entire collection, so that my core Binder remains accessible.
28. As a seller, I want private scheduled MyP store and order automation to stop when Seller Mode is disabled, so that the opt-in governs both interactive and background operations.
29. As an operator, I want capability checks applied on the server as well as in the UI, so that hidden controls cannot be bypassed by direct requests.
30. As a maintainer, I want the capability rules defined once and consumed by pages, routes, services, and UI state, so that access behavior remains consistent as seller features evolve.

## Implementation Decisions

- Add a persisted, default-disabled Seller Mode flag to the Collector settings model. Existing users remain opted out after migration, including those with pre-existing MyP credentials or seller data.
- Define a single server-side capability evaluator at the settings/domain boundary. It derives Vendor Capability from Seller Mode plus a non-empty saved MyP username and encrypted password, and derives Shipping Capability from Vendor Capability plus an encrypted SuperFrete API key.
- Treat credential presence as configuration, not remote verification. MyP and SuperFrete errors are reported only when their respective operation executes.
- Expose capability state through the safe settings contract without exposing encrypted credential values. Update validation and settings persistence so clearing MyP credentials also persists Seller Mode as disabled.
- Apply Vendor Capability to private MyP Store Listing reads/writes, Store Sync, private MyP order ingestion and fulfillment, the Tampermonkey/userscript bridge, and all background private-vendor sync execution.
- Apply Shipping Capability to every SuperFrete ticket, quote, print, tracking synchronization, and cancellation operation, including shipping-package configuration and any server-side shipping action.
- Keep public Marketplace browsing, public market data, Deck shortage discovery, and the managed MyP Watchlist outside Seller Mode. The existing watchlist feature continues to require its own MyP settings and explicit automation configuration.
- Centralize API enforcement before the service call. A missing required capability returns a generic 404 response; avoid returning capability or credential details.
- Gate independent seller-only pages with the framework’s ordinary not-found mechanism. For the collection query subview, normalize unavailable `MYP_STORE` selection to the All Cards view instead of rendering a page-level 404.
- Remove unavailable vendor and shipping entries from navigation, command palette, collection subtabs, action controls, modals, and progressive settings. Preserve only the configuration fields necessary to gain the next capability.
- Keep Fulfillment order processing within Vendor Capability while independently removing all shipment controls without Shipping Capability.
- Retain Store Listings, Fulfillment Orders, Shipping Tickets, and saved encrypted credentials when Seller Mode is disabled. Clearing the SuperFrete key revokes Shipping Capability but does not revoke Vendor Capability.
- Keep the change within the existing TypeScript/Next.js, Auth.js, Drizzle/libSQL, repository, service, and typed shared-i18n architecture. User-facing labels, descriptions, statuses, and 404-related UI must be added to both supported translation catalogs with strict parity.

## Testing Decisions

- Test observable capability behavior at the highest existing seam: authenticated route/page behavior backed by persisted user settings. Prefer shared capability-evaluator coverage for the derivation matrix rather than duplicating authorization logic tests per consumer.
- Add focused tests for all combinations that change behavior: Seller Mode disabled, complete/incomplete MyP credentials, SuperFrete key absent/present, clearing MyP credentials, disabling Seller Mode, and clearing SuperFrete configuration.
- Verify server routes return 404 before invoking vendor or shipping services when their capability is absent; verify allowed requests reach the existing service behavior.
- Verify seller-only pages render normal not-found behavior without Vendor Capability and shipping actions/endpoints are absent without Shipping Capability.
- Verify `/collection?view=MYP_STORE` resolves to All Cards for a Collector lacking Vendor Capability.
- Verify progressive UI behavior through component/page tests: unavailable tabs, command-palette entries, userscript controls, shipping controls, and settings sections are not rendered; Vendor Capability retains order processing while Shipping Capability adds shipment features.
- Verify watchlist behavior remains available with MyP configuration when Seller Mode is disabled, including the existing policy and automation boundaries from ADR 0010.
- Extend existing settings API tests, marketplace/fulfillment route tests, shipping route tests, scanner-style feature-flag 404 tests, and typed-i18n completeness tests rather than introducing lower-level implementation-coupled tests.
- Good tests assert responses, rendered access, and authorized service effects; they do not assert internal component state, exact database query shape, or helper call counts.

## Out of Scope

- Remote preflight verification of MyP credentials or SuperFrete API keys.
- Changing public Marketplace data, market scanning, Deck shortage discovery, or public card-finding recommendations.
- Deleting Store Listings, Fulfillment Orders, Shipping Tickets, or credential records when Seller Mode is disabled.
- Replacing or removing the existing Tampermonkey fallback architecture described by ADR 0014.
- New seller roles, organization-level permissions, subscription tiers, or administrator-managed access.
- Changes to MyP or SuperFrete external APIs and their operational behavior once a capability-authorized request reaches the existing service.

## Further Notes

This is a cross-cutting authorization and progressive-disclosure feature, but it does not change the established external integration architecture. It builds on the credential persistence and fulfillment boundaries established in ADRs 0010, 0013, and 0014, and must preserve the repository/service layering in ADR 0012. The terminology in `CONTEXT.md` is authoritative: use Seller Mode, Vendor Capability, and Shipping Capability rather than ambiguous terms such as vendor access or store mode.
