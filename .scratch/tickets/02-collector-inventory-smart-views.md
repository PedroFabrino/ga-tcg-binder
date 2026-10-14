## Parent
#1

## What to build
Implement user authentication via Auth.js (supporting Discord and Google OAuth) and the `collection_items` schema to track a collector's physical inventory at the specific Printing level (specifying foil or non-foil finish). Deliver a fast Quick-Search bar with `+`/`-` buttons to increment/decrement card quantities, a bulk text importer, and the primary Collection Dashboard with smart view tabs ("All", "Low Population", and "Idle / Binder") and user-configurable population threshold settings.

## Acceptance criteria
- [ ] Auth.js (NextAuth v5) configured with Discord and Google OAuth, storing user accounts in Turso libSQL.
- [ ] Collection items schema tracks user ID, edition ID, foil status, quantity, and dedication status.
- [ ] Quick-search autocomplete allows adding cards directly with foil toggle and increment/decrement controls.
- [ ] Bulk text importer parses card lines (e.g., `4x Fracturize [DOA 1st Ed Non-foil]`) and registers them in the collection.
- [ ] Main collection dashboard displays smart view tabs: "All", "Low Population" (filtered by user threshold), and "Idle / Binder" (cards not in any deck).
- [ ] User settings modal permits adjusting the Low Population threshold (defaults to 1,000).
- [ ] Automated tests verify collection inventory additions, updates, and smart-view filtering logic.

## Blocked by
- #2 (Card Catalog Ingestion & Search View)
