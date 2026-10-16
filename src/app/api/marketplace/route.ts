import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { runMigrations } from "@/db/init";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";
import { auth } from "@/auth";
import {
  getUserMarketplaceReport,
  syncUserMarketplace,
  claimMarketplaceCardForBinder,
} from "@/services/marketplace";

export async function GET(req: NextRequest) {
  try {
    await runMigrations();
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const url = new URL(req.url);
    const userId = session?.user?.id || url.searchParams.get("userId") || DEFAULT_USER_ID;

    const report = await getUserMarketplaceReport(userId, db);
    return NextResponse.json(report);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load marketplace" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await runMigrations();
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const body = await req.json();
    const userId = session?.user?.id || body.userId || DEFAULT_USER_ID;
    const action = body.action || "sync";

    if (action === "sync") {
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
    }

    if (action === "claim") {
      const { mypCardId, quantity = 1 } = body;
      if (!mypCardId) {
        return NextResponse.json({ error: "Missing mypCardId" }, { status: 400 });
      }

      const claimRes = await claimMarketplaceCardForBinder(userId, mypCardId, Number(quantity), db);
      const updatedReport = await getUserMarketplaceReport(userId, db);
      return NextResponse.json({
        ...claimRes,
        report: updatedReport,
      });
    }

    return NextResponse.json({ error: "Invalid marketplace action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Marketplace operation failed" },
      { status: 500 }
    );
  }
}
