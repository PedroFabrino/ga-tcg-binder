import { NextRequest, NextResponse } from "next/server";
import { parseFulfillmentRequest } from "@/lib/validation/fulfillment-schemas";
import { buildFulfillmentReport } from "@/services/fulfillment";

// Wildcard origin is intentionally allowed so Tampermonkey / Violentmonkey userscripts
// running on https://mypcards.com can invoke this stateless fulfillment endpoint directly.
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
    const rawBody = await req.json();
    const validation = parseFulfillmentRequest(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400, headers: corsHeaders }
      );
    }

    const report = await buildFulfillmentReport(validation.data);
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
