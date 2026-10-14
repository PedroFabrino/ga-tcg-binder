# Specification: Grand Archive TCG Binder & Deck Manager

## Problem Statement

Grand Archive TCG collectors and competitive players lack a unified tool to track their physical card collections at the exact printing and circulation level, assess print scarcity (population numbers), and analyze deck construction feasibility. When building multiple decks or inspecting top tournament lists, players struggle to know:
1. Which cards are missing from their physical collection.
2. Which physical copies are shared across multiple active decks vs. sitting idle in trade binders.
3. Which playgroup friends own idle, unassigned copies of cards needed to complete a deck.
4. How to quickly register physical cards without tedious manual data entry, especially from a mobile camera.

## Solution

A full-stack Next.js web application deployed on Vercel backed by Turso (libSQL) that:
1. Synchronizes the complete Grand Archive Card Catalog (~2,535 cards) from the official `api.gatcg.com` API, capturing print editions, circulations, foil statuses, and exact publisher population numbers.
2. Manages physical collections at the specific Printing level, with automated smart grouping for **Multi-Deck Staples**, **Low Population** collectibles, and **Idle Binder** cards.
3. Provides deck construction, Omnidex text import/export, and real-time shortage analysis (Main Deck, Material Deck, Sideboard) with configurable **Dedicated (No-Sharing)** controls.
4. Integrates live tournament data from `grandarchivestats.com`, enabling one-click shortage comparison against meta archetypes and tournament-winning decklists.
5. Connects collectors via **Friend Links**, displaying playgroup friend availability inline on deck shortages (*"Available from Friends: Bob (2 idle copies)"*).
6. Powers a **QR-Paired Mobile Card Scanner** where scanning a desktop QR code opens a phone camera viewfinder that streams recognized cards directly into the desktop collection without a mobile login.

---

## User Stories

### Card Catalog & Discovery
1. As a collector, I want to search cards by name, set prefix, class, and element, so that I can look up any card in the Grand Archive universe instantly.
2. As a collector, I want to view every printing and circulation of a card, so that I can see its foil variants, collector number, and official print population count.
3. As a collector, I want cards with population $\le 1,000$ (or custom threshold) to display a "Low Population" badge, so that I can immediately identify rare collector prints.
4. As an administrator, I want to trigger an incremental sync with `api.gatcg.com`, so that newly released sets and errata are added to the local catalog.

### Collection Management
5. As a collector, I want to add owned copies of specific card printings (specifying foil or non-foil), so that my physical binder is accurately represented.
6. As a collector, I want a quick-add search bar with `+` and `-` quantity buttons, so that I can register card pulls with minimal clicks.
7. As a collector, I want a bulk text paste importer, so that I can import lists of cards in seconds.
8. As a collector, I want smart view tabs for "All", "Multi-Deck Staples", "Low Population", and "Idle / Binder", so that I can isolate cards relevant to trading or deck building.
9. As a collector, I want to adjust my Low Population threshold in settings, so that I can tailor the scarcity view to my collection preferences.

### Decks & Shortage Analysis
10. As a deckbuilder, I want to create decks with Main (60), Material (12), and Sideboard zones, so that I can plan legal tournament decks.
11. As a deckbuilder, I want to paste Omnidex text decklists, so that I can import decks built on Silvie.gg or other community builders.
12. As a deckbuilder, I want to view a deck's shortage report, so that I see exactly which cards and quantities I am missing from my physical collection.
13. As a deckbuilder, I want to click "Add missing to collection" on any missing card, so that I can update my inventory immediately when I acquire the cards.
14. As a deckbuilder, I want cards to be shared between decks by default, so that owning 4 copies of a staple satisfies multiple decks.
15. As a deckbuilder, I want to mark specific cards (or a global setting) as "Dedicated", so that physical copies cannot be double-counted across multiple decks.
16. As a deckbuilder, I want to explicitly assign physical copies of Dedicated cards to a deck, so that other decks accurately reflect the resulting card deficit.

### Tournament Meta Explorer
17. As a competitive player, I want to browse top meta archetypes and tier rankings from `grandarchivestats.com`, so that I can track current tournament trends.
18. As a competitive player, I want to view tournament decklists and click "Compare Against My Collection", so that I immediately know what cards I need to build a winning list.
19. As a competitive player, I want to paste any `grandarchivestats.com` deck URL, so that the app automatically extracts the Omnidex list and runs the shortage comparison.

