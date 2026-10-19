import {
  getFulfillmentOrdersByStatus,
  createShippingTicketWithOrders,
  getShippingTicketById,
  cancelShippingTicketById,
  updateFulfillmentOrdersBuyerDocument,
  type FulfillmentOrderWithPrintings,
  type ShippingTicketRow,
} from "@/db/repositories/fulfillment-repository";
import { getUserById } from "@/db/repositories/settings-repository";
import { normalizeBuyerNick } from "@ga/contracts";
import { decryptSecret } from "@/lib/crypto";
import {
  A4_ENVELOPE_PACKAGE,
  fetchSuperfreteQuotes,
  createSuperfreteCartOrder,
  cancelSuperfreteOrder,
  type SuperfreteCalculatorQuote,
} from "./superfrete-client";

import {
  sanitizeName,
  toCarrierCode,
  calculateInsuranceValue,
  selectBestCarrierQuote,
  buildSuperfreteProducts,
  calculatePackageWeightKg,
  buildPackageVolume,
  type SuperfreteProductLine,
  type ShippingPackageConfig,
} from "./superfrete-helpers";

export {
  A4_ENVELOPE_PACKAGE,
  type SuperfreteCalculatorQuote,
  sanitizeName,
  toCarrierCode,
  calculateInsuranceValue,
  selectBestCarrierQuote,
  buildSuperfreteProducts,
  calculatePackageWeightKg,
  buildPackageVolume,
  type SuperfreteProductLine,
};

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
  packageWeightKg: number;
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
  recipientDocument?: string;
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
    const userPackageConfig: ShippingPackageConfig = {
      heightCm: user.shippingPackageHeight ?? undefined,
      widthCm: user.shippingPackageWidth ?? undefined,
      lengthCm: user.shippingPackageLength ?? undefined,
      baseWeightG: user.shippingPackageBaseWeight ?? undefined,
      tapeWeightG: user.shippingPackageTapeWeight ?? undefined,
      cardWeightG: user.shippingCardWeight ?? undefined,
    };
    const packageVolume = buildPackageVolume(totalCards, userPackageConfig);

    let quotes: SuperfreteCalculatorQuote[] = [];
    let recommendedQuote: SuperfreteCalculatorQuote | null = null;
    let errorMessage: string | null = null;

    try {
      quotes = await fetchSuperfreteQuotes(
        apiToken,
        primaryOrder.senderPostalCode,
        primaryOrder.buyerPostalCode,
        insuranceValueBrl,
        customFetch,
        packageVolume
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
      packageWeightKg: packageVolume.weight,
      quotes,
      recommendedQuote,
      selectedServiceCode: recommendedQuote ? String(recommendedQuote.id) : null,
      errorMessage,
    });
  }

  return result;
}

export interface CreateShippingTicketError {
  buyerNick: string;
  error: string;
}

export interface CreateShippingTicketsResult {
  tickets: ShippingTicketRow[];
  errors: CreateShippingTicketError[];
}

