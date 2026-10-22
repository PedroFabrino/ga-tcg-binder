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
import { matchesSetChecklistFilters } from "@ga/contracts";
import type {
  FeaturedSetSummary,
  SetGroupStats,
  SetChecklistCard,
  SetChecklistFilters,
} from "@ga/contracts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SetShortageLevel = "hard" | "shared" | "none";

export interface DeckRequirement {
  deckId: string;
  deckName: string;
  quantity: number;
}

export interface SetChecklistReportCard extends SetChecklistCard {
  /** All printings (editions) of this card within the group. */
  printings: Array<{
    editionId: string;
    setPrefix: string;
    setName: string;
    collectorNumber: string;
    rarity: number;
    imageUrl: string | null;
  }>;
  /** Preferred edition ID: first (lowest collector number) in narrowest prefix. */
  preferredEditionId: string | null;
  ownedNormal: number;
  ownedFoil: number;
  peakMissing: number;
  concurrentMissing: number;
  shortage: SetShortageLevel;
  /** Per-deck quantity requirements (deckId, deckName, quantity). */
  deckRequirements: DeckRequirement[];
}

export interface SetGroupChecklistReport {
  group: { uuid: string; name: string; slug: string; imageUrl: string | null };
  stats: SetGroupStats;
  cards: SetChecklistReportCard[];
}

