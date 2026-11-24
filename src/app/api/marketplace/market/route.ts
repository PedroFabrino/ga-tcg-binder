import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { runMigrations } from "@/db/init";
import {
  getEnabledMarketStores,
  getMarketStoreById,
} from "@/db/repositories/marketplace-repository";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";
import { auth } from "@/auth";
import { getGlobalMarketReport } from "@/services/marketplace";
import { syncGlobalMarketplace } from "@/services/myp-sync";
import { syncLigaStore } from "@/services/ligastore-sync";
import { syncLootcards } from "@/services/lootcards-sync";

interface MarketSyncStats {
  totalSynced: number;
  matchedCount: number;
  unmatchedCount: number;
}

function emptyStats(): MarketSyncStats {
  return { totalSynced: 0, matchedCount: 0, unmatchedCount: 0 };
}

function addStats(target: MarketSyncStats, delta: Partial<MarketSyncStats>): void {
  target.totalSynced += delta.totalSynced || 0;
  target.matchedCount += delta.matchedCount || 0;
  target.unmatchedCount += delta.unmatchedCount || 0;
}

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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load global market report";
    return NextResponse.json({ error: message }, { status: 500 });
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

    const stats: MarketSyncStats = emptyStats();
    let warning: string | undefined;

    if (requestedStoreId) {
      const store = await getMarketStoreById(requestedStoreId, db);
      if (!store) {
        return NextResponse.json(
          { error: `Marketplace store "${requestedStoreId}" not found` },
          { status: 404 }
        );
      }

      if (store.platform === "liga_store") {
        try {
          addStats(stats, await syncLigaStore({ storeId: store.id, database: db }));
        } catch (err: unknown) {
          console.warn(`[LigaStore Sync Blocked / Failed for ${store.id}]`, err);
          warning = "LIGASTORE_CLOUDFLARE_BLOCKED";
        }
      } else if (store.platform === "lootcards") {
        try {
          addStats(stats, await syncLootcards({ storeId: store.id, database: db }));
        } catch (err: unknown) {
          console.warn(`[Lootcards Sync Failed for ${store.id}]`, err);
          warning = "LOOTCARDS_SYNC_FAILED";
        }
      } else if (store.platform === "myp") {
        addStats(stats, await syncGlobalMarketplace(db));
      } else {
        return NextResponse.json(
          { error: `Unsupported marketplace platform "${store.platform}"` },
          { status: 400 }
        );
      }
    } else {
      const enabledStores = await getEnabledMarketStores(db);
      const mypStores = enabledStores.filter((s) => s.platform === "myp");
      const ligaStores = enabledStores.filter((s) => s.platform === "liga_store");
      const lootcardsStores = enabledStores.filter((s) => s.platform === "lootcards");

      const mypTotals = emptyStats();
      const ligaTotals = emptyStats();
      const lootTotals = emptyStats();

      await Promise.all([
        (async () => {
          for (const store of mypStores) {
            try {
              addStats(mypTotals, await syncGlobalMarketplace(db));
            } catch (err: unknown) {
              console.warn(`[MyP Sync Failed in All Stores for ${store.id}]`, err);
            }
          }
        })(),
        (async () => {
          for (const store of ligaStores) {
            try {
              addStats(ligaTotals, await syncLigaStore({ storeId: store.id, database: db }));
            } catch (err: unknown) {
              console.warn(`[LigaStore Sync Blocked / Failed for ${store.id} in All Stores]`, err);
              warning = "LIGASTORE_CLOUDFLARE_BLOCKED";
            }
          }
        })(),
        (async () => {
          for (const store of lootcardsStores) {
            try {
              addStats(lootTotals, await syncLootcards({ storeId: store.id, database: db }));
            } catch (err: unknown) {
              console.warn(`[Lootcards Sync Failed for ${store.id} in All Stores]`, err);
            }
          }
        })(),
      ]);

      addStats(stats, mypTotals);
      addStats(stats, ligaTotals);
      addStats(stats, lootTotals);
    }

    const updatedReport = await getGlobalMarketReport(userId, db, requestedStoreId);

    return NextResponse.json({
      success: true,
      stats,
      warning,
      report: updatedReport,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Global market sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
