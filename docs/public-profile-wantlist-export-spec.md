## Problem Statement

Grand Archive **Collectors** frequently participate in local playgroups, tournaments, Discord channels, WhatsApp groups, and external marketplaces (like MyP Cards) where they need to:
1. Share their active **Shortages** (*Cartas Necessárias* / Wantlist) with vendors and trading partners so others can identify and supply what they need.
2. Showcase their **Target Decks** (in-construction decks) with completion progress and missing card counts.
3. Share their physical inventory or available **Idle Copies** for trade without requiring recipients to create an account, log in, or install an app.
4. Export their physical collection across both personal Binders and MyP Store listings into standard community formats (such as Grand Archive Omnidex format for Silvie.gg / GrandArchiveStats, or detailed trading spreadsheets).

Previously, shortages and collection holdings were restricted to authenticated session users (`/decks/shortages`, `/collection`), and friend interactions required mutual `FriendLink` pairing codes. There was no unauthenticated public profile, no shareable wantlist URL, and no automated multi-format export for physical inventory.

## Solution

Introduce unauthenticated, read-only **Public Collector Profiles** (`/u/[friendCode]` and alias `/u/[mypUsername]`), a dedicated **Public Wantlist** with dual clipboard exports, an interactive **Target Decks** showcase with assembly meters and zone inspection, browsable **Public Collection** with an idle-trade filter, and multi-format inventory exports (Omnidex text + Detailed Trading CSV), backed by contextual sharing triggers in the authenticated application.

Sharing is enabled by default via `users.public_profile_enabled = 1` to eliminate onboarding friction, with an opt-out toggle in `/settings` that serves a standard 404 when disabled.

## User Stories

1. As a Collector, I want an unauthenticated public profile URL at `/u/[friendCode]`, so that I can share my profile with anyone without forcing them to register or sign in.
2. As a Collector with a configured MyP username, I want visitors who navigate to `/u/[mypUsername]` to be redirected via HTTP 307 to my canonical `/u/[friendCode]` URL, so that vanity URLs work while maintaining a single canonical address.
3. As a visitor browsing an alias URL like `/u/Fabrino?tab=shortages`, I want query parameters preserved during the redirect, so that I arrive directly at the intended tab.
4. As a Collector, I want my public profile to display my friend code, avatar/name, and a link to my external MyP store (`https://mypcards.com/[username]`) when configured, so that trading partners can verify my identity and store.
5. As a Collector, I want an opt-out toggle in `/settings` ("Enable Public Collector Profile"), so that I can disable my public profile at any time.
6. As a visitor requesting a public profile for a user who disabled public sharing (or does not exist), I want to receive a 404 Not Found page, so that private accounts are not disclosed.
7. As a visitor or trade partner, I want to view a Collector's **Public Wantlist** listing all active Deck Shortages sorted by missing quantity, so that I can see exactly what cards they need.
8. As a visitor, I want shortages annotated with badges distinguishing **Hard Shortages** (*Compra Necessária* — single-deck deficit) from **Shared Shortages** (*Revezamento entre Decks* — concurrent multi-deck gap), so that I understand urgency.
9. As a visitor, I want each wantlist card to list which public **Target Decks** demand it, so that I understand why the card is needed.
10. As a Collector or trading partner, I want a 1-click **"Copy as Omnidex"** button on the Public Wantlist, so that I can paste the missing cards directly into Silvie.gg or GrandArchiveStats formatted into `# Material Deck` and `# Main Deck`.
11. As a Collector or trading partner, I want a 1-click **"Copy as Plain Text List"** button on the Public Wantlist, so that I can paste `<quantity> <card name>` lists into Discord, WhatsApp, or store search bars.
12. As a visitor, I want to browse a Collector's **Target Decks** (all user decks marked `isPublic = true`), so that I can view what decks they are currently assembling.
13. As a visitor, I want each Target Deck card to display its physical assembly percentage (`totalOwned / totalRequired`) and missing card count, so that I can see deck completion at a glance.
14. As a visitor, I want clicking a Target Deck to open a slide-over inspection drawer showing the visual card grid organized by canonical zones (`Material Deck`, `Main Deck`, `Sideboard`) with missing cards highlighted with warning rings, so that I can inspect the full decklist and identify gaps.
15. As a visitor or Collector, I want an "Export Deck Omnidex" button inside the deck inspection drawer, so that I can copy the complete decklist in standard Omnidex format.
16. As a visitor, I want to browse the Collector's public collection with Element, Class, and Rarity filters, so that I can explore their available cards.
17. As a visitor looking to trade, I want an **"Available for Trade (Idle Copies Only)"** filter toggle in the collection view, so that I only see cards not currently committed to active decks.
18. As a Collector or visitor, I want to export the entire collection in standard **Omnidex Text Format**, aggregating physical Binder copies and active MyP Store listings into `# Material Deck` and `# Main Deck`.
19. As a Collector or visitor, I want to export the entire collection as a **Detailed Trading CSV**, containing: `Card Name, Set Prefix, Collector Number, Finish, Rarity, Element, Class, Type, Total Copies, Dedicated Copies, Idle Copies, MyP Store Copies`.
20. As an authenticated Collector, I want a **"Share Profile"** button in the top navigation bar opening a modal with 1-click copy links for Profile (`/u/[code]`), Shortages (`/u/[code]?tab=shortages`), and Target Decks (`/u/[code]?tab=decks`), so that I can share links effortlessly from any page.
21. As an authenticated Collector on `/collection`, I want an **"Export"** dropdown button in the header allowing instant Omnidex text copy/download and CSV download, so that I can export my inventory anytime.
22. As an authenticated Collector on `/decks` (Shortages tab), I want a **"Share Wantlist"** button that copies `/u/[friendCode]?tab=shortages`, so that I can share my missing cards with one click.
23. As a user of either English or Portuguese (`pt-BR`), I want all UI chrome, tooltips, buttons, modals, badges, and empty states fully translated, while preserving official Grand Archive Game Nomenclature in English.

