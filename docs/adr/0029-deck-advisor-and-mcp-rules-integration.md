# 0029: Deck Advisor with Gemini Flash, Effect-Aware Candidate Pool, and GitBook MCP Rules

## Status

Accepted

## Context

Collectors want an interactive AI referee and deck-building partner (**Deck Advisor**) to discuss strategies, card synergies, tournament meta comparisons, and card swaps for a selected **Deck**, strictly grounded in the Collector's actual physical holdings (**Candidate Pool**), real card oracle texts in Turso (`cards`), and the live Grand Archive Comprehensive Rules (`https://rules.gatcg.com/~gitbook/mcp`).

An initial draft (`apps/local-llm-ruleset-helper/grand_archive_ai_assistant_with_turso_mcp.md`) proposed a standalone Python script running a local 7B model (`qwen2.5:7b-instruct` on an 8GB VRAM RTX 3070) with raw SQL against `cards`. Stress-testing that design surfaced four architectural and domain findings:

1. **Stack & Layering ([ADR 0012](./0012-layered-architecture-and-code-limits.md))**: The monorepo is strictly TypeScript-only, and all database access must live in `src/db/repositories/*`. Embedding the **Deck Advisor** directly in the Next.js app reuses existing collection, shortage, and meta services and works seamlessly on Vercel without requiring a separate Python environment or home-PC tunnel.
2. **Gemini Flash Context & Reasoning Advantage vs. Local 7B**: A Collector can own **1,000+ unique cards** across their Binder (`collection_items`) and personal Store Listings (`myp_cards`). A local 7B model on 8GB VRAM is constrained to an 8K–16K context window and struggles with multi-card TCG synergy chains and Memory/Reserve economy math. Using **Gemini Flash** via the Gemini API provides a 1M-token context window with implicit/explicit context caching, allowing the advisor to ingest the full oracle text of the selected Deck and every legal/effect-unlocked card in the Collector's Candidate Pool (~15K–25K tokens) in a single turn while working 24/7 on Vercel.
3. **Grand Archive Rule-Bending Legality Exceptions**: Naive SQL filtering by `element IN (Deck Elements) AND class IN (Deck Classes)` hides legal competitive tech cards:
   - **Element Bypass via Card Effects**: Cards in a Deck can waive elemental requirements for specific subtypes across the entire game (for example, *The Looking Glass* is a `NORM` Divine Relic with `"Ignore the elemental requirements of Distortion cards you play"`, making an `ASTRA` card like *Palvor Sword* legal in a Fire/Crux Merlin deck).
   - **Class is Advisory, Not Blocking**: Off-class cards (e.g., `GUARDIAN` on *Palvor Sword* or `CLERIC` on *The Looking Glass* in a `MAGE` deck) are legal to materialize and play for their base effects unless restricted by an explicit class-only activation clause; they simply do not activate `[Class Bonus]` abilities.
4. **Resilience & Automatic Fallback**: If the primary Gemini API encounters rate limits (`HTTP 429`) or quota exhaustion, the service automatically falls back to the OmniRoute gateway (`http://localhost:20128/v1`, `combo/auto-fallback`) so theorycrafting sessions are never interrupted.

## Decision

### 1. Native TypeScript Architecture Embedded in `/decks/[id]`

Retire `apps/local-llm-ruleset-helper/` and implement the **Deck Advisor** natively inside the Next.js application following [ADR 0012](./0012-layered-architecture-and-code-limits.md):
- **UI Surface**: A conversational drawer/tab inside `src/app/decks/[id]/page.tsx` where a Deck is already selected, storing conversation history ephemerally in browser `localStorage` keyed by `deckId`. All static UI labels reside in `@ga/contracts` (`en` and `pt-BR`).
- **Access Control Gate**: Gated via environment variable allowlist (`ADVISOR_ALLOWED_EMAILS` / `ADVISOR_ALLOWED_USER_IDS`) checked against the authenticated NextAuth session on both the UI and `/api/decks/[id]/advisor`.
- **Service & Repository Layer**: `src/services/deck-advisor.ts` orchestrates prompt assembly, tool execution, and MCP calls, reading data exclusively through `src/db/repositories/*` and existing domain services.

