import {
  RawMypFulfillmentOrderInput,
  RawMypOrderItemInput,
  PostalAddress,
  OrderTotals,
} from "@ga/contracts";

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function parseOrderItem(raw: unknown, index: number): ValidationResult<RawMypOrderItemInput> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { success: false, error: `Item at index ${index} must be an object` };
  }
  const item = raw as Record<string, unknown>;

  if (typeof item.rawTitle !== "string" || !item.rawTitle.trim()) {
    return { success: false, error: `Item at index ${index} must have a non-empty rawTitle string` };
  }
  if (typeof item.mypCode !== "string" || !item.mypCode.trim()) {
    return { success: false, error: `Item at index ${index} must have a non-empty mypCode string` };
  }

  const rawSubtitle = typeof item.rawSubtitle === "string" ? item.rawSubtitle : undefined;
  const productUrl = typeof item.productUrl === "string" ? item.productUrl : null;
  const condition = typeof item.condition === "string" && item.condition.trim() ? item.condition.trim().toUpperCase() : "NM";
  const language = typeof item.language === "string" ? item.language.trim().toUpperCase() : "EN";
  const isFoil = Boolean(item.isFoil);
  const quantity = typeof item.quantity === "number" && !isNaN(item.quantity) && item.quantity > 0 ? Math.floor(item.quantity) : 1;
  const unitPriceBrl = typeof item.unitPriceBrl === "string" ? item.unitPriceBrl : "R$ 0,00";

  return {
    success: true,
    data: {
      rawTitle: item.rawTitle.trim(),
      rawSubtitle,
      mypCode: item.mypCode.trim(),
      productUrl,
      condition,
      language,
      isFoil,
      quantity,
      unitPriceBrl,
    },
  };
}

function parsePostalAddress(raw: unknown): PostalAddress | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const a = raw as Record<string, unknown>;
  if (
    typeof a.fullName !== "string" ||
    typeof a.street !== "string" ||
    typeof a.number !== "string" ||
    typeof a.district !== "string" ||
    typeof a.city !== "string" ||
    typeof a.stateAbbr !== "string" ||
    typeof a.postalCode !== "string"
  ) {
    return undefined;
  }
  return {
    fullName: a.fullName.trim(),
    document: typeof a.document === "string" ? a.document.trim() : null,
    street: a.street.trim(),
    number: a.number.trim(),
    complement: typeof a.complement === "string" ? a.complement.trim() : null,
    district: a.district.trim(),
    city: a.city.trim(),
    stateAbbr: a.stateAbbr.trim().toUpperCase().slice(0, 2),
    postalCode: a.postalCode.replace(/\D/g, ""),
  };
}

function parseOrderTotals(raw: unknown): OrderTotals | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const t = raw as Record<string, unknown>;
  if (
    typeof t.subtotalCents !== "number" ||
    typeof t.shippingCents !== "number" ||
    typeof t.totalCents !== "number"
  ) {
    return undefined;
  }
  return {
    subtotalCents: t.subtotalCents,
    shippingCents: t.shippingCents,
    totalCents: t.totalCents,
    subtotalBrl: typeof t.subtotalBrl === "string" ? t.subtotalBrl : `R$ ${(t.subtotalCents / 100).toFixed(2)}`,
    shippingBrl: typeof t.shippingBrl === "string" ? t.shippingBrl : `R$ ${(t.shippingCents / 100).toFixed(2)}`,
    totalBrl: typeof t.totalBrl === "string" ? t.totalBrl : `R$ ${(t.totalCents / 100).toFixed(2)}`,
    shippingMethod: typeof t.shippingMethod === "string" ? t.shippingMethod : null,
  };
}

function parseFulfillmentOrder(raw: unknown, index: number): ValidationResult<RawMypFulfillmentOrderInput> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { success: false, error: `Order at index ${index} must be an object` };
  }
  const order = raw as Record<string, unknown>;

  if (typeof order.orderId !== "string" || !order.orderId.trim()) {
    return { success: false, error: `Order at index ${index} must have a non-empty orderId string` };
  }
  if (typeof order.buyerNick !== "string" || !order.buyerNick.trim()) {
    return { success: false, error: `Order at index ${index} must have a non-empty buyerNick string` };
  }
  if (!Array.isArray(order.items)) {
    return { success: false, error: `Order at index ${index} must have an items array` };
  }

  const items: RawMypOrderItemInput[] = [];
  for (let i = 0; i < order.items.length; i++) {
    const itemRes = parseOrderItem(order.items[i], i);
    if (!itemRes.success) return itemRes;
    items.push(itemRes.data);
  }

  const orderDate = typeof order.orderDate === "string" && order.orderDate.trim()
    ? order.orderDate.trim()
    : new Date().toLocaleDateString("pt-BR");
  const shippingMethod = typeof order.shippingMethod === "string" && order.shippingMethod.trim()
    ? order.shippingMethod.trim()
    : "Padrão";
  const status = typeof order.status === "string" && order.status.trim()
    ? order.status.trim()
    : "Aguard. envio";
  const orderUrl = typeof order.orderUrl === "string" && order.orderUrl.trim()
    ? order.orderUrl.trim()
    : `https://mypcards.com/pedido/${order.orderId}`;

  const buyer = parsePostalAddress(order.buyer);
  const sender = parsePostalAddress(order.sender);
  const totals = parseOrderTotals(order.totals);

  return {
    success: true,
    data: {
      orderId: order.orderId.trim(),
      orderDate,
      buyerNick: order.buyerNick.trim(),
      shippingMethod,
      status,
      orderUrl,
      buyer,
      sender,
      totals,
      items,
    },
  };
}

