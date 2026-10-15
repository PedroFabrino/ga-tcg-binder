# 01 — Monorepo Restructuring & Shared Contracts Package (GitHub Issue #10)

**What to build:** Restructure the repository into a pnpm monorepo containing `apps/web` and `packages/contracts`. Move shared scanner contracts, WebSocket message definitions, card finishing types, and validation schemas into `@ga/contracts`. Ensure existing Next.js build, test suites, and Vercel compatibility remain completely green.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Repository is configured as a pnpm workspace with `apps/web` and `packages/contracts`.
- [ ] Shared types (`Point`, `Quad`, `CardVariant`, `CardMatchResult`, `ScanSession`, WebSocket message envelopes) are extracted into `packages/contracts`.
- [ ] All existing Next.js tests pass without regressions using the shared `@ga/contracts` workspace import.
- [ ] TypeScript compilation and build pass cleanly across the workspace.
