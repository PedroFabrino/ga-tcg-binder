import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";
import { markOrdersAsSent } from "@/db/repositories/fulfillment-repository";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const userId = session?.user?.id || DEFAULT_USER_ID;

    const body = await req.json();
    const orderIds: string[] = Array.isArray(body?.orderIds)
      ? body.orderIds
      : typeof body?.orderId === "string"
      ? [body.orderId]
      : [];

    if (orderIds.length === 0) {
      return NextResponse.json(
        { error: "orderIds array is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    await markOrdersAsSent(userId, orderIds);
    return NextResponse.json({ success: true, count: orderIds.length }, { status: 200, headers: corsHeaders });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}
