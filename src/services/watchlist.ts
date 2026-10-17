import {
  loadWatchlistReconciliationData,
  getWatchlistByUser,
  updateWatchlistEntry,
  markWatchlistItemsWatching,
  deleteWatchlistItemsByIds,
  type WatchlistRow,
} from "@/db/repositories/watchlist-repository";
import { getUserById, updateUserSettings } from "@/db/repositories/settings-repository";
import { DEFAULT_USER_ID } from "@/services/seed";
import { type ParsedMypItem } from "./marketplace";
import {
  type WatchlistQuotaPolicy,
  type StandardPlayablePrintingCandidate,
  isStandardPlayablePrinting,
  isCollectorPrinting,
  computeQuotaForCard,
  computeCombinedQuota,
  getEffectiveQuotaPolicy,
  summarizeWatchlistRows,
  normalizePolicyFlags,
  type WatchlistStatusCounts,
} from "./watchlist-policy";
import { fetchPublicQueroList, discoverMypProductPrintings } from "./watchlist-remote";
import {
  reconcileShortagePrinting,
  reconcileFilledShortage,
  type PrintingTarget,
  type ReconcileContext,
} from "./watchlist-state";

export {
  type WatchlistQuotaPolicy,
  type StandardPlayablePrintingCandidate,
  isStandardPlayablePrinting,
  isCollectorPrinting,
  computeQuotaForCard,
  computeCombinedQuota,
  getEffectiveQuotaPolicy,
  summarizeWatchlistRows,
  fetchPublicQueroList,
};

export interface ReconcileWatchlistOptions {
  database?: unknown;
  fetchQuero?: (username: string) => Promise<ParsedMypItem[]>;
  discoverPrintings?: (cardName: string) => Promise<ParsedMypItem[]>;
}

export interface ReconciledShortageSummary {
  cardSlug: string;
  cardName: string;
  quota: number;
  binderOwned: number;
  missing: number;
}

export interface ReconcileWatchlistResult extends WatchlistStatusCounts {
  userId: string;
  activeShortageCards: ReconciledShortageSummary[];
  filledShortageCards: string[];
}

/**
 * Executes a two-way reconciliation between local collection shortages
 * and live public MyP Quero items.
 */
