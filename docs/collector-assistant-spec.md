# Spec: Multi-Platform Collector Assistant (Discord & Root)

## Problem Statement

Grand Archive TCG collectors coordinate trades, discuss tournament decklists, and plan deck building inside chat communities on Discord and Root. When discussing cards or preparing for events, checking personal binder holdings, verifying if a specific foil printing is owned, or seeing which cards are missing to sleeve a deck currently requires opening a web browser, logging into the GA Binder web app, and manually searching through decklists.

This workflow friction slows down trading and tournament preparation. Collectors need a direct, conversational way to query their active Decks, itemized Shortages, Binder holdings, and Wantlists inside Discord and Root without leaving chat, while keeping their personal collection data private by default.

## Solution

A multi-platform **Collector Assistant** service integrated into both Discord and Root. 

Collectors securely link their Discord or Root platform identities to their GA Binder Collector profile using either zero-click OAuth matching (for Discord users with matching emails) or an ephemeral 6-digit pairing code generated in the Web Settings page (`/link <code>`). Once linked, collectors can execute slash commands to immediately view:
- Their active Decks with card counts and completion percentage.
- Exact missing cards for any Deck, explicitly split into **Hard Shortages** (*Compra Necessária* — cards physically unowned in sufficient quantity to sleeve even one deck) and **Shared Shortages** (*Revezamento entre Decks* — cards owned but contended across multiple concurrent decks).
- Binder card holdings by name, printing, finish (foil/normal), and dedicated/idle assignment.
- Deck-partitioned Wantlists itemizing shortages per target deck list.

All conversational responses are strictly **Ephemeral** (private to the executing collector), ensuring tournament decklists and collection sizes remain confidential unless manually copied and shared. The architecture maximizes reuse by hosting the Discord bot serverless on Vercel (`/api/discord/interactions`) and consolidating the Root bot into `apps/ga-tcg-root-app`, both calling a shared internal REST API (`/api/assistant/*`) typed via `@ga/contracts`.

## User Stories

1. As a Collector, I want to pair my Discord account with my GA Binder profile via a 6-digit pairing code, so that I can securely access my collection data in Discord.
2. As a Collector, I want to pair my Root account with my GA Binder profile via a 6-digit pairing code, so that I can securely access my collection data in Root community channels.
3. As a Collector who logs into GA Binder with Discord OAuth, I want the bot to automatically recognize my Discord identity without manual pairing, so that I have zero setup friction.
4. As a Collector who registered with Google, I want to link my Discord account even if my Discord email differs from my Google email, so that my identities are unified under one collection.
5. As a Collector, I want to run `/decks` in chat to see all my active Decks with their sleeve completion rates, so that I know which decks are ready to play.
6. As a Collector, I want to run `/shortages [deck_name]` to see exactly what cards are missing to sleeve that deck, so that I know what to trade or buy.
7. As a Collector, I want `/shortages` to clearly distinguish Hard Shortages from Shared Shortages, so that I know which cards I must buy versus which cards I can swap from another deck.
8. As a Collector, I want to run `/collection [card_name]` to check how many copies of a card I own in my Binder across different editions and foil finishes, so that I don't buy duplicate copies during chat trades.
9. As a Collector, I want `/collection` to indicate whether my owned copies are currently dedicated to a deck or idle in my binder, so that I know if they are available to lend.
10. As a Collector, I want to run `/wantlist` to receive a clean, deck-partitioned list of all missing cards across all my active decks, so that I can easily copy and paste them into trading channels.
11. As a Collector, I want all bot replies to be ephemeral (only visible to me), so that other server members cannot see my private decks, binder value, or shortages without my consent.
12. As a Collector, I want to view and revoke my linked Discord and Root accounts in the Web Settings page, so that I have full control over my third-party access.
13. As a Server Administrator, I want to invite one single GA TCG Binder app to my Root community that handles both market stock alerts and collector assistant commands, so that the community member list is clean.
14. As a Server Administrator, I want the Discord slash commands to work without requiring a persistent self-hosted server process, so that the bot operates reliably with zero downtime or maintenance.

## Implementation Decisions

