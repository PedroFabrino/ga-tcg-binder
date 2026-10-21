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

**Shortage** (_pt-BR_: **Cartas Necessárias**):
The quantity deficit when the number of copies required by one or more Decks exceeds available Owned Copies.
_Avoid_: Missing card, out of stock, falta

**Hard Shortage** (_pt-BR_: **Compra Necessária** / **Sem Cópia Suficiente**):
A high-priority single-deck Shortage where the Collector does not own enough copies in their Binder to sleeve even one individual Deck (`peakMissing > 0`).
_Avoid_: Peak deficit, unplayable gap, falta crítica

**Shared Shortage** (_pt-BR_: **Revezamento entre Decks**):
A secondary multi-deck Shortage where every individual Deck has enough copies if shared, but total concurrent demand across multiple Decks exceeds Owned Copies (`concurrentMissing > 0` with `peakMissing = 0`).
_Avoid_: Contention deficit, swap shortage, falta compartilhada

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
The periodic or on-demand automated ingestion process that crawls tournament data sources to synchronize Meta Archetypes, Meta Tiers, Canonical Decklists, and Meta Staples.
_Avoid_: Deck scraper, meta pull, bot refresh

**Meta Staple**:
A format-wide competitive Card with high tournament inclusion across Divine Relics, Material Decks, Elemental Main Decks, or Sideboards, tracked with its recommended competitive playset quantity.
_Avoid_: Personal staple, format staple, popular card

**Staple Deficit**:
A state where a Collector holds fewer copies of a Meta Staple in their active Binder than its recommended playset quantity, flagging any copies listed in their personal Store Listings to be claimed back into the Binder.
_Avoid_: Staple shortage, missing staple

**Archetype Completion**:
The percentage of a Meta Archetype's core playable Canonical Decklist (Material Deck and Main Deck) satisfied by the Collector's combined physical holdings across their active Binder and personal Store Listings.
_Avoid_: Deck match score, buildability rate

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

**Store Listing**:
A physical card instance listed by the Collector in their own external store (such as their personal MyP Cards profile), tracked inside their Collection view but kept isolated from active Binder copies until claimed.
_Avoid_: Inventory item, shop stock, sale row

**Store Sync**:
The on-demand crawler pipeline that extracts a Collector's personal Store Listings and resolves them against the Card Catalog.
_Avoid_: Store scraper, listing importer

**Shortage Offset**:
A Store Listing owned by the Collector that matches an active Deck Shortage, identifying physical copies the Collector already owns on sale that could be withdrawn and claimed into their Binder.
_Avoid_: Sale conflict, deck reserve

**Market Listing**:
An aggregated public product entry on the global external marketplace (such as MyP Cards) with active stock for sale, tracking total available quantity and lowest asking price across all sellers.
_Avoid_: Global item, shop product

**Market Sync**:
The on-demand or scheduled crawler pipeline that snapshots all active Market Listings for Grand Archive and resolves them against the Card Catalog.
_Avoid_: Global scraper, price pull

**Buyable Shortage**:
An active Deck Shortage (either a hard single-deck deficit or a multi-deck sharing contention) that matches at least one active Market Listing available for purchase.
_Avoid_: Purchasable missing card, market match

**Preço TCG Player**:
The benchmark market price reported by MyP Cards for a Printing, sourced from TCGplayer reference data and converted to BRL.
_Avoid_: US price, TCG baseline, external quote

**Price Fairness**:
The quantitative evaluation comparing a Market Listing's asking price against its Preço TCG Player baseline to detect price gouging or bargains.
_Avoid_: Price rating, deal score

**Overpriced Listing**:
A Market Listing whose asking price exceeds the Collector's configured Slightly Overpriced threshold (default `1.2x`, or 20% above its Preço TCG Player baseline), subdivided into:
- **Heavily Overpriced**: Asking price exceeds the Collector's configured Heavily Overpriced threshold (default `2.0x`, or over double the Preço TCG Player baseline).
- **Slightly Overpriced**: Asking price is between the Slightly Overpriced and Heavily Overpriced thresholds (default `1.2x` to `2.0x` of the Preço TCG Player baseline).
_Avoid_: Expensive card, bad deal, markup tier

