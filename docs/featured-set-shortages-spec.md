## Problem Statement

Grand Archive **Collectors** and players build constructed decks that require cards across various sets. When expanding their physical collections, deciding which sealed booster boxes or packs to purchase, or prioritizing singles acquisitions, collectors face two key challenges:

1. **Blind Buying**: Collectors lack visibility into which official set releases contain the most missing cards required across their active constructed **Decks**. A card might be printed in *Dawn of Ashes* and reprinted in *Alchemical Revolution* or a *Re:Collection* starter deck; collectors need to know which set gives them the highest yield of cards needed to sleeve their decks.
2. **Disconnected Set Browsing**: Collectors cannot easily browse an official set's card checklist alongside their own **Owned Copies** and **Deck Shortages**. Existing card catalogs and deck builders do not connect set release groups with personal binder completion and deck shortages.
3. **Irrelevant Product Noise**: Collectors often want to hide sets they are not interested in (such as older out-of-print promotional sets, specific starter decks, or draft-only releases) without permanently deleting data, while retaining the ability to unhide them at any time.

## Solution

Introduce a dedicated **Featured Sets Shortage & Catalog Browser** accessible via the top-level route `/sets`.

1. **Hierarchical Ingestion**: Synchronize the official Grand Archive `/featured-sets` endpoint into local database tables (`featured_set_groups` and `set_definitions`), linking set groups (e.g., *Dawn of Ashes*, *Alchemical Revolution*, *Distorted Reflections*) to their child set prefixes (`DOA 1st`, `DOA Alter`, `DOASD`, etc.).
2. **Set Shortage Ranking**: Rank all Featured Set Groups primarily by **Set Shortages** (the aggregate count of missing deck copies that can be pulled from that set, distinguishing **Hard Shortages** from **Shared Shortages**), accompanied by a secondary **Set Completion** progress meter (`Owned Cards / Total Cards in Set %`).
3. **Multiset Attribution**: When a card required by an active deck was printed in multiple sets, its shortage copies are attributed to every set containing an eligible printing, empowering the collector to choose which product release to open.
4. **Interactive Set Checklist Browser (`/sets/[groupSlug]`)**: A dedicated view for each set group featuring official banner art, prefix drilldowns (e.g. `1st Edition` vs `Alter Edition`), filter chips (*All Cards*, *Only Deck Shortages*, *Only Unowned / Missing from Binder*, *Only Owned*), and interactive quantity steppers (+/-) to directly log owned cards into the binder.
5. **Personalized Set Hiding**: Collectors can hide any set group with one click (stored in the database via `users.hidden_set_uuids`), moving it to a collapsed `Hidden Sets` accordion at the bottom of the screen where it can be unhidden instantly.
6. **Compile-Time i18n**: Full bilingual support (`en` and `pt-BR`) in `@ga/contracts`, keeping official Grand Archive Game Nomenclature in canonical English.

## User Stories

1. As a Collector, I want to access a dedicated **Sets** view from the top navigation bar (`/sets`), so that I can explore all official Grand Archive product releases in one place.
2. As a competitive player, I want the sets on `/sets` to be ordered by default by **Most Deck Shortages**, so that I immediately know which booster box or set release provides the most missing cards for my active decks.
3. As a Collector, I want each set card to display a clear breakdown of **Total Shortages** (with counts for **Hard Shortages** / *Compra Necessária* and **Shared Shortages** / *Revezamento entre Decks*), so that I can assess the urgency of missing cards.
4. As a Collector, I want each set card to indicate how many of my active **Decks** will benefit from cards in that set, so that I can see the breadth of its impact across my deck roster.
5. As a master-set collector, I want each set card to display my **Set Completion Progress** (e.g. `168 / 240 Cards (70%)`) with a visual progress bar, so that I can track my binder completion alongside deck shortages.
6. As a Collector, I want a sorting dropdown on `/sets` allowing me to sort by:
   - *Most Shortages* (Default)
   - *Lowest Completion %*
   - *Highest Completion %*
   - *Release Date (Newest first)*
   - *Alphabetical Name*
   so that I can organize sets according to my current purchasing or collection goals.