export function parseFulfillmentRequest(input: unknown): ValidationResult<RawMypFulfillmentOrderInput[]> {
  if (!input) {
    return { success: false, error: "Request body cannot be empty" };
  }

  let rawList: unknown[] = [];
  if (Array.isArray(input)) {
    rawList = input;
  } else if (typeof input === "object" && input !== null) {
    const obj = input as Record<string, unknown>;
    if (Array.isArray(obj.orders)) {
      rawList = obj.orders;
    } else {
      return { success: false, error: "Payload must be an array of orders or an object with an 'orders' array" };
    }
  } else {
    return { success: false, error: "Invalid payload format" };
  }

  if (rawList.length === 0) {
    return { success: true, data: [] };
  }

  const orders: RawMypFulfillmentOrderInput[] = [];
  for (let i = 0; i < rawList.length; i++) {
    const orderRes = parseFulfillmentOrder(rawList[i], i);
    if (!orderRes.success) return orderRes;
    orders.push(orderRes.data);
  }

  return { success: true, data: orders };
}

export interface ConfirmSentInput {
  orderIds?: string[];
  orderId?: string;
}

export function safeParseConfirmSentInput(input: unknown): ValidationResult<ConfirmSentInput> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { success: false, error: "Payload must be an object" };
  }
  const obj = input as Record<string, unknown>;
  const orderIds = Array.isArray(obj.orderIds) && obj.orderIds.every((id) => typeof id === "string")
    ? (obj.orderIds as string[])
    : undefined;
  const orderId = typeof obj.orderId === "string" ? obj.orderId : undefined;
  return { success: true, data: { orderIds, orderId } };
}

export interface TogglePhotographedInput {
  orderId: string;
  isPhotographed: boolean;
}

export function safeParseTogglePhotographedInput(input: unknown): ValidationResult<TogglePhotographedInput> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { success: false, error: "Payload must be an object" };
  }
  const obj = input as Record<string, unknown>;
  if (typeof obj.orderId !== "string" || !obj.orderId.trim()) {
    return { success: false, error: "orderId must be a non-empty string" };
  }
  if (typeof obj.isPhotographed !== "boolean") {
    return { success: false, error: "isPhotographed must be a boolean" };
  }
  return { success: true, data: { orderId: obj.orderId.trim(), isPhotographed: obj.isPhotographed } };
}

export interface CreateTicketsPackItem {
  buyerNick: string;
  selectedServiceCode: string;
  quotedPriceBrl?: number;
}

export interface CreateTicketsInput {
  packs: CreateTicketsPackItem[];
}

export function safeParseCreateTicketsInput(input: unknown): ValidationResult<CreateTicketsInput> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { success: false, error: "Payload must be an object" };
  }
  const obj = input as Record<string, unknown>;
  if (!Array.isArray(obj.packs) || obj.packs.length === 0) {
    return { success: false, error: "packs array must not be empty" };
  }
  const packs: CreateTicketsPackItem[] = [];
  for (let i = 0; i < obj.packs.length; i++) {
    const item = obj.packs[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { success: false, error: `Pack at index ${i} must be an object` };
    }
    const p = item as Record<string, unknown>;
    if (typeof p.buyerNick !== "string" || !p.buyerNick.trim()) {
      return { success: false, error: `Pack at index ${i} must have a non-empty buyerNick` };
    }
    if (typeof p.selectedServiceCode !== "string" || !p.selectedServiceCode.trim()) {
      return { success: false, error: `Pack at index ${i} must have a non-empty selectedServiceCode` };
    }
    const quotedPriceBrl = typeof p.quotedPriceBrl === "number" && !isNaN(p.quotedPriceBrl) ? p.quotedPriceBrl : undefined;
    packs.push({
      buyerNick: p.buyerNick.trim(),
      selectedServiceCode: p.selectedServiceCode.trim(),
      quotedPriceBrl,
    });
  }
  return { success: true, data: { packs } };
}
