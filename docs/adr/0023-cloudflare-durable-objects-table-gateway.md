# 0023: Cloudflare Durable Objects with SQLite & Hibernation for Table Gateway

## Status
Accepted

## Context
GrandTable requires a single server-side authority for Table state, write permissions, and seat ownership (ADRs 0002, 0004; `apps/table/docs/MVP_SPEC.md`).
The development gateway (`services/ws-gateway/src/node-server.ts`) uses an in-memory `TableRoomManager` suitable for local iteration, while the initial `cf-worker.ts` relied on a module-level Map broken across Cloudflare isolate boundaries (two clients for the same table could hit different worker isolates that never see each other).

Furthermore, maintaining persistent WebSocket connections in serverless environments can quickly exhaust compute budgets if idle connections keep workers pinned in memory.

## Decision
1. **Host each Table in a dedicated Cloudflare Durable Object (`TableDO`)**:
   - The Durable Object ID is bound to the 6-character room code via `env.TABLE_DO.idFromName(code)`.
   - The Cloudflare Worker routes `/t/:code` WebSocket upgrades to the corresponding `TableDO` and handles `POST /api/table` by generating a code and calling the DO's create-only `/init` endpoint.
   - A `/t/:code` request for a code that was never initialized is rejected, so a socket cannot mint a table by guessing a code.
   - Module-level Maps in `cf-worker.ts` are eliminated; each Table is completely isolated in its own Durable Object actor.

2. **Durable SQLite Storage for Credentials & Table State**:
   - `TableDO` provisions an embedded SQLite table (`table_meta`) using the modern `this.ctx.storage.sql` API enabled via Wrangler's `new_sqlite_classes = ["TableDO"]` migration.
   - At creation (`POST /api/table`), `TableDO` generates and persists `p1Token`, `p2Token`, and `viewerToken`, alongside serialized `TableState`.
   - `/init` is create-only: a second call for an existing DO returns 409, and the worker retries with a fresh code on collision.
   - On wake after hibernation or isolate eviction, `TableDO` rehydrates `TableRoom` and all active seats directly from SQLite storage.

3. **WebSocket Hibernation API**:
   - Incoming WebSocket upgrade requests use `this.ctx.acceptWebSocket(server)` rather than keeping the DO running continuously in memory.
   - Client seat bindings and roles are persisted across hibernation cycles using `ws.serializeAttachment()` and rehydrated via `ws.deserializeAttachment()`.
   - WebSocket events (`webSocketMessage`, `webSocketClose`, `webSocketError`) are handled through native DO class lifecycle hooks.

4. **Tooling & Development**:
   - Wrangler (`wrangler dev`) and `@cloudflare/workers-types` are adopted for local emulation and type checking of Cloudflare Workers and Durable Objects.
   - `TableDO` depends only on the narrow `TableObjectState` and `TableWebSocket` interfaces, so Vitest drives it with in-memory doubles instead of a Workers runtime.

## Consequences
- Single authority per room code guaranteed across all Cloudflare edge locations.
- Zero CPU compute duration billed for idle tables waiting for player input.
- Seamless rehydration of game state, turn status, and seat ownership after network interruptions or browser refreshes.
- Guessed or stale codes cannot create tables or consume storage.
- Zero hardcoded module-level state in `cf-worker.ts`.
