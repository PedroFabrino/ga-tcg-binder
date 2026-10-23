# AGENTS.md — apps/table (GrandTable)

## Context pointers

- **Naming** — read `CONTEXT.md` before naming any symbol, route, message, or UI label; use its terms (`Table`, `Seat`, `Feed`, `Capture Device`, `Pin`, `HUD`, `Turn`) and none of their `_Avoid_` words.
- **Architecture** — read `docs/adr/` before touching the room state machine, media, or state shape.
- **Scope** — read `docs/MVP_SPEC.md` §2 and §10 before adding any feature; items listed there are not built in v1.
- **Repo rules** — the root `AGENTS.md` governs i18n (every user string in en + pt-BR via `@ga/contracts`), layering, file size, and dependencies; it applies here unchanged.

## Contract-first

One shape, one home: `@ga/contracts`. Every cross-boundary shape — room messages, `TableState`, `SeatState`, `Pin` — lives there. Add the shape and its parity test first, then build against it.

## Testing seam

The seam is the room state machine and its message contract; test it, and only it.

- Server: exercise `TableRoom` through the `UnifiedSocket` interface (`services/ws-gateway/src/unified-socket.ts`), following `gateway.test.ts`; exercise `TableDO` through `TableObjectState`/`TableWebSocket` doubles, following `table-do.test.ts`.
- Client: keep the reducer a pure function of the same contract and test it as such.

There is no end-to-end test. Media and DOM are verified by each ticket's acceptance criteria in a real browser. Write no test past this seam.

## Hard APIs: copy the pattern

Durable Objects and WebRTC are the two areas to copy, not improvise:

- Durable Object wiring: `cf-worker.ts`, `table-do.ts`, and `table-room.ts` in `services/ws-gateway`; the DO seam is tested with structural doubles, not a live Worker.
- WebRTC: one small module, its shape in `@ga/contracts`, its behaviour verified in a browser.

## Done

A ticket is done when its acceptance criteria pass, the architecture-guardrails and i18n-parity tests pass, and any new dependency has an ADR.
