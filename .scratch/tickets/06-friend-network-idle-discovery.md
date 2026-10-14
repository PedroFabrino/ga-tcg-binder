## Parent
#1

## What to build
Build a social friend network enabling collectors in a local playgroup to connect via shareable invite links or friend codes. On any deck shortage report, automatically cross-reference linked friends' collections and highlight idle copies: `✨ Available from Friends: Chryst (2 idle copies)`. Provide a dedicated "Friends" page allowing users to browse their friends list and inspect each friend's Idle Binder (unassigned cards not locked into their active decks).

## Acceptance criteria
- [ ] Friend system schema (`friend_links`) supports pending/accepted states and unique shareable invite URLs (`/invite/[code]`).
- [ ] Users can generate an invite link and connect mutually with friends in one click.
- [ ] Friend search by username or friend code enables finding and requesting connections manually.
- [ ] Shortage calculation engine checks linked friends' inventories for cards with unassigned (idle) quantities.
- [ ] Missing card rows in deck shortage views display an inline friend availability badge with friend name and idle count.
- [ ] Dedicated "Friends" view lets collectors browse each connected friend's profile and idle card inventory.
- [ ] Automated tests verify friend linkage and ensure dedicated/active deck cards are excluded from idle lending calculations.

## Blocked by
- #3 (Collector Inventory Tracking & Smart Views)
- #4 (Deck Builder, Omnidex Importer & Shortage Gap Analysis)
