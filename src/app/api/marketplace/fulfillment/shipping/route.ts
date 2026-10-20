import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureDefaultUserAndSeed } from "@/services/seed";
import { userHasCapability } from "@/services/settings";
import { getShippingTicketsService } from "@/services/fulfillment";
import { cancelShippingTicketService } from "@/services/superfrete";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
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
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: authentication required" },
        { status: 401, headers: corsHeaders }
      );
    }
    if (!(await userHasCapability(userId, "hasShippingCapability"))) {
      return new NextResponse(null, { status: 404, headers: corsHeaders });
    }

    const { searchParams } = new URL(req.url);
    const withOrders = searchParams.get("withOrders") === "true";

    const tickets = await getShippingTicketsService(userId, withOrders);
    return NextResponse.json(tickets, { status: 200, headers: corsHeaders });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE(req: NextRequest) {
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
    if (!(await userHasCapability(userId, "hasShippingCapability"))) {
      return new NextResponse(null, { status: 404, headers: corsHeaders });
    }

    const { searchParams } = new URL(req.url);
    let ticketId = searchParams.get("ticketId");

    if (!ticketId) {
      try {
        const body = await req.json();
        ticketId = body.ticketId;
      } catch {
        // query param fallback
      }
    }

    if (!ticketId) {
      return NextResponse.json(
        { error: "ticketId is required to delete/cancel a shipping ticket" },
        { status: 400, headers: corsHeaders }
      );
    }

    const result = await cancelShippingTicketService(userId, ticketId);
    return NextResponse.json(result, { status: 200, headers: corsHeaders });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}

