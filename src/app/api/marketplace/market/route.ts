import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { runMigrations } from "@/db/init";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";
import { auth } from "@/auth";
import {
  getGlobalMarketReport,
  syncGlobalMarketplace,
} from "@/services/marketplace";
import { syncLigaStore } from "@/services/ligastore-sync";

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
    let requestedStoreId: string | undefined;

    try {
      const body = await req.json();
      if (body?.userId) userId = body.userId;
      if (body?.storeId) requestedStoreId = body.storeId;
    } catch {
      // Body may be empty
    }

    let stats: any = {};
    if (requestedStoreId === "brandao") {
      stats = await syncLigaStore({ storeId: "brandao", database: db });
    } else if (requestedStoreId === "myp") {
      stats = await syncGlobalMarketplace(db);
    } else {
      const mypStats = await syncGlobalMarketplace(db);
      const ligaStats = await syncLigaStore({ storeId: "brandao", database: db });
      stats = {
        totalSynced: (mypStats.totalSynced || 0) + (ligaStats.totalSynced || 0),
        matchedCount: (mypStats.matchedCount || 0) + (ligaStats.matchedCount || 0),
        unmatchedCount: (mypStats.unmatchedCount || 0) + (ligaStats.unmatchedCount || 0),
      };
    }

    const updatedReport = await getGlobalMarketReport(userId, db, requestedStoreId);

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
