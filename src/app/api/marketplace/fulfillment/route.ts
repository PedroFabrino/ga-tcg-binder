import { NextRequest, NextResponse } from "next/server";
import { parseFulfillmentRequest, safeParseTogglePhotographedInput } from "@/lib/validation/fulfillment-schemas";
import {
  buildFulfillmentReport,
  persistFulfillmentOrdersService,
  getFulfillmentOrdersService,
  toggleOrderPhotographedService,
  authenticateFulfillmentBridgeUser,
} from "@/services/fulfillment";
import { auth } from "@/auth";
import { ensureDefaultUserAndSeed } from "@/services/seed";
import type { FulfillmentOrderStatus } from "@ga/contracts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-GA-User-Id, X-GA-Sync-Token, x-ga-user-id, x-ga-sync-token",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: authentication required" },
        { status: 401, headers: corsHeaders }
      );
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format");
    if (format === "report") {
      const openOrders = await getFulfillmentOrdersService(userId, "open");
      const rawOrders = openOrders.map((o) => ({
        orderId: o.mypOrderId,
        orderDate: o.orderDate,
        buyerNick: o.buyerNick,
        shippingMethod: o.shippingMethod || "Padrão",
        status: o.status,
        orderUrl: `https://mypcards.com/pedido/${o.mypOrderId}`,
        buyer: {
          fullName: o.buyerFullName,
          document: o.buyerDocument,
          street: o.buyerStreet,
          number: o.buyerNumber,
          complement: o.buyerComplement,
          district: o.buyerDistrict,
          city: o.buyerCity,
          stateAbbr: o.buyerStateAbbr,
          postalCode: o.buyerPostalCode,
        },
        sender: {
          fullName: o.senderFullName,
          document: o.senderDocument,
          street: o.senderStreet,
          number: o.senderNumber,
          complement: o.senderComplement,
          district: o.senderDistrict,
          city: o.senderCity,
          stateAbbr: o.senderStateAbbr,
          postalCode: o.senderPostalCode,
        },
        totals: {
          subtotalCents: o.subtotalCents,
          shippingCents: o.shippingCents,
          totalCents: o.totalCents,
          subtotalBrl: `R$ ${(o.subtotalCents / 100).toFixed(2).replace(".", ",")}`,
          shippingBrl: `R$ ${(o.shippingCents / 100).toFixed(2).replace(".", ",")}`,
          totalBrl: `R$ ${(o.totalCents / 100).toFixed(2).replace(".", ",")}`,
          shippingMethod: o.shippingMethod,
        },
        items: o.printings.map((p) => ({
          rawTitle: p.cardName,
          mypCode: p.mypCode,
          condition: p.condition,
          language: p.language,
          isFoil: p.isFoil,
          quantity: p.quantity,
          unitPriceBrl: p.unitPriceBrl,
        })),
      }));

      const report = await buildFulfillmentReport(rawOrders);
      return NextResponse.json(report, { status: 200, headers: corsHeaders });
    }

    const status = (searchParams.get("status") as FulfillmentOrderStatus) || undefined;

    const data = await getFulfillmentOrdersService(userId, status);
    return NextResponse.json(data, { status: 200, headers: corsHeaders });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const session = await auth();
    let userId = session?.user?.id;

    // Support cross-origin browser userscript bridge on mypcards.com
    if (!userId) {
      const headerUserId = req.headers.get("x-ga-user-id") || req.headers.get("X-GA-User-Id");
      const headerToken =
        req.headers.get("x-ga-sync-token") ||
        req.headers.get("X-GA-Sync-Token") ||
        req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
      if (headerUserId && headerToken) {
        userId = (await authenticateFulfillmentBridgeUser(headerUserId, headerToken)) || undefined;
      }
    }

    const mode = req.nextUrl?.searchParams?.get("mode");
    if (!userId && mode !== "enrich") {
      return NextResponse.json(
        { error: "Unauthorized: abra o MyP Vendas pelo botão 'Abrir MyP Vendas' no Grand Archive Binder para autorizar a sincronização." },
        { status: 401, headers: corsHeaders }
      );
    }

    const rawBody = await req.json();
    const validation = parseFulfillmentRequest(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400, headers: corsHeaders }
      );
    }

    let ordersForReport = validation.data;
    if (userId && validation.data.length > 0) {
      await persistFulfillmentOrdersService(userId, validation.data);
      const existingOrders = await getFulfillmentOrdersService(userId);
      const nonOpenOrderIds = new Set(
        existingOrders.filter((o) => o.status !== "open").map((o) => o.mypOrderId)
      );
      if (nonOpenOrderIds.size > 0) {
        ordersForReport = validation.data.filter((o) => !nonOpenOrderIds.has(o.orderId));
      }
    }

    // Build enriched report with only open orders
    const report = await buildFulfillmentReport(ordersForReport);

    return NextResponse.json(report, { status: 200, headers: corsHeaders });
  } catch (error: unknown) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[Fulfillment API Internal Error]:", error);
    }
    const message =
      process.env.NODE_ENV === "development" && error instanceof Error
        ? error.message
        : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }

}

export async function PATCH(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: authentication required" },
        { status: 401, headers: corsHeaders }
      );
    }

    const body = await req.json();
    const parsed = safeParseTogglePhotographedInput(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "orderId string and isPhotographed boolean are required" },
        { status: 400, headers: corsHeaders }
      );
    }

    await toggleOrderPhotographedService(userId, parsed.data.orderId, parsed.data.isPhotographed);
    return NextResponse.json({ success: true }, { status: 200, headers: corsHeaders });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}
