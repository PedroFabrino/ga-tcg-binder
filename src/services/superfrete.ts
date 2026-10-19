import {
  getFulfillmentOrdersByStatus,
  createShippingTicketWithOrders,
  type FulfillmentOrderWithPrintings,
} from "@/db/repositories/fulfillment-repository";
import { getUserById } from "@/db/repositories/settings-repository";
import { normalizeBuyerNick } from "@ga/contracts";
import { decryptSecret } from "@/lib/crypto";
import {
  A4_ENVELOPE_PACKAGE,
  fetchSuperfreteQuotes,
  createSuperfreteCartOrder,
  type SuperfreteCalculatorQuote,
} from "./superfrete-client";

export { A4_ENVELOPE_PACKAGE, type SuperfreteCalculatorQuote };

export interface SuperfreteProductLine {
  name: string;
  quantity: number;
  unitary_value: number;
}

export interface QuotedBuyerPack {
  buyerNick: string;
  orderIds: string[];
  ordersCount: number;
  isReadyForShipping: boolean;
  containsUnphotographedOrders: boolean;
  recipient: {
    fullName: string;
    document: string | null;
    street: string;
    number: string;
    complement: string | null;
    district: string;
    city: string;
    stateAbbr: string;
    postalCode: string;
  };
  insuranceValueBrl: number;
  totalCards: number;
  quotes: SuperfreteCalculatorQuote[];
  recommendedQuote: SuperfreteCalculatorQuote | null;
  selectedServiceCode: string | null;
  errorMessage?: string | null;
}

export interface CreateShippingTicketRequest {
  buyerNick: string;
  selectedServiceCode: string;
  selectedServiceName?: string;
  quotedPriceBrl?: number;
}

export function toCarrierCode(
  serviceId: number | string,
  companyName?: string
): "loggi" | "jadlog" | "correios" | "outro" {
  const idStr = String(serviceId);
  const comp = (companyName || "").toLowerCase();
  if (idStr === "31" || comp.includes("loggi")) return "loggi";
  if (idStr === "3" || comp.includes("jadlog")) return "jadlog";
  if (idStr === "1" || idStr === "2" || idStr === "17" || comp.includes("correios")) {
    return "correios";
  }
  return "outro";
}

export function calculateInsuranceValue(
  subtotalCents: number,
  shippingCents: number,
  serviceCode?: string | number
): number {
  const rawBrl = Number(((subtotalCents + shippingCents) / 100).toFixed(2));
  const sCode = serviceCode !== undefined ? String(serviceCode) : undefined;

  if (sCode === "1" || sCode === "2") {
    return Math.max(rawBrl, 24.5);
  }
  if (sCode === "17") {
    return Math.max(rawBrl, 12.25);
  }
  if (sCode === "3" || sCode === "31") {
    return Math.max(rawBrl, 1.0);
  }

  return Math.max(rawBrl, 24.5);
}

function quotePrice(q: SuperfreteCalculatorQuote): number {
  return typeof q.price === "number" ? q.price : parseFloat(String(q.price)) || 0;
}

const quotePriceAscending = (a: SuperfreteCalculatorQuote, b: SuperfreteCalculatorQuote): number =>
  quotePrice(a) - quotePrice(b);

export function selectBestCarrierQuote(
  quotes: SuperfreteCalculatorQuote[]
): SuperfreteCalculatorQuote | null {
  const validQuotes = quotes.filter((q) => {
    if (q.has_error) return false;
    const priceNum = quotePrice(q);
    return !isNaN(priceNum) && priceNum > 0;
  });

  if (validQuotes.length === 0) return null;

  // 1. Preferred group: Loggi (31) and Jadlog (3)
  const preferred = validQuotes.filter((q) => {
    const carrier = toCarrierCode(q.id, q.company?.name);
    return carrier === "loggi" || carrier === "jadlog";
  });

  if (preferred.length > 0) {
    preferred.sort(quotePriceAscending);
    return preferred[0];
  }

  // 2. Fallback group: Correios (1, 2, 17)
  const fallback = validQuotes.filter((q) => {
    const carrier = toCarrierCode(q.id, q.company?.name);
    return carrier === "correios";
  });

  if (fallback.length > 0) {
    fallback.sort(quotePriceAscending);
    return fallback[0];
  }

  validQuotes.sort(quotePriceAscending);
  return validQuotes[0];
}

