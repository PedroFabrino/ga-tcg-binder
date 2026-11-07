/**
 * Featured Set Shortage Ranking & Checklist Service
 *
 * Pure domain orchestration: loads bulk data from the repository and computes
 * per-card shortages, multiset attribution, per-group summaries, and checklist
 * reports. Zero SQL; all queries live in src/db/repositories/set-repository.ts.
 */

import {
  loadSetShortageAndInventoryData,
  loadSetGroupChecklist,
  getUserHiddenSetUuids,
  setUserHiddenSetUuids,
  getFeaturedSetGroupBySlug,
  getFeaturedSetGroupByUuid,
} from "@/db/repositories/set-repository";
import type { SetRepositoryDatabase } from "@/db/repositories/set-repository";
import {
  cardToGroupsMap,
  categoryFromNames,
  computeCardShortage,
  computeShortages,
  computeSummariesFromData,
  filterTargetDemandCards,
  groupDefs,
  prefixToGroupMap,
  slugsInGroup,
  type DemandCard,
} from "./set-shortage-math";
import { allocateCardDemand, type DeckCardDemand } from "./deck-allocation";
import { matchesSetChecklistFilters } from "@ga/contracts";
import type {
  FeaturedSetSummary,
  FeaturedSetsResponse,
  SetGroupStats,
  SetChecklistFilters,
  SetShortageLevel,
  SetDeckRequirement,
  SetPrinting,
  SetChecklistReportCard,
  SetGroupChecklistReport,
} from "@ga/contracts";

