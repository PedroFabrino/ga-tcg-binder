import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { runMigrations } from "@/db/init";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";
import { auth } from "@/auth";
import { getGlobalMarketReport } from "@/services/marketplace";
import { syncGlobalMarketplace } from "@/services/myp-sync";
import { syncLigaStore } from "@/services/ligastore-sync";
import { syncLootcards } from "@/services/lootcards-sync";

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
    let warning: string | undefined;

    if (requestedStoreId === "brandao" || requestedStoreId === "tabletopsorocaba") {
      try {
        stats = await syncLigaStore({ storeId: requestedStoreId, database: db });
      } catch (err: unknown) {
        console.warn("[LigaStore Sync Blocked / Failed]", err);
        warning = "LIGASTORE_CLOUDFLARE_BLOCKED";
      }
    } else if (requestedStoreId === "lootcards") {
      try {
        stats = await syncLootcards({ storeId: "lootcards", database: db });
      } catch (err: unknown) {
        console.warn("[Lootcards Sync Failed]", err);
        warning = "LOOTCARDS_SYNC_FAILED";
      }
    } else if (requestedStoreId === "myp") {
      stats = await syncGlobalMarketplace(db);
    } else {
      let brandaoStats: any = {};
      let tabletopStats: any = {};
      let lootStats: any = {};

      const [mypResult] = await Promise.all([
        syncGlobalMarketplace(db).catch((err) => {
          console.warn("[MyP Sync Failed in All Stores]", err);
          return { totalSynced: 0, matchedCount: 0, unmatchedCount: 0 };
        }),
        (async () => {
          try {
            brandaoStats = await syncLigaStore({ storeId: "brandao", database: db });
          } catch (err: unknown) {
            console.warn("[LigaStore Sync Blocked / Failed in All Stores]", err);
            warning = "LIGASTORE_CLOUDFLARE_BLOCKED";
          }
          try {
            tabletopStats = await syncLigaStore({ storeId: "tabletopsorocaba", database: db });
          } catch (err: unknown) {
            console.warn("[LigaStore Sync Blocked / Failed for TabletopSorocaba in All Stores]", err);
          }
        })(),
        (async () => {
          try {
            lootStats = await syncLootcards({ storeId: "lootcards", database: db });
          } catch (err: unknown) {
            console.warn("[Lootcards Sync Failed in All Stores]", err);
          }
        })(),
      ]);

      const mypStats = mypResult || {};
      stats = {
        totalSynced:
          (mypStats.totalSynced || 0) +
          (brandaoStats.totalSynced || 0) +
          (tabletopStats.totalSynced || 0) +
          (lootStats.totalSynced || 0),
        matchedCount:
          (mypStats.matchedCount || 0) +
          (brandaoStats.matchedCount || 0) +
          (tabletopStats.matchedCount || 0) +
          (lootStats.matchedCount || 0),
        unmatchedCount:
          (mypStats.unmatchedCount || 0) +
          (brandaoStats.unmatchedCount || 0) +
          (tabletopStats.unmatchedCount || 0) +
          (lootStats.unmatchedCount || 0),
      };
    }

    const updatedReport = await getGlobalMarketReport(userId, db, requestedStoreId);

    return NextResponse.json({
      success: true,
      stats,
      warning,
      report: updatedReport,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Global market sync failed" },
      { status: 500 }
    );
  }
}
