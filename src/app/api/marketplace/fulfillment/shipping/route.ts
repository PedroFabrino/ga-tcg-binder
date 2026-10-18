import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";
import { getShippingTickets } from "@/db/repositories/fulfillment-repository";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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
    const status = searchParams.get("status") || undefined;

    const tickets = await getShippingTickets(userId, status);
    return NextResponse.json(tickets, { status: 200, headers: corsHeaders });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}
