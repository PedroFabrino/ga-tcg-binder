# Specification: MyP Fulfillment Order Pick List & Buyer Pack Assistant

**Status:** `ready-for-agent`

## Problem Statement

When a **Collector** sells cards on their external MyP Cards store (`mypcards.com/<nick>/vendas`), fulfilling a batch of pending orders (**Aguard. envio**) requires a tedious, error-prone manual workflow:

1. **Fragmented Order Inspection**: The `/vendas` summary table lists order codes (`#654326`, `#654317`, etc.), buyers, and shipping methods, but hides the sold items inside individual `/pedido/<id>` pages. A Collector with 15 pending orders must open 15 separate tabs just to see which cards were sold.
2. **Missing Element Grouping on MyP**: Collectors physically organize their Grand Archive storage boxes and binders by canonical **Element** (`Norm`, `Fire`, `Water`, `Wind`, etc.) and card name. However, MyP's order page only displays the card name, set name, and product slug (`grandarchive_rdo_029`)—it has no concept of Grand Archive **Elements**. Pulling cards order-by-order forces the Collector to repeatedly flip back and forth through the same elemental storage boxes.
3. **Multi-Order Buyers & Per-Order Photo Verification**: The same buyer frequently places multiple separate orders (e.g., 5 separate orders from `Betinho3`, or 2 orders from `LOOTCARDS` combining *PAC* and *Frete combinado com o vendedor*). While these orders are shipped together in a single physical parcel, the Collector must stage and photograph the exact items for each individual **Fulfillment Order** `#` to send verification screenshots in each order's MyP chat before packing them together.
4. **Mixed-TCG Store Noise**: A Collector's MyP `/vendas` queue may include orders from other trading card games (such as Pokémon) alongside Grand Archive orders. Mixing non-Grand Archive items into the Grand Archive **Pick List** or silently dropping them causes confusion during fulfillment.

## Solution

We introduce a read-only **MyP Fulfillment Order Pick & Pack Assistant** spanning both the existing **Auditable Browser Userscript Bridge** on `mypcards.com` and the **MyP Store** view inside the Grand Archive TCG Binder web application:

1. **In-Page Order Selection & Polite Sequential Extraction on MyP (`/vendas`)**:
   - Extend the Tampermonkey userscript on `https://mypcards.com/*/vendas` to inject selection checkboxes on **Aguard. envio** rows (selected by default, with an optional toggle to include **Em separação** rows) and a **"Separar Envios"** action button.
   - Sequentially fetch each selected `/pedido/<id>` page using the Collector's active browser session with polite pacing (400–600ms delay between requests) and `sessionStorage` caching per order ID.
   - Strictly strip and ignore all buyer personally identifiable information (`CPF`, full legal name, street address) from the DOM, extracting only `orderId`, `orderDate`, `buyerNick`, `shippingMethod`, `status`, and the order's item lines (`cardName`, `setName`, `mypCode`, `condition`, `language`, `isFoil`, `quantity`, `unitPrice`).
2. **Stateless Card Catalog Enrichment**:
   - Send the extracted order items to a stateless enrichment endpoint on the application server, which resolves each Grand Archive item against the **Card Catalog** (`grandarchive_<set>_<collector_number>` slug and card/edition fallback) to attach canonical **Element**, set prefix, collector number, rarity, and card artwork URL.
   - Automatically detect non-Grand Archive **Fulfillment Orders** (e.g., `pokemon_*` slugs or non-`/grandarchive/` product links) and isolate them into a dedicated **"Non-Grand Archive Orders"** callout with direct links to each order.
3. **Two-Phase Fulfillment Workflow (On-Page MyP Modal + Web App View)**:
   - **Phase 1 — Pick List (Grouped by Canonical Element)**: Aggregates all sold Grand Archive **Printings** across selected **Fulfillment Orders**, grouped by canonical **Element** (`Norm`, `Fire`, `Water`, `Wind`, `Tera`, `Crux`, `Umbra`, `Luxem`, `Exalted`, `Astra`, `Exia`, `Arcane`, `Neos`, plus an `Unmatched Grand Archive` fallback bucket) and sorted alphabetically by **Card** name. Each entry displays the set code, collector number, condition, foil badge, total quantity to pull, and a persistent checkbox.
   - **Phase 2 — Buyer Packs (Grouped by Buyer, Sub-Grouped by Fulfillment Order `#`)**: Groups orders by `buyerNick` so multi-order buyers are consolidated for shipping (highlighting paid shipping methods like `PAC` or `Frete Fixo` alongside `Frete combinado`), while sub-grouping items under each individual **Fulfillment Order** (`#Código`). Each order provides per-item checkboxes, an **"Order Completed / Photographed"** toggle, and a direct link to `/pedido/<id>` to upload the verification screenshot.
   - **Cross-Surface Handoff & Clipboard Export**: Provides 1-click formatted text export (`Norm:\nVoid's Cloak [RDO #029 · NM] x1...`) inside the MyP modal and a 1-click handoff to view and check off the enriched batch with full card artwork previews inside the web application's MyP Store tab.