## Implementation Decisions

- **Database Schema**:
  - Add `public_profile_enabled integer NOT NULL DEFAULT 1` to the `users` table in `src/db/schema.ts` (mapped as boolean).
  - Add schema migration step in `src/db/init.ts` via `ALTER TABLE users ADD COLUMN public_profile_enabled INTEGER NOT NULL DEFAULT 1`.
  - Expose `publicProfileEnabled` in the `/api/user/settings` GET and PUT routes and persist user preferences.
- **Repository Layer (ADR 0012 compliance)**:
  - Create `src/db/repositories/public-profile-repository.ts` to own all public read-only database queries:
    - `getPublicProfileUser(identifier: string)`: Resolves user by `friendCode` (case-insensitive) or `mypUsername` (case-insensitive).
    - `getPublicWantlist(userId: string)`: Computes active deck shortages across user's public decks, joining cards and editions to calculate hard vs shared shortages and target deck tags.
    - `getPublicTargetDecks(userId: string)`: Retrieves public decks (`isPublic = true`) with total required cards, owned copies count, and missing counts.
    - `getPublicDeckDetails(userId: string, deckId: string)`: Retrieves complete deck cards grouped by canonical zones (`MAIN`, `MATERIAL`, `SIDEBOARD`) with ownership status per card.
    - `getPublicCollection(userId: string, idleOnly: boolean)`: Retrieves collection inventory (binder copies + store listings + dedicated deck assignments) with card catalog details.
  - Zero raw SQL or Drizzle queries in pages, API routes, or client components.
- **Routing & Vanity Alias Redirection**:
  - Route `/u/[identifier]/page.tsx`:
    - Server Component reads params. If `identifier` matches a user's `mypUsername` and not their `friendCode`, perform an immediate `redirect('/u/' + user.friendCode + queryParams, RedirectType.replace)` (HTTP 307).
    - If user does not exist or has `publicProfileEnabled === false`, invoke `notFound()`.
    - Renders the public layout with header banner (name, friend code, verified MyP link), tab navigation (`Wantlist`, `Target Decks`, `Collection`), and active tab view.
