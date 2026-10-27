/**
 * Shared Fulfillment domain models and contracts for Grand Archive TCG Collector.
 */
export interface RawMypOrderItemInput {
    rawTitle: string;
    rawSubtitle?: string;
    mypCode: string;
    productUrl?: string | null;
    condition: string;
    language?: string;
    isFoil: boolean;
    quantity: number;
    unitPriceBrl: string;
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
    orderId: string;
    orderDate: string;
    buyerNick: string;
    shippingMethod: string;
    status: string;
    orderUrl: string;
    buyer?: PostalAddress;
    sender?: PostalAddress;
    totals?: OrderTotals;
    items: RawMypOrderItemInput[];
}
export interface EnrichedFulfillmentItem {
    itemKey: string;
    isGrandArchive: boolean;
    cardSlug: string | null;
    cardName: string;
    element: string;
    setPrefix: string;
    collectorNumber: string | null;
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
    primaryShippingMethod: string;
    orders: BuyerPackSubOrder[];
}
export interface NonGrandArchiveOrderNotice {
    orderId: string;
    orderDate: string;
    buyerNick: string;
    orderUrl: string;
    detectedTcg: string;
    itemCount: number;
}
export interface FulfillmentReport {
    generatedAt: number;
    totalGrandArchiveOrders: number;
    totalGrandArchiveCopies: number;
    pickListByElement: Record<string, PickListEntry[]>;
    buyerPacks: BuyerPackGroup[];
    nonGrandArchiveOrders: NonGrandArchiveOrderNotice[];
}
export declare const UNMATCHED_ELEMENT = "UNMATCHED";
export declare const CANONICAL_ELEMENT_ORDER: readonly string[];
export declare function createEmptyFulfillmentReport(): FulfillmentReport;
export declare function normalizeBuyerNick(nick: string): string;
export type FulfillmentOrderStatus = "open" | "processed" | "sent";
export type ShippingTicketStatus = "pending" | "released" | "posted" | "cancelled" | "unknown";
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
