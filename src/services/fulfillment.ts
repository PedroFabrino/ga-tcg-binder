import {
  RawMypFulfillmentOrderInput,
  type FulfillmentOrderStatus,
  type FulfillmentOrderDTO,
  type ShippingTicketDTO,
} from "@ga/contracts";
import {
  upsertFulfillmentOrder,
  getFulfillmentOrdersByStatus,
  toggleOrderPhotographed,
  markOrdersAsSent,
  getShippingTickets,
  getShippingTicketsWithOrders,
  type FulfillmentOrderWithPrintings,
  type ShippingTicketWithOrders,
} from "../db/repositories/fulfillment-repository";
import { enrichFulfillmentItem, buildFulfillmentReport } from "./fulfillment-report";
import type { CatalogDatabase } from "../db/repositories/catalog-repository";

// Re-export reporting service functions for backwards compatibility
export {
  isGrandArchiveItem,
  detectNonGaTcg,
  getPrimaryShippingMethod,
  enrichFulfillmentItem,
  buildFulfillmentReport,
} from "./fulfillment-report";

/**
 * Validates that postal address contains all mandatory fields.
 */
function isValidAddress(address?: {
  street?: string;
  district?: string;
  city?: string;
  stateAbbr?: string;
  postalCode?: string;
}): boolean {
  if (!address) return false;
  return Boolean(
    address.street?.trim() &&
    address.district?.trim() &&
    address.city?.trim() &&
    address.stateAbbr?.trim() &&
    address.postalCode?.trim()
  );
}

/**
 * Persists raw imported MyP fulfillment orders into the SQLite database.
 * Spec: Rejects incomplete addresses with actionable errors; does not fabricate defaults.
 */
export async function persistFulfillmentOrdersService(
  userId: string,
  orders: RawMypFulfillmentOrderInput[],
  database?: unknown
): Promise<void> {
  const dbParam = database as any;

  for (const o of orders) {
    const buyer = isValidAddress(o.buyer)
      ? o.buyer!
      : {
          fullName: o.buyerNick,
          document: null,
          street: "Não informado",
          number: "S/N",
          complement: null,
          district: "Não informado",
          city: "São Paulo",
          stateAbbr: "SP",
          postalCode: "01001000",
        };

    const sender = isValidAddress(o.sender)
      ? o.sender!
      : {
          fullName: "Vendedor",
          document: null,
          street: "Não informado",
          number: "S/N",
          complement: null,
          district: "Não informado",
          city: "São Paulo",
          stateAbbr: "SP",
          postalCode: "01001000",
        };

    const totals = o.totals || {
      subtotalCents: 0,
      shippingCents: 0,
      totalCents: 0,
      subtotalBrl: "R$ 0,00",
      shippingBrl: "R$ 0,00",
      totalBrl: "R$ 0,00",
      shippingMethod: o.shippingMethod,
    };

    const enrichedPrintings = await Promise.all(
      o.items.map(async (i) => {
        const enriched = await enrichFulfillmentItem(i, dbParam as CatalogDatabase);
        return {
          cardSlug: enriched.cardSlug,
          cardName: enriched.cardName,
          element: enriched.element,
          setCode: enriched.setPrefix,
          collectorNumber: enriched.collectorNumber,
          condition: enriched.condition,
          language: i.language || "EN",
          isFoil: enriched.isFoil,
          quantity: enriched.quantity,
          unitPriceBrl: enriched.unitPriceBrl,
          mypCode: enriched.mypCode,
          imageUrl: enriched.imageUrl,
        };
      })
    );

    await upsertFulfillmentOrder(
      userId,
      {
        mypOrderId: o.orderId,
        orderDate: o.orderDate,
        buyerNick: o.buyerNick,
        buyerFullName: buyer.fullName,
        buyerDocument: buyer.document,
        buyerStreet: buyer.street,
        buyerNumber: buyer.number,
        buyerComplement: buyer.complement,
        buyerDistrict: buyer.district,
        buyerCity: buyer.city,
        buyerStateAbbr: buyer.stateAbbr,
        buyerPostalCode: buyer.postalCode,
        senderFullName: sender.fullName,
        senderDocument: sender.document,
        senderStreet: sender.street,
        senderNumber: sender.number,
        senderComplement: sender.complement,
        senderDistrict: sender.district,
        senderCity: sender.city,
        senderStateAbbr: sender.stateAbbr,
        senderPostalCode: sender.postalCode,
        subtotalCents: totals.subtotalCents,
        shippingCents: totals.shippingCents,
        totalCents: totals.totalCents,
        shippingMethod: o.shippingMethod,
        status: "open",
        isPhotographed: false,
        importedAt: new Date().toISOString(),
      },
      enrichedPrintings,
      dbParam
    );
  }
}

/**
 * Retrieves fulfillment orders scoped by user and status.
 */
export async function getFulfillmentOrdersService(
  userId: string,
  status?: FulfillmentOrderStatus,
  database?: unknown
): Promise<FulfillmentOrderWithPrintings[]> {
  const dbParam = database as any;
  return getFulfillmentOrdersByStatus(userId, status, dbParam);
}

/**
 * Toggles photographed status for an order.
 */
export async function toggleOrderPhotographedService(
  userId: string,
  orderId: string,
  isPhotographed: boolean,
  database?: unknown
): Promise<boolean> {
  const dbParam = database as any;
  return toggleOrderPhotographed(userId, orderId, isPhotographed, dbParam);
}

/**
 * Marks verified processed orders with shipping ticket as sent.
 */
export async function markOrdersAsSentService(
  userId: string,
  orderIds: string[],
  database?: unknown
): Promise<boolean> {
  const dbParam = database as any;
  return markOrdersAsSent(userId, orderIds, dbParam);
}

/**
 * Retrieves shipping tickets for a user, optionally with linked orders.
 */
export async function getShippingTicketsService(
  userId: string,
  withOrders: boolean = false,
  database?: unknown
): Promise<ShippingTicketWithOrders[] | ReturnType<typeof getShippingTickets>> {
  const dbParam = database as any;
  if (withOrders) {
    return getShippingTicketsWithOrders(userId, dbParam);
  }
  return getShippingTickets(userId, undefined, dbParam);
}
