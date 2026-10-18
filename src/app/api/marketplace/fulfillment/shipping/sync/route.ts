import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureDefaultUserAndSeed } from "@/services/seed";
import { syncShippingTicketsService } from "@/services/superfrete-sync";

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

export async function POST() {
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

    const updated = await syncShippingTicketsService(userId);
    return NextResponse.json({ success: true, tickets: updated }, { status: 200, headers: corsHeaders });
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
