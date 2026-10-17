import { NextRequest, NextResponse } from "next/server";
import { runFullSyncPipeline } from "@/services/sync-pipeline";
import { db } from "@/db";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

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

    let targetUserId: string | undefined;
    try {
      const body = await req.json();
      if (body?.targetUserId) {
        targetUserId = body.targetUserId;
      }
    } catch {
      // Body may be empty, which is completely valid
    }

    const report = await runFullSyncPipeline(db, {
      targetUserId: targetUserId || session?.user?.id,
    });

    const status = report.success ? 200 : 207;
    return NextResponse.json(report, { status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
