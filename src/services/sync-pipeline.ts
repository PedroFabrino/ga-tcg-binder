import { db } from "../db";
import { users, cards } from "../db/schema";
import { syncMetaStaples } from "./meta-staples";
import {
  syncUserMarketplace,
  syncGlobalMarketplace,
  enrichMarketplaceTcgPrices,
} from "./marketplace";
import { syncMetaArchetypes } from "./meta";
import { reconcileUserWatchlist, fetchPublicQueroList } from "./watchlist";
import { executeAutomatedWatchlistSync } from "./watchlist-sync-runner";
import { eq, isNotNull, and } from "drizzle-orm";

export interface PipelineStageResult {
  stage: string;
  status: "success" | "skipped" | "failed";
  durationMs: number;
  details?: Record<string, any>;
  error?: string;
}

export interface PipelineExecutionReport {
  startedAt: number;
  completedAt: number;
  totalDurationMs: number;
  stages: PipelineStageResult[];
  success: boolean;
}

export interface PipelineOptions {
  customFetch?: typeof fetch;
  targetUserId?: string;
}

export async function runFullSyncPipeline(
  database: any = db,
  options: PipelineOptions = {}
): Promise<PipelineExecutionReport> {
  const customFetch = options.customFetch || fetch;
  const startedAt = Date.now();
  const stages: PipelineStageResult[] = [];

  // Stage 0: Catalog Check
  const stage0Start = Date.now();
  try {
    const existingCards = await database.select().from(cards).limit(1);
    stages.push({
      stage: "Stage 0: Catalog Check",
      status: "success",
      durationMs: Date.now() - stage0Start,
      details: {
        hasCatalogData: existingCards.length > 0,
      },
    });
  } catch (err: any) {
    stages.push({
      stage: "Stage 0: Catalog Check",
      status: "failed",
      durationMs: Date.now() - stage0Start,
      error: err.message,
    });
  }

  // Stage 1: Meta Staples Sync
  const stage1Start = Date.now();
  try {
    const res = await syncMetaStaples(database, customFetch);
    stages.push({
      stage: "Stage 1: Meta Staples Sync",
      status: "success",
      durationMs: Date.now() - stage1Start,
      details: res,
    });
  } catch (err: any) {
    stages.push({
      stage: "Stage 1: Meta Staples Sync",
      status: "failed",
      durationMs: Date.now() - stage1Start,
      error: err.message,
    });
  }

  // Stage 2a: Personal MyP Store Sync
  const stage2aStart = Date.now();
  try {
    let usersToSync: any[] = [];
    if (options.targetUserId) {
      usersToSync = await database
        .select()
        .from(users)
        .where(eq(users.id, options.targetUserId));
    } else {
      usersToSync = await database
        .select()
        .from(users)
        .where(isNotNull(users.mypUsername));
    }

    const syncSummaries: any[] = [];
    for (const u of usersToSync) {
      if (u.mypUsername) {
        try {
          const userRes = await syncUserMarketplace(
            u.id,
            u.mypUsername,
            database,
            options.customFetch
          );
          syncSummaries.push({ userId: u.id, ...userRes });
        } catch (uErr: any) {
          syncSummaries.push({
            userId: u.id,
            username: u.mypUsername,
            error: uErr.message,
          });
        }
      }
    }

    stages.push({
      stage: "Stage 2a: Personal MyP Store Sync",
      status: "success",
      durationMs: Date.now() - stage2aStart,
      details: {
        usersChecked: usersToSync.length,
        synced: syncSummaries,
      },
    });
  } catch (err: any) {
    stages.push({
      stage: "Stage 2a: Personal MyP Store Sync",
      status: "failed",
      durationMs: Date.now() - stage2aStart,
      error: err.message,
    });
  }

  // Stage 2b: Global MyP Market Sync
  const stage2bStart = Date.now();
  try {
    const res = await syncGlobalMarketplace(database, options.customFetch);
    stages.push({
      stage: "Stage 2b: Global MyP Market Sync",
      status: "success",
      durationMs: Date.now() - stage2bStart,
      details: res,
    });
  } catch (err: any) {
    stages.push({
      stage: "Stage 2b: Global MyP Market Sync",
      status: "failed",
      durationMs: Date.now() - stage2bStart,
      error: err.message,
    });
  }

  // Stage 2c: Deck Shortages TCG Player Price Enrichment
  const stage2cStart = Date.now();
  try {
    const res = await enrichMarketplaceTcgPrices(
      {
        onlyShortages: true,
        userId: options.targetUserId,
        limit: 30,
      },
      database,
      options.customFetch
    );
    stages.push({
      stage: "Stage 2c: Deck Shortages TCG Price Enrichment",
      status: "success",
      durationMs: Date.now() - stage2cStart,
      details: res,
    });
  } catch (err: any) {
    stages.push({
      stage: "Stage 2c: Deck Shortages TCG Price Enrichment",
      status: "failed",
      durationMs: Date.now() - stage2cStart,
      error: err.message,
    });
  }

  // Stage 2d: Watchlist Ledger Reconciliation
  const stage2dStart = Date.now();
  try {
    let usersToReconcile: any[] = [];
    if (options.targetUserId) {
      usersToReconcile = await database
        .select()
        .from(users)
        .where(eq(users.id, options.targetUserId));
    } else {
      usersToReconcile = await database
        .select()
        .from(users)
        .where(isNotNull(users.mypUsername));
    }

    const reconcileResults: any[] = [];
    for (const u of usersToReconcile) {
      if (u.mypUsername) {
        try {
          const rec = await reconcileUserWatchlist(u.id, {
            database,
            fetchQuero: async (username) => {
              return fetchPublicQueroList(username, customFetch);
            },
          });
          reconcileResults.push(rec);
        } catch (rErr: any) {
          reconcileResults.push({ userId: u.id, error: rErr.message });
        }
      }
    }

    stages.push({
      stage: "Stage 2d: Watchlist Ledger Reconciliation",
      status: "success",
      durationMs: Date.now() - stage2dStart,
      details: {
        usersReconciled: reconcileResults.length,
        results: reconcileResults,
      },
    });
  } catch (err: any) {
    stages.push({
      stage: "Stage 2d: Watchlist Ledger Reconciliation",
      status: "failed",
      durationMs: Date.now() - stage2dStart,
      error: err.message,
    });
  }

  // Stage 2e: Automated Watchlist Mutation Execution
  const stage2eStart = Date.now();
  try {
    let usersToMutate: any[] = [];
    if (options.targetUserId) {
      usersToMutate = await database
        .select()
        .from(users)
        .where(and(eq(users.id, options.targetUserId), isNotNull(users.mypPasswordEncrypted)));
    } else {
      usersToMutate = await database
        .select()
        .from(users)
        .where(isNotNull(users.mypPasswordEncrypted));
    }

    const mutationResults: any[] = [];
    for (const u of usersToMutate) {
      try {
        const mRes = await executeAutomatedWatchlistSync(u.id, { database });
        mutationResults.push({ userId: u.id, ...mRes });
      } catch (mErr: any) {
        mutationResults.push({ userId: u.id, error: mErr.message });
      }
    }

    stages.push({
      stage: "Stage 2e: Automated Watchlist Mutation Execution",
      status: "success",
      durationMs: Date.now() - stage2eStart,
      details: {
        usersProcessed: mutationResults.length,
        results: mutationResults,
      },
    });
  } catch (err: any) {
    stages.push({
      stage: "Stage 2e: Automated Watchlist Mutation Execution",
      status: "failed",
      durationMs: Date.now() - stage2eStart,
      error: err.message,
    });
  }

  // Stage 3: Meta Archetypes & Canonical Decklists Sync
  const stage3Start = Date.now();
  try {
    const res = await syncMetaArchetypes(database, customFetch);
    stages.push({
      stage: "Stage 3: Meta Archetypes & Canonical Decklists Sync",
      status: "success",
      durationMs: Date.now() - stage3Start,
      details: res,
    });
  } catch (err: any) {
    stages.push({
      stage: "Stage 3: Meta Archetypes & Canonical Decklists Sync",
      status: "failed",
      durationMs: Date.now() - stage3Start,
      error: err.message,
    });
  }

  const completedAt = Date.now();
  const hasFailures = stages.some((s) => s.status === "failed");

  return {
    startedAt,
    completedAt,
    totalDurationMs: completedAt - startedAt,
    stages,
    success: !hasFailures,
  };
}
