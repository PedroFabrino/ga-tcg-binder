# Grand Archive Collection & Deck Management

Manage Grand Archive TCG physical collections, track print populations, allocate cards across decks, and detect card shortages against personal and tournament decklists.

## Language

**Card**:
The abstract gameplay entity defined by its game rules, name, element, class, and effect text.
_Avoid_: Printing, edition, physical card

**Printing**:
A specific physical manufacturing release of a Card, identified by set edition, collector number, finish (foil or non-foil), and publisher print population.
_Avoid_: Card, version, print run

**Owned Copy**:
A physical instance of a Printing held in the user's collection, tracked with a quantity.
_Avoid_: Inventory row, stock

**Deck**:
A constructed 60-card Main Deck, Material Deck, and optional Sideboard representing a playable list.
_Avoid_: Build, decklist

**Shared Card**:
An Owned Copy whose usage is permitted across multiple Decks simultaneously under the assumption that physical cards are moved between decks when played.
_Avoid_: Cloned card, virtual copy

**Dedicated Card**:
An Owned Copy strictly reserved for a single Deck, preventing any other Deck from satisfying its card requirements with that copy.
_Avoid_: Locked card, exclusive card

**Shortage**:
The quantity deficit when the number of copies required by one or more Decks exceeds available Owned Copies.
_Avoid_: Missing card, out of stock

**Population**:
The total number of circulating copies produced for a given Printing as recorded by the publisher API.
_Avoid_: Print run, supply count

**Meta Archetype**:
A recognized competitive deck classification derived from tournament results and event playrates.
_Avoid_: Meta build, tournament category

**Meta Tier**:
The competitive hierarchy rating (Tier 1, Tier 2, Tier 3, Rogue) assigned to a Meta Archetype based on tournament share and game win rates.
_Avoid_: Letter tier, power rank, rating bracket

**Canonical Decklist**:
A specific verified tournament-winning or high-cut decklist adopted as the representative card configuration for a Meta Archetype.
_Avoid_: Default list, netdeck template, sample deck

**Meta Sync**:
The periodic or on-demand automated ingestion process that crawls tournament data sources to synchronize Meta Archetypes, Meta Tiers, and Canonical Decklists.
_Avoid_: Deck scraper, meta pull, bot refresh

**Card Catalog**:
The canonical reference repository of Cards and Printings synchronized from the official game API.
_Avoid_: Card master list, card index

**Deck Assignment**:
The explicit allocation of an Owned Copy of a Dedicated Card to a specific Deck.
_Avoid_: Card reservation, card attachment

**Population Threshold**:
The circulating copy limit below which a Printing is classified as low population.
_Avoid_: Rarity cutoff, scarcity limit

**Collector**:
An authenticated user who maintains a personal collection of Owned Copies and personal Decks.
_Avoid_: Player, account, user

**Friend Link**:
An established mutual connection between two Collectors granting reciprocal visibility into each other's collection and idle cards.
_Avoid_: Friendship, buddy, contact

**Idle Copy**:
An Owned Copy not currently allocated to or referenced by any of the Collector's Decks, available for lending or trading.
_Avoid_: Spare card, trade binder item, unassigned card

**Card Scanner**:
An automated visual ingestion tool that recognizes Cards and Printings from video frames or still images.
_Avoid_: Video OCR, card detector

**Scanner Session**:
A temporary authenticated pairing bridge allowing a mobile device camera to scan and register cards directly into a desktop session without mobile login.
_Avoid_: Camera pairing, phone session

**Companion Scanner**:
A dedicated native mobile application that connects to an active Scanner Session to capture, process, and stream card recognitions in real time.
_Avoid_: Mobile app, remote camera, phone client

**Rapid-Fire Mode**:
A continuous scanning state where confirmed cards are automatically committed to the collection without leaving the camera viewfinder or requiring manual taps.
_Avoid_: Batch mode, continuous scan, auto scan