7. As a Collector, I want a search input on `/sets` to quickly filter sets by name (e.g., typing "Alchemical" or "Origins"), so that I can locate specific sets instantly.
8. As a Collector, I want quick-filter buttons on `/sets` for *All Sets*, *Booster Sets Only*, and *Starter / Re:Collection Sets*, so that I can focus on primary booster releases or preconstructed decks.
9. As a Collector, I want an action button/icon on each set card to **Hide Set**, so that I can remove sets I do not collect from my active dashboard.
10. As a Collector who hid one or more sets, I want hidden sets relegated to a collapsed **"Hidden Sets (N)"** accordion at the bottom of `/sets`, so that they stay out of my way without being permanently deleted.
11. As a Collector, I want an **Unhide** button inside the Hidden Sets section, so that I can restore any previously hidden set back to my main dashboard with a single click.
12. As a Collector accessing the app from multiple devices (desktop web or mobile browser), I want my hidden sets preference persisted to my user account in the database, so that my hidden sets remain synchronized everywhere.
13. As a Collector, I want clicking a set card (or clicking "Browse Set") to navigate to a dedicated checklist route (`/sets/[groupSlug]`), so that I have a clean, shareable URL to inspect that set in detail.
14. As a Collector on `/sets/[groupSlug]`, I want to see the set's official banner artwork, official release date, total card count, binder completion percentage, and active deck shortages in the header, so that I have a rich overview of the release.
15. As a Collector on `/sets/[groupSlug]`, I want prefix drilldown chips (e.g., `All`, `DOA 1st`, `DOA Alter`, `DOASD`) to inspect individual print runs or starter editions within the parent set group, so that I can view specific printings.
16. As a Collector on `/sets/[groupSlug]`, I want status filter chips:
    - *All Cards*
    - *Deck Shortages Only* (highlighting cards needed for my active decks)
    - *Missing from Binder Only* (unowned cards needed for set completion)
    - *Owned Only*
    so that I can slice the checklist according to my immediate task.
17. As a Collector on `/sets/[groupSlug]`, I want to filter the set checklist by Element (`Norm`, `Fire`, `Water`, `Wind`, etc.) and Rarity (`Common`, `Uncommon`, `Rare`, `Super Rare`, `Ultra Rare`, `Collector`), so that I can find specific cards quickly.
18. As a Collector on `/sets/[groupSlug]`, I want cards that are missing for my decks to be clearly badged with a **Shortage Badge** showing the missing quantity and which decks require it, so that I can identify deck staples at a glance.
19. As a Collector browsing a set checklist, I want interactive quantity controls (`+` and `-` buttons) on each card to increment or decrement my owned copies directly, so that I can log new pulls without leaving the set view.
20. As a Collector, when I update my owned copies of a card from the set browser, I want my deck shortages and set completion progress to update immediately in real time, so that the UI reflects my current collection state.
21. As an administrator or automated system running catalog synchronization (`/api/sync/pipeline` or `syncCatalogFromApi`), I want official Grand Archive Featured Set Groups (`https://api.gatcg.com/featured-sets`) synchronized automatically into the local database, so that new set releases are ingested seamlessly.
22. As an English or Portuguese (`pt-BR`) speaker, I want all user-facing static texts across `/sets` and `/sets/[groupSlug]` completely translated into my chosen locale, while keeping official Grand Archive Game Nomenclature in canonical English.

## Implementation Decisions

### 1. Database Schema (`src/db/schema.ts` & `src/db/init.ts`)
- **`featured_set_groups` table**:
  - `uuid: text("uuid").primaryKey()` (10-char alphanumeric GA API UUID, e.g. `kZFLg89KfS`)
  - `name: text("name").notNull()` (e.g. `Dawn of Ashes`)
  - `slug: text("slug").notNull().unique()` (e.g. `dawn-of-ashes`, URL-friendly)
  - `imageUrl: text("image_url").notNull()` (e.g. `https://api.gatcg.com/featured-sets/images/DOA.png`)
  - `sortOrder: integer("sort_order").notNull().default(0)`
  - `createdAt`, `updatedAt` timestamps
- **`set_definitions` table**:
  - `id: text("id").primaryKey()` (GA API dataset UUID, e.g. `qJQf0KvMlM`)
  - `groupUuid: text("group_uuid").notNull().references(() => featuredSetGroups.uuid, { onDelete: "cascade" })`
  - `prefix: text("prefix").notNull()` (e.g. `DOA 1st`, `DOA Alter`, `DOASD`)
  - `name: text("name").notNull()` (e.g. `Dawn of Ashes First Edition`)
  - `language: text("language").notNull().default("EN")`
  - `releaseDate: text("release_date").notNull()`
  - `createdAt`, `updatedAt` timestamps
