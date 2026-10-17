import { NextRequest, NextResponse } from "next/server";
import { getMetaArchetypes, syncMetaArchetypes } from "@/services/meta";
import { db } from "@/db";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId") || session?.user?.id || DEFAULT_USER_ID;

    const archetypes = await getMetaArchetypes(db, userId);

    // Recommended archetypes: sorted by completion percentage descending, then winRate
    // Must have a meaningful completion threshold (at least 40% owned to be "Recommended")
    const meaningfulArchetypes = [...archetypes].filter((a) => (a.completionPct || 0) >= 40);
    const candidatePool =
      meaningfulArchetypes.length > 0
        ? meaningfulArchetypes
        : [...archetypes].filter((a) => (a.completionPct || 0) >= 20);

    const recommendedArchetypes = candidatePool
      .sort((a, b) => {
        if ((b.completionPct || 0) !== (a.completionPct || 0)) {
          return (b.completionPct || 0) - (a.completionPct || 0);
        }
        return parseFloat(b.winRate || "0") - parseFloat(a.winRate || "0");
      })
      .slice(0, 4);

    return NextResponse.json({
      archetypes,
      recommendedArchetypes,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    const isAuthorized =
      Boolean(session?.user) ||
      (cronSecret && authHeader === `Bearer ${cronSecret}`);

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await syncMetaArchetypes(db);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