### 2. Grounded Context Assembly & Effect-Aware `Candidate Pool`

To guarantee the **Deck Advisor** only uses real card effects and accurately reflects the Collector's physical inventory:

1. **Pre-Loaded Grounded System Context (~15K–25K tokens, cached across turns)**:
   - **Strict Grounding Mandate**: The system prompt instructs Gemini Flash to rely *exclusively* on the Turso card oracle texts and GitBook MCP rule excerpts provided in context/tools, never hallucinating card effects or unverified ownership.
   - **Full Selected Deck**: Every card in `material`, `main`, and `side` zones with quantities, costs (`costMemory`, `costReserve`), `element`, `class`, `type`, `subtypes`, and full `effect` text, plus current **Hard Shortages** and **Shared Shortages**.
   - **Effect-Aware Candidate Pool (Full Oracle Text Included)**:
     - Includes all owned cards matching the Deck's unlocked **Elements** (`NORM` + elements in Material/Main Deck) **PLUS** any subtypes/elements unlocked by effect-bypass clauses detected in the Deck (such as all owned `DISTORTION` cards across *any* Element when *The Looking Glass* is present).
     - Tracks **Champion Classes** as `[Class Bonus Active]` rather than excluding off-class cards, tagging off-class options as `[Off-Class: Base Effect Only]` (and only excluding cards with hard class activation locks).
     - Partitions every candidate card by acquisition friction:
       1. **Binder Available** (Idle Copies + Shared Copies not Dedicated to other Decks),
       2. **Store Listing Pull-Backs** (`myp_cards` owned by the Collector that can offset a shortage), and
       3. **Unowned Meta/Catalog Upgrades** (from `meta_archetypes` / `meta_staples`, flagged as creating a **Hard Shortage**).
   - **Meta Archetype & Staple Benchmark Diff**: Automatic comparison against the closest matching **Meta Archetype** (`meta_archetypes`) and format **Meta Staples** (`meta_staples`).

2. **Agent Tools for Cross-Element Pivots, Full Catalog Lookups & Live Rules**:
   - `search_candidate_pool({ element?, subtype?, cardType?, keyword?, includeUnownedCatalog? })`: Queries across the Collector's entire 1,000+ card Binder, Store Listings, and the global Card Catalog when the Collector asks about splashing a new Element, pivoting their Champion lineage, or exploring unowned tech cards.
   - `query_official_rules({ query })`: Connects via `@modelcontextprotocol/sdk` (`StreamableHTTPClientTransport`) to `https://rules.gatcg.com/~gitbook/mcp` to verify timing windows (`Fast`, `Slow`), phase rules (`Recollection Step`, `Materialize Phase`), and keyword interactions live against the official Grand Archive Comprehensive Rules.

### 3. Gemini Flash Primary Engine with OmniRoute Fallback

- **Primary Provider**: Calls **Gemini 3.8 Flash** (`GEMINI_MODEL`, defaulting to `gemini-3.8-flash`) using `GEMINI_API_KEY` via Google's OpenAI-compatible/Generative AI endpoint.
- **Automatic Fallback**: On `HTTP 429` / token exhaustion, transparently routes through `OMNIROUTE_URL` (`http://localhost:20128/v1`, `combo/auto-fallback`).

## Consequences

- **Zero Hallucination & Full Synergy Visibility**: Gemini Flash sees the real Turso oracle text of the entire selected Deck and all legal/effect-unlocked cards in the Collector's Candidate Pool at once, effortlessly catching cross-element synergies like *The Looking Glass* + *Palvor Sword*.
- **Zero Home-PC Dependency on Vercel**: Works natively in production on Vercel via `GEMINI_API_KEY` without requiring the home RTX 3070 to be online.
- **Strict Architectural Compliance**: Zero Python dependencies, full reuse of `src/db/repositories/*` and `@ga/contracts` i18n.