- **User Hidden Sets column**:
  - Add `hiddenSetUuids: text("hidden_set_uuids").notNull().default("[]")` to the `users` table in `src/db/schema.ts`.
  - Add schema migration step in `src/db/init.ts` via `ALTER TABLE users ADD COLUMN hidden_set_uuids TEXT NOT NULL DEFAULT '[]'`.

### 2. Catalog Synchronization (`src/services/catalog-sync.ts`)
- Add `syncFeaturedSetsFromApi(targetDb?: any)` function to fetch `https://api.gatcg.com/featured-sets`.
- Upsert records into `featured_set_groups` and `set_definitions`.
- Ingest this step automatically as Phase 1 of `syncCatalogFromApi()` so sets are always present before cards and editions are processed.

### 3. Repository Layer (`src/db/repositories/set-repository.ts` - ADR 0012)
- All SQL/libSQL/Drizzle operations live strictly in `src/db/repositories/set-repository.ts`:
  - `getAllFeaturedSetGroups(database?)`: Fetches all set groups ordered by sortOrder / releaseDate.
  - `getFeaturedSetGroupBySlug(slug: string, database?)`: Fetches single group with child set definitions.
  - `upsertFeaturedSetGroup(data, database?)` and `upsertSetDefinition(data, database?)`.
  - `getUserHiddenSetUuids(userId: string, database?)`: Reads user's `hidden_set_uuids` parsed as JSON string array.
  - `setUserHiddenSetUuids(userId: string, hiddenUuids: string[], database?)`: Updates user's `hidden_set_uuids`.
  - `loadSetShortageAndInventoryData(userId: string, database?)`: Loads required deck cards, user collection items, card editions, and set group associations in bulk for fast calculation.
  - `loadSetGroupChecklist(groupUuid: string, userId: string, database?)`: Retrieves all unique cards and printings belonging to set definitions of this group, joined with user collection items and deck requirements.

### 4. Domain Service Layer (`src/services/set-shortage.ts`)
- Implements pure business logic:
  - `calculateFeaturedSetSummaries(userId: string, database?)`:
    - Aggregates all active deck shortages (`peakMissing` and `concurrentMissing`).
    - Resolves every card slug with a shortage to all set definitions that feature an edition of that card.
    - Computes `totalShortageCopies`, `peakShortageCopies`, `concurrentShortageCopies`, `impactedDecksCount`, `uniqueShortageCardsCount`.
    - Computes `ownedCardsCount` and `totalCardsCount` (Set Completion %).
    - Flags `isHidden: boolean` matching user's `hidden_set_uuids`.
    - Sorts by default: active (non-hidden) first, descending by `totalShortageCopies`, then by completion rate.
  - `getSetGroupChecklistReport(slugOrUuid: string, userId: string, options?, database?)`:
    - Returns structured checklist items with card metadata, owned quantity (foil vs normal), shortage status, and impacted decks.
  - `toggleUserSetHidden(userId: string, groupUuid: string, isHidden: boolean, database?)`:
    - Updates user's hidden set list cleanly.

### 5. API Routes Layer
- `GET /api/sets`: Returns `{ groups: FeaturedSetSummary[], hiddenCount: number }`.
- `GET /api/sets/[groupSlug]`: Returns `{ group: FeaturedSetGroup, checklist: SetChecklistCard[], summary: SetGroupStats }`.
- `POST /api/sets/hide`: Accepts `{ groupUuid: string, isHidden: boolean }`, updates user preference and returns success status.

### 6. User Interface & Components
- **Top Navigation Bar**: Add `Sets` navigation item (`/sets`) with icon (e.g. `Layers` or `PackageCheck`).
- **Main Sets Dashboard (`/sets`)**:
  - `SetSearchBar`: Search by set name, sort dropdown, filter buttons (All, Booster, Starter).
  - `SetGroupCard`: Set banner art, release date badge, prominent shortage pill (`14 Shortages (10 Hard / 4 Shared)` across `4 Decks`), completion bar (`168 / 240 Cards (70%)`), `Browse Set` button, and 1-click `Hide Set` icon.
  - `HiddenSetsAccordion`: Collapsible section at bottom listing hidden sets with instant `Unhide` button.
