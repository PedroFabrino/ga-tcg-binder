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
    const report = await getSetGroupChecklistReport(groupSlug, userId, {
      filters,
    });

    if (!report) {
      return NextResponse.json({ error: "Set group not found" }, { status: 404 });
    }

    return NextResponse.json({
      group: report.group,
      checklist: report.cards,
      summary: report.stats,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}