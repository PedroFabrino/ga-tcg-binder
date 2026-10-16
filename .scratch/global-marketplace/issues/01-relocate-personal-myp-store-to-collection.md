## Parent

#18

## What to build

Move the Collector's personal MyP Cards store management (`@username` connection, Store Sync, Shortage Offset alerts, and Claim-to-Binder workflow) into a dedicated **MyP Store** tab inside `/collection` (`/collection?view=MYP_STORE`), so all physical cards owned by the Collector (both active Binder copies and personal Store Listings) live under `/collection` while keeping `myp_cards` strictly isolated from `collection_items` until claimed.

## Acceptance criteria

- [ ] `/collection` includes a **MyP Store** tab (`MYP_STORE`) alongside `All Cards`, `Staples`, `Low Pop`, and `Idle / Trade`, and supports deep-linking via `/collection?view=MYP_STORE`.
- [ ] Selecting the **MyP Store** tab in `/collection` allows the Collector to configure or edit their MyP Cards `@username`, trigger a Store Sync, filter their personal Store Listings by Shortage Offsets / Element / Rarity / search query, and claim copies directly into their Binder (opening the MyP listing URL to delist).
- [ ] Personal Store Listings (`myp_cards`) remain isolated from the active Binder tabs (`All Cards`, `Staples`, `Low Pop`, `Idle / Trade`) so cards listed for sale do not falsely satisfy Deck requirements until claimed.
- [ ] The *"X in MyP"* Shortage Offset badge in the consolidated Shortages view links directly to `/collection?view=MYP_STORE`.

## Blocked by

None — can start immediately
