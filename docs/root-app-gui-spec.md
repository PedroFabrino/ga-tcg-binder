# Root App GUI Assistant Dashboard

## Problem Statement

The Root Bot currently relies entirely on plain-text chat messages starting with `/` (e.g. `/link`, `/decks`, `/shortages`, `/notify on [all|hard]`). Because the Root platform and client SDK do not support native slash command registration or chat autocomplete menus, users face several friction points:
1. Collectors must remember exact command names, argument keywords, and pairing procedures without any UI discovery, autocomplete suggestions, or inline parameter hints.
2. Linking an account requires manually navigating to the web portal, generating a 6-character code, switching back to Root, and typing `/link <code>` into a public or group channel.
3. Managing deal alert notification preferences (`/notify on all` vs `/notify on hard` vs `/notify off`) is non-visual, requiring users to remember subtle syntax differences to avoid getting flooded with shared shortages.
4. Reviewing constructed decks and card shortages outputs long multi-line text blocks in the chat feed rather than a structured, collapsible dashboard.
5. The visual identity of the collector assistant in Root is disconnected from the Grand Archive Binder Web App design system.

## Solution

Build an interactive, in-community GUI application inside Root using `@rootsdk/client-app` (React, TypeScript, Tailwind CSS, Lucide icons) backed by Root RPC services (`@rootsdk/server-app`) and our existing Next.js Assistant APIs:
1. **Seamless Design System Alignment**: The GUI strictly adopts the web app's dark-mode design system: rounded card containers (`rounded-xl border border-white/[0.08] bg-white/[0.02]`), slate/zinc typography, Lucide React icons, and standard badge colors (`emerald` for active status, `rose` for Hard Shortages, `amber` for Shared Shortages, `indigo` for linked identity badges).
2. **Account Linking Portal Card**: Displays live link status. If unlinked, displays an input field for the 6-character code, an instant "Link Account" action button, and a direct button linking out to the web portal's `Settings > Linked Accounts` page. If linked, displays the collector's name and friend code with an unlink option.
3. **Deal Alert Preference Switchboard**: Provides an interactive toggle switch for private deal alerts (`Active` / `Disabled`) and a segmented mode picker (`All Shortages` vs `Hard Shortages Only`), explaining clearly what each mode delivers without typing text commands.
4. **Decks & Shortages Dashboard**: Displays collapsible cards for each of the collector's active constructed decks, highlighting Champion, Format, total card counts, and distinct badges for Hard Shortages (compra necessária) and Shared Shortages (revezamento).
5. **Dedicated Community Channel & Admin In-App Configuration**: Administrators can select any community text channel as the broadcast dump channel or trigger one-click idempotent channel provisioning directly inside the Assistant GUI (`CommunityAdminCard`), removing any dependency on `/setup`.
6. **GUI-Only Architecture**: All interaction is handled through the interactive GUI; legacy `/` text commands in chat are fully removed to eliminate noisy bot messages and duplicated interface layers.

## User Stories

1. As a Root community member, I want to open the `#assistant` channel in the GA Market group, so that I can see my Grand Archive collection and notification dashboard without typing `/` commands.
2. As a Root user without a linked account, I want to see an "Account Not Linked" status card with a direct button opening the GA Binder Linked Accounts settings page, so that I can generate a pairing code with one click.
3. As a Root user with a pairing code, I want a dedicated text input and "Link Account" button in the GUI, so that I can connect my binder without typing `/link <code>` in public chat.
4. As a linked collector, I want to see my collector username and friend code at the top of the GUI, so that I know immediately which binder account is active.
5. As a linked collector, I want an interactive switch to enable or disable private deal alerts, so that I can toggle marketplace notifications without remembering `/notify on` or `/notify off`.
6. As a linked collector who only buys unowned cards, I want a mode selector for "Hard Shortages Only", so that I receive notifications only for unowned cards and general wantlist items rather than deck rotations.
7. As a linked collector who wants complete deck sets, I want a mode selector for "All Shortages", so that I am notified on both hard shortages, shared shortages, and personal wants.
8. As a linked collector, I want to see a direct link to my private deal alert channel inside the notifications card, so that I can jump straight to my alerts.
9. As a linked collector, I want to see a list of my active constructed decks in the GUI, so that I can check which decks are currently tracked by the assistant.
10. As a linked collector, I want each deck card to show the deck's Champion, Format, and total card count, matching the web app's deck cards.
11. As a linked collector, I want to see the count of Hard Shortages displayed with a distinct red/rose badge on each deck, so that I instantly know how many copies I must purchase.
12. As a linked collector, I want to see the count of Shared Shortages displayed with a distinct amber badge on each deck, so that I know which cards can be borrowed or rotated from other decks.
13. As a linked collector, I want to click any deck card to expand its missing card breakdown, so that I can see the exact card names and deficit quantities.
14. As a community administrator, I want to configure the market broadcast channel directly inside the Assistant GUI, so that marketplace deal updates are routed without typing `/setup` in chat.
15. As a community administrator, I want a "Provision Default Channels" button inside the GUI that idempotently creates the `#market` and `#assistant` channels in the `GA Market` group if not yet created.
16. As a developer, I want all GUI static text to follow the canonical English game nomenclature rules, so that card names and game elements remain official.
17. As a developer, I want the client app to communicate with the server via typed Root RPC, so that user identity verification is handled cryptographically by the platform without exposing server secrets.

