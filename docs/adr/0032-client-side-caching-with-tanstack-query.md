# 0032: Client-Side Caching with TanStack Query

## Status

Accepted

## Context

In the Next.js App Router client architecture, application pages (`/decks`, `/collection`, `/catalog`, `/sets`, `/meta`, `/marketplace`) are client components that previously performed imperative data fetching inside `useEffect` with local `useState(true)` for loading states.

Because Next.js App Router destroys component state upon navigating between routes, every return visit to a previously loaded screen mounted from scratch with empty state, flashed full-page skeleton loaders, and triggered redundant network requests to server API routes.

Per [AGENTS.md](../../AGENTS.md) and [ADR 0012](./0012-layered-architecture-and-code-limits.md), introducing any new third-party dependency requires an ADR.

We considered three approaches:
1. **Full Server Component (RSC) Conversion**: Refactoring all pages into Server Components using Next.js route segment caches. While idiomatic for read-heavy sites, the application relies heavily on interactive client state (e.g. `@dnd-kit` drag-and-drop, real-time modal filters, responsive tables, client-side pagination, web workers). Refactoring all screens to RSC would introduce massive architectural churn and fight client-heavy UX requirements.
2. **`swr`**: Vercel's stale-while-revalidate data fetching library. Lightweight, but has less expressive query key management, fewer mutation orchestration primitives, and less robust manual query invalidation patterns across complex inter-dependent domain models (e.g. deck updates invalidating shortage models).
3. **`@tanstack/react-query` (TanStack Query v5)**: The industry standard for client-side state and asynchronous server state management in React. Provides typed query key factories, fine-grained cache duration configuration, declarative invalidation (`queryClient.invalidateQueries`), optimistic updates, and instant stale-while-revalidate navigation.

## Decision

We adopt `@tanstack/react-query` as the single client-side query caching engine across the application:

1. **Global Provider & Stale Policy**:
   - `QueryClientProvider` is configured at the root of the app in `RootLayout`.
   - Default query configuration specifies `staleTime: 30 * 60 * 1000` (30 minutes) and `gcTime: 60 * 60 * 1000` (60 minutes).
   - Stale-while-revalidate is guaranteed: navigating to any previously visited page renders cached data instantly (0ms UI latency, 0 skeleton flash), revalidating silently in the background if older than 30 minutes.
   - `refetchOnWindowFocus: false` is configured to prevent intrusive refetch storms during normal window switching.

2. **Query Key Architecture & User Scoping**:
   - Query keys are defined through centralized factory objects under `src/lib/query-keys.ts` for all primary domain entities: `deckKeys`, `collectionKeys`, `catalogKeys`, `metaKeys`, `setsKeys`, `settingsKeys`, and `marketplaceKeys`.
   - All user-specific queries (`deckKeys.list`, `deckKeys.shortages`, `collectionKeys.view`, `settingsKeys.current`, `setsKeys.dashboard`, `setsKeys.detail`) incorporate `userId` in their key parameters.
   - Cross-query derivations (such as `useVendorCapabilityQuery`) consume the canonical query via `select` selectors to avoid cache key collision or data shape pollution.
   - Cache boundaries are strictly purged via `queryClient.clear()` on user sign-out and session account switches (`signOutAndClearCache` and `QueryProvider` session watcher) to eliminate cross-account leakage.

3. **Mutation Invalidation Protocol**:
   - Centralized invalidators under `src/lib/query-invalidation.ts` (`invalidateDeckQueries`, `invalidateCollectionQueries`) orchestrate inter-dependent caches.
   - Shortage queries are invalidated via the prefix `deckKeys.shortagesPrefix()` so user-scoped entries are reliably invalidated.
   - Mutating actions (card quantity stepper, catalog quick-add, deck import) call the central invalidators rather than manually crafting ad-hoc invalidations.
   - Interactive toggles (such as set hide/unhide) execute optimistic updates directly on the cache via `useToggleSetHiddenMutation`, guaranteeing immediate feedback and zero state divergence.

4. **Order Fulfillment Workspace**:
   - The Order Fulfillment lifecycle header and tabs (`open`, `processed`, `sent`) remain permanently interactive, decoupled from empty batch checks, with top bridge actions (`Open MyP Vendas` and `Copy Userscript`) always accessible.

## Consequences

- Adds `@tanstack/react-query` to dependencies in `package.json`.
- Eliminates repeated loading screens and skeleton flashes on 2nd+ visits across the web app.
- Standardizes data fetching across client components into declarative hooks under `src/hooks/queries/`.
- Drastically reduces redundant database queries and server load on API endpoints.
