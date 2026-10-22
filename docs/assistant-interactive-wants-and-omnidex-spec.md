# Assistant Interactive Selection, Personal Wants, Omnidex Ingestion, and Deal Alerts

## Problem Statement

The Grand Archive Collector Assistant bot allows linked collectors to query decks, shortages, collections, and wantlists via Discord. However:
1. Users must manually type exact deck and card names without visual guidance, leading to frequent typos, mismatched queries, and frustration.
2. Wantlists are exclusively calculated from constructed decks. Collectors have no way to track independent chase cards, speculative buys, or tech cards without sleeving them into an active deck.
3. Importing popular decklists from Omnidex (Omnidex.gg, Silvie.gg, GrandArchiveStats.com) is absent in the chat interface. Users cannot import a deck to their collection nor extract just the missing card gap into a personal wantlist directly within Discord.
4. Running `/collection` without arguments fails or forces an arbitrary search query, missing an opportunity to see a high-level collection portfolio dashboard.
5. Collectors must manually search external marketplaces for missing cards rather than receiving automated private alerts when cards in their wantlists become available.

## Solution

1. **Interactive Selection & Autocomplete**:
   - Provide live Discord Autocomplete (`type: 4`) for deck and card lookups.
   - Provide interactive Dropdown Select Menus on `/decks` and `/shortages` to browse and inspect decks in-place (`type: 7 UPDATE_MESSAGE`) without typing.
2. **Collection Portfolio Dashboard**:
   - Make the `query` parameter optional on `/collection`. When omitted, display an overarching Binder Portfolio Dashboard with ownership metrics, elemental breakdown, and dedication stats.
3. **Personal Wants & Aggregate Wantlist**:
   - Introduce a dedicated `collector_wants` table for tracking non-deck wishlist cards with desired quantity, finish preferences, and price ceilings.
   - Display an Aggregate Wantlist unifying deck-derived Shortages (Hard 🔴 and Shared 🟡) and independent Direct Wants (🎯).
4. **Omnidex Ingestion**:
   - `/decks add [url]`: Imports an Omnidex deck (via URL or multiline Discord Modal) as a newly saved constructed Deck.
   - `/wantlist add-omnidex [url]`: Ingests an Omnidex deck, reconciles it against the collector's Binder inventory, and adds only the unowned shortage gap into Personal Wants.
5. **Marketplace Deal Notifications Foundation**:
   - `/wantlist notify [enable: true/false]`: Allows collectors to subscribe to private bot Direct Messages whenever an external marketplace listing matches cards in their Aggregate Wantlist.

## User Stories

1. As a collector, I want live autocomplete when typing a deck name into `/shortages deck:`, so that I never misspell my deck names or receive "Deck Not Found" errors.
2. As a collector, I want to run `/shortages` without options to see an interactive dropdown menu of my decks, so that I can click my desired deck and see its shortages immediately.
3. As a collector, I want to run `/decks` and receive an interactive dropdown menu, so that I can select any deck and inspect its detailed card composition and completion percentage in-place.
4. As a collector, I want an option in the `/decks` dropdown to return to the full overview list, so that I can browse multiple decks without re-running the command.
5. As a collector, I want to run `/collection` without any arguments, so that I can see an overview dashboard of my total cards, unique counts, foils, and elemental distribution.
6. As a collector, I want the `/collection` dashboard to include a direct link to my web binder profile, so that I can open my complete digital binder in the browser with one click.
7. As a collector, I want to search specific cards in `/collection query: <name>`, so that I can continue inspecting exact printings, dedicated counts, and idle copies for individual cards.
8. As a collector, I want to run `/wantlist add card: <name> [quantity] [foil]`, so that I can track cards I want to buy even if they are not part of an existing deck.
9. As a collector, I want live autocomplete as I type card names in `/wantlist add card:`, so that I can quickly select canonical cards without typing full titles.
10. As a collector, I want to run `/wantlist view`, so that I can see both my active deck shortages and my manually added personal wants grouped clearly in one place.
11. As a collector, I want to run `/wantlist view deck: <name>`, so that I can inspect the aggregate shortages filtered specifically for one deck.
12. As a collector, I want to run `/wantlist remove card: <name>`, with autocomplete suggesting only cards currently in my personal wants, so that I can easily remove or decrement cards I no longer want.
13. As a collector, I want to run `/decks add url: <url>`, so that I can import a tournament list from GrandArchiveStats or Omnidex as a new playable deck directly in Discord.
14. As a collector, I want to run `/decks add` without a URL, so that a Discord Modal opens with a multiline textarea where I can paste raw Omnidex text.
15. As a collector, I want to run `/wantlist add-omnidex url: <url>`, so that the bot extracts only the cards I don't already own from that deck and adds them to my personal wants.
16. As a collector, I want `/wantlist add-omnidex` to notify me how many cards were already owned in my binder and skipped, so that I know exactly what was added to my wishlist.
17. As a collector, I want to run `/wantlist notify enable: true`, so that I can opt into receiving private bot Direct Messages when marketplace sellers list cards I need.
18. As a collector, I want to run `/wantlist notify enable: false`, so that I can silence deal alerts when I am not actively purchasing cards.
19. As a collector receiving a deal alert DM, I want to see the card name, printing, condition, price, store name, and a direct purchase link, so that I can immediately purchase the card before stock runs out.