**Fair Price**:
A Market Listing whose asking price is between 1.0x and 1.2x (up to 20% higher than) the Preço TCG Player baseline, or below baseline (bargain).
_Avoid_: Normal price, cheap listing

**Market Vendor**:
An external seller or store offering one or more Market Listings, used to group Buyable Shortages into multi-card packages that consolidate shipping costs.
_Avoid_: Merchant, third-party shop, dealer

**Quota**:
The target copy count of a Card that a Collector aims to hold in their active Binder, governed by their configured shortage policy (Hard Shortage, Shared Shortage, or Staple Deficit).
_Avoid_: Target count, max copies, cap

**Standard Playable Printing**:
A base non-foil Printing of a Card (Common through Ultra Rare, excluding special treatments such as Collector Rarity, Curio, Full Art, or Foil), eligible for automated gameplay shortage watching.
_Avoid_: Normal version, base card

**Collector Printing**:
A foil, Collector Super Rare (CSR), Curio (CUR), Full Art, or promotional Printing of a Card sought for aesthetic or collectible value rather than standard deck completion, and excluded from automated watchlist mutations.
_Avoid_: Bling, high-rarity version, chase card

**Watchlist Entry**:
A Standard Playable Printing of a Card registered on the Collector's external marketplace wantlist to monitor stock and seller cart matches until its Card's Quota is satisfied in the Binder.
_Avoid_: Favorite item, wishlist row, tracked product

**Watchlist Ledger**:
The managed set of Watchlist Entries created and tracked by the system, isolating automated shortage additions and quota-fulfilled removals of Standard Playable Printings from Collector Printings or items the Collector added manually on the marketplace.
_Avoid_: Sync queue, wantlist cache

**Game Nomenclature**:
Official Grand Archive TCG gameplay terms—including Card names, Elements (`Norm`, `Fire`, `Water`, `Wind`, `Tera`, `Crux`, `Umbra`, `Luxem`, `Exalted`, `Astra`, `Exia`, `Arcane`, `Neos`), Rarities (`Common`, `Uncommon`, `Rare`, `Super Rare`, `Ultra Rare`, `Collector`), Deck zones (`Main Deck`, `Material Deck`, `Sideboard`), and Finishes (`Foil`, `Normal`)—that remain in their canonical English form across all application locales (`en`, `pt-BR`).
_Avoid_: Translated element names, translated rarity tiers, translated deck zones

**Seller Mode**:
An explicit Collector opt-in that enables private external-marketplace selling workflows when complete MyP credentials are saved.
_Avoid_: Store Mode, vendor account, seller account

**Vendor Capability**:
The eligibility to access private external-marketplace selling workflows, requiring Seller Mode and complete saved MyP credentials.
_Avoid_: MyP access, seller permission, vendor access

**Shipping Capability**:
The eligibility to access shipping workflows, requiring Vendor Capability and a saved SuperFrete API key.
_Avoid_: Shipping access, SuperFrete mode, delivery permission

**Fulfillment Order**:
A customer purchase on the Collector's external marketplace store containing one or more sold Printings and recipient shipping details, progressing through three lifecycle stages: `Open` (imported and in card separation/photography), `Processed` (linked to a generated Shipping Ticket awaiting payment or tracking confirmation), and `Sent` (tracking code confirmed on the marketplace).
_Avoid_: Sale row, invoice, pending shipment

**Pick List**:
The aggregated list of sold Printings across selected Fulfillment Orders, grouped by canonical Element and Card name so the Collector can pull all required physical copies from storage in a single pass.
_Avoid_: Pull sheet, element batch, shopping list

**Buyer Pack**:
The post-pick grouping of Fulfillment Orders organized first by buyer nickname to consolidate physical parcels into a single Shipping Ticket, and sub-grouped by individual Fulfillment Order so each order's items can be staged and photographed separately before shipping together.
_Avoid_: Customer bundle, shipment stack, order merge

**Shipping Ticket**:
A freight shipment registered in the external shipping aggregator (Superfrete) for a consolidated Buyer Pack, progressing from `pending` (awaiting payment in the aggregator panel) to `released` (paid, with an assigned postal tracking code) and `posted`.
_Avoid_: Shipping label, cart row, freight order

