# Deck Advisor Specification

## Problem Statement

Collectors building and tuning competitive Grand Archive TCG Decks inside the Binder application have no integrated way to brainstorm strategies, verify complex timing and keyword rulings against the official Grand Archive Comprehensive Rules, compare their list against tournament Meta Archetypes and Meta Staples, or evaluate card swaps grounded strictly in their actual physical holdings.

Furthermore, evaluating which cards in a 1,000+ card collection can legally be swapped into a selected Deck is non-trivial in Grand Archive:
- Cards in a Deck can grant rule-bending elemental bypasses across the entire game (for example, *The Looking Glass* is a `NORM` Divine Relic whose effect reads *"Ignore the elemental requirements of Distortion cards you play"*, making an `ASTRA` card like *Palvor Sword* legal in a Fire/Crux Merlin Deck).
- Off-class cards (such as `GUARDIAN` on *Palvor Sword* or `CLERIC` on *The Looking Glass* in a `MAGE` Deck) are legal to materialize and activate for their base effects unless restricted by an explicit class-only activation clause; they simply do not activate `[Class Bonus]` abilities.
- Physical holdings are distributed across active Binder **Owned Copies** (**Idle Copies**, **Shared Copies**, and **Dedicated Cards** locked to other Decks) and personal **Store Listings** eligible for **Shortage Offset** pull-back.

## Solution

Introduce the **Deck Advisor**, an account-gated conversational AI referee and deck-building partner embedded directly in the Deck Detail view. Powered by **Gemini 3.8 Flash** (`gemini-3.8-flash` via `GEMINI_API_KEY`, with automatic fallback to **OmniRoute** `combo/auto-fallback` on `HTTP 429` or quota exhaustion), the **Deck Advisor** ingests:
1. The Collector's full selected **Deck** (`Main Deck`, `Material Deck`, and `Sideboard`) with complete Card Catalog oracle text, costs, subtypes, and active **Hard Shortages** and **Shared Shortages**.
2. An effect-aware **Candidate Pool** containing full oracle text for all owned cards matching the Deck's unlocked Elements (`NORM` plus elements present in the Material/Main Deck) and any subtypes unlocked by effect-bypass clauses in the Deck (such as all `DISTORTION` cards across any Element when *The Looking Glass* is present), keeping off-class cards eligible for base effects (`[Off-Class: Base Effect Only]`) and partitioning every candidate card by acquisition friction:
   - **Tier 1 (Binder Available)**: **Idle Copies** and **Shared Copies** not strictly reserved as **Dedicated Cards** for other Decks.
   - **Tier 2 (Store Listing Pull-Back)**: Personal **Store Listings** owned by the Collector that can be withdrawn to offset a Shortage.
   - **Tier 3 (Unowned Meta & Catalog Upgrades)**: Missing cards from matching **Meta Archetypes** (`Canonical Decklist`) and **Meta Staples**, explicitly flagged as causing a **Hard Shortage**.
3. Live agent tools for querying the official Grand Archive Comprehensive Rules via the GitBook MCP endpoint (`https://rules.gatcg.com/~gitbook/mcp`) and searching across the Collector's entire 1,000+ card collection and global **Card Catalog** when exploring elemental splashes or Champion lineage pivots.
4. Structured card swap proposals (`-X Card A / +X Card B`) displaying acquisition tier, reasoning, and 1-click updated **Omnidex Format** export.

## User Stories

