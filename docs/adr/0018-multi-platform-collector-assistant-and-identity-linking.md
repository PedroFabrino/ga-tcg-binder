# ADR 0018: Multi-Platform Collector Assistant and Identity Linking Architecture

## Status

Accepted

## Context

Collectors frequently discuss decklists, shortages, and trades inside community chat channels (Discord and Root). Navigating to the web app during live conversations adds friction. Collectors need a fast, conversational way to query their personal Decks, Shortages, Binder holdings, and Wantlists directly from their chat platforms.

We require an architecture that:
1. Supports both **Discord** and **Root** while maximizing code reuse across schemas, endpoints, and domain logic.
2. Securely links third-party platform identities (Discord Snowflake IDs and Root User GUIDs) to canonical Collector accounts, supporting collectors who log in via Google, Discord, or different emails.
3. Preserves collection privacy by keeping conversational data private.
4. Adheres strictly to [ADR 0012](./0012-layered-architecture-and-code-limits.md) (layered repository pattern, capped file size, no direct DB queries in apps or entrypoints).

## Decision

### 1. Unified Backend API (`/api/assistant/*`) & Shared Contracts

Domain calculations (shortage resolution, binder search, wantlist aggregation) live in `src/services/collector-assistant.ts` and are exposed via internal REST endpoints under `/api/assistant/*`.

A shared module in `packages/contracts/src/assistant.ts` defines request/response contracts and a typed client reused by both bots:
- `POST /api/assistant/link`: Validate pairing code and bind platform identity.
- `GET /api/assistant/decks`: List collector's active decks with completion percentages.
- `GET /api/assistant/shortages`: Itemize Hard Shortages and Shared Shortages for a deck.
- `GET /api/assistant/collection`: Query owned binder copies by card name.
- `GET /api/assistant/wantlist`: Fetch deck-partitioned wantlists.

Endpoints are authenticated via a pre-shared internal secret header (`x-assistant-token`).

### 2. Multi-Provider Identity Linking & Pairing Tokens

Introduce two persistence tables in `src/db/schema.ts`:

#### `collector_identities`
Maps external chat platform users to canonical `users.id`:
- `id` (text, PK, UUID)
- `collectorId` (text, FK -> `users.id`, onDelete cascade)
- `provider` (text, `'discord' | 'root'`)
- `providerUserId` (text, unique per provider)
- `providerUsername` (text, nullable)
- `linkedAt` (integer timestamp)

#### `collector_pairing_tokens`
Ephemeral 6-digit alphanumeric pairing codes:
- `id` (text, PK, UUID)
- `collectorId` (text, FK -> `users.id`, onDelete cascade)
- `token` (text, 6 chars)
- `expiresAt` (integer timestamp, 10 min TTL)
- `usedAt` (integer timestamp, nullable)

#### Unification Flow
1. **Automatic Discord Linking**: If a user authenticates via Discord OAuth in `src/auth.ts`, the `signIn` callback records their Discord identity into `collector_identities`.
2. **Cross-Provider Pairing**: A user authenticated via Google (or Discord with a different email) visits `/settings -> Linked Accounts`, generates a 6-digit code, and executes `/link <code>` in Discord or Root.

### 3. Discord Architecture: Serverless HTTP Interactions on Vercel

The Discord app avoids persistent container hosting:
- `apps/ga-tcg-discord-app/`: Contains command definitions and deployment scripts to sync slash commands with Discord REST API (`PUT /applications/{id}/commands`).
- `src/app/api/discord/interactions/route.ts`: Edge/Node webhook handler on Vercel. Validates Ed25519 cryptographic request signatures, parses interaction payloads, delegates to `collector-assistant.ts`, and returns responses in < 3 seconds.

### 4. Root Architecture: Consolidated `apps/ga-tcg-root-app`

Rename `apps/ga-tcg-binder-bot` to `apps/ga-tcg-root-app`:
- Deploys as a single application under the registered Root App ID.
- Runs the background marketplace outbox poller alongside slash command handlers for `/decks`, `/shortages`, `/collection`, and `/wantlist`.
- Retains compatibility with Root's manifest structure, leaving the door open for an embedded client GUI panel (`package.client`) in the future.

### 5. Privacy & Command Surface

All command responses are **Ephemeral** (only visible to the executing user):
- `/link <code>`: Pairs identity.
- `/decks`: Active decks, card counts, completion % badge.
- `/shortages [deck]`: Itemizes Hard Shortages (*Compra Necessária*) vs Shared Shortages (*Revezamento entre Decks*).
- `/collection [name]`: Binder copies by printing, finish, and dedicated/idle state.
- `/wantlist [deck?]`: Deck-partitioned shortages ready to copy.

Playgroup friend idle copy probing (`/borrow`) is deferred to Phase 2.

## Consequences

### Positive
- **Zero Additional Hosting**: The Discord bot runs serverless on existing Vercel infrastructure; the Root bot runs in Root Cloud.
- **Strict Layering**: Both chat platforms consume the same typed REST contracts from `@ga/contracts`.
- **Privacy by Default**: No accidental leaking of personal collections in public channels.
- **Provider Agnostic**: Multiple Discord or Root accounts can link to a single Collector.

### Negative
- **No Discord Presence**: The Discord bot will not display an active "Green Dot" status in the server member list since it does not maintain a persistent WebSocket gateway connection.
- **3-Second Interaction Window**: Discord serverless endpoints must reply within 3 seconds (mitigated by fast libSQL index lookups and deferral if needed).
