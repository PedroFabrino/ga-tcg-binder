import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users } from "./schema";

export type FulfillmentOrderStatus = "open" | "processed" | "sent";
export type ShippingTicketStatus = "pending" | "released" | "posted" | "unknown";
export type CarrierCode = "correios" | "loggi" | "jadlog" | "outro";

export const fulfillmentOrders = sqliteTable("fulfillment_orders", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  mypOrderId: text("myp_order_id").notNull(),
  orderDate: text("order_date").notNull(),
  buyerNick: text("buyer_nick").notNull(),
  buyerFullName: text("buyer_full_name").notNull(),
  buyerDocument: text("buyer_document"),
  buyerStreet: text("buyer_street").notNull(),
  buyerNumber: text("buyer_number").notNull(),
  buyerComplement: text("buyer_complement"),
  buyerDistrict: text("buyer_district").notNull(),
  buyerCity: text("buyer_city").notNull(),
  buyerStateAbbr: text("buyer_state_abbr").notNull(),
  buyerPostalCode: text("buyer_postal_code").notNull(),
  senderFullName: text("sender_full_name").notNull(),
  senderDocument: text("sender_document"),
  senderStreet: text("sender_street").notNull(),
  senderNumber: text("sender_number").notNull(),
  senderComplement: text("sender_complement"),
  senderDistrict: text("sender_district").notNull(),
  senderCity: text("sender_city").notNull(),
  senderStateAbbr: text("sender_state_abbr").notNull(),
  senderPostalCode: text("sender_postal_code").notNull(),
  subtotalCents: integer("subtotal_cents").notNull(),
  shippingCents: integer("shipping_cents").notNull(),
  totalCents: integer("total_cents").notNull(),
  shippingMethod: text("shipping_method"),
  status: text("status").notNull().default("open"), // 'open' | 'processed' | 'sent'
  isPhotographed: integer("is_photographed", { mode: "boolean" }).notNull().default(false),
  shippingTicketId: text("shipping_ticket_id"),
  mypConfirmedAt: text("myp_confirmed_at"),
  importedAt: text("imported_at").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  userOrderUnique: uniqueIndex("fulfillment_orders_user_order_idx").on(table.userId, table.mypOrderId),
}));

export const fulfillmentOrderPrintings = sqliteTable("fulfillment_order_printings", {
  id: text("id").primaryKey(),
  fulfillmentOrderId: text("fulfillment_order_id").notNull().references(() => fulfillmentOrders.id, { onDelete: "cascade" }),
  cardSlug: text("card_slug"),
  cardName: text("card_name").notNull(),
  element: text("element").notNull().default("UNMATCHED"),
  setCode: text("set_code"),
  collectorNumber: text("collector_number"),
  condition: text("condition").notNull().default("NM"),
  language: text("language").notNull().default("EN"),
  isFoil: integer("is_foil", { mode: "boolean" }).notNull().default(false),
  quantity: integer("quantity").notNull().default(1),
  unitPriceBrl: text("unit_price_brl").notNull().default("R$ 0,00"),
  mypCode: text("myp_code").notNull(),
  imageUrl: text("image_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

export const shippingTickets = sqliteTable("shipping_tickets", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  superfreteOrderId: text("superfrete_order_id").notNull(),
  buyerNick: text("buyer_nick").notNull(),
  status: text("status").notNull().default("pending"), // 'pending' | 'released' | 'posted' | 'unknown'
  carrier: text("carrier").notNull(), // 'correios' | 'loggi' | 'jadlog' | 'outro'
  serviceCode: text("service_code").notNull(),
  serviceName: text("service_name").notNull(),
  quotedPriceCents: integer("quoted_price_cents"),
  insuranceValueCents: integer("insurance_value_cents").notNull(),
  trackingCode: text("tracking_code"),
  printUrl: text("print_url"),
  providerPayloadJson: text("provider_payload_json"),
  synchronizedAt: text("synchronized_at"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  userTicketUnique: uniqueIndex("shipping_tickets_user_ticket_idx").on(table.userId, table.superfreteOrderId),
}));