- **Set Checklist Page (`/sets/[groupSlug]`)**:
  - Header banner with set logo/image, release date, set stats, and back link to `/sets`.
  - Prefix chips (`All`, `DOA 1st`, `DOA Alter`, `DOASD`) to filter editions.
  - Status filter chips (`All Cards`, `Deck Shortages Only`, `Missing from Binder`, `Owned Only`).
  - Search bar and Element/Rarity filter bar.
  - Interactive card checklist grid with visual shortage indicators and `+` / `-` quantity controls.

### 7. Compile-Time Internationalization (`@ga/contracts`)
- Strict parity across `en` and `pt-BR` dictionaries for all UI text:
  - `sets.title`: "Set Releases & Shortages" / "Coleções & Cartas Necessárias"
  - `sets.subtitle`: "Find which booster sets contain the most missing cards for your decks." / "Descubra quais coleções contêm mais cartas necessárias para seus decks."
  - `sets.sortByShortages`: "Most Deck Shortages" / "Mais Cartas Necessárias"
  - `sets.sortByCompletionAsc`: "Lowest Completion %" / "Menor Conclusão %"
  - `sets.sortByCompletionDesc`: "Highest Completion %" / "Maior Conclusão %"
  - `sets.sortByDate`: "Release Date" / "Data de Lançamento"
  - `sets.sortByName`: "Name" / "Nome"
  - `sets.filterAll`: "All Releases" / "Todos os Lançamentos"
  - `sets.filterBoosters`: "Booster Sets" / "Coleções Principais"
  - `sets.filterDecks`: "Starter / Re:Collection" / "Decks Iniciais & Re:Collection"
  - `sets.hiddenSetsTitle`: "Hidden Sets" / "Coleções Ocultas"
  - `sets.hideSet`: "Hide Set" / "Ocultar Coleção"
  - `sets.unhideSet`: "Unhide Set" / "Reexibir Coleção"
  - `sets.browseSet`: "Browse Set" / "Explorar Coleção"
  - `sets.shortageBadge`: "{count} Shortages" / "{count} Necessárias"
  - `sets.decksImpacted`: "{count} Decks" / "{count} Decks"
  - `sets.cardsOwned`: "{owned} / {total} Cards ({percent}%)" / "{owned} / {total} Cartas ({percent}%)"
  - `sets.checklist.allCards`: "All Cards" / "Todas as Cartas"
  - `sets.checklist.shortagesOnly`: "Deck Shortages" / "Cartas Necessárias"
  - `sets.checklist.missingOnly`: "Missing from Binder" / "Ausentes na Pasta"
  - `sets.checklist.ownedOnly`: "Owned" / "Possuídas"

## Testing Decisions

1. **Service Tests (`src/services/__tests__/set-shortage.test.ts`)**:
   - Verify `calculateFeaturedSetSummaries()` correctly ranks sets by total missing deck copies.
   - Verify multiset reprints attribute shortages to both parent set groups containing the card.
   - Verify `ownedCardsCount` and `totalCardsCount` calculate accurately against user collection items.
   - Verify hidden sets are correctly flagged and filtered to the hidden section.
2. **Ingestion & Repository Tests (`src/services/__tests__/catalog-sync-sets.test.ts` & `src/db/repositories/__tests__/set-repository.test.ts`)**:
   - Verify `syncFeaturedSetsFromApi()` parses GA API JSON into `featured_set_groups` and `set_definitions`.
   - Verify cascading constraints and user `hidden_set_uuids` updates.
3. **API Route Tests (`src/app/api/sets/__tests__/route.test.ts`)**:
   - Verify `GET /api/sets` returns ranked sets for session user.
   - Verify `POST /api/sets/hide` updates user preferences and reflects on subsequent GET.
   - Verify `GET /api/sets/[groupSlug]` returns 404 for nonexistent set and checklist for valid slug.
4. **UI & i18n Parity Tests (`vitest`)**:
   - Verify strict dictionary parity between `en` and `pt-BR`.
   - Component test for `/sets` rendering set cards and toggling hidden sets accordion.

## Out of Scope

- Marketplace seller price scraping directly inside the set checklist (market prices remain on `/marketplace` and `/decks?view=shortages`).
- Custom user-created set groupings (only official GA API featured set groups are supported).
- Physical booster pack simulation or virtual pack opening.

## Further Notes

- Relies on ADR 0009 (Eager Meta Sync Pipeline), ADR 0011 (Compile-Time Typed i18n Catalog), ADR 0012 (Layered Architecture and Code Limits), and ADR 0021 (Featured Set Groups and Hierarchical Shortage Ranking).