export async function createShippingTicketsService(
  userId: string,
  packsToCreate: CreateShippingTicketRequest[],
  database?: unknown,
  customFetch: typeof fetch = fetch
): Promise<CreateShippingTicketsResult> {
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

  const createdTickets: ShippingTicketRow[] = [];
  const errors: CreateShippingTicketError[] = [];

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
      const totalCards = allPrintings.reduce((sum, p) => sum + (p.quantity || 1), 0);
      const productDescription = totalCards > 1
        ? `Cards Colecionáveis Grand Archive (${totalCards} un)`
        : (allPrintings[0]?.cardName || "Cards Colecionáveis Grand Archive");

      const products: SuperfreteProductLine[] = [
        {
          name: productDescription.slice(0, 50),
          quantity: 1,
          unitary_value: insuranceValueBrl,
        },
      ];

      const carrier = toCarrierCode(packReq.selectedServiceCode, packReq.selectedServiceName);
      const serviceName = packReq.selectedServiceName || `Service ${packReq.selectedServiceCode}`;

      const senderName = sanitizeName(primaryOrder.senderFullName, "Remetente Colecionador");
      const buyerName = sanitizeName(primaryOrder.buyerFullName, "Destinatario Colecionador");

      const userPackageConfig: ShippingPackageConfig = {
        heightCm: user.shippingPackageHeight ?? undefined,
        widthCm: user.shippingPackageWidth ?? undefined,
        lengthCm: user.shippingPackageLength ?? undefined,
        baseWeightG: user.shippingPackageBaseWeight ?? undefined,
        tapeWeightG: user.shippingPackageTapeWeight ?? undefined,
        cardWeightG: user.shippingCardWeight ?? undefined,
      };
      const packageVolume = buildPackageVolume(totalCards, userPackageConfig);

      const rawRecipientDoc = packReq.recipientDocument || primaryOrder.buyerDocument || "";
      const recipientDocClean = rawRecipientDoc.replace(/\D/g, "");

      if (packReq.recipientDocument && packReq.recipientDocument !== primaryOrder.buyerDocument) {
        await updateFulfillmentOrdersBuyerDocument(
          userId,
          orders.map((o) => o.id),
          packReq.recipientDocument,
          dbParam
        );
      }

      const cartPayload = {
        from: {
          name: senderName,
          ...(primaryOrder.senderDocument ? { document: primaryOrder.senderDocument.replace(/\D/g, "") } : {}),
          postal_code: primaryOrder.senderPostalCode.replace(/\D/g, "").slice(0, 8),
          address: (primaryOrder.senderStreet || "Rua").trim().slice(0, 50),
          number: (primaryOrder.senderNumber || "").trim().slice(0, 10),
          complement: primaryOrder.senderComplement ? primaryOrder.senderComplement.trim().slice(0, 20) : "",
          district: (primaryOrder.senderDistrict || "NA").trim().slice(0, 50),
          city: (primaryOrder.senderCity || "").trim().slice(0, 50),
          state_abbr: (primaryOrder.senderStateAbbr || "SP").trim().toUpperCase().slice(0, 2),
          state_code: (primaryOrder.senderStateAbbr || "SP").trim().toUpperCase().slice(0, 2),
        },
        to: {
          name: buyerName,
          ...(recipientDocClean ? { document: recipientDocClean } : {}),
          postal_code: primaryOrder.buyerPostalCode.replace(/\D/g, "").slice(0, 8),
          address: (primaryOrder.buyerStreet || "Rua").trim().slice(0, 50),
          number: (primaryOrder.buyerNumber || "").trim().slice(0, 10),
          complement: primaryOrder.buyerComplement ? primaryOrder.buyerComplement.trim().slice(0, 20) : "",
          district: (primaryOrder.buyerDistrict || "NA").trim().slice(0, 50),
          city: (primaryOrder.buyerCity || "").trim().slice(0, 50),
          state_abbr: (primaryOrder.buyerStateAbbr || "SP").trim().toUpperCase().slice(0, 2),
          state_code: (primaryOrder.buyerStateAbbr || "SP").trim().toUpperCase().slice(0, 2),
        },
        service: Number(packReq.selectedServiceCode),
        package: packageVolume,
        volumes: packageVolume,
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
      if (process.env.NODE_ENV !== "production") {
        console.error(`[Superfrete Cart Error] for buyer ${packReq.buyerNick}:`, err);
      }
      errors.push({ buyerNick: packReq.buyerNick, error: msg });
    }
  }

  if (createdTickets.length === 0 && errors.length > 0) {
    throw new Error(errors.map((e) => `${e.buyerNick}: ${e.error}`).join(" | "));
  }

  return { tickets: createdTickets, errors };
}

export async function cancelShippingTicketService(
  userId: string,
  ticketId: string,
  database?: unknown,
  customFetch: typeof fetch = fetch
): Promise<{ success: boolean; canceledSuperfrete: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- repository parameter
  const dbParam = database as any;
  const ticket = await getShippingTicketById(userId, ticketId, dbParam);
  if (!ticket || ticket.userId !== userId) {
    throw new Error("Shipping ticket not found");
  }

  let canceledSuperfrete = false;
  const user = await getUserById(userId, dbParam);
  if (user?.superfreteApiKeyEncrypted && ticket.superfreteOrderId) {
    try {
      const apiToken = decryptSecret(user.superfreteApiKeyEncrypted);
      await cancelSuperfreteOrder(
        apiToken,
        ticket.superfreteOrderId,
        "Cancelado para recriação com peso ajustado",
        customFetch
      );
      canceledSuperfrete = true;
    } catch (e) {
      console.warn(`[Superfrete] Cancellation warning for order ${ticket.superfreteOrderId}:`, e);
    }
  }

  await cancelShippingTicketById(userId, ticketId, dbParam);
  return { success: true, canceledSuperfrete };
}