export class SetGroupNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Set group not found: ${identifier}`);
    this.name = "SetGroupNotFoundError";
  }
}

// ---------------------------------------------------------------------------
// Internal pure helpers
// ---------------------------------------------------------------------------

interface PerCardShortage {
  peakMissing: number;
  concurrentMissing: number;
  deckIds: string[];
}

/** peakMissing = max(0, peakDemand - owned), concurrentMissing = max(0, totalDemand - owned) */
function computeShortages(
  allDeckCards: Array<{ deckId: string; cardSlug: string; quantity: number }>,
  userCollection: Array<{ cardSlug: string; quantity: number }>,
): Map<string, PerCardShortage> {
  // Aggregate deck demand per card slug
  const demandByCard = new Map<string, Map<string, number>>();
  for (const dc of allDeckCards) {
    let entry = demandByCard.get(dc.cardSlug);
    if (!entry) { entry = new Map(); demandByCard.set(dc.cardSlug, entry); }
    entry.set(dc.deckId, (entry.get(dc.deckId) ?? 0) + dc.quantity);
  }

  // Aggregate owned per card slug
  const ownedByCard = new Map<string, number>();
  for (const ci of userCollection) {
    ownedByCard.set(ci.cardSlug, (ownedByCard.get(ci.cardSlug) ?? 0) + ci.quantity);
  }

  const result = new Map<string, PerCardShortage>();
  for (const [slug, deckMap] of demandByCard) {
    const owned = ownedByCard.get(slug) ?? 0;
    const demands = [...deckMap.values()];
    const peak = demands.reduce((max, q) => Math.max(max, q), 0);
    const total = demands.reduce((sum, q) => sum + q, 0);
    result.set(slug, {
      peakMissing: Math.max(0, peak - owned),
      concurrentMissing: Math.max(0, total - owned),
      deckIds: [...deckMap.keys()],
    });
  }
  return result;
}

/** setPrefix -> groupUuid from definitions. First-wins for ambiguous prefixes. */
function prefixToGroupMap(
  defs: Array<{ groupUuid: string; prefix: string }>,
): Map<string, string> {
  const m = new Map<string, string>();
  for (const d of defs) { if (!m.has(d.prefix)) m.set(d.prefix, d.groupUuid); }
  return m;
}

/** cardSlug -> Set<groupUuid> via edition setPrefixes. */
function cardToGroupsMap(
  editions: Array<{ cardSlug: string; setPrefix: string }>,
  p2g: Map<string, string>,
): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const e of editions) {
    const g = p2g.get(e.setPrefix);
    if (!g) continue;
    let groups = m.get(e.cardSlug);
    if (!groups) { groups = new Set(); m.set(e.cardSlug, groups); }
    groups.add(g);
  }
  return m;
}

/** Map set definitions to their group UUID. */
function groupDefs(
  defs: Array<{ groupUuid: string; prefix: string; name: string; releaseDate: string | null }>,
): Map<string, typeof defs> {
  const m = new Map<string, typeof defs>();
  for (const d of defs) {
    const l = m.get(d.groupUuid); if (l) l.push(d); else m.set(d.groupUuid, [d]);
  }
  return m;
}

/** Card slugs belonging to each group via edition setPrefix → definition → groupUuid. */
function slugsInGroup(
  editions: Array<{ cardSlug: string; setPrefix: string }>,
  p2g: Map<string, string>,
): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const e of editions) {
    const g = p2g.get(e.setPrefix);
    if (!g) continue;
    let s = m.get(g); if (!s) { s = new Set(); m.set(g, s); }
    s.add(e.cardSlug);
  }
  return m;
}

/** Category: "decks" only when every child name is "Starter Decks" or "Re:Collection". */
function categoryFromNames(names: string[]): "booster" | "decks" {
  if (names.length === 0) return "booster";
  return names.every((n) => n === "Starter Decks" || n === "Re:Collection") ? "decks" : "booster";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Rank all featured set groups by deck shortages and set completion. */
export async function calculateFeaturedSetSummaries(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test db passthrough
  database?: any,
): Promise<FeaturedSetSummary[]> {
  const { allDeckCards, userCollection, allEditions, allGroups, allDefs, hidden } =
    await loadSetShortageAndInventoryData(userId, database);

  if (allGroups.length === 0) return [];

  const shortages = computeShortages(allDeckCards, userCollection);
  const p2g = prefixToGroupMap(allDefs);
  const c2g = cardToGroupsMap(allEditions, p2g);
  const dByG = groupDefs(allDefs);
  const slugsByGroup = slugsInGroup(allEditions, p2g);

  // Owned slugs (any card with qty > 0)
  const ownedSlugs = new Set<string>();
  for (const ci of userCollection) {
    if (ci.quantity > 0) ownedSlugs.add(ci.cardSlug);
  }

  const summaries: FeaturedSetSummary[] = [];
  for (const group of allGroups) {
    const defs = dByG.get(group.uuid) ?? [];
    const groupSlugs = slugsByGroup.get(group.uuid);
    const totalCards = groupSlugs?.size ?? 0;

    let ownedCards = 0;
    if (groupSlugs) for (const s of groupSlugs) { if (ownedSlugs.has(s)) ownedCards++; }

    const prefixes = [...new Set(defs.map((d) => d.prefix))].sort();
    const relDates = defs.map((d) => d.releaseDate).filter((d): d is string => d !== null).sort();
    const releaseDate = relDates[0] ?? null;

    let hard = 0; let shared = 0; let uniqueShort = 0;
    const impactedDecks = new Set<string>();

    for (const [slug, sh] of shortages) {
      if (sh.concurrentMissing <= 0 && sh.peakMissing <= 0) continue;
      const cardGroups = c2g.get(slug);
      if (!cardGroups?.has(group.uuid)) continue;
      hard += sh.peakMissing;
      shared += sh.concurrentMissing - sh.peakMissing;
      uniqueShort++;
      for (const dId of sh.deckIds) impactedDecks.add(dId);
    }

    summaries.push({
      groupUuid: group.uuid,
      groupName: group.name,
      slug: group.slug,
      imageUrl: group.imageUrl ?? null,
      sortOrder: group.sortOrder,
      hardShortageCopies: hard,
      sharedShortageCopies: shared,
      totalShortageCopies: hard + shared,
      uniqueShortageCards: uniqueShort,
      impactedDecks: impactedDecks.size,
      ownedCards,
      totalCards,
      completionPercent: totalCards > 0 ? Math.round((ownedCards / totalCards) * 100) : 0,
      releaseDate,
      childPrefixes: prefixes,
      category: categoryFromNames(defs.map((d) => d.name)),
      isHidden: hidden.includes(group.uuid),
    });
  }

  summaries.sort((a, b) => {
    if (a.isHidden !== b.isHidden) return a.isHidden ? 1 : -1;
    if (a.totalShortageCopies !== b.totalShortageCopies) return b.totalShortageCopies - a.totalShortageCopies;
    if (a.completionPercent !== b.completionPercent) return a.completionPercent - b.completionPercent;
    return a.groupName.localeCompare(b.groupName);
  });

  return summaries;
}

/** Build a checklist report (group stats + one row per distinct card slug). */
export async function getSetGroupChecklistReport(
  slugOrUuid: string,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test db passthrough
  database?: any,
  options?: { filters?: SetChecklistFilters },
): Promise<SetGroupChecklistReport | null> {
  // Resolve group
  let group: { uuid: string; name: string; slug: string; imageUrl: string | null };
  const bySlug = await getFeaturedSetGroupBySlug(slugOrUuid, database);
  if (bySlug) {
    group = { uuid: bySlug.uuid, name: bySlug.name, slug: bySlug.slug, imageUrl: bySlug.imageUrl ?? null };
  } else {
    const byUuid = await getFeaturedSetGroupByUuid(slugOrUuid, database);
    if (!byUuid) return null;
    group = { uuid: byUuid.uuid, name: byUuid.name, slug: byUuid.slug, imageUrl: byUuid.imageUrl ?? null };
  }

  const checklist = await loadSetGroupChecklist(group.uuid, userId, database);
  if (!checklist) return null;
  const { editions, cards: cardRows, collection } = checklist;

  // Lookups: card metadata, editions by slug
  const edsBySlug = new Map<string, typeof editions>();
  for (const e of editions) {
    const l = edsBySlug.get(e.cardSlug);
    if (l) l.push(e); else edsBySlug.set(e.cardSlug, [e]);
  }

  // Deck demand: load all user deck cards, filter to group slugs
  const { allDeckCards } = await loadSetShortageAndInventoryData(userId, database);
  const groupSlugSet = new Set(cardRows.map((c) => c.slug));
  const demandBySlug = new Map<string, { deckId: string; deckName: string; quantity: number }[]>();
  for (const dc of allDeckCards) {
    if (!groupSlugSet.has(dc.cardSlug)) continue;
    const l = demandBySlug.get(dc.cardSlug);
    if (l) l.push({ deckId: dc.deckId, deckName: dc.deckName, quantity: dc.quantity });
    else demandBySlug.set(dc.cardSlug, [{ deckId: dc.deckId, deckName: dc.deckName, quantity: dc.quantity }]);
  }

  // Owned per slug (normal / foil)
  const ownedBySlug = new Map<string, { normal: number; foil: number }>();
  for (const ci of collection) {
    const prev = ownedBySlug.get(ci.cardSlug) ?? { normal: 0, foil: 0 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- foil from repo
    if ((ci as any).foil) prev.foil += ci.quantity;
    else prev.normal += ci.quantity;
    ownedBySlug.set(ci.cardSlug, prev);
  }

  const cards: SetChecklistReportCard[] = [];
  let ownedCardCount = 0;

  for (const { slug, name, element, class: cls, type } of cardRows) {
    const slugEds = edsBySlug.get(slug) ?? [];
    const owned = ownedBySlug.get(slug) ?? { normal: 0, foil: 0 };
    const ownedTotal = owned.normal + owned.foil;
    const deckReqs = demandBySlug.get(slug) ?? [];
    const demands = deckReqs.map((r) => r.quantity);
    const peak = demands.reduce((max, q) => Math.max(max, q), 0);
    const total = demands.reduce((sum, q) => sum + q, 0);
    const peakM = Math.max(0, peak - ownedTotal);
    const concM = Math.max(0, total - ownedTotal);
    let shortage: SetShortageLevel = "none";
    if (peakM > 0) shortage = "hard";
    else if (concM > 0) shortage = "shared";

    /** Preferred edition: first by collectorNumber in narrowest prefix */
    const fp = options?.filters?.prefix ?? null;
    const cands = fp ? slugEds.filter((e) => e.setPrefix === fp) : slugEds;
    cands.sort((a, b) => {
      const na = parseInt(a.collectorNumber, 10) || 0;
      const nb = parseInt(b.collectorNumber, 10) || 0;
      return na !== nb ? na - nb : a.id.localeCompare(b.id);
    });

    const card: SetChecklistReportCard = {
      cardSlug: slug, cardName: name, element, class: cls, type,
      rarity: slugEds.length > 0 ? Math.max(...slugEds.map((e) => e.rarity)) : 1,
      imageUrl: slugEds[0]?.imageUrl ?? null,
      prefixes: [...new Set(slugEds.map((e) => e.setPrefix))].sort(),
      printings: slugEds.map((e) => ({
        editionId: e.id, setPrefix: e.setPrefix, setName: e.setName,
        collectorNumber: e.collectorNumber, rarity: e.rarity, imageUrl: e.imageUrl,
      })),
      preferredEditionId: cands[0]?.id ?? null,
      ownedNormal: owned.normal, ownedFoil: owned.foil, ownedQuantity: ownedTotal,
      deckRequirements: deckReqs.map((r) => ({ deckId: r.deckId, deckName: r.deckName, quantity: r.quantity })),
      requiredQuantity: total, peakMissing: peakM, concurrentMissing: concM, shortage,
      isShortage: shortage !== "none", missingQuantity: concM,
      requiringDeckIds: deckReqs.map((r) => r.deckId),
    };

    if (ownedTotal > 0) ownedCardCount++;
    if (options?.filters && !matchesSetChecklistFilters(card, options.filters)) continue;
    cards.push(card);
  }

  const totalCards = cardRows.length;
  const stats: SetGroupStats = {
    totalGroups: 1,
    totalHardShortageCopies: cards.reduce((s, c) => s + c.peakMissing, 0),
    totalSharedShortageCopies: cards.reduce((s, c) => s + (c.concurrentMissing - c.peakMissing), 0),
    totalShortageCopies: cards.reduce((s, c) => s + c.concurrentMissing, 0),
    totalCardsAcrossGroups: totalCards,
    totalOwnedCardsAcrossGroups: ownedCardCount,
    overallCompletionPercent: totalCards > 0 ? Math.round((ownedCardCount / totalCards) * 100) : 0,
  };

  return { group, stats, cards };
}

/** Toggle a featured set group's hidden state. @throws SetGroupNotFoundError */
export async function toggleUserSetHidden(
  userId: string,
  groupUuid: string,
  isHidden: boolean,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test db passthrough
  database?: any,
): Promise<string[]> {
  const group = await getFeaturedSetGroupByUuid(groupUuid, database);
  if (!group) throw new SetGroupNotFoundError(groupUuid);

  const current = await getUserHiddenSetUuids(userId, database);
  const updated = isHidden
    ? [...new Set([...current, groupUuid])]
    : current.filter((u) => u !== groupUuid);

  await setUserHiddenSetUuids(userId, updated, database);
  return updated;
}