## Implementation Decisions

### 1. Database Schema
- Create `collector_wants` table:
  - `id`: string (UUID, primary key)
  - `collector_id`: string (foreign key to `users.id`, non-null)
  - `card_slug`: string (foreign key to `cards.slug`, non-null)
  - `edition_id`: string (foreign key to `card_editions.id`, nullable)
  - `desired_quantity`: integer (default 1, non-null)
  - `foil`: integer/boolean (nullable, 0 = normal, 1 = foil, null = any)
  - `target_max_price`: real (nullable)
  - `source`: string (`"manual"` or `"omnidex"`, default `"manual"`)
  - `created_at`: integer / timestamp
  - `updated_at`: integer / timestamp
  - Unique composite index on `(collector_id, card_slug, edition_id, foil)` for upsert conflict resolution.
- Add `wantlist_notifications_enabled` column (boolean, default false) to `collector_identities`.

### 2. Service & Repository Layer
- **Personal Wants Repository**:
  - `listPersonalWants(collectorId)`: loads active personal wants joined with canonical card and edition metadata.
  - `upsertPersonalWant(data)`: adds or increments desired quantity.
  - `removePersonalWant(collectorId, cardSlug, quantity?)`: decrements or removes the row.
  - `setWantlistNotificationPreference(collectorId, platform, enabled)`: updates notification preference.
- **Collection Portfolio Service**:
  - `getCollectorPortfolioSummary(collectorId)`: computes total owned, unique cards, foil count, idle count, dedicated count, and cards grouped by element in a single optimized query.
- **Omnidex Reconcilation Service**:
  - `importOmnidexDeckToCollection(collectorId, name, omnidexText, champion?, format?)`: invokes existing `createDeckService`.
  - `importOmnidexDeckToPersonalWants(collectorId, omnidexText)`: parses the decklist, loads current collector inventory, calculates `Math.max(0, required - idleOwned)`, and bulk inserts positive deficits into `collector_wants`.

### 3. Discord Interaction Handling
- **Interaction Types**:
  - `APPLICATION_COMMAND_AUTOCOMPLETE` (`type: 4`):
    - When focused on `deck:` (in `/shortages` or `/wantlist view`): query collector's decks matching input, return up to 25 `{ name, value }`.
    - When focused on `card:` (in `/wantlist add`): query `cards` catalog with `LIKE '%query%'`, return up to 25 `{ name: "Card Name (Element Type)", value: card.slug }`.
    - When focused on `card:` (in `/wantlist remove`): query collector's `collector_wants`, return active wanted cards.
  - `MESSAGE_COMPONENT` (`type: 3`):
    - Handle `custom_id: "select_deck_shortages"`: updates message in-place (`type: 7`) with itemized deck shortages.
    - Handle `custom_id: "select_deck_details"`: updates message in-place (`type: 7`) with deck card composition.
  - `MODAL_SUBMIT` (`type: 5`):
    - Handle `custom_id: "modal_decks_add"`: parses pasted text, creates deck via `createDeckService`, replies with confirmation embed.
    - Handle `custom_id: "modal_wantlist_add_omnidex"`: parses pasted text, calculates inventory deficit, inserts personal wants, replies with summary embed.
- **Command Definitions (`/api/discord/register`)**:
  - Update registered commands to include subcommands for `/wantlist` (`view`, `add`, `add-omnidex`, `remove`, `notify`) and `/decks` (`overview`, `add`).

### 4. Marketplace Alert Notification Delivery
- Extend marketplace notification processor: when a new listing is synced to `market_cards`, match against active `collector_wants` and `deck_shortages`.
- For collectors with `wantlist_notifications_enabled = true` on Discord, enqueue delivery and post private direct message using the Discord Bot REST API.

## Testing Decisions

- **Testing Seam**: Test at the interaction handler level (`handleDiscordInteraction` in `src/services/discord-interaction.ts`) and API route (`src/app/api/discord/interactions/route.ts`) using an in-memory SQLite test database.
- **Behavioral Assertions**:
  - Autocomplete queries return valid JSON choices with `type: 8` in under 50ms without hitting rate limits.
  - Component select interactions update embeds in-place with `type: 7` and preserve the select menu for subsequent navigation.
  - Omnidex wantlist imports accurately subtract owned idle binder copies and only record true deficits in `collector_wants`.
  - Empty `/collection` returns accurate collection metrics matching database inventory.
- **Prior Art**: Follows patterns established in `src/services/__tests__/discord-interaction.test.ts` and `src/services/__tests__/collector-assistant-shortages.test.ts`.

## Out of Scope

- Automated checkout, cart generation, or payment processing for marketplace listings.
- Web-based editing interface for Personal Wants (can be added in a future web UI ticket).
- Push notifications to platforms other than Discord (e.g. mobile APNS or Root Bot DMs).

## Further Notes

- All user-facing texts must adhere to ADR 0011 and ADR 0018: game nomenclature (Card names, Elements, Zones, Finishes) remain in canonical English.
- All source files must strictly abide by ADR 0012: maximum 400 lines per file, layered architecture, no direct database access in services or route handlers.
