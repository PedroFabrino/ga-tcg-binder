import { db } from "../index";
import {
  fulfillmentOrders,
  fulfillmentOrderPrintings,
  shippingTickets,
  type FulfillmentOrderStatus,
} from "../schema";
import { eq, and, sql, desc, inArray } from "drizzle-orm";

export type FulfillmentOrderRow = typeof fulfillmentOrders.$inferSelect;
export type FulfillmentOrderInsert = typeof fulfillmentOrders.$inferInsert;
export type FulfillmentOrderPrintingRow = typeof fulfillmentOrderPrintings.$inferSelect;
export type FulfillmentOrderPrintingInsert = typeof fulfillmentOrderPrintings.$inferInsert;
export type ShippingTicketRow = typeof shippingTickets.$inferSelect;
export type ShippingTicketInsert = typeof shippingTickets.$inferInsert;

export interface FulfillmentOrderWithPrintings extends FulfillmentOrderRow {
  printings: FulfillmentOrderPrintingRow[];
}

export async function getFulfillmentOrdersByStatus(
  userId: string,
  status?: FulfillmentOrderStatus,
  database = db
): Promise<FulfillmentOrderWithPrintings[]> {
  const query = status
    ? and(eq(fulfillmentOrders.userId, userId), eq(fulfillmentOrders.status, status))
    : eq(fulfillmentOrders.userId, userId);

  const orders = await database
    .select()
    .from(fulfillmentOrders)
    .where(query)
    .orderBy(desc(fulfillmentOrders.createdAt));

  if (orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id);
  const printings = await database
    .select()
    .from(fulfillmentOrderPrintings)
    .where(sql`${fulfillmentOrderPrintings.fulfillmentOrderId} IN ${orderIds}`);

  const printingsByOrder = new Map<string, FulfillmentOrderPrintingRow[]>();
  for (const p of printings) {
    const list = printingsByOrder.get(p.fulfillmentOrderId) || [];
    list.push(p);
    printingsByOrder.set(p.fulfillmentOrderId, list);
  }

  return orders.map((order) => ({
    ...order,
    printings: printingsByOrder.get(order.id) || [],
  }));
}

export async function upsertFulfillmentOrder(
  userId: string,
  orderData: Omit<FulfillmentOrderInsert, "id" | "userId">,
  printingsData: Array<Omit<FulfillmentOrderPrintingInsert, "id" | "fulfillmentOrderId">>,
  database = db
): Promise<FulfillmentOrderWithPrintings> {
  const existing = await database
    .select()
    .from(fulfillmentOrders)
    .where(and(eq(fulfillmentOrders.userId, userId), eq(fulfillmentOrders.mypOrderId, orderData.mypOrderId)))
    .limit(1);

  let orderId: string;
  if (existing.length > 0) {
    orderId = existing[0].id;
    // Only update order details if not already sent
    if (existing[0].status !== "sent") {
      await database
        .update(fulfillmentOrders)
        .set({
          ...orderData,
          status: existing[0].status, // preserve status (processed stays processed)
          isPhotographed: existing[0].isPhotographed, // preserve photo checkbox
          shippingTicketId: existing[0].shippingTicketId,
          updatedAt: sql`(strftime('%s', 'now'))`,
        })
        .where(eq(fulfillmentOrders.id, orderId));
    }
  } else {
    orderId = crypto.randomUUID();
    await database.insert(fulfillmentOrders).values({
      ...orderData,
      id: orderId,
      userId,
      status: "open",
      isPhotographed: false,
    });
  }

  // Replace printings transactionally / idempotently
  await database
    .delete(fulfillmentOrderPrintings)
    .where(eq(fulfillmentOrderPrintings.fulfillmentOrderId, orderId));

  if (printingsData.length > 0) {
    const printingsToInsert = printingsData.map((p) => ({
      ...p,
      id: crypto.randomUUID(),
      fulfillmentOrderId: orderId,
    }));
    await database.insert(fulfillmentOrderPrintings).values(printingsToInsert);
  }

  const [finalOrder] = await database
    .select()
    .from(fulfillmentOrders)
    .where(eq(fulfillmentOrders.id, orderId))
    .limit(1);

  const finalPrintings = await database
    .select()
    .from(fulfillmentOrderPrintings)
    .where(eq(fulfillmentOrderPrintings.fulfillmentOrderId, orderId));

  return {
    ...finalOrder,
    printings: finalPrintings,
  };
}

export async function toggleOrderPhotographed(
  userId: string,
  orderId: string,
  isPhotographed: boolean,
  database = db
): Promise<boolean> {
  await database
    .update(fulfillmentOrders)
    .set({
      isPhotographed,
      updatedAt: sql`(strftime('%s', 'now'))`,
    })
    .where(and(eq(fulfillmentOrders.id, orderId), eq(fulfillmentOrders.userId, userId)));

  return true;
}

export async function getShippingTickets(
  userId: string,
  status?: string,
  database = db
): Promise<ShippingTicketRow[]> {
  const query = status
    ? and(eq(shippingTickets.userId, userId), eq(shippingTickets.status, status))
    : eq(shippingTickets.userId, userId);

  return database
    .select()
    .from(shippingTickets)
    .where(query)
    .orderBy(desc(shippingTickets.createdAt));
}

export async function createShippingTicketWithOrders(
  userId: string,
  ticketData: Omit<ShippingTicketInsert, "id" | "userId">,
  orderIds: string[],
  database = db
): Promise<ShippingTicketRow> {
  const ticketId = crypto.randomUUID();
  await database.insert(shippingTickets).values({
    ...ticketData,
    id: ticketId,
    userId,
    status: ticketData.status || "pending",
  });

  if (orderIds.length > 0) {
    await database
      .update(fulfillmentOrders)
      .set({
        status: "processed",
        shippingTicketId: ticketId,
        updatedAt: sql`(strftime('%s', 'now'))`,
      })
      .where(and(eq(fulfillmentOrders.userId, userId), inArray(fulfillmentOrders.id, orderIds)));
  }

  const [ticket] = await database
    .select()
    .from(shippingTickets)
    .where(eq(shippingTickets.id, ticketId))
    .limit(1);

  return ticket;
}

