/**
 * Shared Fulfillment domain models and contracts for Grand Archive TCG Collector.
 */

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

export interface PickListOrderRef {
  orderId: string;
  buyerNick: string;
  quantity: number;
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
  orderReferences: PickListOrderRef[];
}

export interface BuyerPackSubOrder {
  orderId: string;
  orderDate: string;
  shippingMethod: string;
  status: string;
  orderUrl: string;
  items: EnrichedFulfillmentItem[];
}

export interface BuyerPackGroup {
  buyerNick: string;
  totalOrders: number;
  totalItems: number;
  shippingMethods: string[];
  primaryShippingMethod: string; // Prioritizes paid/tracked methods (PAC, Sedex, Frete Fixo) over "Frete combinado"
  orders: BuyerPackSubOrder[];
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

export const UNMATCHED_ELEMENT = "UNMATCHED";

export const CANONICAL_ELEMENT_ORDER: readonly string[] = [
  "Norm",
  "Fire",
  "Water",
  "Wind",
  "Tera",
  "Crux",
  "Umbra",
  "Luxem",
  "Exalted",
  "Astra",
  "Exia",
  "Arcane",
  "Neos",
  UNMATCHED_ELEMENT,
] as const;
