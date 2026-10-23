# GrandTable MVP — Specification

**Feature slug:** `grandtable-mvp`
**Status:** ready-for-agent
**Vocabulary:** `apps/table/CONTEXT.md`. **Model assignments:** `apps/table/docs/MODELS.md`.

---

## Problem Statement

Two friends want to play a physical game of Grand Archive over video. Their usual fallback — Discord screen-share — is blocked in their region, and a plain call gives them neither a way to see each other's boards clearly nor a shared, honest record of damage, Memory, and whose turn it is. They currently track game state with dice on camera, which glare, get bumped, and force constant "whose turn?" and "what card is that?" callouts.

## Solution

A standalone web app, built as `apps/table` in the existing pnpm monorepo, where two Seats join a Table by link or code. Each Seat publishes one video Feed from one Capture Device (desktop webcam or QR-paired phone), peer-to-peer — no media server. A mirrored HUD and per-Seat Pins are synchronized through a Cloudflare Durable Object that is the single authority for seat ownership and write permissions. No accounts, no persistence, no card recognition in v1. The Whiteboard model governs everything: the app mirrors the physical game and never holds hidden information.

## User Stories

### Rooms and Seats

1. As a player, I want to create a Table and receive a shareable link and Room Code, so that I can invite exactly one opponent.
2. As a player, I want to open the invite link and claim the second Seat, so that I can join without creating an account.
3. As a player, I want my Seat remembered across a refresh, so that I resume in place instead of re-joining as a stranger.
4. As a player, I want a third connection to the Table refused with a clear message, so that no one silently takes a Seat.
5. As a player, I want opening my Seat in a second tab to displace the older tab, so that two tabs never fight over the same HUD.

### HUD and state

6. As a player, I want to set a display name, so that my opponent and the log identify me.
7. As a player, I want to Pin my Champion, so that its printed level and life become my visible level and life total.
8. As a player, I want to raise and lower my damage counter, so that I track damage counting up toward my life total.
9. As a player, I want to set my Memory count, so that I track how many face-down cards are in Memory.
10. As a player, I want to set my hand count, so that both counts are visible.
11. As a player, I want to see influence derived from hand plus Memory, so that I never track it as a separate number.
12. As a player, I want to edit only my own Seat's fields, so that I cannot, even by accident, change my opponent's numbers.
13. As a player, I want every state change attributed to the Seat that made it in an action log, so that disputes are visible evidence rather than a verdict.
14. As a player, I want my Seat's writes rejected by the server if I try to write the other Seat's fields, so that the Whiteboard rule is enforced, not just expected.

### Turn and action log

15. As a player, I want a Start Turn action when no Seat is active, so that a match can begin.
16. As the active player, I want an End Turn action that hands the Turn to my opponent, so that only the active player can end their own Turn.
17. As a player, I want to see which Seat is active at all times, so that I never ask "whose turn?".
18. As a player, I want the action log to preserve the last events in order, so that the sequence of Pins and counter changes is reviewable.

### Video

19. As a player, I want to pair my phone as a Capture Device by scanning a QR code, so that I can play without owning a webcam.
20. As a player, I want my board streamed to my opponent only, so that my phone encodes a single stream and I frame the shot on the phone itself.
21. As a player, I want to use my desktop webcam as the Capture Device, so that a phone is optional rather than required.
22. As a player, I want a "camera asleep" badge when my opponent's Feed is muted (e.g. their phone screen locked), so that a frozen frame is never mistaken for live video.
23. As a player, I want an empty state where my opponent's Feed would be when they have no camera, so that the rest of the Table remains usable.
24. As a player, I want the Feed to recover on its own after a network drop through ICE restart, so that I do not have to renegotiate by hand.
25. As a player on a restrictive network, I want TURN relay to be used automatically, so that NAT does not block the call.
26. As a player, I want card text on the Feed to stay legible, so that the encoder does not blur fine print.

### Deck import

27. As a player, I want to paste an Omnidex/GrandArchiveStats decklist, so that my Pin search is scoped to the cards I am actually playing.
28. As a player, I want my Champion resolved from the level-0 card in my Material deck, so that the HUD is pre-filled correctly rather than with the first line of the list.
29. As a player, I want card names that do not resolve to be shown as warnings, so that a typo is surfaced instead of silently dropped.
30. As a player, I want my Main Deck, Material Deck, and Sideboard preserved by the import, so that the Pin grid reflects the list faithfully.