export interface SetShortageOptions {
  target?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Rank all featured set groups by deck shortages and set completion. */
export async function calculateFeaturedSetSummaries(
  userId: string,
  optionsOrDatabase?: SetShortageOptions | SetRepositoryDatabase,
  database?: SetRepositoryDatabase,
): Promise<FeaturedSetSummary[]> {
  const options =
    optionsOrDatabase && "target" in optionsOrDatabase
      ? optionsOrDatabase
      : undefined;
  const db =
    optionsOrDatabase && !("target" in optionsOrDatabase)
      ? (optionsOrDatabase as SetRepositoryDatabase)
      : database;

  const data = await loadSetShortageAndInventoryData(userId, db);
  return computeSummariesFromData(data, options?.target);
}

/** Returns all data needed for the /sets dashboard view including available target decks. */
export async function getFeaturedSetsDashboardData(
  userId: string,
  optionsOrDatabase?: SetShortageOptions | SetRepositoryDatabase,
  database?: SetRepositoryDatabase,
): Promise<FeaturedSetsResponse> {
  const options =
    optionsOrDatabase && "target" in optionsOrDatabase
      ? optionsOrDatabase
      : undefined;
  const db =
    optionsOrDatabase && !("target" in optionsOrDatabase)
      ? (optionsOrDatabase as SetRepositoryDatabase)
      : database;

  const data = await loadSetShortageAndInventoryData(userId, db);
  const groups = computeSummariesFromData(data, options?.target);
  const hiddenCount = groups.filter((g) => g.isHidden).length;

  return {
    groups,
    hiddenCount,
    availableDecks: data.userDecks ?? [],
    hasPersonalWants: (data.personalWants ?? []).length > 0,
    currentTarget: options?.target ?? "all",
  };
}

/** Build a checklist report (group stats + one row per distinct card slug). */
export async function getSetGroupChecklistReport(
  slugOrUuid: string,
  userId: string,
  options?: { filters?: SetChecklistFilters; target?: string },
  database?: SetRepositoryDatabase,
): Promise<SetGroupChecklistReport | null> {
  // Resolve group
  const bySlug = await getFeaturedSetGroupBySlug(slugOrUuid, database);
  const resolved =
    bySlug ?? (await getFeaturedSetGroupByUuid(slugOrUuid, database));
  if (!resolved) return null;

  const defs = resolved.setDefinitions;
  const releaseDates = defs
    .map((d) => d.releaseDate)
    .filter((d): d is string => Boolean(d))
    .sort();

  // Parse release date at T12:00:00 to avoid timezone shifts
  const releaseDate = releaseDates[0] ?? null;

  const group = {
    uuid: resolved.uuid,
    name: resolved.name,
    slug: resolved.slug,
    imageUrl: resolved.imageUrl ?? null,
    releaseDate,
    childPrefixes: [...new Set(defs.map((d) => d.prefix))].sort(),
    category: categoryFromNames(defs.map((d) => d.name)),
  };

  const checklist = await loadSetGroupChecklist(group.uuid, userId, database);
  if (!checklist) return null;
  const {
    editions,
    cards: cardRows,
    collection,
    deckCards: allDeckCards = [],
    userDecks = [],
    personalWants = [],
  } = checklist;

  // Lookups: card metadata, editions by slug
  const edsBySlug = new Map<string, typeof editions>();
  for (const e of editions) {
    const l = edsBySlug.get(e.cardSlug);
    if (l) l.push(e);
    else edsBySlug.set(e.cardSlug, [e]);
  }

  const colBySlug = new Map<string, number>();
  const normalBySlug = new Map<string, number>();
  const foilBySlug = new Map<string, number>();
  for (const ci of collection) {
    colBySlug.set(
      ci.cardSlug,
      (colBySlug.get(ci.cardSlug) ?? 0) + ci.quantity,
    );
    // foil is integer (0/1) from the repository query
    if (ci.foil) {
      foilBySlug.set(
        ci.cardSlug,
        (foilBySlug.get(ci.cardSlug) ?? 0) + ci.quantity,
      );
    } else {
      normalBySlug.set(
        ci.cardSlug,
        (normalBySlug.get(ci.cardSlug) ?? 0) + ci.quantity,
      );
    }
  }

  // Filter demand according to target
  const groupSlugSet = new Set(cardRows.map((c) => c.slug));
  const targetDemandCards = filterTargetDemandCards(
    allDeckCards,
    personalWants,
    options?.target,
  );

  const targetDemandsBySlug = new Map<string, DemandCard[]>();
  for (const dc of targetDemandCards) {
    if (!groupSlugSet.has(dc.cardSlug)) continue;
    const list = targetDemandsBySlug.get(dc.cardSlug) ?? [];
    list.push(dc);
    targetDemandsBySlug.set(dc.cardSlug, list);
  }

  // Build cards
  const allCards: SetChecklistReportCard[] = [];
  for (const row of cardRows) {
    const eds = edsBySlug.get(row.slug) ?? [];
    const ownedTotal = colBySlug.get(row.slug) ?? 0;
    const ownedNormal = normalBySlug.get(row.slug) ?? 0;
    const ownedFoil = foilBySlug.get(row.slug) ?? 0;
    const demands = targetDemandsBySlug.get(row.slug) ?? [];

    const deckDemands: DeckCardDemand[] = demands.map((d) => ({
      deckId: d.deckId,
      deckName: d.deckName,
      section: d.section ?? "4fun",
      priority: d.priority ?? 0,
      createdAt: d.createdAt,
      demand: d.quantity,
    }));

    const alloc = allocateCardDemand(ownedTotal, deckDemands);
    const allocMap = new Map(alloc.deckAllocations.map((a) => [a.deckId, a]));

    const peakMissing = alloc.peakMissing;
    const concurrentMissing = alloc.concurrentMissing;
    const required = deckDemands.reduce((s, d) => s + d.demand, 0);
    const missing = Math.max(0, required - ownedTotal);

    const deckReqs: SetDeckRequirement[] = demands.map((d) => {
      const a = allocMap.get(d.deckId);
      return {
        deckId: d.deckId,
        deckName: d.deckName,
        quantity: d.quantity,
        section: d.section ?? "4fun",
        priority: d.priority ?? 0,
        hardMissing: a?.hardMissing ?? 0,
        sharedMissing: a?.sharedMissing ?? 0,
      };
    });

    // Prefer first (lowest collector number) edition in narrowest prefix
    const sortedEds = [...eds].sort(
      (a, b) =>
        Number.parseInt(a.collectorNumber.replace(/\D/g, "") || "0", 10) -
        Number.parseInt(b.collectorNumber.replace(/\D/g, "") || "0", 10),
    );
    const preferredEditionId = sortedEds[0]?.id ?? null;

    // Derive shortage level
    let shortage: SetShortageLevel = "none";
    if (peakMissing > 0) {
      shortage = "hard";
    } else if (concurrentMissing > 0) {
      shortage = "shared";
    }

    // Rarities: collect all distinct rarities across printings
    const rarityValues = [...new Set(eds.map((e) => e.rarity))];
    // Highest rarity (lowest number = highest rarity in GA)
    const highestRarity = rarityValues.length > 0 ? Math.min(...rarityValues) : 0;

    const printings: SetPrinting[] = eds.map((e) => ({
      editionId: e.id,
      setPrefix: e.setPrefix,
      setName: e.setName,
      collectorNumber: e.collectorNumber,
      rarity: e.rarity,
      imageUrl: e.imageUrl ?? null,
    }));

    const prefixes = [...new Set(eds.map((e) => e.setPrefix))].sort();

    const card: SetChecklistReportCard = {
      cardSlug: row.slug,
      cardName: row.name,
      element: row.element ?? "",
      class: row.class ?? "",
      type: row.type ?? "",
      rarity: highestRarity,
      rarities: rarityValues,
      imageUrl: eds[0]?.imageUrl ?? null,
      prefixes,
      ownedQuantity: ownedTotal,
      requiredQuantity: required,
      missingQuantity: missing,
      isShortage: missing > 0,
      requiringDeckIds: [...new Set(deckReqs.map((dr) => dr.deckId))],
      printings,
      preferredEditionId,
      ownedNormal,
      ownedFoil,
      peakMissing,
      concurrentMissing,
      shortage,
      deckRequirements: deckReqs,
    };

    allCards.push(card);
  }

  // Apply filters if provided
  const filters = options?.filters;
  const filtered = filters
    ? allCards.filter((c) => matchesSetChecklistFilters(c, filters))
    : allCards;

  // Stats: hard = Σ peakMissing, shared = Σ (concurrentMissing − peakMissing),
  // total = hard + shared, all computed over every short card (matching the
  // dashboard summary).
  const stats: SetGroupStats = {
    totalGroups: 1,
    totalHardShortageCopies: allCards
      .filter((c) => c.shortage !== "none")
      .reduce((s, c) => s + c.peakMissing, 0),
    totalSharedShortageCopies: allCards
      .filter((c) => c.shortage !== "none")
      .reduce((s, c) => s + (c.concurrentMissing - c.peakMissing), 0),
    totalShortageCopies: allCards
      .filter((c) => c.shortage !== "none")
      .reduce((s, c) => s + c.concurrentMissing, 0),
    totalCardsAcrossGroups: allCards.length,
    totalOwnedCardsAcrossGroups: allCards.filter((c) => c.ownedQuantity > 0)
      .length,
    overallCompletionPercent:
      allCards.length > 0
        ? Math.round(
            (allCards.filter((c) => c.ownedQuantity > 0).length /
              allCards.length) *
              100,
          )
        : 0,
  };

  return {
    group,
    stats,
    cards: filtered,
    availableDecks: userDecks,
    hasPersonalWants: personalWants.length > 0,
    currentTarget: options?.target ?? "all",
  };
}

/** Toggle visibility. */
export async function toggleUserSetHidden(
  userId: string,
  groupUuid: string,
  isHidden: boolean,
  database?: SetRepositoryDatabase,
): Promise<string[]> {
  const resolved = await getFeaturedSetGroupByUuid(groupUuid, database);
  if (!resolved) throw new SetGroupNotFoundError(groupUuid);

  const current = await getUserHiddenSetUuids(userId, database);
  let next: string[];
  if (isHidden && !current.includes(groupUuid)) {
    next = [...current, groupUuid];
  } else if (!isHidden) {
    next = current.filter((u) => u !== groupUuid);
  } else {
    return current;
  }

  await setUserHiddenSetUuids(userId, next, database);
  return next;
}

export class SetGroupNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Set group not found: ${identifier}`);
    this.name = "SetGroupNotFoundError";
  }
}