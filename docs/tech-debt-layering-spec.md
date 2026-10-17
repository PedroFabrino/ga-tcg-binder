## Problem Statement

The Engineering Directives in `AGENTS.md` (ADR 0012) are hard rules for new code, but the existing codebase violates them. Services and API routes query the database directly, no Repository layer exists, and eleven source files exceed 400 lines (the largest, the marketplace Service, is ~1800 lines). Contributors and agents cannot tell what "good" looks like in the repo, Services are hard to test without a real database, and nothing stops the debt from growing.

## Solution

Pay the debt down incrementally without freezing feature work. Introduce the Repository layer, add lint guardrails with a shrinking allowlist of known offenders so debt can never grow, migrate each aggregate to Repositories while splitting oversized files, and finally empty the allowlist so the directives are enforced absolutely.

## User Stories

1. As a developer, I want a Repository layer with a clear convention, so that I know exactly where database queries belong.
2. As a developer, I want a pilot aggregate migrated first, so that I have a reference implementation to copy.
3. As a developer, I want lint to reject database imports outside Repositories, so that violations are caught before review.
4. As a developer, I want lint to reject source files over 400 lines, so that God files cannot form.
5. As a maintainer, I want an allowlist of current offenders that can only shrink, so that existing debt is visible and never worsened.
6. As a developer, I want Services to hold only domain logic and orchestration, so that I can unit test them with fake Repositories.
7. As a developer, I want API routes to only parse, authorize, call a Service, and respond, so that routes stay thin and consistent.
8. As a developer, I want catalog and collection queries behind Repositories, so that browsing the Collection is unchanged for users while the code is cleaner.
9. As a developer, I want deck, friend, settings and auth persistence behind Repositories, so that auth callbacks stop touching the database directly.
10. As a developer, I want scanner session and queue persistence behind Repositories, so that scanner pairing logic is testable in isolation.
11. As a developer, I want meta, staples and sync-pipeline persistence behind Repositories, so that two-phase meta sync stays unchanged for users.
12. As a developer, I want the marketplace Service split by responsibility, so that no single module needs "and" to describe it.
13. As a developer, I want Shortage and watchlist logic split below 400 lines, so that Shortage calculation stays readable.
14. As a developer, I want oversized React components and pages split into focused components, so that UI changes are low risk.
15. As a mobile developer, I want the scanner screen split, so that the companion app follows the same limits.
16. As a user, I want zero behavior change from these refactors, so that my Collection, Decks and Shortages keep working.
17. As a maintainer, I want ADR 0012 updated when debt is closed, so that the debt list reflects reality.
18. As an agent, I want each migration ticket scoped to one aggregate, so that it fits in one context window.

## Implementation Decisions

- Repositories are the only modules that import Drizzle/libSQL; they own all queries for one aggregate each.
- Services call Repositories and contain no queries; API routes and pages call Services only.
- Migration uses expand–contract: add Repositories beside existing code, migrate call sites per aggregate, then remove direct access and tighten lint.
- Lint enforcement uses restricted imports for database packages and a max-lines rule, with an explicit allowlist of current offenders. Entries are removed as files are migrated or split; entries may never be added.
- Oversized files are split by responsibility as part of the migration touching them, not in isolated cosmetic PRs.
- No public API, schema, or UI behavior changes. Game Nomenclature and i18n catalogs are untouched.
- Tests (any size) are exempt from the 400-line cap.

## Testing Decisions

- Good tests assert external behavior of Services and routes, not Repository internals or file layout.
- Highest seam: Service-level vitest tests against the existing in-memory libSQL test utilities, plus one lint check as the enforcement seam.
- Existing tests for each migrated Service must continue to pass unchanged; new Repository behavior is covered through Service tests.
- Prior art: existing Service tests, including shortage, scanner, meta, and watchlist suites.

## Out of Scope

- New features or schema changes.
- Mobile app database access (none exists).
- Changing the stack or adding dependencies beyond lint configuration.
- Rewriting oversized test files.

## Further Notes

- Known debt at the time of writing is listed in ADR 0012.
- Order of work is driven by blocking edges: foundation first, lint guardrails second, migrations in parallel, contract last.