### Pins

31. As a player, I want to search my imported deck first with a fallback to the full catalog, so that tokens and unlisted cards can still be pinned.
32. As a player, I want to Pin a card that appears on both screens immediately, so that my opponent sees exactly what I am playing.
33. As a player, I want to choose a specific art when a card has multiple printings, so that the Pin matches the physical card.
34. As a player, I want to see the last three Pins with attribution, so that the sequence of plays reads like a stack.
35. As a player, I want to clear my Pin, so that a finished play leaves the Table.

### Pointer ripple

36. As a player, I want to click my opponent's Feed and drop a numbered marker on both screens for a few seconds, so that I can point at a specific card without recognition.

### Overlay and stage

37. As a content creator, I want a transparent overlay showing both HUDs, both Pins, the Turn, and a wordmark, so that I can layer it over a window capture in OBS.
38. As a content creator, I want the overlay to carry no video, so that it stays reliable inside OBS's browser source.
39. As a content creator, I want the overlay legible at 1080p with cards at near-native size, so that the 500×700 art does not look soft.
40. As a content creator, I want a `/stage` route with no controls, so that I can capture a clean board for broadcast.

### Hardening

41. As a player, I want the Table to remain playable when the card API is unreachable, so that an outage does not end a match.
42. As a player, I want every user-facing string available in English and Brazilian Portuguese, so that the local community is served.
43. As a developer, I want every cross-boundary shape to live in `@ga/contracts`, so that client and server cannot drift.

## Implementation Decisions

- **Monorepo**: `apps/table` joins the existing pnpm workspace; `services/ws-gateway` is extended. See ADRs 0001–0003 under `apps/table/docs/adr/`.
- **Transport**: mesh WebRTC, one Capture Device per Seat publishing one stream to the opponent; no SFU. TURN via Cloudflare Realtime, minted at `GET /turn` on the gateway.
- **State authority**: one Durable Object per Table (SQLite, WebSocket Hibernation). Partitioned writes enforced server-side; Turn handoff (only the active Seat may clear); Seat takeover (newest connection wins); third join refused.
- **Contract**: `TableState`, `SeatState`, `Pin`, and the message union live in `@ga/contracts`, the single source of truth.
- **Card data**: fetched from `api.gatcg.com` (`/cards/all` cached 7 days in localStorage, `/cards/{slug}` cached in IndexedDB). No proxy, no database.
- **Decklists**: local to the owning browser only; never in `TableState`. Champion is the Material-deck card whose printed `level` is 0.
- **i18n**: every user-facing string via the `@ga/contracts` i18n catalog, en and pt-BR together.
- **Model lineup**: foundation tickets and all reviews by DeepSeek V4 Pro; mechanical tickets by `qwen3-coder:7b`; complex tickets by `qwen3-coder:30b` (see `docs/MODELS.md`).

## Testing Decisions

- **One seam**: the room state machine and its message contract. Server: exercise `TableRoom` through the `UnifiedSocket` interface. Client: the state reducer as a pure function of the same contract.
- **No end-to-end tests**: media and DOM behaviour are verified by each ticket's acceptance criteria in a real browser.
- **Prior art**: `services/ws-gateway/src/gateway.test.ts` (session room manager), `src/services/deck.test.ts` (parser), `packages/contracts/src/index.test.ts` (schema parity).
- **Gates**: architecture-guardrails and i18n-parity tests must pass on every change.

## Out of Scope

Card recognition, in-app audio, match recording, accounts, profiles, lobby/matchmaking, persistence beyond a Table's lifetime, referee/watcher roles, a second Feed per Seat, deck import by URL, LAN/offline mode, and Tauri. Each has a named trigger in `apps/table/docs/MVP_SPEC.md` §10.

## Further Notes

- The acceptance test for v1 is ten real matches, at least one using a phone as the Capture Device, none lost to a technical failure.
- The two source drafts are preserved under `apps/table/docs/background/` and their factual errors are itemised in `MVP_SPEC.md` §11.
- Ticket order is dependency order; each ticket body names its model and its blockers.