### 1. Unified Internal REST API (`/api/assistant/*`) & `@ga/contracts`
- Domain logic is isolated in a pure service (`src/services/collector-assistant.ts`) adhering to [ADR 0012](docs/adr/0012-layered-architecture-and-code-limits.md) (queries via repositories only).
- Next.js exposes authenticated REST endpoints secured with an `x-assistant-token` header:
  - `POST /api/assistant/link`: Validates a 6-digit pairing token and inserts a record in `collector_identities`.
  - `GET /api/assistant/decks`: Returns active decks, card counts, and completion percentages for a verified platform user.
  - `GET /api/assistant/shortages`: Returns Hard Shortages and Shared Shortages for a specified deck.
  - `GET /api/assistant/collection`: Searches owned copies by card name.
  - `GET /api/assistant/wantlist`: Returns shortages grouped and partitioned by deck.
- Request/response schemas, DTOs, and a typed HTTP client are published in `packages/contracts/src/assistant.ts`.

### 2. Identity Linking & Multi-Provider Unification
- Schema additions in `src/db/schema.ts`:
  - `collector_identities`: `id` (PK), `collectorId` (FK `users.id`), `provider` (`'discord' | 'root'`), `providerUserId`, `providerUsername`, `linkedAt`.
  - `collector_pairing_tokens`: `id` (PK), `collectorId` (FK `users.id`), `token` (6-char alphanumeric), `expiresAt` (10-minute TTL), `usedAt`.
- Auth integration in `src/auth.ts`: Discord OAuth login checks if an identity record exists and creates it automatically.
- Settings UI: New "Linked Accounts" card in `/settings` allowing collectors to generate pairing tokens and view/unlink active platform identities.

### 3. Serverless Discord Integration
- Next.js route `src/app/api/discord/interactions/route.ts` handles inbound Discord webhook POSTs.
- Verifies Ed25519 cryptographic signatures using the Discord Application Public Key.
- Dispatches commands directly to `collector-assistant.ts` and returns JSON interaction responses with `flags: 64` (ephemeral).
- `apps/ga-tcg-discord-app/` contains the slash command definitions (`commands.json` / TypeScript definitions) and an automated registration script to register slash commands via Discord REST API.

### 4. Consolidated Root Application (`apps/ga-tcg-root-app`)
- Rename `apps/ga-tcg-binder-bot/` to `apps/ga-tcg-root-app/` under the existing registered Root App ID.
- Combines the existing background market outbox poller with slash command listeners for `/link`, `/decks`, `/shortages`, `/collection`, and `/wantlist`.
- Calls `/api/assistant/*` via the typed client from `@ga/contracts`.
- Uses lightweight staging packaging (`scripts/package.js`) to guarantee package archives remain ~21MB, preventing HTTP 413 upload errors.

### 5. Structured Payloads with Platform-Native Formatting
- API responses return pure JSON domain data.
- Discord adapter translates data into native Discord Embeds (green status for complete decks, red accent for Hard Shortages, yellow accent for Shared Shortages).
- Root adapter formats clean Markdown tables and bold bullet lists.

## Testing Decisions

- **Seam Strategy**: The primary testing seam is the service layer (`src/services/collector-assistant.ts`) and repository layer (`src/db/repositories/assistant-repository.ts`). Tests run against in-memory SQLite test databases using `createTestDb()`.
- **Discord Webhook Seam**: Test `src/app/api/discord/interactions/route.ts` by mocking Ed25519 signature verification and testing command dispatching.
- **Contract Parity**: Vitest suite verifies that schemas in `packages/contracts/src/assistant.ts` correctly validate mock API responses.
- **Prior Art**: Follows patterns established in `src/services/auth-persistence.test.ts`, `src/services/shortage.test.ts`, and `apps/ga-tcg-binder-bot/src/__tests__/market-notifier.test.ts`.

## Out of Scope

- **Conversational Inventory Editing**: Adding, modifying, or deleting Owned Copies via chat is strictly out of scope for v1 to prevent physical inventory drift.
- **Selling / Marketplace Operations**: No marketplace listing, order creation, or selling actions in chat.
- **Playgroup Idle Card Probing (`/borrow`)**: Cross-friend borrowing checks within a server channel are deferred to Phase 2.
- **Public Chat Broadcasting**: No public announcement of personal decks or collection queries in server channels; all responses remain ephemeral.

## Further Notes

- Architecture is governed by [ADR 0018: Multi-Platform Collector Assistant and Identity Linking Architecture](docs/adr/0018-multi-platform-collector-assistant-and-identity-linking.md).
- Adheres to [ADR 0011](docs/adr/0011-compile-time-typed-i18n-catalog.md) (official English game nomenclature with localized chrome) and [ADR 0012](docs/adr/0012-layered-architecture-and-code-limits.md) (layered repository pattern and 400-line limit).
