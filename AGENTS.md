# AGENTS.md

## Context Pointers

- **Domain Glossary**: Read [`CONTEXT.md`](CONTEXT.md) before designing, naming symbols, writing specs, or drafting tickets. Update it inline the moment a new domain term crystallizes.
- **Architecture Decisions**: Read [`docs/adr/`](docs/adr/) before modifying persistence, authentication, scanner pairing, meta synchronization, or marketplace pipelines.

## Issue Tracker & Spec Publishing

- **Tracker**: GitHub Issues (`gh issue`) is the single authoritative issue tracker. Use the `ready-for-agent` triage label on all published specs and tickets.
- **Specs (`/to-spec`)**: Save the spec to `docs/<feature-slug>-spec.md` and always publish it to GitHub Issues via `gh issue create --label "ready-for-agent" --body-file docs/<feature-slug>-spec.md`.
- **Tickets (`/to-tickets`)**: Publish tracer-bullet tickets in dependency order (blockers first) to GitHub Issues via `gh issue create --label "ready-for-agent"` so every `Blocked by` edge references real GitHub issue numbers (`#NN`), and mirror each ticket locally under `.scratch/<feature-slug>/issues/<NN>-<ticket-slug>.md`.

## Internationalization (i18n) & Static Text Policy

- **Zero Hardcoded Static Text**: ANY and ALL user-facing static texts across both the Next.js Web App (`src/`) and the Companion Scanner Mobile App (`apps/mobile/`)—including headings, labels, buttons, tooltips, placeholders, empty states, toasts, modals, error messages, and `aria-label` attributes—MUST be covered by translation keys in the shared `@ga/contracts` i18n catalog (`en` and `pt-BR`). Never introduce hardcoded English or Portuguese user-facing strings directly in JSX/TSX components.
- **Compile-Time & Test Parity**: Every new or modified translation key MUST be added to both `en` and `pt-BR` dictionaries simultaneously. All changes must pass both TypeScript strict dictionary parity (`tsc --noEmit`) and the automated i18n completeness test suite (`vitest`).
- **Game Nomenclature Boundary**: Per [`CONTEXT.md`](CONTEXT.md) and [`docs/adr/0011-compile-time-typed-i18n-catalog.md`](docs/adr/0011-compile-time-typed-i18n-catalog.md), keep official Grand Archive **Game Nomenclature** (Card names, Elements, Rarities, Deck zones `Main Deck` / `Material Deck` / `Sideboard`, and Finishes `Foil` / `Normal`) in canonical English, while translating all surrounding UI chrome and domain concepts (e.g., *Shortages* → *Cartas Necessárias*, *Hard Shortage* → *Compra Necessária*, *Shared Shortage* → *Revezamento entre Decks*).

## Engineering Directives

Rules are **hard** for all new and modified code. Existing violations are tracked as debt in [`docs/adr/0012-layered-architecture-and-code-limits.md`](docs/adr/0012-layered-architecture-and-code-limits.md) and fixed when the file is touched, never worsened.

### Layering (see ADR 0012)

- **Database access only in `src/db/repositories/*`**: Drizzle/libSQL queries (`drizzle-orm`, `@libsql/client`, `db` imports) are forbidden in services, API routes, pages, components, auth callbacks, and mobile code. Services orchestrate pure domain logic and call repositories.
- **Thin entry points**: API routes and pages only parse input, authorize, call a service, and respond. No business logic, no queries.
- **Components never import `src/db/*` or server-only services**; they consume data via props, hooks, or API calls.
- **Validate at the boundary**: all external input (API bodies, scanner payloads, scraped meta/marketplace data) is parsed with a schema before reaching a service.

### File & Code Size

- **No God files**: one module, one responsibility. If a file needs "and" to describe it, split it.
- **Max 400 lines per source file** (tests exempt). Split by responsibility before crossing it.
- **Functions** do one thing; extract when nesting or length hurts readability.

### Duplication

- On the **second copy** of non-trivial logic (more than ~5 lines, or any business rule), extract a helper. Place it in the feature module first; promote to `packages/` only when both web and mobile need it.

### Quality

- Every behavior change ships with a `vitest` test.
- No `any` and no `@ts-ignore`/`@ts-expect-error` without a one-line reason comment.
- No dead or commented-out code.
- Secrets come from environment variables only; never commit or log them.
- No new dependency, layer, or language without an ADR in `docs/adr/`. The stack is TypeScript only; no Go or other languages.
