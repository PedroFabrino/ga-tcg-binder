# 0012: Layered architecture and code limits

## Status

Accepted

## Context

Persistence calls are spread across ~12 services, 5 API routes, and `src/auth.ts`. Several files are very large (`marketplace.ts` 1823 lines, `shortage.ts`, `meta.ts`, `MypStoreView.tsx`, ...), mixing queries, domain logic, and orchestration.

## Decision

- Introduce `src/db/repositories/*` as the only place with DB queries. Services hold domain logic and orchestration; routes/pages are thin.
- Source files are capped at 400 lines (tests exempt) and must have a single responsibility.
- Non-trivial logic duplicated a second time is extracted into a helper.
- TypeScript only; no Go.

## Transition

Rules apply immediately to new code. Existing violators migrate when touched and must not grow. Known debt: files over 400 lines (`services/marketplace.ts`, `services/shortage.ts`, `services/meta.ts`, `services/watchlist.ts`, `services/scanner.ts`, `components/collection/MypStoreView.tsx`, `components/decks/AllShortagesView.tsx`, `app/marketplace/page.tsx`, `app/scan/dashboard/page.tsx`, `app/meta/page.tsx`, `apps/mobile/src/screens/ScannerScreen.tsx`) and direct DB use in services, `src/app/api/{decks,friends,settings}`, and `src/auth.ts`.

## Consequences

Services become testable without a DB; a follow-up ticket may add lint rules (`no-restricted-imports`, `max-lines`) with an allowlist that can only shrink.
