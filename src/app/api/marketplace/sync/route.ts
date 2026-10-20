import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { runMigrations } from "@/db/init";
import { ensureDefaultUserAndSeed } from "@/services/seed";
import { auth } from "@/auth";
import { userHasCapability } from "@/services/settings";
import {
  getUserMarketplaceReport,
  syncUserMarketplace,
} from "@/services/marketplace";

export async function POST(req: NextRequest) {
  try {
    await runMigrations();
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const body = await req.json();
    const userId = session?.user?.id;

    if (!userId || !(await userHasCapability(userId, "hasVendorCapability"))) {
      return new NextResponse(null, { status: 404 });
    }

    const currentReport = await getUserMarketplaceReport(userId, db);
    const usernameToSync = body.username || currentReport.mypUsername;

    if (!usernameToSync) {
      return NextResponse.json(
        { error: "Please provide your MyP Cards username to sync." },
        { status: 400 }
      );
    }

    const stats = await syncUserMarketplace(userId, usernameToSync, db);
    const updatedReport = await getUserMarketplaceReport(userId, db);

    return NextResponse.json({
      success: true,
      stats,
      report: updatedReport,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Marketplace sync failed" },
      { status: 500 }
    );
  }
}
