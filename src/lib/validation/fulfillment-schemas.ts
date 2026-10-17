import {
  RawMypFulfillmentOrderInput,
  RawMypOrderItemInput,
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

  return {
    success: true,
    data: {
      orderId: order.orderId.trim(),
      orderDate,
      buyerNick: order.buyerNick.trim(),
      shippingMethod,
      status,
      orderUrl,
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