1. As an allowlisted Collector viewing one of my Decks, I want to open the **Deck Advisor** panel directly on the Deck Detail view, so that I can discuss strategy and card changes without leaving my decklist.
2. As a non-allowlisted Collector or unauthenticated visitor, I want the **Deck Advisor** UI and API endpoints to remain hidden and return `403 Forbidden`, so that the feature is strictly restricted to authorized accounts.
3. As a Collector talking to the **Deck Advisor**, I want the assistant to see every card in my selected Deck's `Main Deck`, `Material Deck`, and `Sideboard` along with its exact oracle effect text, Reserve/Memory costs, speed, subtypes, and current **Hard Shortages** and **Shared Shortages**, so that it never hallucinates card effects or deck contents.
4. As a Collector running effect-bypass cards like *The Looking Glass* in my Fire/Crux Merlin Deck, I want the **Deck Advisor** to automatically detect subtype/element bypass clauses in my Deck and include matching off-element cards I own (such as `ASTRA` `DISTORTION` card *Palvor Sword*) in my pre-loaded **Candidate Pool**, so that legal cross-element synergies are surfaced immediately.
5. As a Collector evaluating off-class tech cards (such as a `GUARDIAN` sword or `CLERIC` relic in a `MAGE` Deck), I want the **Deck Advisor** to include off-class cards in my **Candidate Pool** tagged as `[Off-Class: Base Effect Only]` rather than excluding them, while warning me that `[Class Bonus]` effects will not be active.
6. As a Collector asking what cards I can swap in right now, I want the **Deck Advisor** to distinguish between **Tier 1 (Binder Available: Idle & Shared Copies)**, **Tier 2 (Personal Store Listings eligible for Shortage Offset pull-back)**, and **Tier 3 (Unowned Meta/Catalog upgrades that create a Hard Shortage)**, so that I know whether I can sleeve a suggestion immediately, pull it from my store, or need to buy it.
7. As a Collector with **Dedicated Cards** strictly reserved for another Deck, I want those dedicated copies excluded from my available Tier 1 count for the current Deck, so that the **Deck Advisor** does not recommend cannibalizing a locked Deck.
8. As a Collector tuning a competitive list, I want the **Deck Advisor** to automatically benchmark my Deck against the closest matching **Meta Archetype** (`Canonical Decklist`, `Meta Tier`, win rate, share rate) and format **Meta Staples**, so that we can discuss why my list deviates from tournament builds and which missing staples I already own.
9. As a Collector asking a timing, priority, or keyword ruling question (such as activating `Fast` cards during the `Recollection Step` or how `Omnishroud` and `Floating Memory` interact), I want the **Deck Advisor** to call the live GitBook MCP rules endpoint (`https://rules.gatcg.com/~gitbook/mcp`) and cite the verified ruling, displaying an indicator in the UI that official rules were consulted.
10. As a Collector with 1,000+ unique cards in my Binder considering an elemental splash or Champion lineage pivot (e.g., *"Do I own a good Water package if I swap my Level 1 Spirit?"*), I want the **Deck Advisor** to invoke a collection/catalog search tool across all Elements, Subtypes, and Keywords, so that it can inspect any card in my collection or the **Card Catalog** on demand.
11. As a Collector agreeing on a deck change with the **Deck Advisor**, I want the assistant to render structured swap proposal cards (`-X Cut Card` → `+X Add Card` with zone, acquisition tier badge, and strategic rationale) and allow me to copy the resulting updated **Omnidex Format** decklist in one click.
12. As a Collector refreshing the page or switching between Grid and List views on my Deck, I want my **Deck Advisor** conversation history for that Deck preserved in browser `localStorage` with a "Clear Chat" action to reset the thread when starting fresh.
13. As a Collector using the app in either English (`en`) or Brazilian Portuguese (`pt-BR`), I want all **Deck Advisor** UI chrome, badges, buttons, placeholders, and error states localized via `@ga/contracts` while keeping official Grand Archive **Game Nomenclature** in canonical English, and I want the **Deck Advisor** to respond in my active locale.
14. As a Collector whose primary Gemini API key hits a rate limit (`HTTP 429`) or quota exhaustion, I want the **Deck Advisor** to automatically fall back to the local **OmniRoute** gateway (`combo/auto-fallback`) and transparently notify me that fallback routing is active, so that my theorycrafting session continues without failing.

## Implementation Decisions

