# 0012: Layered architecture and code limits

## Status

Accepted

## Context

Persistence calls are spread across ~12 services, 5 API routes, and `src/auth.ts`. Several files are very large (`marketplace.ts` 1823 lines, `shortage.ts`, `meta.ts`, `MypStoreView.tsx`, ...), mixing queries, domain logic, and orchestration.

## Decision

- Introduce `src/db/repositories/*` as the only place with DB queries. Services hold domain logic and orchestration; routes/pages are thin.
- Repository files live in `src/db/repositories/` and use the naming convention `*-repository.ts`, for example `settings-repository.ts`.
- A repository owns persistence operations for one aggregate or bounded area. It contains Drizzle/libSQL queries, persistence-specific mapping, and no HTTP, route, page, or domain-orchestration concerns.
- Repositories accept an optional database parameter for dependency injection. The parameter defaults to the application `db` singleton so production callers do not need to pass a database, while services and tests can provide an isolated database instance.
- Each repository exports the relevant persistence types, including `Row` and `Insert` types derived from the database schema, rather than requiring services to import tables or infer database row shapes themselves.
- Services call repositories instead of importing `db`, Drizzle query helpers, schema tables, or libSQL clients directly. Services are responsible for validation, encryption/decryption boundaries, domain rules, and orchestration.
- Routes, route handlers, pages, and server actions are thin: they authenticate/authorize, parse transport input, call a service, and format the response. They must not issue database queries or import repository schema tables directly.
- Source files are capped at 400 lines (tests exempt) and must have a single responsibility.
- Non-trivial logic duplicated a second time is extracted into a helper.
- TypeScript only; no Go.

## Transition

Rules apply immediately to new code. Existing violators migrate when touched and must not grow. Known debt: files over 400 lines (`services/marketplace.ts`, `services/shortage.ts`, `services/meta.ts`, `services/watchlist.ts`, `services/scanner.ts`, `components/collection/MypStoreView.tsx`, `components/decks/AllShortagesView.tsx`, `app/marketplace/page.tsx`, `app/scan/dashboard/page.tsx`, `app/meta/page.tsx`, `apps/mobile/src/screens/ScannerScreen.tsx`, `packages/contracts/src/i18n.ts`) and direct DB use in services, `src/app/api/{decks,friends,settings}`, and `src/auth.ts`.

## Consequences

Services become testable with an injected in-memory database while repository queries remain covered by service-level tests. A follow-up ticket may add lint rules (`no-restricted-imports`, `max-lines`) with an allowlist that can only shrink.
