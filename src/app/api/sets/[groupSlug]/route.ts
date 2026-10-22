import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";
import { auth } from "@/auth";
import { getSetGroupChecklistReport } from "@/services/set-shortage";
import { parseSetChecklistQuery } from "@/lib/validation/sets-schemas";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupSlug: string }> | { groupSlug: string } }
) {
  try {
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const userId =
      req.nextUrl.searchParams.get("userId") || session?.user?.id || DEFAULT_USER_ID;

    const { groupSlug } = await params;
    const filters = parseSetChecklistQuery(req.nextUrl.searchParams);
    const target =
      req.nextUrl.searchParams.get("target") ||
      req.nextUrl.searchParams.get("deckId") ||
      undefined;

    const report = await getSetGroupChecklistReport(groupSlug, userId, {
      filters,
      target,
    });

    if (!report) {
      return NextResponse.json({ error: "Set group not found" }, { status: 404 });
    }

    return NextResponse.json({
      group: report.group,
      checklist: report.cards,
      summary: report.stats,
      availableDecks: report.availableDecks,
      hasPersonalWants: report.hasPersonalWants,
      currentTarget: report.currentTarget,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