- **Layering & Architecture Compliance (ADR 0012 & ADR 0029)**:
  - All database queries for assembling the Deck, Candidate Pool, Store Listings, and Meta Archetype benchmarks live exclusively in a dedicated repository module under `src/db/repositories/`.
  - Domain logic—including effect-bypass clause detection, class bonus/restriction classification, tiered Candidate Pool partitioning, prompt construction, tool orchestration, and LLM/MCP communication—lives in `src/services/` (split into focused modules under 400 lines each).
  - The Next.js API route (`/api/decks/[id]/advisor`) is a thin entry point that authenticates the session, checks the account allowlist, validates the request body with a schema, invokes the service, and returns the response.
- **Account Allowlist Gating**:
  - Access is controlled via `ADVISOR_ALLOWED_EMAILS` and/or `ADVISOR_ALLOWED_USER_IDS` environment variables (comma-separated, case-insensitive for emails).
  - An availability check endpoint/flag exposes whether the current authenticated Collector is allowlisted so the Deck Detail UI only renders the **Deck Advisor** experience for authorized accounts.
- **Effect-Aware Candidate Pool & Legality Engine**:
  - **Unlocked Elements**: Computed from `NORM` plus all unique `element` values present in the selected Deck's `material` and `main` zones, plus any elemental unlocks detected in the Deck's card `effect` texts.
  - **Effect-Driven Subtype Bypasses**: Scans all cards in the selected Deck for patterns such as `/ignore the elemental requirements of ([a-z0-9 -]+) cards/i` (e.g., *The Looking Glass* unlocking `DISTORTION` cards). Any Owned Copy or Store Listing whose `subtypes` JSON array contains a bypassed subtype is included in the pre-loaded **Candidate Pool** regardless of its `element`, annotated with `[Unlocked via <Source Card Name>]`.
  - **Class Handling**: Derives the Champion's active classes from the `material` zone Champion lineage. Cards matching those classes (or `ALL` / `GENERIC`) are marked `[Class Bonus Active]`. Cards with a different `class` are NOT excluded unless their `effect` contains a hard class activation lock; instead, they are included and annotated `[Off-Class: Base Effect Only]`.
  - **Three-Tier Acquisition Partitioning**:
    - **Tier 1 (`binder_available`)**: Owned Copies in `collection_items` where copies are either Idle or Shared (`!isDedicated`), plus any Dedicated copies already assigned to the selected Deck.
    - **Tier 2 (`store_pullback`)**: Unclaimed personal Store Listings in `myp_cards` matched by `cardSlug`.
    - **Tier 3 (`unowned_upgrade`)**: Cards from the closest matching **Meta Archetype** (`Canonical Decklist` sharing the Deck's Champion/Element) and format **Meta Staples** not fully satisfied by Tier 1 + Tier 2, flagged with their exact **Hard Shortage** deficit.
- **Primary LLM Engine & Automatic OmniRoute Fallback**:
  - Uses **Gemini 3.8 Flash** (`GEMINI_MODEL` defaulting to `gemini-3.8-flash`) via `GEMINI_API_KEY` against Google's OpenAI-compatible chat completions endpoint (`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`).
  - If the Gemini endpoint returns `HTTP 429` or a quota/token exhaustion error, the client automatically retries the request against the configured **OmniRoute** gateway (`OMNIROUTE_URL` defaulting to `http://localhost:20128/v1`, model `combo/auto-fallback`) and sets `fallbackActivated: true` in the response metadata so the UI can surface a transparent badge.
- **Agent Tools (Function Calling)**:
  - `query_official_rules({ query: string })`: Connects to `GA_RULES_MCP_URL` (defaulting to `https://rules.gatcg.com/~gitbook/mcp`) using the MCP Streamable HTTP protocol (`@modelcontextprotocol/sdk` or lightweight JSON-RPC Streamable HTTP client) to discover and invoke the GitBook search/read tool, returning official rulebook excerpts.
  - `search_candidate_pool({ element?: string, subtype?: string, cardType?: string, cardClass?: string, keyword?: string, includeUnownedCatalog?: boolean, limit?: number })`: Queries across the Collector's entire 1,000+ card Binder, Store Listings, and (when `includeUnownedCatalog: true`) the global `cards` table, returning full oracle `effect` text, costs, and ownership tier counts.
- **Structured Swap Proposals**:
  - The assistant response contract includes optional structured swap proposals (`cuts: { cardName, zone, quantity }[]`, `adds: { cardName, zone, quantity, tier }[]`, `rationale: string`) parsed from a structured block or tool output, enabling the UI to render interactive swap cards and compute a preview **Omnidex Format** string on the client.
- **Internationalization (`@ga/contracts`)**:
  - All new UI keys are added simultaneously to `en` and `pt-BR` dictionaries in `@ga/contracts`, preserving canonical English **Game Nomenclature** (`Main Deck`, `Material Deck`, `Sideboard`, Elements, Rarities, Finishes, Card names).

## Testing Decisions

- **What makes a good test**: Tests exercise public service and route boundaries using real in-memory SQLite/libSQL tables and deterministic stubbed HTTP/MCP transports, asserting observable outputs (context assembly, legality bypass inclusion, tiered ownership counts, tool loop execution, 429 fallback routing, and access control rejection) rather than internal private helpers.
- **Primary Testing Seam**:
  - The **Deck Advisor Service** (`buildDeckAdvisorContext`, `runDeckAdvisorTurn`, and tool handlers) tested against an injected in-memory libSQL database seeded with `users`, `decks`, `deck_cards`, `cards`, `card_editions`, `collection_items`, `myp_cards`, `meta_archetypes`, and `meta_staples`.
  - Key scenarios verified at this seam:
    1. **Allowlist Gate**: Rejects non-allowlisted Collectors and permits allowlisted `userId` or `email`.
    2. **Effect-Bypass & Off-Class Legality**: Verifies that a Fire/Crux Merlin Deck containing *The Looking Glass* (`NORM`, `CLERIC`, `"Ignore the elemental requirements of Distortion cards you play"`) automatically pulls an owned *Palvor Sword* (`ASTRA`, `GUARDIAN`, `["GUARDIAN", "DISTORTION", "SWORD"]`) into the pre-loaded Candidate Pool with `[Unlocked via The Looking Glass]` and `[Off-Class: Base Effect Only]`.
    3. **Tiered Candidate Pool Math**: Verifies Tier 1 (Idle/Shared vs. Dedicated to other Decks), Tier 2 (`myp_cards` Store Listing pull-back), and Tier 3 (unowned Meta Archetype diff).
    4. **Tool Loop & Rules MCP**: Verifies `query_official_rules` and `search_candidate_pool` tool execution within a multi-step conversation turn.
    5. **OmniRoute Automatic Fallback**: Verifies that an `HTTP 429` from Gemini 3.8 Flash triggers immediate retry against `http://localhost:20128/v1` with `combo/auto-fallback` and sets `fallbackActivated: true`.
- **Prior Art in the Codebase**:
  - Service tests with injected in-memory databases: `src/services/__tests__/collector-assistant.test.ts` and `src/services/__tests__/collector-assistant-shortages.test.ts`.
  - Architecture and i18n guardrails: `src/lib/__tests__/architecture-guardrails.test.ts` and `packages/contracts/src/__tests__/i18n.test.ts`.

## Out of Scope

- Persisting chat threads in Turso database tables (conversation history uses browser `localStorage` per `deckId` in this slice).
- Exposing the **Deck Advisor** inside the Discord slash-command bot or Root App GUI (`Collector Assistant`).
- Mutating saved Decks in the database automatically without user confirmation (swap proposals provide a 1-click Omnidex copy/apply preview).
- Fine-tuning or hosting custom LLM weights.

## Further Notes

- Governed by [ADR 0029](./adr/0029-deck-advisor-and-mcp-rules-integration.md) and [ADR 0012](./adr/0012-layered-architecture-and-code-limits.md).
