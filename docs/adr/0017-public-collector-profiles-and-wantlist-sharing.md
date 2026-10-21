# 0017: Public Collector Profiles, Wantlist Sharing, and Multi-Format Exports

Status: accepted

## Context

Grand Archive **Collectors** frequently participate in local playgroups, tournaments, and online communities (Discord, WhatsApp, MyP Cards) where they need to:
1. Share their **Shortages** (*Cartas Necessárias* / Wantlist) with vendors and trading partners so others can match what they need.
2. Showcase their **Target Decks** (in-construction decks) with completion progress and missing card counts.
3. Export or share their physical collection and available **Idle Copies** for trade without requiring recipients to create an account, log in, or install an app.

Previously, shortages and collection holdings were restricted to authenticated session users (`/decks/shortages`, `/collection`), and friend interactions required mutual `FriendLink` pairing codes, making broad sharing with store sellers or external playgroup members impossible. Furthermore, there was no automated file export for physical inventory across both personal Binders and MyP Store listings.

## Decision

1. **Canonical Public Routing with Alias Redirection (`/u/[friendCode]` & `/u/[mypUsername]`)**:
   - Establish `/u/[friendCode]` (e.g. `/u/GA-QLMGAQ`) as the canonical, unauthenticated read-only **Public Collector Profile** route.
   - If a visitor accesses `/u/[mypUsername]` (e.g. `/u/Fabrino`), the server performs an immediate 307 Temporary Redirect to the canonical `/u/[friendCode]` path while preserving query parameters (e.g., `?tab=shortages`).
   - The public page prominently displays the Collector's identity, canonical friend code, and a verified MyP Cards store link (`https://mypcards.com/[username]`) when configured.

2. **Public Wantlist (Shortages) & Dual 1-Click Clipboard Export**:
   - The Public Wantlist displays all active Shortages sorted by missing quantity, decorated with severity badges distinguishing **Hard Shortages** (*Compra Necessária* — single-deck peak gap) from **Shared Shortages** (*Revezamento entre Decks* — concurrent multi-deck gap).
   - Each card displays which public **Target Decks** demand it.
   - Includes a dual **"Copy Wantlist"** clipboard action:
     - **As Omnidex**: Standard `# Material Deck` and `# Main Deck` format directly pasteable into Silvie.gg or GrandArchiveStats.
     - **As Plain Text**: Clean `<quantity> <card name>` list optimized for Discord, WhatsApp, or store search queries.

3. **Public Target Decks with Assembly Progress & Slide-Over Inspection**:
   - Displays all Decks created by the Collector that have `isPublic = true`.
   - Each deck card highlights its live physical assembly percentage (`totalOwned / totalRequired`) and missing card count.
   - Clicking a deck opens a slide-over drawer showing the full visual card grid organized by canonical zones (`Material Deck`, `Main Deck`, `Sideboard`) with missing cards highlighted with warning rings, plus an "Export Deck Omnidex" button.

4. **Public Collection Browsing with Trade Filter & Multi-Format Exports**:
   - Public view includes a browsable card grid with Element, Class, and Rarity filters, plus an active toggle for **"Available for Trade (Idle Copies Only)"** to exclude cards committed to active decks.
   - Provides multi-format exports for download and copy:
     - **Omnidex Text Export**: Complete inventory formatted into `# Material Deck` and `# Main Deck`, aggregating copies across both the physical Binder and active MyP Store listings.
     - **Detailed Trading CSV Export**: Standardized CSV file containing:
       `Card Name, Set Prefix, Collector Number, Finish, Rarity, Element, Class, Type, Total Copies, Dedicated Copies, Idle Copies, MyP Store Copies`.

5. **Opt-Out Privacy Default & Contextual Share Triggers**:
   - Public sharing is enabled by default (`users.public_profile_enabled = 1`) to eliminate onboarding friction, with a toggle in `/settings` (*"Enable Public Collector Profile"*) that returns 404 if disabled.
   - Expose contextual sharing actions across the authenticated application:
     - Top `Navbar`: A **"Share Profile"** button opening a modal with direct 1-click links for Profile, Shortages, and Target Decks.
     - Collection Hub (`/collection`): An **"Export"** dropdown offering instant Omnidex and CSV downloads.
     - Decks Hub (`/decks` Shortages tab): A **"Share Wantlist"** button that copies the direct wantlist link (`/u/[code]?tab=shortages`).

## Consequences

- Visitors and store sellers can instantly view what a Collector needs and what they have for trade without authenticating.
- Collectors can effortlessly export their inventory in both standard Omnidex and spreadsheet-compatible CSV formats.
- Maintains strict layering (ADR 0012) by exposing public profile data through a dedicated read-only repository query.
- Full compile-time i18n parity (`en` and `pt-BR`) maintained across all public profile UI chrome.
