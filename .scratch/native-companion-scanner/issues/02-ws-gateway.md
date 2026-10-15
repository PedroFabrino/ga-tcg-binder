# 02 — WebSocket Session Gateway Microservice (GitHub Issue #11)

**What to build:** An ephemeral room-isolated WebSocket session broker supporting dual runtimes (a standalone Node.js `ws` runner for local development and a Cloudflare Workers WebSocket handler for production edge deployment). The gateway routes messages between paired mobile companion scanners and desktop receivers keyed by `session_<uuid>`, with automatic heartbeat pings and clean disconnect cleanups.

**Blocked by:** #10 (01 — Monorepo Restructuring & Shared Contracts Package)

**Status:** ready-for-agent

- [ ] Dual-runtime WebSocket handler implemented supporting room creation, joining, and peer message broadcasting.
- [ ] Strictly validates incoming envelopes (`SESSION_JOIN`, `SESSION_STATUS`, `SCAN_IDENTIFY_REQUEST`, `CARD_COMMITTED`, `HEARTBEAT`).
- [ ] Room isolation verified: messages dispatched within `session_A` never leak to `session_B`.
- [ ] Automated integration test suite tests two simultaneous clients joining a room, exchanging messages, and handling unexpected disconnects.