**Headless Ingestion Engine**:
The server-side background and on-demand synchronization worker using FlareSolverr transport to discover eligible Fulfillment Orders from the external marketplace (`Aguard. envio` and `Em separação`) and extract order and recipient details incrementally.
_Avoid_: Order bot, background scraper, sync daemon

**Order Reconciliation**:
The synchronization state comparison between external marketplace orders and local Fulfillment Orders, detecting status modifications and buyer cancellation requests, and cross-referencing them against Shipping Ticket payment status to alert the Collector whether an order is safe to cancel or requires freight intervention.
_Avoid_: State sync, diff check, order auditor

**Marketplace Platform**:
The external marketplace commerce system or technical integration adapter (such as `myp` or `liga_store`) used to discover and crawl listings.
_Avoid_: Shop engine, site type, crawler adapter

**Marketplace Store**:
A specific configured external storefront or seller source (such as MyP Cards or Brandão Card Game) tracked with its own identity, base URL, platform, external TCG identifier, enabled state, listing count, and sync timestamps.

**Latest Card Detection**:
A change-detection strategy for LigaStore marketplaces that compares the most recently added product (`txt_order=12&ultimas=1`) against a previously recorded reference ID (`lastLatestCardRefId`), catching single-card swaps that count-based detection would miss.

**Notification Outbox**:
A persisted queue table (`market_notifications`) in the application database that decouples the marketplace sync process from the Root bot notification delivery. The sync process writes pending notifications; the bot polls and sends them, marking rows as sent.

**Root Bot**:
The `@rootsdk/server-bot` application at `apps/ga-tcg-binder-bot/` that sends marketplace update messages to a configured Root community channel. It polls the Notification Outbox and formats detected new cards as Markdown messages.

**Bot Channel**:
The Root community channel (identified by `ROOT_BOT_MARKET_CHANNEL_ID`) where the Root Bot posts market update notifications.
_Avoid_: Vendor, shop profile, site account

**LigaStore**:
The integration adapter for external stores powered by the LigaMagic/lmcorp e-commerce engine, operating strictly as a buy-side listing source for Buyable Shortages and marketplace browsing without selling, cart, or fulfillment write-backs.
_Avoid_: LigaMagic bot, Liga scraper

**Marketplace Listing**:
The current observed external product offer for a card from a Marketplace Store, capturing price, quantity, condition, finish, vendor data, source URL, and observation timestamps.
_Avoid_: Shop item, external card, store offer

**Canonical Listing Data**:
The normalized local card identity associated with a Marketplace Listing, derived from the official Grand Archive Card Catalog and represented by canonical card and edition linkages (`card_slug`, `edition_id`).
_Avoid_: Mapped product, verified card

**Listing Resolver**:
The domain process that matches raw external marketplace titles and collector numbers against the canonical Card Catalog to establish card and edition links.
_Avoid_: Title matcher, card linker

**Unlinked Listing**:
A crawled Marketplace Listing successfully ingested from an external store but not yet confidently resolved to a canonical card or edition in the local Card Catalog, retained for operational diagnostics without distorting shortage calculations.
_Avoid_: Orphan card, unknown item, broken listing

**Count Poll** (_or_ **Lightweight Poll**):
A low-overhead periodic HTTP check retrieving only a Marketplace Store's reported total listing count (e.g., `1-14 de 14` on LigaStore or `N itens` on MyP) to detect inventory changes before dispatching an expensive rescan.
_Avoid_: Quick scrape, count ping, header check

**Full Rescan**:
A complete catalog crawl of an active Marketplace Store that extracts listing prices and quantities across all pages and reconciles the store's current active listing snapshot.
_Avoid_: Deep crawl, total sync, hard refresh

**Listing Reconciliation**:
The synchronization phase following a successful Full Rescan that refreshes observed listings, updates `last_seen_at`, and marks previously active listings absent from the scan as out-of-stock or inactive without deleting history.
_Avoid_: Stale cleanup, inventory purge, listing diff

**Repository**:
A module in `src/db/repositories/` that owns all database queries for one aggregate; the only layer allowed to touch Drizzle/libSQL.
_Avoid_: DAO, data layer, db helper

**Service**:
A module in `src/services/` holding domain logic and orchestration, calling Repositories and never the database directly.
_Avoid_: Manager, util

