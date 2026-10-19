import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureDefaultUserAndSeed } from "@/services/seed";
import {
  createShippingTicketsService,
} from "@/services/superfrete";
import { safeParseCreateTicketsInput } from "@/lib/validation/fulfillment-schemas";

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

    const rawBody = await req.json();
    const normalizedInput = Array.isArray(rawBody) ? { packs: rawBody } : rawBody;
    const parsed = safeParseCreateTicketsInput(normalizedInput);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload format: packs array required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const result = await createShippingTicketsService(userId, parsed.data.packs);
    return NextResponse.json(
      { success: true, tickets: result.tickets, errors: result.errors },
      { status: 200, headers: corsHeaders }
    );
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "SUPERFRETE_API_KEY_NOT_CONFIGURED") {
      return NextResponse.json(
        { error: "SUPERFRETE_API_KEY_NOT_CONFIGURED" },
        { status: 400, headers: corsHeaders }
      );
    }
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}
