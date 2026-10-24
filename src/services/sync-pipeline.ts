import { syncMetaStaples } from "./meta-staples";
import {
  syncUserMarketplace,
  enrichMarketplaceTcgPrices,
} from "./marketplace";
import { syncGlobalMarketplace } from "./myp-sync";
import { syncMetaArchetypes } from "./meta";
import { reconcileUserWatchlist, fetchPublicQueroList } from "./watchlist";
import { executeAutomatedWatchlistSync } from "./watchlist-sync-runner";
import { dispatchDealAlerts } from "./discord-deal-notifier";
import {
  getUsersWithMypUsername,
  getUsersForAutomatedWatchlistSync,
} from "../db/repositories/settings-repository";
import { hasCatalogData } from "../db/repositories/shortage-repository";

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
  database: unknown,
  options: PipelineOptions = {}
): Promise<PipelineExecutionReport> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- repositories accept in-memory test database or singleton db
  const dbParam = database as any;
  const customFetch = options.customFetch || fetch;
  const startedAt = Date.now();
  const stages: PipelineStageResult[] = [];

  // Stage 0: Catalog Check
  const stage0Start = Date.now();
  try {
    const hasCards = await hasCatalogData(dbParam);
    stages.push({
      stage: "Stage 0: Catalog Check",
      status: "success",
      durationMs: Date.now() - stage0Start,
      details: {
        hasCatalogData: hasCards,
      },
    });
  } catch (err: unknown) {
    stages.push({
      stage: "Stage 0: Catalog Check",
      status: "failed",
      durationMs: Date.now() - stage0Start,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Stage 1: Meta Staples Sync
  const stage1Start = Date.now();
  try {
    const res = await syncMetaStaples(dbParam, customFetch);
    stages.push({
      stage: "Stage 1: Meta Staples Sync",
      status: "success",
      durationMs: Date.now() - stage1Start,
      details: res,
    });
  } catch (err: unknown) {
    stages.push({
      stage: "Stage 1: Meta Staples Sync",
      status: "failed",
      durationMs: Date.now() - stage1Start,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Stage 2a: Personal MyP Store Sync
  const stage2aStart = Date.now();
  try {
    const usersToSync = await getUsersWithMypUsername(options.targetUserId, dbParam);
    const syncSummaries: Record<string, unknown>[] = [];
    for (const u of usersToSync) {
      if (u.mypUsername) {
        try {
          const userRes = await syncUserMarketplace(
            u.id,
            u.mypUsername,
            dbParam,
            options.customFetch
          );
          syncSummaries.push({ userId: u.id, ...userRes });
        } catch (uErr: unknown) {
          syncSummaries.push({
            userId: u.id,
            username: u.mypUsername,
            error: uErr instanceof Error ? uErr.message : String(uErr),
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
  } catch (err: unknown) {
    stages.push({
      stage: "Stage 2a: Personal MyP Store Sync",
      status: "failed",
      durationMs: Date.now() - stage2aStart,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Stage 2b: Global MyP Market Sync
  const stage2bStart = Date.now();
  try {
    const res = await syncGlobalMarketplace(dbParam, options.customFetch);
    stages.push({
      stage: "Stage 2b: Global MyP Market Sync",
      status: "success",
      durationMs: Date.now() - stage2bStart,
      details: res,
    });
  } catch (err: unknown) {
    stages.push({
      stage: "Stage 2b: Global MyP Market Sync",
      status: "failed",
      durationMs: Date.now() - stage2bStart,
      error: err instanceof Error ? err.message : String(err),
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
      dbParam,
      options.customFetch
    );
    stages.push({
      stage: "Stage 2c: Deck Shortages TCG Price Enrichment",
      status: "success",
      durationMs: Date.now() - stage2cStart,
      details: res,
    });
  } catch (err: unknown) {
    stages.push({
      stage: "Stage 2c: Deck Shortages TCG Price Enrichment",
      status: "failed",
      durationMs: Date.now() - stage2cStart,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Stage 2d: Watchlist Ledger Reconciliation
  const stage2dStart = Date.now();
  try {
    const usersToReconcile = await getUsersWithMypUsername(options.targetUserId, dbParam);

    const reconcileResults: Record<string, unknown>[] = [];
    for (const u of usersToReconcile) {
      if (u.mypUsername) {
        try {
          const rec = await reconcileUserWatchlist(u.id, {
            database: dbParam,
            fetchQuero: async (username) => {
              return fetchPublicQueroList(username, customFetch);
            },
          });
          reconcileResults.push(rec as unknown as Record<string, unknown>);
        } catch (rErr: unknown) {
          reconcileResults.push({ userId: u.id, error: rErr instanceof Error ? rErr.message : String(rErr) });
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
  } catch (err: unknown) {
    stages.push({
      stage: "Stage 2d: Watchlist Ledger Reconciliation",
      status: "failed",
      durationMs: Date.now() - stage2dStart,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Stage 2e: Automated Watchlist Mutation Execution
  const stage2eStart = Date.now();
  try {
    const usersToMutate = await getUsersForAutomatedWatchlistSync(options.targetUserId, dbParam);

    const mutationResults: Record<string, unknown>[] = [];
    for (const u of usersToMutate) {
      if (!options.targetUserId && !u.mypAutoWatchlistEnabled) {
        continue;
      }
      try {
        const mRes = await executeAutomatedWatchlistSync(u.id, { database: dbParam });
        mutationResults.push({ userId: u.id, ...mRes });
      } catch (mErr: unknown) {
        mutationResults.push({ userId: u.id, error: mErr instanceof Error ? mErr.message : String(mErr) });
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

  // Stage 2f: Wantlist Deal Alert Dispatch
  const stage2fStart = Date.now();
  try {
    const res = await dispatchDealAlerts(dbParam, undefined, undefined, {
      forceRefresh: true,
    });
    stages.push({
      stage: "Stage 2f: Wantlist Deal Alert Dispatch",
      status: "success",
      durationMs: Date.now() - stage2fStart,
      details: res,
    });
  } catch (err: unknown) {
    stages.push({
      stage: "Stage 2f: Wantlist Deal Alert Dispatch",
      status: "failed",
      durationMs: Date.now() - stage2fStart,
      error: err instanceof Error ? err.message : String(err),
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
