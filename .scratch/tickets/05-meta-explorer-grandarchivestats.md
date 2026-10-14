## Parent
#1

## What to build
Build a "Meta Decks" explorer that fetches and caches competitive archetypes and tier rankings from `grandarchivestats.com`. Implement a tournament deck URL importer that fetches any `grandarchivestats.com/events/.../decks/...` link and extracts the embedded Omnidex list from `<textarea id="omnidex-src">`. Provide a one-click "Compare Against My Collection" feature on any meta deck, displaying a full shortage report to instantly evaluate what is missing to assemble that tournament list, along with a "Clone to My Decks" option.

## Acceptance criteria
- [ ] Meta explorer page displays top Grand Archive archetypes, tier rankings, and recent tournament winning decks.
- [ ] Tournament deck URL scraper extracts the clean Omnidex decklist from `grandarchivestats.com` tournament deck pages.
- [ ] "Compare Against My Collection" runs a live shortage comparison without requiring the deck to be saved first.
- [ ] Comparison view details missing card quantities, card elements/classes, and estimated readiness.
- [ ] "Clone to My Decks" creates a personal editable copy in the user's deck collection.
- [ ] Automated tests verify extraction of Omnidex text from mock HTML responses and shortage comparison against sample collections.

## Blocked by
- #4 (Deck Builder, Omnidex Importer & Shortage Gap Analysis)