## User Stories

1. As a Collector on `https://mypcards.com/<nick>/vendas`, I want to see selection checkboxes next to every order in **Aguard. envio** (all checked by default), so that I can process my entire shipping queue at once or deselect specific orders I am not packing today.
2. As a Collector on `/vendas`, I want an optional toggle to also include orders currently in **Em separação**, so that I can resume or re-verify orders I already marked as in separation on MyP.
3. As a Collector clicking **"Separar Envios"** on `/vendas`, I want the userscript to fetch each selected `/pedido/<id>` sequentially with a visible progress indicator (`Reading order X of Y (#654326)...`) and polite 400–600ms pacing, so that my browser never triggers Cloudflare rate limits.
4. As a Collector reopening or adjusting my order selection in the same browser session, I want already-fetched `/pedido/<id>` details cached in `sessionStorage`, so that the script does not re-fetch pages unnecessarily.
5. As a security-conscious Collector, I want the userscript to strictly ignore the buyer's `CPF`, legal name, and physical address on `/pedido/<id>` and perform only read-only `GET` requests on MyP, so that no buyer PII ever leaves the page and no unintended mutations occur on my MyP store.
6. As a Collector who sells cards from multiple TCGs on MyP (such as Pokémon alongside Grand Archive), I want any non-Grand Archive **Fulfillment Order** automatically detected and listed in a separate **"Non-Grand Archive Orders"** banner with the order `#`, buyer nickname, and a direct link to `/pedido/<id>`, so that non-GA cards do not pollute my Grand Archive **Pick List** while never being forgotten.
7. As a Collector in **Phase 1 (Pick List)**, I want all sold Grand Archive cards aggregated by canonical **Element** (`Norm`, `Fire`, `Water`, `Wind`, `Tera`, `Crux`, `Umbra`, `Luxem`, `Exalted`, `Astra`, `Exia`, `Arcane`, `Neos`) and sorted alphabetically by **Card** name within each **Element**, so that I can pull every sold card from my elemental storage boxes in a single forward pass.
8. As a Collector pulling cards in **Phase 1 (Pick List)**, I want each line to clearly display the **Card** name, set prefix, collector number, condition (e.g., `NM`), quantity (`xN`), and a prominent `[FOIL]` badge whenever a sold **Printing** is foil, so that I never pull the wrong edition, finish, or condition from my collection.
9. As a Collector, if two different orders purchased the exact same **Printing**, finish, and condition of a **Card** (e.g., two orders each buying `1x Eight of Spades [DOA · NM]`), I want their quantities summed in the **Pick List** (`Eight of Spades [DOA · NM] x2`), while keeping distinct **Printings** or finishes (e.g., `Foil` vs `Normal`, or `DOA` vs `ALC`) on separate lines.
10. As a Collector, if a Grand Archive item on MyP has a product code or title that cannot be matched to an existing **Card** in the **Card Catalog**, I want it placed in an explicit **Unmatched Grand Archive** section of the **Pick List**, so that 100% of sold items are accounted for.
11. As a Collector pulling cards from my boxes, I want interactive checkboxes next to each row in the **Pick List** whose checked state persists in `localStorage`, so that I can track which cards I have already pulled to my desk.
12. As a Collector, I want a **"Copy Pick List Text"** button that copies the clean text breakdown grouped by **Element** (and optional **Buyer Packs**) to my clipboard, so that I can paste or print it anywhere.
13. As a Collector in **Phase 2 (Buyer Packs)**, I want orders grouped by buyer nickname (`buyerNick`) with a summary badge showing how many orders that buyer has and their shipping methods (e.g., flagging `PAC` or `Frete Fixo com rastreio` vs `Frete combinado com o vendedor`), so that I know which orders will be packed into the same physical parcel.
14. As a Collector who sends a separate verification photo in each order's chat on MyP, I want each **Buyer Pack** sub-grouped by individual **Fulfillment Order** (`Pedido #654326`, `Pedido #654317`, etc.) listing that specific order's items, so that I can lay out one order's cards, snap the photo, and repeat for the buyer's remaining orders before sealing their parcel.
15. As a Collector staging cards in **Phase 2 (Buyer Packs)**, I want a checkbox for each item inside a **Fulfillment Order** and an **"Order Completed / Photographed"** toggle for the order as a whole (persisted in `localStorage`), plus a direct link to open `/pedido/<id>` in a new tab, so that I can systematically photograph and verify every order without losing my place.
16. As a Collector who wants rich visual verification with card artwork, I want to view the active fulfillment batch inside the web application's **MyP Store** view (populated via the userscript bridge), displaying `ElementBadge`s, `FoilBadge`s, `CardArt` hover previews, and interactive **Pick List** and **Buyer Pack** checklists.
17. As a bilingual user (`en` and `pt-BR`), I want all user-facing UI chrome in the web application's Fulfillment view localized through the shared compile-time i18n catalog while preserving canonical English **Game Nomenclature** (`Norm`, `Fire`, `Water`, `Foil`, `Normal`, Card names).

