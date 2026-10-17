import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { runMigrations } from "@/db/init";
import { ensureDefaultUserAndSeed } from "@/services/seed";
import { auth } from "@/auth";
import { enrichMarketplaceTcgPrices } from "@/services/marketplace";

export async function POST(req: NextRequest) {
  try {
    await runMigrations();
    await ensureDefaultUserAndSeed();

    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const isCronAuthorized = cronSecret && authHeader === `Bearer ${cronSecret}`;

    const session = await auth();
    if (!isCronAuthorized && !session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let cardIds: string[] | undefined;
    let limit: number | undefined;
    let onlyShortages: boolean | undefined;

    try {
      const body = await req.json();
      if (Array.isArray(body?.cardIds)) {
        cardIds = body.cardIds;
      }
      if (typeof body?.limit === "number") {
        limit = body.limit;
      }
      if (typeof body?.onlyShortages === "boolean") {
        onlyShortages = body.onlyShortages;
      }
    } catch {
      // Empty or non-JSON body is valid
    }

    const result = await enrichMarketplaceTcgPrices(
      { cardIds, limit, onlyShortages },
      db
    );

    return NextResponse.json({
      success: true,
      ...result,
      enrichedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to enrich TCG Player prices" },
      { status: 500 }
    );
  }
}