export function buildSuperfreteProducts(
  items: Array<{ cardName: string; quantity: number }>,
  insuranceBrl: number
): SuperfreteProductLine[] {
  const totalCents = Math.round(insuranceBrl * 100);

  if (!items || items.length === 0) {
    return [
      {
        name: "Cards Colecionáveis Grand Archive",
        quantity: 1,
        unitary_value: Number((totalCents / 100).toFixed(2)),
      },
    ];
  }

  const units: string[] = [];
  for (const item of items) {
    const qty = Math.max(1, item.quantity || 1);
    for (let i = 0; i < qty; i++) {
      units.push(item.cardName || "Card Grand Archive");
    }
  }

  if (units.length === 0) {
    return [
      {
        name: "Cards Colecionáveis Grand Archive",
        quantity: 1,
        unitary_value: Number((totalCents / 100).toFixed(2)),
      },
    ];
  }

  const totalCount = units.length;
  const baseCentsPerUnit = Math.floor(totalCents / totalCount);
  const remainderCents = totalCents % totalCount;

  const unitCents: number[] = [];
  for (let i = 0; i < totalCount; i++) {
    unitCents.push(baseCentsPerUnit + (i < remainderCents ? 1 : 0));
  }

  const grouped = new Map<string, { name: string; quantity: number; unitCents: number }>();
  for (let i = 0; i < totalCount; i++) {
    const name = units[i];
    const cents = unitCents[i];
    const key = `${name}:::${cents}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += 1;
    } else {
      grouped.set(key, { name, quantity: 1, unitCents: cents });
    }
  }

  return Array.from(grouped.values()).map((g) => ({
    name: g.name,
    quantity: g.quantity,
    unitary_value: Number((g.unitCents / 100).toFixed(2)),
  }));
}

export async function quoteOpenBuyerPacksService(
  userId: string,
  database?: unknown,
  customFetch: typeof fetch = fetch
): Promise<QuotedBuyerPack[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- repository parameter
  const dbParam = database as any;
  const user = await getUserById(userId, dbParam);
  if (!user?.superfreteApiKeyEncrypted) {
    throw new Error("SUPERFRETE_API_KEY_NOT_CONFIGURED");
  }

  const apiToken = decryptSecret(user.superfreteApiKeyEncrypted);
  const openOrders = await getFulfillmentOrdersByStatus(userId, "open", dbParam);
  if (openOrders.length === 0) return [];

  const packsMap = new Map<string, { buyerNick: string; orders: FulfillmentOrderWithPrintings[] }>();
  for (const o of openOrders) {
    const key = normalizeBuyerNick(o.buyerNick);
    const existing = packsMap.get(key);
    if (existing) {
      existing.orders.push(o);
    } else {
      packsMap.set(key, { buyerNick: o.buyerNick, orders: [o] });
    }
  }

  const result: QuotedBuyerPack[] = [];

  for (const { buyerNick, orders } of packsMap.values()) {
    const subtotalCents = orders.reduce((sum, o) => sum + o.subtotalCents, 0);
    const shippingCents = orders.reduce((sum, o) => sum + o.shippingCents, 0);
    const insuranceValueBrl = calculateInsuranceValue(subtotalCents, shippingCents);
    const totalCards = orders.reduce(
      (sum, o) => sum + o.printings.reduce((s, p) => s + p.quantity, 0),
      0
    );

    const isReadyForShipping = orders.every((o) => o.isPhotographed);
    const containsUnphotographedOrders = orders.some((o) => !o.isPhotographed);
    const primaryOrder = orders[0];

    let quotes: SuperfreteCalculatorQuote[] = [];
    let recommendedQuote: SuperfreteCalculatorQuote | null = null;
    let errorMessage: string | null = null;

    try {
      quotes = await fetchSuperfreteQuotes(
        apiToken,
        primaryOrder.senderPostalCode,
        primaryOrder.buyerPostalCode,
        insuranceValueBrl,
        customFetch
      );
      recommendedQuote = selectBestCarrierQuote(quotes);
    } catch (e: unknown) {
      errorMessage = e instanceof Error ? e.message : "Error quoting shipping";
    }

    result.push({
      buyerNick,
      orderIds: orders.map((o) => o.id),
      ordersCount: orders.length,
      isReadyForShipping,
      containsUnphotographedOrders,
      recipient: {
        fullName: primaryOrder.buyerFullName,
        document: primaryOrder.buyerDocument,
        street: primaryOrder.buyerStreet,
        number: primaryOrder.buyerNumber,
        complement: primaryOrder.buyerComplement,
        district: primaryOrder.buyerDistrict,
        city: primaryOrder.buyerCity,
        stateAbbr: primaryOrder.buyerStateAbbr,
        postalCode: primaryOrder.buyerPostalCode,
      },
      insuranceValueBrl,
      totalCards,
      quotes,
      recommendedQuote,
      selectedServiceCode: recommendedQuote ? String(recommendedQuote.id) : null,
      errorMessage,
    });
  }

  return result;
}

export async function createShippingTicketsService(
  userId: string,
  packsToCreate: CreateShippingTicketRequest[],
  database?: unknown,
  customFetch: typeof fetch = fetch
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- repository parameter
  const dbParam = database as any;
  const user = await getUserById(userId, dbParam);
  if (!user?.superfreteApiKeyEncrypted) {
    throw new Error("SUPERFRETE_API_KEY_NOT_CONFIGURED");
  }

  const apiToken = decryptSecret(user.superfreteApiKeyEncrypted);
  const openOrders = await getFulfillmentOrdersByStatus(userId, "open", dbParam);

  const packsMap = new Map<string, { buyerNick: string; orders: FulfillmentOrderWithPrintings[] }>();
  for (const o of openOrders) {
    const key = normalizeBuyerNick(o.buyerNick);
    const existing = packsMap.get(key);
    if (existing) {
      existing.orders.push(o);
    } else {
      packsMap.set(key, { buyerNick: o.buyerNick, orders: [o] });
    }
  }

  const createdTickets = [];
  const errors: string[] = [];

  for (const packReq of packsToCreate) {
    const pack = packsMap.get(normalizeBuyerNick(packReq.buyerNick));
    if (!pack || pack.orders.length === 0) continue;
    const orders = pack.orders;

    try {
      const primaryOrder = orders[0];
      const subtotalCents = orders.reduce((sum, o) => sum + o.subtotalCents, 0);
      const shippingCents = orders.reduce((sum, o) => sum + o.shippingCents, 0);
      const insuranceValueBrl = calculateInsuranceValue(
        subtotalCents,
        shippingCents,
        packReq.selectedServiceCode
      );

      const allPrintings = orders.flatMap((o) => o.printings);
      const products = buildSuperfreteProducts(allPrintings, insuranceValueBrl);

      const carrier = toCarrierCode(packReq.selectedServiceCode, packReq.selectedServiceName);
      const serviceName = packReq.selectedServiceName || `Service ${packReq.selectedServiceCode}`;

      const cartPayload = {
        from: {
          name: primaryOrder.senderFullName,
          ...(primaryOrder.senderDocument ? { document: primaryOrder.senderDocument.replace(/\D/g, "") } : {}),
          postal_code: primaryOrder.senderPostalCode.replace(/\D/g, ""),
          address: primaryOrder.senderStreet,
          number: primaryOrder.senderNumber,
          complement: primaryOrder.senderComplement || "",
          district: primaryOrder.senderDistrict,
          city: primaryOrder.senderCity,
          state_abbr: primaryOrder.senderStateAbbr.trim().toUpperCase(),
          state_code: primaryOrder.senderStateAbbr.trim().toUpperCase(),
        },
        to: {
          name: primaryOrder.buyerFullName,
          ...(primaryOrder.buyerDocument ? { document: primaryOrder.buyerDocument.replace(/\D/g, "") } : {}),
          postal_code: primaryOrder.buyerPostalCode.replace(/\D/g, ""),
          address: primaryOrder.buyerStreet,
          number: primaryOrder.buyerNumber,
          complement: primaryOrder.buyerComplement || "",
          district: primaryOrder.buyerDistrict,
          city: primaryOrder.buyerCity,
          state_abbr: primaryOrder.buyerStateAbbr.trim().toUpperCase(),
          state_code: primaryOrder.buyerStateAbbr.trim().toUpperCase(),
        },
        service: Number(packReq.selectedServiceCode),
        package: A4_ENVELOPE_PACKAGE,
        volumes: [A4_ENVELOPE_PACKAGE],
        options: {
          non_commercial: true,
          own_hand: false,
          receipt: false,
          insurance_value: insuranceValueBrl,
        },
        products,
        platform: "GA TCG Binder",
      };

      const cartResponse = await createSuperfreteCartOrder(apiToken, cartPayload, customFetch);

      const orderIds = orders.map((o) => o.id);
      const quotedPriceCents = packReq.quotedPriceBrl
        ? Math.round(packReq.quotedPriceBrl * 100)
        : cartResponse.price
        ? Math.round(Number(cartResponse.price) * 100)
        : null;

      const ticket = await createShippingTicketWithOrders(
        userId,
        {
          superfreteOrderId: String(cartResponse.id),
          buyerNick: packReq.buyerNick,
          status: "pending",
          carrier,
          serviceCode: packReq.selectedServiceCode,
          serviceName,
          quotedPriceCents,
          insuranceValueCents: Math.round(insuranceValueBrl * 100),
          providerPayloadJson: JSON.stringify(cartResponse),
        },
        orderIds,
        dbParam
      );

      createdTickets.push(ticket);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error creating ticket in Superfrete";
      errors.push(`${packReq.buyerNick}: ${msg}`);
    }
  }

  if (createdTickets.length === 0 && errors.length > 0) {
    throw new Error(errors.join(" | "));
  }

  return createdTickets;
}
