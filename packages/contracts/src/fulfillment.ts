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

export interface PostalAddress {
  fullName: string;
  document: string | null;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  stateAbbr: string;
  postalCode: string;
}

export interface OrderTotals {
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  subtotalBrl: string;
  shippingBrl: string;
  totalBrl: string;
  shippingMethod: string | null;
}

export interface RawMypFulfillmentOrderInput {
  orderId: string;           // e.g. "654326"
  orderDate: string;         // e.g. "17/10/2026"
  buyerNick: string;         // e.g. "Betinho3"
  shippingMethod: string;    // e.g. "Frete combinado com o vendedor" | "PAC"
  status: string;            // e.g. "Aguard. envio" | "Em separação"
  orderUrl: string;          // e.g. "https://mypcards.com/pedido/654326"
  buyer?: PostalAddress;
  sender?: PostalAddress;
  totals?: OrderTotals;
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

export function normalizeBuyerNick(nick: string): string {
  return nick.trim().replace(/\s+/g, " ").toLowerCase();
}

export type FulfillmentOrderStatus = "open" | "processed" | "sent";

export type ShippingTicketStatus =
  | "pending"
  | "released"
  | "posted"
  | "unknown";

export type CarrierCode = "correios" | "loggi" | "jadlog" | "outro";

export interface FulfillmentPrintingDTO {
  id: string;
  fulfillmentOrderId: string;
  printingId: string | null;
  cardName: string;
  setCode: string | null;
  collectorNumber: string | null;
  cardCondition: string | null;
  language: string | null;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface FulfillmentOrderDTO {
  id: string;
  userId: string;
  mypOrderId: string;
  orderDate: string;
  buyerNick: string;
  buyerFullName: string;
  buyerDocument: string | null;
  buyerStreet: string;
  buyerNumber: string;
  buyerComplement: string | null;
  buyerDistrict: string;
  buyerCity: string;
  buyerStateAbbr: string;
  buyerPostalCode: string;
  senderFullName: string;
  senderDocument: string | null;
  senderStreet: string;
  senderNumber: string;
  senderComplement: string | null;
  senderDistrict: string;
  senderCity: string;
  senderStateAbbr: string;
  senderPostalCode: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  shippingMethod: string | null;
  status: FulfillmentOrderStatus;
  isPhotographed: boolean;
  shippingTicketId: string | null;
  mypConfirmedAt: string | null;
  importedAt: string;
  createdAt: string;
  updatedAt: string;
  printings: FulfillmentPrintingDTO[];
}

export interface ShippingTicketDTO {
  id: string;
  userId: string;
  superfreteOrderId: string;
  buyerNick: string;
  status: ShippingTicketStatus;
  carrier: CarrierCode;
  serviceCode: string;
  serviceName: string;
  quotedPriceCents: number | null;
  insuranceValueCents: number;
  trackingCode: string | null;
  printUrl: string | null;
  providerPayloadJson: string | null;
  synchronizedAt: string | null;
  createdAt: string;
  updatedAt: string;
  orders?: FulfillmentOrderDTO[];
}
