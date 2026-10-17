import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";
import { auth } from "@/auth";
import { parseWatchlistConfirmInput } from "@/lib/validation/watchlist-schemas";
import { confirmWatchlistSyncService } from "@/services/watchlist";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Watchlist-Sync-Token",
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

    const rawBody = await req.json();
    const validation = parseWatchlistConfirmInput(rawBody);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400, headers: corsHeaders });
    }

    const { userId: bodyUserId, syncToken: bodySyncToken, confirmedAddIds, confirmedUpdateIds, confirmedRemoveIds } =
      validation.data;

    const headerToken = req.headers.get("x-watchlist-sync-token");
    const result = await confirmWatchlistSyncService({
      userId: bodyUserId,
      sessionUserId: session?.user?.id,
      syncToken: bodySyncToken || headerToken,
      confirmedAddIds,
      confirmedUpdateIds,
      confirmedRemoveIds,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status || 400, headers: corsHeaders });
    }

    return NextResponse.json(
      {
        success: true,
        updatedCount: result.updatedCount,
      },
      { headers: corsHeaders }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders }
    );
  }
}
