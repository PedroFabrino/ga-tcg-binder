import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";
import {
  createShippingTicketsService,
  type CreateShippingTicketRequest,
} from "@/services/superfrete";

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
    const packs: CreateShippingTicketRequest[] = Array.isArray(body)
      ? body
      : Array.isArray(body?.packs)
      ? body.packs
      : [];

    if (packs.length === 0) {
      return NextResponse.json(
        { error: "No buyer packs provided for shipping ticket creation" },
        { status: 400, headers: corsHeaders }
      );
    }

    const createdTickets = await createShippingTicketsService(userId, packs);
    return NextResponse.json({ success: true, tickets: createdTickets }, { status: 200, headers: corsHeaders });
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
