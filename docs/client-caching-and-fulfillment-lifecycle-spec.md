# Spec: Client Data Caching and Order Fulfillment Lifecycle Architecture

## Problem Statement

Users of the web application experience severe friction due to constant loading indicators and skeleton flashes on every route navigation. Every time a user navigates away from a screen (such as Decks or Collection) and returns to it—even moments later—the client component mounts from scratch with zero in-memory cache, drops existing data, displays full-page skeleton loaders, and fires un-cached network requests to API routes.

Additionally, within the MyP Store Order Fulfillment interface, if there is no active open fulfillment batch, the application replaces the entire screen with an empty state block. This completely blocks the user from viewing or managing their previously processed and shipped orders, locking them out of the fulfillment lifecycle unless new open orders exist.

## Solution

1. **Client-Side Caching with TanStack Query**: Introduce TanStack Query (`@tanstack/react-query`) wrapped at the root layout. Implement a 30-minute stale time (`staleTime: 30 * 60 * 1000`) so that visiting any previously visited route or tab renders cached data instantly (0ms UI delay, 0 skeleton flicker) with silent background revalidation when stale. Automatic mutation invalidation will mark queries stale whenever decks, collections, or shortages are modified, supplemented with subtle manual refresh buttons.
2. **Order Fulfillment Lifecycle Redesign**: Refactor the fulfillment view so that the top action header and lifecycle tabs (`Open Orders`, `Processed Orders`, `Shipped Orders`) are permanently visible and interactive. Top-level bridge buttons (`Open MyP Vendas ↗` and `Copy Userscript`) are permanently accessible. If there are no open orders in the active batch, the view lands on `Processed Orders` (or displays a non-blocking in-tab empty prompt under `Open Orders`), allowing collectors to access their processed and shipped orders at all times.

## User Stories

1. As a collector navigating between Collection and Decks, I want pages to load instantly from cache without skeleton spinners when returning to them, so that I can manage my cards without disruptive visual jitter.
2. As a deckbuilder reordering or editing decks, I want my changes to immediately invalidate cached deck and shortage data, so that my views reflect up-to-date deck counts and deficits without manual page reloads.
3. As a collector browsing the Card Catalog with active filters, I want my catalog state and results cached during route switches, so that I don't lose context or wait for catalog queries when quickly checking my collection.
4. As a collector viewing Meta Archetypes, I want archetype lists and feasibility comparisons to stay cached in memory for up to 30 minutes, so that I can compare decks against meta targets with zero loading latency.
5. As a seller on MyPCards with zero new open orders, I want to access the Order Fulfillment tab and view my already processed and shipped orders, so that I can inspect package tracking and buyer history at any time.
6. As a seller on MyPCards, I want the "Open MyP Vendas" and "Copy Userscript" buttons permanently visible at the top of the Order Fulfillment interface, so that I can launch the sync bridge whenever I need to pull new orders.
7. As a seller switching between Open, Processed, and Shipped order tabs, I want the tabs to remain permanently clickable regardless of whether an active open batch exists, so that my navigation is never blocked by an empty batch state.
8. As a seller landing on Order Fulfillment with no active open batch, I want the system to automatically focus on Processed Orders if available, so that I immediately see actionable processed packages.
9. As a collector on a slow or intermittent network connection, I want stale cached data to be displayed immediately while revalidation happens silently in the background, so that I am never left staring at an empty or blocked interface.
10. As a collector wanting fresh external data, I want a subtle manual refresh control on primary views, so that I can trigger an on-demand cache revalidation at will.
11. As a collector switching between sub-views (e.g. All Cards, Staples, Low Pop, Idle, and Store Listings in Collection), I want each tab's query cached independently, so that switching tabs is instantaneous.
12. As a mobile or desktop user, I want query caching and memory management to operate reliably without memory leaks across long-lived browser sessions.

## Implementation Decisions

- **Client Query Engine**: Install and configure `@tanstack/react-query` with a root `QueryClientProvider` instantiated inside a client provider wrapper in the root layout.
- **Default Query Configuration**: Configure the query client with `defaultOptions.queries.staleTime = 30 * 60 * 1000` (30 minutes), `gcTime = 60 * 60 * 1000` (60 minutes), and `refetchOnWindowFocus = false` to avoid aggressive refetching while preserving immediate cached renders.
- **Query Key Conventions**: Establish consistent, type-safe query keys using factory objects (e.g. `deckKeys`, `collectionKeys`, `catalogKeys`, `metaKeys`, `setsKeys`).
- **Mutation Invalidation Protocol**: Wrap mutating operations (deck creation/updates/deletions, collection updates, batch clearing) in hooks or handlers that call `queryClient.invalidateQueries` for their corresponding query keys and dependent shortage computations.
- **Fulfillment Header Unification**: Promote the top action bar and lifecycle tabs (`open`, `processed`, `sent`) to a permanent container in the fulfillment layout, removing the conditional early return that previously hijacked the view with `FulfillmentEmptyState`.
- **Fulfillment Empty State Scoping**: Scope the empty batch prompt strictly inside the `open` lifecycle tab panel when `report` has zero open orders, leaving the navigation chrome and secondary tabs fully functional.
- **Architecture Record**: Document the client-side caching layer, query key structure, cache invalidation guarantees, and fulfillment layout architecture in `docs/adr/0032-client-side-caching-with-tanstack-query.md`.

## Testing Decisions

- **Query Cache Behavior**: Write Vitest tests for the custom query hooks using a test `QueryClient` wrapper, verifying that initial fetches load data, subsequent invocations hit the cache without network requests, and invalidations trigger re-fetching.
- **Fulfillment Lifecycle Navigation**: Add Vitest component tests for the fulfillment view confirming that when `report` is null or empty, the lifecycle tabs and top-level action buttons render and the user can navigate to `Processed` and `Sent` tabs.
- **Zero Hardcoded Static Text**: Ensure all newly introduced UI labels, buttons, and empty state strings in the redesigned fulfillment workspace exist in both `en` and `pt-BR` dictionaries in `@ga/contracts`.

## Out of Scope

- Offline-first local IndexedDB/PWA persistence for the TanStack Query cache.
- Full server-side rendering (RSC) conversion of existing interactive client components.
- Automatic webhook push updates from MyPCards (the userscript bridge remains the mechanism).

## Further Notes

- All changes adhere to ADR 0012 max 400 lines per file and strict architectural layering rules.

## Addendum: Extended Scope & Review Reconciliation

- **User Settings & Capabilities Caching**: As detailed in ADR 0032, `settingsKeys` (`/api/settings`) is incorporated into TanStack Query to eliminate loading flashes when entering user settings, with `useVendorCapabilityQuery` consuming settings through a type-safe `select` transform to eliminate cache key collisions.
- **Session Cache Purging**: To prevent sensitive user settings, tokens, or custom decks from leaking across shared browser sessions, `signOutAndClearCache` in `src/lib/auth-cache.ts` and `QueryProvider` clear the QueryClient cache immediately upon sign-out or session account switches.
- **Catalog Filter State Persistence**: Filter selections on `/catalog` (query, element, class, set prefix, keywords, and toggles) are preserved across navigations via `useCatalogFilters` with an explicit test reset seam.
- **Sets Refresh Controls**: Manual refresh buttons (`<RefreshCw>`) are integrated into `SetsDashboardView` and `SetChecklistHeader` to ensure on-demand cache revalidation across all set routes.
