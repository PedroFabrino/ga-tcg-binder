# AGENTS.md

## Context Pointers

- **Domain Glossary**: Read [`CONTEXT.md`](CONTEXT.md) before designing, naming symbols, writing specs, or drafting tickets. Update it inline the moment a new domain term crystallizes.
- **Architecture Decisions**: Read [`docs/adr/`](docs/adr/) before modifying persistence, authentication, scanner pairing, meta synchronization, or marketplace pipelines.

## Issue Tracker & Spec Publishing

- **Tracker**: GitHub Issues (`gh issue`) is the single authoritative issue tracker. Use the `ready-for-agent` triage label on all published specs and tickets.
- **Specs (`/to-spec`)**: Save the spec to `docs/<feature-slug>-spec.md` and always publish it to GitHub Issues via `gh issue create --label "ready-for-agent" --body-file docs/<feature-slug>-spec.md`.
- **Tickets (`/to-tickets`)**: Publish tracer-bullet tickets in dependency order (blockers first) to GitHub Issues via `gh issue create --label "ready-for-agent"` so every `Blocked by` edge references real GitHub issue numbers (`#NN`), and mirror each ticket locally under `.scratch/<feature-slug>/issues/<NN>-<ticket-slug>.md`.