- **Public Export Generation Services**:
  - Implement pure export helpers in `src/services/collection-export.ts`:
    - `formatCollectionOmnidex(items: CollectionExportItem[]): string`: Formats cards into `# Material Deck` (cards with types Champion, Regalia, Weapon, etc.) and `# Main Deck` (cards with types Action, Attack, Ally, Item, etc.), summing binder + store copies.
    - `formatCollectionCsv(items: CollectionExportItem[]): string`: Formats standardized CSV with headers: `Card Name,Set Prefix,Collector Number,Finish,Rarity,Element,Class,Type,Total Copies,Dedicated Copies,Idle Copies,MyP Store Copies`.
    - `formatWantlistOmnidex(shortages: ShortageItem[]): string`: Formats missing cards into Omnidex zones.
    - `formatWantlistPlainText(shortages: ShortageItem[]): string`: Formats `<quantity> <card name>` plain text list.
- **UI Chrome & Components**:
  - `PublicProfileHeader`: Displays avatar/initials, Collector name, friend code copy button, and MyP store pill link.
  - `PublicWantlistTab`: Renders shortages with quantity badge, Hard vs Shared shortage tag, target deck chips, and dual copy toolbar.
  - `PublicTargetDecksTab`: Grid of deck cards with progress bar (`X / Y cards`), missing count, and click handler opening the slide-over inspection modal.
  - `DeckInspectionDrawer`: Visual slide-over panel displaying `Material Deck`, `Main Deck`, and `Sideboard` zones with card images, missing rings, and "Export Deck Omnidex".
  - `PublicCollectionTab`: Grid of cards with Element, Class, Rarity filters, "Available for Trade (Idle Copies Only)" toggle, and Export dropdown.
  - Authenticated triggers:
    - Navbar `ShareProfileButton` modal with links and QR code / quick copy.
    - `/collection` Export dropdown (Omnidex / CSV).
    - `/decks` Shortages "Share Wantlist" button.
- **Internationalization (ADR 0011 & AGENTS.md)**:
  - Add all new keys to `packages/contracts/src/i18n.ts` under both `enCatalog` and `ptBRCatalog`.
  - Game Nomenclature boundary: Deck zones (`Material Deck`, `Main Deck`, `Sideboard`), card names, rarities, elements, and finishes (`Foil`, `Normal`) remain in English.

## Testing Decisions

- **Unit & Service Tests (`vitest`)**:
  - `src/services/__tests__/collection-export.test.ts`:
    - Omnidex export correctly groups Material cards vs Main Deck cards.
    - Omnidex export aggregates binder copies and store copies.
    - Plain text wantlist export correctly generates `<qty> <card name>` rows.
    - CSV export generates valid CSV format with exact headers and escaped values.
- **Repository Tests (`vitest`)**:
  - `src/db/repositories/__tests__/public-profile-repository.test.ts`:
    - Resolves user by friendCode and mypUsername case-insensitively.
    - Returns null when user has `publicProfileEnabled = false`.
    - Computes public wantlist correctly distinguishing hard vs shared shortages.
    - Retrieves only public decks (`isPublic = true`) with accurate assembly percentages.
    - Retrieves collection with idle copies calculated by subtracting dedicated deck allocations.
- **Route & Component Integration Tests**:
  - Test `/u/[identifier]` redirection from `mypUsername` to `friendCode` with query parameter preservation.
  - Test `/u/[identifier]` returns 404 for disabled or non-existent profile.
  - Test authenticated `/api/user/settings` allows toggling `publicProfileEnabled`.
- **i18n Guardrail Test**:
  - Verify `src/i18n/static-text-guard.test.ts` passes with 100% dictionary coverage.

## Out of Scope

- Friend-to-friend private messaging or chat within the public profile.
- Direct shopping cart or transactional payment checkout on the public profile.
- Automated creation of MyP cards wantlist via scraper.
- Custom vanity URL creation other than existing `friendCode` and `mypUsername`.
