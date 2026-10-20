import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureDefaultUserAndSeed } from "@/services/seed";
import { userHasCapability } from "@/services/settings";
import {
  getPrintableShippingTicketsService,
  downloadSuperfretePdfBuffer,
} from "@/services/superfrete-print";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get("ticketId");
    const download = searchParams.get("download") === "true";
    const layoutParam = searchParams.get("layout")?.toUpperCase();
    const layout: "A4" | "A5" | "A6" = layoutParam === "A4" || layoutParam === "A6" ? layoutParam : "A5";
    const ticketIds = ticketId ? [ticketId] : undefined;

    const result = await getPrintableShippingTicketsService(userId, ticketIds, undefined, fetch, layout);

    if (download) {
      const { buffer, contentType } = await downloadSuperfretePdfBuffer(result.url);
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="etiquetas-superfrete-${layout.toLowerCase()}.pdf"`,
        },
      });
    }

    return NextResponse.json(
      { success: true, ...result },
      { status: 200, headers: corsHeaders }
    );
  } catch (error: unknown) {
    return handlePrintError(error);
  }
}

export async function POST(request: NextRequest) {
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

    let ticketIds: string[] | undefined;
    let download = false;
    let layout: "A4" | "A5" | "A6" = "A5";

    try {
      const body = await request.json();
      if (Array.isArray(body?.ticketIds)) {
        ticketIds = body.ticketIds;
      } else if (body?.ticketId) {
        ticketIds = [body.ticketId];
      }
      if (body?.download === true) {
        download = true;
      }
      if (body?.layout === "A4" || body?.layout === "A6") {
        layout = body.layout;
      }
    } catch {
      // Body may be empty, proceed with all eligible tickets
    }

    const result = await getPrintableShippingTicketsService(userId, ticketIds, undefined, fetch, layout);

    if (download) {
      const { buffer, contentType } = await downloadSuperfretePdfBuffer(result.url);
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="etiquetas-superfrete-${layout.toLowerCase()}.pdf"`,
        },
      });
    }

    return NextResponse.json(
      { success: true, ...result },
      { status: 200, headers: corsHeaders }
    );
  } catch (error: unknown) {
    return handlePrintError(error);
  }
}

function handlePrintError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal Server Error";

  if (message === "SUPERFRETE_API_KEY_NOT_CONFIGURED") {
    return NextResponse.json(
      { error: "SUPERFRETE_API_KEY_NOT_CONFIGURED" },
      { status: 400, headers: corsHeaders }
    );
  }

  if (message === "NO_PRINTABLE_TICKETS_FOUND") {
    return NextResponse.json(
      { error: "NO_PRINTABLE_TICKETS_FOUND" },
      { status: 400, headers: corsHeaders }
    );
  }

  const status = message.includes("Superfrete") ? 400 : 500;
  return NextResponse.json({ error: message }, { status, headers: corsHeaders });
}