## Implementation Decisions

### 1. Core Domain Types & Stateless Enrichment Contract
To keep buyer order details ephemeral and avoid database schema bloat or PII storage, the backend exposes a stateless enrichment contract validated at the boundary with Zod:

```typescript
// Prototype-derived contract shapes for stateless Fulfillment enrichment

export interface RawMypOrderItemInput {
  rawTitle: string;          // e.g. "Void's Cloak"
  rawSubtitle?: string;      // e.g. "Void's Cloak - Radiant Origins"
  mypCode: string;           // e.g. "grandarchive_rdo_029" or "pokemon_sv1_001"
  productUrl?: string | null;
  condition: string;         // e.g. "NM", "SP", "MP"
  language?: string;         // e.g. "EN"
  isFoil: boolean;
  quantity: number;
  unitPriceBrl: string;      // e.g. "R$ 7,00"
}

export interface RawMypFulfillmentOrderInput {
  orderId: string;           // e.g. "654326"
  orderDate: string;         // e.g. "17/10/2026"
  buyerNick: string;         // e.g. "Betinho3"
  shippingMethod: string;    // e.g. "Frete combinado com o vendedor" | "PAC"
  status: string;            // e.g. "Aguard. envio" | "Em separação"
  orderUrl: string;          // e.g. "https://mypcards.com/pedido/654326"
  items: RawMypOrderItemInput[];
}

export interface EnrichedFulfillmentItem {
  itemKey: string;           // Deterministic key: cardSlug/mypCode + setPrefix + collectorNumber + isFoil + condition
  isGrandArchive: boolean;
  cardSlug: string | null;
  cardName: string;
  element: string;           // Canonical Element ("Norm", "Fire", ...) or "UNMATCHED"
  setPrefix: string;         // e.g. "RDO"
  collectorNumber: string | null; // e.g. "029"
  rarity: number | null;
  imageUrl: string | null;
  condition: string;
  isFoil: boolean;
  quantity: number;
  unitPriceBrl: string;
  mypCode: string;
}

export interface PickListEntry {
  itemKey: string;
  cardSlug: string | null;
  cardName: string;
  element: string;
  setPrefix: string;
  collectorNumber: string | null;
  rarity: number | null;
  imageUrl: string | null;
  condition: string;
  isFoil: boolean;
  totalQuantity: number;
  orderReferences: Array<{
    orderId: string;
    buyerNick: string;
    quantity: number;
  }>;
}

export interface BuyerPackGroup {
  buyerNick: string;
  totalOrders: number;
  totalItems: number;
  shippingMethods: string[];
  primaryShippingMethod: string; // Prioritizes paid/tracked methods (PAC, Sedex, Frete Fixo) over "Frete combinado"
  orders: Array<{
    orderId: string;
    orderDate: string;
    shippingMethod: string;
    status: string;
    orderUrl: string;
    items: EnrichedFulfillmentItem[];
  }>;
}

export interface NonGrandArchiveOrderNotice {
  orderId: string;
  orderDate: string;
  buyerNick: string;
  orderUrl: string;
  detectedTcg: string;       // e.g. "pokemon", "magic", "yugioh", "other"
  itemCount: number;
}

export interface FulfillmentReport {
  generatedAt: number;
  totalGrandArchiveOrders: number;
  totalGrandArchiveCopies: number;
  pickListByElement: Record<string, PickListEntry[]>; // Keyed by canonical Element order
  buyerPacks: BuyerPackGroup[];
  nonGrandArchiveOrders: NonGrandArchiveOrderNotice[];
}
```

### 2. Catalog Resolution & Non-Grand Archive Detection Rules
- **TCG Classification**:
  - An order item is classified as Grand Archive (`isGrandArchive = true`) if its `mypCode` starts with `grandarchive_` (case-insensitive) or its `productUrl` contains `/grandarchive/`.
  - If all items in a **Fulfillment Order** have `isGrandArchive === false`, the order is excluded from `pickListByElement` and `buyerPacks` and emitted in `nonGrandArchiveOrders` with its `detectedTcg` prefix (e.g., `pokemon` from `pokemon_...`), `buyerNick`, and `orderUrl`.
  - If a single order ever contains a mix of Grand Archive and non-Grand Archive items, its Grand Archive items are included in the **Pick List** and **Buyer Pack** while the order is also flagged in `nonGrandArchiveOrders`.
