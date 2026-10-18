import { NextRequest, NextResponse } from "next/server";
import { parseFulfillmentRequest } from "@/lib/validation/fulfillment-schemas";
import { buildFulfillmentReport, persistFulfillmentOrdersService, getFulfillmentOrdersService, toggleOrderPhotographedService } from "@/services/fulfillment";
import { auth } from "@/auth";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";
import type { FulfillmentOrderStatus } from "@/db/schema";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
    const userId = session?.user?.id || DEFAULT_USER_ID;

    const { searchParams } = new URL(req.url);
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
    const userId = session?.user?.id || DEFAULT_USER_ID;

    const rawBody = await req.json();
    const validation = parseFulfillmentRequest(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400, headers: corsHeaders }
      );
    }

    // 1. Build enriched report
    const report = await buildFulfillmentReport(validation.data);

    // 2. Persist to database if orders are present
    if (validation.data.length > 0) {
      await persistFulfillmentOrdersService(userId, validation.data);
    }

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
    const userId = session?.user?.id || DEFAULT_USER_ID;

    const body = await req.json();
    if (!body || typeof body.orderId !== "string" || typeof body.isPhotographed !== "boolean") {
      return NextResponse.json(
        { error: "orderId string and isPhotographed boolean are required" },
        { status: 400, headers: corsHeaders }
      );
    }

    await toggleOrderPhotographedService(userId, body.orderId, body.isPhotographed);
    return NextResponse.json({ success: true }, { status: 200, headers: corsHeaders });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}
