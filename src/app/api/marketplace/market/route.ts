import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { runMigrations } from "@/db/init";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";
import { auth } from "@/auth";
import {
  getGlobalMarketReport,
  syncGlobalMarketplace,
} from "@/services/marketplace";

export async function GET(req: NextRequest) {
  try {
    await runMigrations();
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const url = new URL(req.url);
    const userId = session?.user?.id || url.searchParams.get("userId") || DEFAULT_USER_ID;
    const storeId = url.searchParams.get("storeId") || undefined;

    const report = await getGlobalMarketReport(userId, db, storeId);
    return NextResponse.json(report);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to load global market report" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await runMigrations();
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const url = new URL(req.url);
    let userId = session?.user?.id || url.searchParams.get("userId") || DEFAULT_USER_ID;

    try {
      const body = await req.json();
      if (body?.userId) userId = body.userId;
    } catch {
      // Body may be empty
    }

    const stats = await syncGlobalMarketplace(db);
    const updatedReport = await getGlobalMarketReport(userId, db);

    return NextResponse.json({
      success: true,
      stats,
      report: updatedReport,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Global market sync failed" },
      { status: 500 }
    );
  }
}
