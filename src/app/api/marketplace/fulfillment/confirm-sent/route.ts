import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureDefaultUserAndSeed } from "@/services/seed";
import { markOrdersAsSentService } from "@/services/fulfillment";
import { safeParseConfirmSentInput } from "@/lib/validation/fulfillment-schemas";
import { userHasCapability } from "@/services/settings";

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
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: authentication required" },
        { status: 401, headers: corsHeaders }
      );
    }

    if (!(await userHasCapability(userId, "hasVendorCapability"))) {
      return new NextResponse(null, { status: 404, headers: corsHeaders });
    }

    const rawBody = await req.json();
    const parsed = safeParseConfirmSentInput(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload format" },
        { status: 400, headers: corsHeaders }
      );
    }

    const orderIds: string[] = parsed.data.orderIds
      ? parsed.data.orderIds
      : parsed.data.orderId
      ? [parsed.data.orderId]
      : [];

    if (orderIds.length === 0) {
      return NextResponse.json(
        { error: "orderIds array is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    await markOrdersAsSentService(userId, orderIds);
    return NextResponse.json({ success: true, count: orderIds.length }, { status: 200, headers: corsHeaders });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}
