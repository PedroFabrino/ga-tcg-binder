## Parent
#1

## What to build
Implement deck creation and management, dividing decks into Main Deck (60), Material Deck (12), and Sideboard. Provide a parser for Grand Archive standard Omnidex text format (`# Material Deck`, `# Main Deck`, `# Sideboard` with `[count] [name]`). Build a comprehensive Deck Shortage view comparing a deck's requirements against the collector's owned inventory, computing exact missing quantities, displaying owned vs. needed indicators, and providing a one-click button to add missing copies into the collection.

## Acceptance criteria
- [ ] Deck schema tracks deck metadata (name, champion, format, public status) and deck cards partitioned by zone (`main`, `material`, `side`).
- [ ] Bidirectional Omnidex parser accurately serializes and imports decklists in standard text format.
- [ ] Deck view displays visual breakdowns of Main Deck, Material Deck, and Sideboard with total counts.
- [ ] Shortage calculation engine evaluates deck demand against owned collection copies.
- [ ] Shortage UI visually highlights missing cards (e.g. `Need 4 / Own 1 (Missing 3)`).
- [ ] "Add missing to collection" action allows immediately registering acquired copies into the collector's inventory.
- [ ] Automated tests verify Omnidex text parsing and shortage calculation accuracy across multiple deck configurations.

## Blocked by
- #3 (Collector Inventory Tracking & Smart Views)