### Friend Network & Idle Card Sharing
20. As a collector, I want to generate a shareable friend invite link, so that my local playgroup members can connect with me in one click.
21. As a collector, I want to search for friends by username or friend code, so that we can establish a mutual Friend Link.
22. As a deckbuilder inspecting a deck shortage, I want to see which linked friends have idle (unassigned) copies of missing cards, so that I know who to borrow from before a tournament.
23. As a collector, I want to view a friend's Idle Binder, so that I can explore cards they own that aren't currently locked into their active decks.
24. As a collector, I want my Dedicated and active deck cards to remain distinguished from my Idle Copies, so that friends only ask to borrow cards I'm not actively playing.

### QR-Paired Mobile Scanner
25. As a collector on desktop, I want to open a "Scan with Phone" modal showing a QR code, so that I can use my mobile camera without signing in on my mobile device.
26. As a mobile user, I want scanning the QR code to open a temporary authenticated camera scanner, so that I can point my phone camera at physical cards or binders.
27. As a mobile user, I want the camera viewfinder to sample frames, run client-side OCR on collector codes/names, and match against the catalog in real time.
28. As a collector on desktop, I want recognized cards from the mobile camera to stream onto my desktop screen live, so that I can confirm and add them to my collection in real time.

---

## Implementation Decisions

### Architectural Decisions & Persistence
- **Runtime & Deployment**: Next.js App Router deployed to Vercel serverless environment.
- **Database & ORM**: Turso (libSQL) database accessed over HTTP via `@libsql/client` and schema managed with Drizzle ORM (ADR 0001).
- **Authentication**: Auth.js (NextAuth v5) with Discord and Google OAuth providers, persisting user accounts, sessions, and friend links into Turso (ADR 0002).
- **Scanner Architecture**: Short-lived pairing tokens with temporary WebSocket / Server-Sent Event or polling bridge connecting phone camera capture to desktop collection sessions (ADR 0003).

### Data Schema Shape

```typescript
// Core Catalog (Synced from api.gatcg.com)
interface Card {
  slug: string;
  name: string;
  element: string;
  class: string;
  type: string;
  subtypes: string[];
  effect: string;
  cost_reserve?: number;
  cost_memory?: number;
  level?: number;
  speed?: boolean;
}

interface CardEdition {
  id: string; // uuid
  card_slug: string;
  set_prefix: string;
  set_name: string;
  collector_number: string;
  rarity: number;
  image_url: string;
  circulations: {
    kind: 'FOIL' | 'NONFOIL';
    population: number;
    foil: boolean;
    printing: boolean;
  }[];
}

// User Collection & Decks
interface CollectionItem {
  id: string;
  user_id: string;
  edition_id: string;
  foil: boolean;
  quantity: number;
  is_dedicated: boolean;
}

interface Deck {
  id: string;
  user_id: string;
  name: string;
  champion: string;
  format: string;
  is_public: boolean;
  cards: {
    card_slug: string;
    zone: 'main' | 'material' | 'side';
    quantity: number;
    assigned_edition_id?: string;
  }[];
}

// Social & Sessions
interface FriendLink {
  id: string;
  user_id_1: string;
  user_id_2: string;
  status: 'pending' | 'accepted';
}

interface ScannerSession {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
}
```

---

## Testing Decisions

### What Makes a Good Test
- Tests must verify external domain behavior (catalog search results, accurate shortage counts, multi-deck contention resolution, and friend idle calculations) rather than internal mock-heavy implementation details.
- Database operations must run against an in-memory libSQL instance to mirror production query behavior with zero external network dependencies.
- External HTTP endpoints (`api.gatcg.com` and `grandarchivestats.com`) are exercised using recorded fixture responses.

### Primary Testing Seams
1. **Catalog & Search Seam**: Verifies card search, filtering by element/class/set, and low-population calculations against real Grand Archive API fixture data.
2. **Shortage Calculation Seam**: Evaluates a deck's card demand against a collector's inventory under both Shared and Dedicated rules, verifying missing card lists and cross-deck contention tags.
3. **Friend Idle Inventory Seam**: Verifies that when Deck A requires Card X, linked friends with unassigned copies are correctly detected, while cards locked in friends' dedicated decks are excluded.
4. **Omnidex Parser Seam**: Verifies bidirectional parsing and serialization of standard Grand Archive decklist text and raw HTML extracts from `grandarchivestats.com`.

---

## Out of Scope
- Direct real-time TCGplayer market price polling (deferred per user decision; population values are used exclusively).
- Real-time trading / checkout cart checkout system.
- Direct automated video transcoding on the server (client-side frame sampling is used instead to avoid serverless timeouts).

---

## Further Notes
- Omnidex decklists use `# Material Deck`, `# Main Deck`, and `# Sideboard` section headers with `[count] [Card Name]` syntax.
- Population counts in Grand Archive range from 1 (unique sample/promos) to tens of thousands for standard non-foils.