## Implementation Decisions

### 1. Hybrid Architecture & Single Workspace
- Retain `apps/ga-tcg-root-app` as a unified package containing both server daemon (`server/`) and client web app (`client/`), sharing common protocol definitions (`networking/`).
- Package manifest (`root-manifest.json`) defines both `package.server` and `package.client` pointing to `dist/server/main.js` and `dist/client`.

### 2. Root RPC Protocol (`networking/assistant.proto`)
- Define an RPC service `AssistantService` compiled with `@protobuf-ts`:
  - `GetStatus(rootsdk.Void)` returns `{ isLinked: bool, collectorName: string, friendCode: string, notificationsEnabled: bool, dealAlertMode: string, alertChannelId: string }`.
  - `LinkAccount(LinkRequest)` returns `{ success: bool, collectorName: string, error?: string }`.
  - `SetPreferences(PreferencesRequest)` returns `{ success: bool, notificationsEnabled: bool, dealAlertMode: string }`.
  - `GetDecks(rootsdk.Void)` returns `{ decks: Array<DeckSummary> }`.
- The server implementation obtains `client.userId` directly from the RPC call context, ensuring zero impersonation risk.

### 3. Client UI Framework & Design System
- Built with React 18, Vite, and Tailwind CSS inside `apps/ga-tcg-root-app/client`.
- Adopts the GA Binder web app design system:
  - Theme palette: Dark background (`#0a0f18` / `bg-black/40`), translucent white surfaces (`bg-white/[0.02]`), subtle borders (`border-white/[0.08]`), slate text (`text-slate-200`, `text-slate-400`).
  - Accent colors: Indigo for provider/identity tags, Emerald for active status, Rose for hard shortages, Amber for shared shortages.
  - Icons: `lucide-react` icons (`Link2`, `Bell`, `ShieldCheck`, `Layers`, `ExternalLink`, `AlertCircle`, `CheckCircle2`).

### 4. Idempotent Provisioning & Channel Configuration
- Provide in-app configuration via `CommunityAdminCard` and `admin-rpc-helpers.ts` allowing admins to:
  1. Select any existing community text channel to serve as the market broadcast dump channel.
  2. Or click "Provision Default Channels" to idempotently create:
     - Community Channel Group: `GA Market`
     - Public Store Listing Channel: `#market`
     - Assistant GUI Channel: `#assistant` (configured as an App Channel hosting the client UI)

## Testing Decisions

### 1. RPC Service Behavior Testing
- Test `AssistantRpcService` against fake `RootBotApi` dependencies:
  - Resolving unlinked status vs linked status.
  - Successful account linking with token vs error responses (`INVALID_CODE`, `EXPIRED_CODE`).
  - Preference updating toggling `enabled` and `mode` (`all` vs `hard`).
  - Deck list and shortage aggregation retrieval.
- Prior art: [`apps/ga-tcg-root-app/src/__tests__/assistant-rpc-service.test.ts`](file:///c:/Users/pfabr/Documents/Git/ga-tcg-binder/apps/ga-tcg-root-app/src/__tests__/assistant-rpc-service.test.ts).

### 2. Client Component Unit Testing
- Test the React views using `@testing-library/react` and Vitest:
  - Account Linking card renders unlinked form with portal button when unlinked.
  - Submitting code triggers RPC link call and transitions to linked view.
  - Notification toggle and mode radio updates call `SetPreferences` with expected payload.
  - Deck cards display badges with correct counts for hard vs shared shortages.

### 3. Provisioning Integration Testing
- Verify that provisioning creates the `#assistant` app channel in addition to the `#market` channel, and avoids duplicate creation if already configured.
- Prior art: [`apps/ga-tcg-root-app/src/__tests__/setup-provisioning.test.ts`](file:///c:/Users/pfabr/Documents/Git/ga-tcg-binder/apps/ga-tcg-root-app/src/__tests__/setup-provisioning.test.ts).

## Out of Scope (Phase 2 Deferred Backlog)

1. **Interactive Personal Wantlist Editor**: Adding, adjusting quantities, setting price ceilings, and removing individual wishlist cards directly inside Root.
2. **Omnidex / Silvie Decklist URL Importer**: Modal dialog inside Root to paste an external decklist URL and ingest the missing gap.
3. **Live Marketplace Explorer**: In-GUI table or feed to filter and browse recent store listings across LigaMagic, MyP, and LootCards.
4. **Mobile Native App Scanner Integration**: Direct camera scanning from inside the Root client.

## Further Notes

- The stack remains 100% TypeScript, adhering to ADR 0012 with strict file size limits (<400 lines per module).
- All official card names and element keywords stay in canonical English.
