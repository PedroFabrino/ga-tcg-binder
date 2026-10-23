# 0024: Share the deck-list parser via `@ga/deck-import`

## Status

Accepted

## Context

ADR-0004 says `apps/table` reuses the collection app's deck-list parser, but the table initially carried a copied `parseOmnidexText`. The copy fixed the Champion rule (the Material-deck card whose printed `level` is 0), while the root `src/services/omnidex.ts` still returned the first Material line. Two parsers meant the next parser change would drift between apps.

## Decision

- Extract the structural parser, name normalisation, and catalog-aware resolver into `packages/deck-import` (`@ga/deck-import`).
- `parseOmnidexText` is purely structural and does **not** guess a Champion. `resolveDecklist` resolves the level-0 Material card through the card catalog.
- `apps/table` imports the package directly.
- The root app keeps a thin `parseOmnidexText` wrapper that adds the historical first-Material-line `champion` hint for existing meta ingestion; that legacy behaviour is isolated to the root app and is not the source of truth for GrandTable.

## Considered options

- **Keep two copies** — avoids a package, but contradicts ADR-0004 and preserves the known Champion bug in one of them.
- **Put the parser in `@ga/contracts`** — contracts is for cross-boundary shapes, not parsing/domain logic.
- **Make the root app resolve the Champion through the catalog** — a larger change to meta ingestion with no current need.

## Consequences

- One parser implementation, one set of parser tests (`packages/deck-import/src/index.test.ts`), used by both apps.
- `@ga/deck-import` is a workspace dependency of the root app and `apps/table`; a change rebuilds both.
- The root app's legacy `champion` hint remains until meta ingestion adopts the catalog resolver.
