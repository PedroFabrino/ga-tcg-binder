# 0020: Personal Wants and Collector Assistant Interaction Model

Status: accepted

## Context

The Collector Assistant bot (ADR 0018) provides Grand Archive collectors with conversational access to their decks, shortages, collection holdings, and wantlists across Discord and Root.

In the initial implementation:
1. Commands required manual typing of deck and card names, making interactions prone to typos and missing interactive discovery.
2. The Wantlist was exclusively computed as the aggregate of constructed Deck Shortages (Hard Shortages and Shared Shortages). Collectors had no mechanism to track ad-hoc chase cards, unconstructed archetype tech cards, or cards wanted independently of a 60-card list.
3. Omnidex is the standard deck serialization format across the Grand Archive community (used on Omnidex.gg, Silvie.gg, and GrandArchiveStats.com). Collectors need both the ability to import a whole deck directly into their saved decks, and the ability to extract only the unowned card gap from an Omnidex list into their personal wantlist.
4. Discord slash commands run over serverless HTTP webhooks with a strict 3000ms response budget, requiring low-latency autocomplete and component dispatch.

## Decision

### 1. Interactive Selection & Discord Component Model

To replace blind typing with intuitive selection, the Assistant implements native Discord interactions:

- **Autocomplete (`type: 4 APPLICATION_COMMAND_AUTOCOMPLETE`)**:
  - `/shortages deck:` and `/wantlist view deck:` dynamically resolve up to 25 of the linked collector's active decks as they type.
  - `/wantlist add card:` dynamically searches the canonical `cards` catalog from the first typed character, returning up to 25 matches formatted with name, element, and card type.
  - `/wantlist remove card:` autocompletes exclusively against the collector's current active Personal Wants.
- **Message Components (`type: 3 MESSAGE_COMPONENT` / `StringSelectMenu`)**:
  - When `/decks` or `/shortages` (without parameters) is executed, the bot returns an interactive dropdown menu of the collector's active decks.
  - Selecting an option updates the message in-place (`type: 7 UPDATE_MESSAGE`) to display champion, format, completion percentage, and itemized Hard/Shared shortages, including a `"« Back to All Decks"` reset option.
- **Modals (`type: 9 MODAL`)**:
  - When importing raw multiline Omnidex text, the bot renders a native Discord Modal containing a multiline textarea to prevent slash command string clipping.

### 2. Collection Portfolio Dashboard (`/collection`)

The `query` parameter on `/collection` is made optional:
- **With query**: Performs existing itemized search for matching cards and printings, reporting dedication and idle availability.
- **Without query**: Computes and renders a high-level **Binder Portfolio Dashboard** embed:
  - Total Owned Copies and Unique Card count.
  - Foil vs. Normal distribution.
  - Sleeved Dedicated Copies vs. Available Idle Copies.
  - Elemental distribution breakdown.
  - Direct hyperlink to the collector's public web profile (`/u/[friendCode]`).

### 3. Personal Wants & Aggregate Wantlist Architecture

We introduce a dedicated domain entity **Personal Want** (`collector_wants` table):
- Fields: `id` (UUID), `collectorId`, `cardSlug`, `editionId` (optional specific printing), `desiredQuantity` (integer default 1), `foil` (optional boolean), `targetMaxPrice` (optional real), `source` (`'manual'` or `'omnidex'`), `createdAt`, `updatedAt`.
- Unique constraint on `(collector_id, card_slug, coalesce(edition_id, 'ANY'), coalesce(foil, -1))` ensures upsert semantics rather than duplicate entries.
- **Aggregate Wantlist**: `/wantlist view` consolidates both deck-derived Shortages (grouped by Deck with Hard 🔴 and Shared 🟡 badges) and independent Personal Wants (grouped under **🎯 Direct Wants**).

### 4. Omnidex Deck Import vs. Wantlist Gap Flattening

We delineate deck creation from wantlist tracking:
- **`/decks add [url]`**: Imports an Omnidex deck (via URL or Modal textarea) as a newly saved constructed **Deck**, persisting full deck cards across Material, Main, and Sideboard zones via `createDeckService`.
- **`/wantlist add-omnidex [url]`**: Ingests an Omnidex deck, compares each required card and quantity against the collector's current physical Binder inventory, and flattens **only the unowned shortage gap** into `collector_wants` (`source: 'omnidex'`). Fully owned cards are bypassed.

### 5. Marketplace Deal Alert Foundation (`/wantlist notify`)

- Collectors can toggle deal alerts (`/wantlist notify [enable: true/false]`).
- The marketplace notification sink checks incoming crawled listings from MyP, LigaStore, and Lootcards against both Deck Shortages and Personal Wants.
- When an in-stock listing matches an alerted collector's wantlist, the bot initiates a private Discord Direct Message (`POST /users/@me/channels`) containing the store name, price, printing finish, and purchase link.

## Consequences

- Clean separation between constructed deck analytics (which affect deck completion and contention) and personal purchase targets.
- Omnidex decklists can be utilized both for building full decks and for quick ad-hoc wishlists without cluttering the player's saved decks.
- Strict sub-200ms latency on autocompletion by executing local indexed catalog and deck queries.
