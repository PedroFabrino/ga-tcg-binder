import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { runMigrations } from "@/db/init";
import { ensureDefaultUserAndSeed } from "@/services/seed";
import { auth } from "@/auth";
import { syncGlobalMarketplace, getGlobalMarketReport } from "@/services/marketplace";

export async function POST(req: NextRequest) {
  try {
    await runMigrations();
    await ensureDefaultUserAndSeed();

    // Check authorization: bearer token matches CRON_SECRET or authenticated user session
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const isCronAuthorized =
      cronSecret && authHeader === `Bearer ${cronSecret}`;

    const session = await auth();
    if (!isCronAuthorized && !session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session?.user?.id;
    const stats = await syncGlobalMarketplace(db);
    const report = await getGlobalMarketReport(userId, db);

    return NextResponse.json({
      success: true,
      stats,
      report,
      syncedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Automated market sync failed" },
      { status: 500 }
    );
  }
}