- **Printing & Element Resolution**:
  - Extract `(setPrefix, collectorNumber)` from `grandarchive_<set>_<number>` (e.g., `grandarchive_rdo_029` $\rightarrow$ set `RDO`, collector number `029` / `29`).
  - Query the **Repository** layer for matching `card_editions` joined with `cards` by normalized `(setPrefix, collectorNumber)`, falling back to normalized `cardName` + `setPrefix`, and finally normalized `cardName` alone.
  - Normalize the resolved **Element** using canonical **Game Nomenclature** order (`Norm`, `Fire`, `Water`, `Wind`, `Tera`, `Crux`, `Umbra`, `Luxem`, `Exalted`, `Astra`, `Exia`, `Arcane`, `Neos`). Any Grand Archive item that cannot be matched in the **Card Catalog** is assigned `element = "UNMATCHED"` so it renders in an explicit **Unmatched Grand Archive** section rather than being dropped.

### 3. Layering, CORS & Handoff Architecture
- **Repository Layer**: A dedicated catalog lookup repository owns all database queries against `cards` and `card_editions` (strictly respecting ADR 0012).
- **Service Layer**: A pure domain service parses MyP `/vendas` and `/pedido/<id>` HTML structures, matches items against repository records, aggregates `pickListByElement` (collapsing identical `itemKey`s and sorting alphabetically by `cardName`), and builds `buyerPacks` (sorting buyers with multiple orders or tracked shipping first, and sub-sorting orders chronologically/by ID).
- **API Boundary & CORS**: The `/api/marketplace/fulfillment` route validates incoming payloads with Zod and sets CORS headers allowing `https://mypcards.com` to invoke `POST` and `OPTIONS` requests directly from the Tampermonkey script.
- **Cross-Surface Handoff**: In addition to rendering the interactive modal directly on `mypcards.com/<nick>/vendas`, the userscript can open the web application (`/collection?tab=myp-store&fulfillment=1`) or sync the latest `FulfillmentReport` into browser storage / memory so the Collector can use the full React **Fulfillment View** with `CardArt` previews and synchronized check states.

## Testing Decisions

- **Primary Testing Seam**: The highest and cleanest seam is the **Fulfillment Service & API Boundary** (`buildFulfillmentReport` / `POST /api/marketplace/fulfillment` + HTML parsers `parseMypVendasHtml` and `parseMypOrderPageHtml`).
- **What Makes a Good Test**: Tests must verify external behavior and domain outputs given realistic HTML fixtures and order payloads—never internal implementation details:
  1. Parsing `/vendas` table HTML extracts `Aguard. envio` (and optional `Em separação`) rows with order IDs, dates, buyer nicknames, and shipping methods.
  2. Parsing `/pedido/<id>` HTML extracts item titles, `grandarchive_<set>_<num>` codes, foil flags, conditions, and quantities while ignoring buyer `CPF` and street address fields.
  3. Resolving items against an in-memory SQLite/libSQL **Card Catalog** groups items accurately by canonical **Element**, sums quantities for identical `(Printing, condition, isFoil)` across multiple orders, and keeps distinct printings/finishes separate.
  4. Grouping into **Buyer Packs** consolidates multi-order buyers (e.g., `Betinho3` with 5 orders, `LOOTCARDS` with 2 orders and mixed `PAC` + `Frete combinado` shipping) while preserving each sub-order's individual item list for per-order photo verification.
  5. Filtering non-Grand Archive orders (such as `pokemon_*` items) out of the **Pick List** and surfacing them in `nonGrandArchiveOrders` with their order link.
- **Prior Art**: Follows the exact in-memory Drizzle/libSQL + HTML fixture test patterns in `src/services/marketplace.test.ts` and `src/app/api/watchlist/__tests__/watchlist-api.test.ts`.

## Out of Scope

- Automatically mutating order status on MyP (such as firing `POST` requests to click *"Marcar em Separação"* or *"Confirmar envio"*).
- Automatically deducting sold cards from the Collector's personal **Binder** (`Owned Copy`) or **Store Listings** during Pick & Pack (MyP automatically decrements public store inventory upon sale, which is reconciled on the next **Store Sync**).
- Storing buyer `CPF`, legal names, or shipping addresses anywhere in the application or database.

## Further Notes

- All new UI strings in the web application must be registered simultaneously in both `en` and `pt-BR` dictionaries inside `@ga/contracts` (`ADR 0011`), keeping canonical English **Game Nomenclature** (`Norm`, `Fire`, `Water`, `Foil`, `Normal`) untouched.