export async function reconcileUserWatchlist(
  userId: string,
  options: ReconcileWatchlistOptions = {}
): Promise<ReconcileWatchlistResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- repositories accept in-memory test database or singleton db
  const database = options.database as any;

  // 1. Load all reconciliation data via repository
  const {
    user,
    allDeckCards,
    userInventory,
    existingWatchlistRows,
    allCatalogEditions,
    marketCards,
    stapleMap,
    uniqueSlugs,
  } = await loadWatchlistReconciliationData(userId, database);

  // 2. Fetch live MyP Quero items
  let liveQueroItems: ParsedMypItem[] = [];
  let hasLiveQueroSnapshot = false;
  if (user.mypUsername) {
    try {
      if (options.fetchQuero) {
        liveQueroItems = await options.fetchQuero(user.mypUsername);
      } else {
        liveQueroItems = await fetchPublicQueroList(user.mypUsername);
      }
      hasLiveQueroSnapshot = true;
    } catch {
      hasLiveQueroSnapshot = false;
    }
  }

  // Filter out any Collector Printings from live Quero items
  const liveStandardQuero = liveQueroItems.filter((item) => {
    return isStandardPlayablePrinting({
      setPrefix: item.setPrefix,
      collectorNumber: item.rawName,
      rarity: 1,
      isFoil: item.isFoil,
      rawName: item.rawName,
    });
  });

  const existingRowMap = new Map<string, WatchlistRow>();
  for (const row of existingWatchlistRows) {
    const key = `${row.cardSlug}:${row.editionSlug}:${row.collectorNumber}`.toUpperCase();
    existingRowMap.set(key, row);
  }

  const activeShortageCards: ReconciledShortageSummary[] = [];
  const filledShortageCards: string[] = [];

  for (const slug of uniqueSlugs) {
    const matchingDeckCards = allDeckCards.filter((c) => c.cardSlug === slug);
    const existingRowsForSlug = existingWatchlistRows.filter((r) => r.cardSlug === slug);
    const cardName = matchingDeckCards[0]?.name || existingRowsForSlug[0]?.cardName || slug;

    const totalDemand = matchingDeckCards.reduce((sum, c) => sum + c.quantity, 0);

    const demandByDeck: Record<string, number> = {};
    for (const c of matchingDeckCards) {
      demandByDeck[c.deckId] = (demandByDeck[c.deckId] || 0) + c.quantity;
    }
    const peakDemand = Object.values(demandByDeck).reduce((max, q) => Math.max(max, q), 0);

    const stapleCopies = stapleMap.get(slug) || 0;
    const quota = computeCombinedQuota({
      totalDemand,
      peakDemand,
      policyHard: Boolean(user.watchlistPolicyHard),
      policyShared: Boolean(user.watchlistPolicyShared),
      policyStaples: Boolean(user.watchlistPolicyStaples),
      stapleCopies,
    });

    const ownedCopies = userInventory
      .filter((inv) => inv.cardSlug === slug)
      .reduce((sum, inv) => sum + inv.quantity, 0);

    const missing = Math.max(0, quota - ownedCopies);

    if (missing > 0) {
      activeShortageCards.push({
        cardSlug: slug,
        cardName,
        quota,
        binderOwned: ownedCopies,
        missing,
      });

      // Filter to Standard Playable Printings for this card
      const candidateEditions = allCatalogEditions.filter(
        (e) =>
          e.cardSlug === slug &&
          isStandardPlayablePrinting({
            setPrefix: e.setPrefix,
            collectorNumber: e.collectorNumber,
            rarity: e.rarity,
            isFoil: Boolean(e.foil),
          })
      );

      // De-duplicate editions by (setPrefix, collectorNumber)
      const uniquePrintings = new Map<string, typeof candidateEditions[0]>();
      for (const ed of candidateEditions) {
        const pKey = `${ed.setPrefix}:${ed.collectorNumber}`.toUpperCase();
        if (!uniquePrintings.has(pKey)) {
          uniquePrintings.set(pKey, ed);
        }
      }

      // Check for 0-stock discovery if any printing lacks MyP info and is not already cached in DB
      let discoveredItems: ParsedMypItem[] = [];
      const discoveryFn = options.discoverPrintings || discoverMypProductPrintings;
      const needsDiscovery = Array.from(uniquePrintings.values()).some((ed) => {
        const key = `${slug}:${ed.setPrefix}:${ed.collectorNumber}`.toUpperCase();
        const existingRow = existingRowMap.get(key);
        if (existingRow?.mypItemId) return false; // Already discovered and cached

        return !marketCards.some(
          (m) =>
            m.cardSlug === slug &&
            m.setPrefix.toUpperCase() === ed.setPrefix.toUpperCase() &&
            !m.isFoil
        );
      });

      if (needsDiscovery) {
        try {
          discoveredItems = await discoveryFn(cardName);
        } catch {
          // Graceful fallback
        }
      }

      for (const printing of uniquePrintings.values()) {
        const key = `${slug}:${printing.setPrefix}:${printing.collectorNumber}`.toUpperCase();
        const existingRow = existingRowMap.get(key);

        const mkt = marketCards.find(
          (m) =>
            m.cardSlug === slug &&
            m.setPrefix.toUpperCase() === printing.setPrefix.toUpperCase() &&
            !m.isFoil
        );

        const discovered = discoveredItems.find(
          (d) =>
            d.setPrefix.toUpperCase() === printing.setPrefix.toUpperCase() &&
            !d.isFoil
        );

        const targetPriceBrl =
          mkt?.tcgPriceNumeric ??
          mkt?.priceNumeric ??
          (discovered ? Number(discovered.price.replace(/[^0-9,.]/g, "").replace(",", ".")) : null) ??
          1.0;

        const mypItemId = mkt?.mypItemId || discovered?.mypItemId || existingRow?.mypItemId || null;
        const mypProductUrl = mkt?.mypProductUrl || discovered?.mypProductUrl || existingRow?.mypProductUrl || null;

        // Check if on live MyP Quero
        const liveMatch = liveStandardQuero.find(
          (q) =>
            (q.cleanName.toLowerCase() === cardName.toLowerCase() ||
              q.rawName.toLowerCase().includes(cardName.toLowerCase())) &&
            q.setPrefix.toUpperCase() === printing.setPrefix.toUpperCase()
        );

        const target: PrintingTarget = {
          slug,
          cardName,
          setPrefix: printing.setPrefix,
          collectorNumber: printing.collectorNumber,
          missing,
          targetPriceBrl,
          mypItemId,
          mypProductUrl,
        };

        const ctx: ReconcileContext = {
          userId,
          database,
          hasLiveQueroSnapshot,
          existingRow,
          liveMatch,
        };

        await reconcileShortagePrinting(target, ctx);
      }
    } else {
      // missing === 0 -> Quota filled!
      filledShortageCards.push(slug);

      const rowsForCard = existingWatchlistRows.filter((r) => r.cardSlug === slug);
      if (rowsForCard.length > 0) {
        await reconcileFilledShortage(rowsForCard, database);
      }
    }
  }

  // 3. Summary metrics
  const finalRows = await getWatchlistByUser(userId, database);
  const summaryCounts = summarizeWatchlistRows(finalRows);

  return {
    userId,
    activeShortageCards,
    filledShortageCards,
    ...summaryCounts,
  };
}

