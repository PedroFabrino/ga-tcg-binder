## Parent

#23

## What to build

Cross-reference indexed **Meta Staples** against the Collector's active **Binder** and personal **Store Listings** (`/collection?view=MYP_STORE`) as well as global **Market Listings** (`/marketplace`). When a personal Store Listing matches a **Meta Staple** and the Collector owns fewer copies in their Binder than `recommendedCopies` (**Staple Deficit**), flag the listing with a prominent **"🔥 Meta Staple · Keep in Binder! (Binder: X/Y)"** alert and sort it immediately after active **Shortage Offsets** so the Collector can claim it back into their Binder. When the Collector already holds a full playset in their Binder (`binderOwned >= recommendedCopies`), display a neutral **"Meta Staple · Playset Owned in Binder (Y/Y)"** badge instead of nagging them to delist their 5th+ surplus copy.

## Acceptance criteria

- [ ] Personal **Store Listings** in `/collection?view=MYP_STORE` matching a **Meta Staple** where `binderOwned < recommendedCopies` display a **"🔥 Meta Staple · Keep in Binder! (Binder: X/Y — Z% inclusion)"** badge and sort immediately after **Shortage Offsets** (and ahead of normal store listings).
- [ ] Personal **Store Listings** in `/collection?view=MYP_STORE` matching a **Meta Staple** where `binderOwned >= recommendedCopies` display a neutral **"Meta Staple · Playset Owned in Binder (Y/Y)"** badge and are not flagged as a **Staple Deficit**.
- [ ] `/collection?view=MYP_STORE` includes a filter pill/card to isolate **Staple Deficits** alongside **Shortage Offsets** and **All Store Listings**.
- [ ] Global **Market Listings** on `/marketplace` display a **Meta Staple** badge (highlighting **Staple Deficits** where `binderOwned < recommendedCopies` and `netExternalStock > 0`) and support filtering by **Meta Staples**.
- [ ] Service-seam tests verify that a Collector with `2/4` copies in their Binder has their MyP listing flagged with `isStapleDeficit = true`, whereas a Collector with `4/4` copies in their Binder has their 5th copy on MyP flagged with `isMetaStaple = true` and `isStapleDeficit = false`.

## Blocked by

- #24
- #19
- #20
