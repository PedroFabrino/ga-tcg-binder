import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import {
  users,
  cards,
  cardEditions,
  cardCirculations,
  collectionItems,
  decks,
  deckCards,
  mypMarketCards,
  mypWatchlist,
  metaStaples,
  type WatchlistStatus,
} from "../db/schema";
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
} from "./watchlist-policy";
import { fetchPublicQueroList, discoverMypProductPrintings } from "./watchlist-remote";
import { reconcileShortagePrinting, reconcileFilledShortage } from "./watchlist-state";

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
  discoverMypProductPrintings,
};

export interface ReconcileWatchlistOptions {
  database?: any;
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

export interface ReconcileWatchlistResult {
  userId: string;
  activeShortageCards: ReconciledShortageSummary[];
  filledShortageCards: string[];
  pendingAdds: number;
  pendingUpdates: number;
  pendingRemoves: number;
  watchingCount: number;
  ignoredCount: number;
}

/**
 * Reconciles the user's Watchlist Ledger against deck shortages, Binder holdings,
 * and live public MyP Quero items.
 */
export async function reconcileUserWatchlist(
  userId: string,
  options: ReconcileWatchlistOptions = {}
): Promise<ReconcileWatchlistResult> {
  const database = options.database || db;

  const user = await database
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!user) {
    throw new Error(`User not found with id ${userId}`);
  }

  const policy = getEffectiveQuotaPolicy(user);

  // 1. Fetch user decks & deck cards
  const userDecks = await database
    .select({ id: decks.id, name: decks.name })
    .from(decks)
    .where(eq(decks.userId, userId));

  const deckIds = userDecks.map((d: any) => d.id);
  let allDeckCards: any[] = [];
  if (deckIds.length > 0) {
    allDeckCards = await database
      .select({
        deckId: deckCards.deckId,
        cardSlug: deckCards.cardSlug,
        quantity: deckCards.quantity,
        zone: deckCards.zone,
        name: cards.name,
      })
      .from(deckCards)
      .innerJoin(cards, eq(deckCards.cardSlug, cards.slug))
      .where(inArray(deckCards.deckId, deckIds));
  }

  // 2. Fetch user collection items (Binder)
  const userInventory = await database
    .select({
      cardSlug: cardEditions.cardSlug,
      quantity: collectionItems.quantity,
    })
    .from(collectionItems)
    .innerJoin(cardEditions, eq(collectionItems.editionId, cardEditions.id))
    .where(eq(collectionItems.userId, userId));

  // 3. Fetch live MyP Quero items
  let liveQueroItems: ParsedMypItem[] = [];
  if (user.mypUsername) {
    if (options.fetchQuero) {
      liveQueroItems = await options.fetchQuero(user.mypUsername);
    } else {
      liveQueroItems = await fetchPublicQueroList(user.mypUsername);
    }
  }

  // Filter out any Collector Printings from live Quero items
  const liveStandardQuero = liveQueroItems.filter((item) => {
    return isStandardPlayablePrinting({
      setPrefix: item.setPrefix,
      collectorNumber: item.rawName,
      rarity: 1, // Unknown rarity from HTML, but check foil & collector keywords
      isFoil: item.isFoil,
      rawName: item.rawName,
    });
  });

  // 4. Fetch existing myp_watchlist rows for this user
  const existingWatchlistRows = await database
    .select()
    .from(mypWatchlist)
    .where(eq(mypWatchlist.userId, userId));

  const existingRowMap = new Map<string, any>();
  for (const row of existingWatchlistRows) {
    const key = `${row.cardSlug}:${row.editionSlug}:${row.collectorNumber}`.toUpperCase();
    existingRowMap.set(key, row);
  }

  // 5. Aggregate demands across decks per cardSlug, unioned with existing watchlist rows
  // so cards removed from all decks are transitioned to pending_remove
  const deckSlugs = allDeckCards.map((c: any) => String(c.cardSlug));
  const watchlistSlugs = existingWatchlistRows.map((r: any) => String(r.cardSlug));
  const uniqueSlugs = Array.from(new Set([...deckSlugs, ...watchlistSlugs]));

  // Fetch all editions and circulations for these unique slugs
  let allCatalogEditions: any[] = [];
  if (uniqueSlugs.length > 0) {
    allCatalogEditions = await database
      .select({
        id: cardEditions.id,
        cardSlug: cardEditions.cardSlug,
        setPrefix: cardEditions.setPrefix,
        collectorNumber: cardEditions.collectorNumber,
        rarity: cardEditions.rarity,
        imageUrl: cardEditions.imageUrl,
        foil: cardCirculations.foil,
        kind: cardCirculations.kind,
      })
      .from(cardEditions)
      .leftJoin(cardCirculations, eq(cardCirculations.editionId, cardEditions.id))
      .where(inArray(cardEditions.cardSlug, uniqueSlugs));
  }