/**
 * Re-enables an ignored watchlist entry back to pending_add.
 */
export async function reEnableWatchlistEntry(
  watchlistId: string,
  database?: unknown
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- repositories accept DrizzleDatabase or test mock
  await updateWatchlistEntry(watchlistId, { status: "pending_add" }, database as any);
}

/**
 * Domain service for fetching watchlist ledger rows and user summary metrics.
 */
export async function getWatchlistSummaryService(userId: string) {
  const user = await getUserById(userId);
  const items = await getWatchlistByUser(userId);

  const activePolicy = getEffectiveQuotaPolicy(user);
  const summaryCounts = summarizeWatchlistRows(items);

  return {
    items,
    summary: {
      activePolicy,
      ...summaryCounts,
      hasSavedMypCredentials: Boolean(user?.mypPasswordEncrypted),
      mypUsername: user?.mypUsername || null,
      watchlistSyncToken: user?.watchlistSyncToken || null,
      mypAutoWatchlistEnabled: Boolean(user?.mypAutoWatchlistEnabled),
    },
  };
}

/**
 * Domain service for updating watchlist quota policies and triggering reconciliation.
 */
export async function updateWatchlistPoliciesService(
  userId: string,
  policies: {
    hard?: boolean;
    shared?: boolean;
    staples?: boolean;
    legacyPolicy?: string;
  }
) {
  const flags = normalizePolicyFlags(policies);

  await updateUserSettings(userId, {
    watchlistPolicyHard: flags.hard,
    watchlistPolicyShared: flags.shared,
    watchlistPolicyStaples: flags.staples,
  });

  const report = await reconcileUserWatchlist(userId);
  return { policy: flags, report };
}

export interface ConfirmWatchlistSyncParams {
  userId?: string;
  sessionUserId?: string;
  syncToken?: string | null;
  confirmedAddIds: string[];
  confirmedUpdateIds: string[];
  confirmedRemoveIds: string[];
}

/**
 * Domain service for processing userscript confirmations and hard-deleting satisfied quotas.
 */
export async function confirmWatchlistSyncService(params: ConfirmWatchlistSyncParams): Promise<{
  success: boolean;
  updatedCount: number;
  error?: string;
  status?: number;
}> {
  let targetUserId = params.sessionUserId;

  // Cross-origin verification for Browser Userscript Bridge on mypcards.com
  if (!targetUserId && params.userId) {
    const user = await getUserById(params.userId);
    if (user && user.watchlistSyncToken && params.syncToken === user.watchlistSyncToken) {
      targetUserId = user.id;
    } else if (process.env.NODE_ENV !== "production" && params.userId === DEFAULT_USER_ID) {
      targetUserId = DEFAULT_USER_ID;
    } else {
      return { success: false, updatedCount: 0, error: "Unauthorized: Invalid sync token", status: 401 };
    }
  }

  if (!targetUserId) {
    targetUserId = DEFAULT_USER_ID;
  }

  let updatedCount = 0;
  const watchingIds = Array.from(new Set([...params.confirmedAddIds, ...params.confirmedUpdateIds]));
  if (watchingIds.length > 0) {
    const count = await markWatchlistItemsWatching(targetUserId, watchingIds);
    updatedCount += count;
  }

  if (params.confirmedRemoveIds.length > 0) {
    const count = await deleteWatchlistItemsByIds(targetUserId, params.confirmedRemoveIds);
    updatedCount += count;
  }

  return { success: true, updatedCount };
}
