## Parent

#18

## What to build

A full Global MyP Market Scanner experience on `/marketplace` that lets Collectors scan, filter, and buy active Grand Archive Market Listings prioritized by **Hard Shortages** (🔴 Red alert) and **Shared Shortages** (🟡 Yellow/Amber alert), alongside direct **"Buy on MyP · R$ X,XX (N avail)"** purchase links inside the `/decks` shortage views.

## Acceptance criteria

- [ ] `/marketplace` displays the Global MyP Market Scanner with summary filter cards for 🔴 **Hard Shortages**, 🟡 **Shared Shortages**, and 🌐 **All Market Listings**, plus a **"Sync MyP Market"** button and last-synced timestamp.
- [ ] Market Listings in `/marketplace` display a red alert badge for **Hard Shortages** (*"Missing X to play [Deck Name]"*) and an amber/yellow alert badge for **Shared Shortages** (*"Sharing X across [Decks]"*), sorted with Hard Shortages first and Shared Shortages second.
- [ ] When a Collector also has copies of a Market Listing in their personal MyP Store (`personalStoreQty > 0`), `/marketplace` displays a badge indicating how many copies are in their own MyP Store (linking to `/collection?view=MYP_STORE`) and warns if `netExternalStock === 0` so they do not buy their own listing.
- [ ] `/marketplace` supports filtering Market Listings by text query (card name, edition code, or deck name), Element chips, Rarity chips, and shortage tier, with a direct **"Buy on MyP"** button opening the MyP product page in a new tab.
- [ ] Both the consolidated Shortages view (`/decks`) and individual Deck Shortage tables (`/decks/[id]`) display a direct **"Buy on MyP · R$ X,XX (N avail)"** badge on any missing card with `netExternalStock > 0`, opening its MyP product page in a new tab.

## Blocked by

- #19
- #20