  // Also fetch market pricing data
  let marketCards: any[] = [];
  if (uniqueSlugs.length > 0) {
    try {
      marketCards = await database
        .select()
        .from(mypMarketCards)
        .where(inArray(mypMarketCards.cardSlug, uniqueSlugs));
    } catch {
      // Fallback
    }
  }

  // Also fetch staple recommendations if staples policy is active
  const stapleMap = new Map<string, number>();
  if (user.watchlistPolicyStaples && uniqueSlugs.length > 0) {
    try {
      const staplesList = await database
        .select({
          cardSlug: metaStaples.cardSlug,
          recommendedCopies: metaStaples.recommendedCopies,
        })
        .from(metaStaples)
        .where(inArray(metaStaples.cardSlug, uniqueSlugs));
      for (const s of staplesList) {
        stapleMap.set(s.cardSlug, s.recommendedCopies);
      }
    } catch {
      // Fallback
    }
  }

  const activeShortageCards: ReconciledShortageSummary[] = [];
  const filledShortageCards: string[] = [];

  for (const slug of uniqueSlugs) {
    const matchingDeckCards = allDeckCards.filter((c: any) => c.cardSlug === slug);
    const existingRowsForSlug = existingWatchlistRows.filter((r: any) => r.cardSlug === slug);
    const cardName = matchingDeckCards[0]?.name || existingRowsForSlug[0]?.cardName || slug;

    const totalDemand = matchingDeckCards.reduce((sum: number, c: any) => sum + c.quantity, 0);

    const demandByDeck: Record<string, number> = {};
    for (const c of matchingDeckCards) {
      demandByDeck[c.deckId] = (demandByDeck[c.deckId] || 0) + c.quantity;
    }
    const peakDemand = Object.values(demandByDeck).reduce((max: number, q: number) => Math.max(max, q), 0);

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
      .filter((inv: any) => inv.cardSlug === slug)
      .reduce((sum: number, inv: any) => sum + inv.quantity, 0);

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
        (e: any) =>
          e.cardSlug === slug &&
          isStandardPlayablePrinting({
            setPrefix: e.setPrefix,
            collectorNumber: e.collectorNumber,
            rarity: e.rarity,
            isFoil: Boolean(e.foil),
          })
      );

      // De-duplicate editions by (setPrefix, collectorNumber)
      const uniquePrintings = new Map<string, any>();
      for (const ed of candidateEditions) {
        const pKey = `${ed.setPrefix}:${ed.collectorNumber}`.toUpperCase();
        if (!uniquePrintings.has(pKey)) {
          uniquePrintings.set(pKey, ed);
        }
      }

      // Check for 0-stock discovery if any printing lacks MyP info
      let discoveredItems: ParsedMypItem[] = [];
      const discoveryFn = options.discoverPrintings || discoverMypProductPrintings;
      const needsDiscovery = Array.from(uniquePrintings.values()).some((ed) => {
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

        // Find pricing & product URL
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

        const mypItemId = mkt?.mypItemId || discovered?.mypItemId || null;
        const mypProductUrl = mkt?.mypProductUrl || discovered?.mypProductUrl || null;

        // Check if on live MyP Quero
        const liveMatch = liveStandardQuero.find(
          (q) =>
            (q.cleanName.toLowerCase() === cardName.toLowerCase() ||
              q.rawName.toLowerCase().includes(cardName.toLowerCase())) &&
            q.setPrefix.toUpperCase() === printing.setPrefix.toUpperCase()
        );

        await reconcileShortagePrinting({
          database,
          userId,
          slug,
          cardName,
          printing,
          missing,
          targetPriceBrl,
          mypItemId,
          mypProductUrl,
          existingRow,
          liveMatch,
        });
      }
    } else {
      // missing === 0 -> Quota filled!
      filledShortageCards.push(slug);

      const rowsForCard = existingWatchlistRows.filter((r: any) => r.cardSlug === slug);
      await reconcileFilledShortage(database, rowsForCard);
    }
  }

  // 6. Summary metrics
  const finalRows = await database
    .select()
    .from(mypWatchlist)
    .where(eq(mypWatchlist.userId, userId));

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
  database: any = db
): Promise<void> {
  await database
    .update(mypWatchlist)
    .set({
      status: "pending_add",
      updatedAt: sql`(strftime('%s', 'now'))`,
    })
    .where(eq(mypWatchlist.id, watchlistId));
}
