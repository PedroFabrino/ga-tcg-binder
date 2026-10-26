# Deck In-Place Update Specification (Web & Root App)

## Problem Statement

Currently, collectors on both the Grand Archive Binder Web App and the Root Companion App can create and import constructed decks from Omnidex, Silvie.gg, or raw text decklists. However, there is no way to update an existing deck in place:
1. When a player tunes their decklist (adjusting card ratios, testing new sideboards, or importing an updated Omnidex list), their only option is to delete the deck and re-import it from scratch.
2. Deleting and recreating a deck loses deck history, breaks external references, and forces the user to re-navigate.
3. In the Root App, users have `/decks add <url>` and an "Import Deck" button, but no way to update or tune an existing deck.

## Solution

Provide a seamless **In-Place Deck Update** flow across both Web and Root App:
1. **Web App**:
   - Add an **Edit** action to deck cards on `/decks` and on the deck detail view `/decks/[id]`.
   - Open a pre-filled `DeckFormModal` loaded with the deck's current Name, Champion, and serialized Omnidex decklist text.
   - Allow the user to update the name, champion, or edit/replace the decklist lines.
   - On save, issue `PUT /api/decks/[id]` to atomically update deck metadata and replace its cards in place via batch execution.
2. **Root Companion App**:
   - Extend `assistant.proto` with an `UpdateDeck` RPC procedure.
   - Add an **Edit** button on each deck row in `DecksDashboardCard.tsx` that opens a prefilled edit form (name, Omnidex URL, or raw decklist text).
   - Add chat slash command `/decks update <deck_name_or_id> <url>` for quick Discord/Root command-line parity.
   - Expose `PUT /api/assistant/decks` to handle authorized assistant deck update requests.

## User Stories

1. **As a web user on `/decks`**, I want to click an "Edit" icon on any deck card so that I can quickly update its list without opening the full details page.
2. **As a web user on `/decks/[id]`**, I want to click "Edit Deck" in the page header so that I can modify the decklist in the familiar import modal.
3. **As a web user in the Edit Modal**, I want the modal pre-filled with my current deck name, champion, and full Omnidex decklist, so that I can tweak a few quantities or paste an entire new list on top of it.
4. **As a Root App user in the GUI**, I want an "Edit" button on my deck cards so that I can update an existing deck by pasting an updated Omnidex URL or text list.
5. **As a Root App user in chat**, I want to type `/decks update <deck> <url>` to quickly update my decklist directly from Discord/Root chat.
6. **As any user updating a deck**, I want the deck ID to remain unchanged so that my shortages, statistics, and references remain intact.

## Implementation Architecture

### 1. Database & Repository Layer (`src/db/repositories/deck-repository.ts`)
- Implement `replaceDeckCards(deckId: string, cardsToInsert: DeckCardInsert[], database?: DeckDatabase): Promise<void>`.
- Deletes existing `deckCards` rows for `deckId` and inserts new items in an atomic batch.

### 2. Domain Service Layer (`src/services/deck.ts` & `src/services/assistant-wants-service.ts`)
- Enhance `updateDeckService`:
  - When `omnidexText` is provided, parse the decklist with `parseOmnidexText`, resolve catalog slugs, and call `replaceDeckCards`.
  - Update `name`, `champion`, `format` in `decks` table.
- Implement `updateAssistantDeckFromSource` in `src/services/assistant-wants-service.ts`:
  - Fetch list from URL if provided, or parse raw text, and call `updateDeckService`.

### 3. API Layer
- **Web**: `PUT /api/decks/[id]` handles `{ name, champion, format, omnidexText }`.
- **Assistant**: `PUT /api/assistant/decks` handles `{ provider, providerUserId, deckId, url, text, name, champion, format }`.

### 4. Internationalization & Static Text
- Add strict compile-time translation keys in `@ga/contracts` for both `en` and `pt-BR`:
  - `decks.editDeck`: "Edit Deck" / "Editar Deck"
  - `decks.editDeckSubtitle`: "Update deck name, champion, or decklist." / "Atualize o nome, campeão ou lista do deck."
  - `decks.saveChanges`: "Save Changes" / "Salvar Alterações"
  - `decks.deckUpdated`: "Deck updated successfully" / "Deck atualizado com sucesso"

### 5. Root App Client & Protocol
- Add `UpdateDeckRpcRequest` and `UpdateDeckRpcResponse` to `assistant.proto`.
- Generate protobuf bindings for TypeScript.
- Implement `updateDeck` in `AssistantRpcService` and `RootBotApi`.
- Add inline edit trigger and form in `DecksDashboardCard.tsx`.
