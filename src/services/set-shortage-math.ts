/**
 * Pure aggregation helpers for the Featured Set shortage ranking.
 * No I/O: callers pass already-loaded rows.
 */

import type { DeckSection, FeaturedSetSummary } from "@ga/contracts";
import { allocateCardDemand, type DeckCardDemand } from "./deck-allocation";

export interface PerCardShortage {
  peakMissing: number;
  concurrentMissing: number;
  deckIds: string[];
}

/**
 * Compute shortage metrics for a single card given its deck demands and
 * the user's owned quantity. Backward-compatible fallback when sections are absent.
 */
export function computeCardShortage(
  deckQuantities: number[],
  owned: number,
): { peakMissing: number; concurrentMissing: number } {
  const peak = deckQuantities.reduce((max, q) => Math.max(max, q), 0);
  const total = deckQuantities.reduce((sum, q) => sum + q, 0);
  return {
    peakMissing: Math.max(0, peak - owned),
    concurrentMissing: Math.max(0, total - owned),
  };
}

/** Section-aware shortage computation across all cards. */
export function computeShortages(
  allDeckCards: Array<{
    deckId: string;
    cardSlug: string;
    quantity: number;
    section?: DeckSection | string;
    priority?: number;
    createdAt?: Date | string | null;
  }>,
  userCollection: Array<{ cardSlug: string; quantity: number }>,
  userDecks?: Array<{
    id: string;
    name?: string;
    section?: DeckSection | string;
    priority?: number;
    createdAt?: Date | string | null;
  }>,
): Map<string, PerCardShortage> {
  const deckLookup = new Map(userDecks?.map((d) => [d.id, d]));
  const demandByCard = new Map<
    string,
    Map<string, { demand: number; section: DeckSection; priority: number; createdAt?: Date | string | null }>
  >();

  for (const dc of allDeckCards) {
    let entry = demandByCard.get(dc.cardSlug);
    if (!entry) {
      entry = new Map();
      demandByCard.set(dc.cardSlug, entry);
    }
    const current = entry.get(dc.deckId);
    const d = deckLookup.get(dc.deckId);
    const section = ((d?.section ?? dc.section) as DeckSection) || "4fun";
    const priority = d?.priority ?? dc.priority ?? 0;
    const createdAt = d?.createdAt ?? dc.createdAt;
    entry.set(dc.deckId, {
      demand: (current?.demand ?? 0) + dc.quantity,
      section,
      priority,
      createdAt,
    });
  }

  const ownedByCard = new Map<string, number>();
  for (const ci of userCollection) {
    ownedByCard.set(ci.cardSlug, (ownedByCard.get(ci.cardSlug) ?? 0) + ci.quantity);
  }

  const result = new Map<string, PerCardShortage>();
  for (const [slug, deckMap] of demandByCard) {
    const owned = ownedByCard.get(slug) ?? 0;
    const deckDemands: DeckCardDemand[] = [];
    for (const [deckId, info] of deckMap) {
      deckDemands.push({
        deckId,
        demand: info.demand,
        section: info.section,
        priority: info.priority,
        createdAt: info.createdAt,
      });
    }

    const alloc = allocateCardDemand(owned, deckDemands);
    result.set(slug, {
      peakMissing: alloc.peakMissing,
      concurrentMissing: alloc.concurrentMissing,
      deckIds: [...deckMap.keys()],
    });
  }
  return result;
}

export interface SetPrefixGroup {
  groupUuid: string;
  prefix: string;
}

export interface EditionPrefixRef {
  cardSlug: string;
  setPrefix: string;
}

/** setPrefix -> groupUuid from definitions. First-wins for ambiguous prefixes. */
export function prefixToGroupMap(
  defs: SetPrefixGroup[],
): Map<string, string> {
  const m = new Map<string, string>();
  for (const d of defs) {
    if (!m.has(d.prefix)) m.set(d.prefix, d.groupUuid);
  }
  return m;
}

/** cardSlug -> Set<groupUuid> via edition setPrefixes. */
export function cardToGroupsMap(
  editions: EditionPrefixRef[],
  prefixToGroup: Map<string, string>,
): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const e of editions) {
    const g = prefixToGroup.get(e.setPrefix);
    if (!g) continue;
    const groups = m.get(e.cardSlug) ?? new Set();
    groups.add(g);
    m.set(e.cardSlug, groups);
  }
  return m;
}

/** Map set definitions to their group UUID. */
export function groupDefs<T extends { groupUuid: string }>(defs: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const d of defs) {
    const list = m.get(d.groupUuid);
    if (list) list.push(d);
    else m.set(d.groupUuid, [d]);
  }
  return m;
}

/** Card slugs belonging to each group via edition setPrefix → definition → groupUuid. */
export function slugsInGroup(
  editions: EditionPrefixRef[],
  prefixToGroup: Map<string, string>,
): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const e of editions) {
    const g = prefixToGroup.get(e.setPrefix);
    if (!g) continue;
    const s = m.get(g) ?? new Set();
    s.add(e.cardSlug);
    m.set(g, s);
  }
  return m;
}

export function hasDeckReleases(names: string[]): boolean {
  const deckKeywords = ["starter deck", "pantheon deck", "re:collection", "deck"];
  return names.some((n) => deckKeywords.some((kw) => n.toLowerCase().includes(kw)));
}

export function hasBoosterReleases(names: string[]): boolean {
  const deckKeywords = ["starter deck", "pantheon deck", "re:collection", "deck"];
  return names.some((n) => !deckKeywords.some((kw) => n.toLowerCase().includes(kw)));
}

/**
 * Category: "decks" when only deck releases, "both" when both booster and deck releases, or "booster".
 */
export function categoryFromNames(names: string[]): "booster" | "decks" | "both" {
  const hasDecks = hasDeckReleases(names);
  const hasBooster = hasBoosterReleases(names);

  if (hasDecks && hasBooster) return "both";
  if (hasDecks) return "decks";
  return "booster";
}

export interface DemandCard {
  deckId: string;
  deckName: string;
  cardSlug: string;
  quantity: number;
  section?: DeckSection;
  priority?: number;
  createdAt?: Date | string | null;
}

/** Filters demand cards according to the selected target. */
export function filterTargetDemandCards(
  allDeckCards: Array<{
    deckId: string;
    deckName?: string | null;
    deckSection?: string | null;
    deckPriority?: number | null;
    deckCreatedAt?: Date | string | null;
    section?: string | null;
    priority?: number | null;
    createdAt?: Date | string | null;
    cardSlug: string;
    quantity: number;
  }>,
  personalWants: Array<{ cardSlug: string; quantity: number }> = [],
  target?: string,
): DemandCard[] {
  const wantsAsDemands: DemandCard[] = personalWants.map((w) => ({
    deckId: "wantlist",
    deckName: "Personal Wants",
    cardSlug: w.cardSlug,
    quantity: w.quantity,
    section: "4fun",
    priority: 999999,
  }));

  if (target === "wantlist") return wantsAsDemands;

  const mapDeckCard = (dc: typeof allDeckCards[0]): DemandCard => ({
    deckId: dc.deckId,
    deckName: dc.deckName ?? "",
    cardSlug: dc.cardSlug,
    quantity: dc.quantity,
    section: ((dc.deckSection ?? dc.section) as DeckSection) || "4fun",
    priority: dc.deckPriority ?? dc.priority ?? 0,
    createdAt: dc.deckCreatedAt ?? dc.createdAt,
  });

  if (target && target !== "all") {
    return allDeckCards.filter((dc) => dc.deckId === target).map(mapDeckCard);
  }

  return [...allDeckCards.map(mapDeckCard), ...wantsAsDemands];
}

export interface SetShortageRawData {
  allDeckCards: Array<{
    id?: string;
    deckId: string;
    cardSlug: string;
    zone?: string;
    quantity: number;
    assignedEditionId?: string | null;
    deckName?: string | null;
    deckSection?: string | null;
    deckPriority?: number | null;
    deckCreatedAt?: Date | string | null;
    section?: string | null;
    priority?: number | null;
    createdAt?: Date | string | null;
  }>;
  userCollection: Array<{
    id?: string;
    cardSlug: string;
    quantity: number;
    isDedicated?: boolean;
  }>;
  allEditions: Array<{
    id: string;
    cardSlug: string;
    setPrefix: string;
    setName: string;
    collectorNumber: string;
    rarity: number;
    imageUrl?: string | null;
  }>;
  allGroups: Array<{
    uuid: string;
    name: string;
    slug: string;
    imageUrl?: string | null;
    sortOrder: number;
  }>;
  allDefs: Array<{
    id: string;
    groupUuid: string;
    prefix: string;
    name: string;
    language?: string;
    releaseDate?: string | null;
  }>;
  hidden: string[];
  userDecks?: Array<{
    id: string;
    name: string;
    section?: DeckSection | string;
    priority?: number;
    createdAt?: Date | string | null;
  }>;
  personalWants?: Array<{ id?: string; cardSlug: string; quantity: number }>;
}

export function computeSummariesFromData(
  data: SetShortageRawData,
  target?: string,
): FeaturedSetSummary[] {
  const { allDeckCards, userCollection, allEditions, allGroups, allDefs, hidden, userDecks, personalWants = [] } = data;
  if (allGroups.length === 0) return [];

  const targetDemandCards = filterTargetDemandCards(allDeckCards, personalWants, target);
  const shortages = computeShortages(targetDemandCards, userCollection, userDecks);
  const prefixToGroup = prefixToGroupMap(allDefs);
  const cardToGroups = cardToGroupsMap(allEditions, prefixToGroup);
  const defsByGroup = groupDefs(allDefs);
  const slugsByGroup = slugsInGroup(allEditions, prefixToGroup);

  const ownedSlugs = new Set<string>();
  for (const ci of userCollection) {
    if (ci.quantity > 0) ownedSlugs.add(ci.cardSlug);
  }

  const summaries: FeaturedSetSummary[] = [];
  for (const group of allGroups) {
    const defs = defsByGroup.get(group.uuid) ?? [];
    const groupSlugs = slugsByGroup.get(group.uuid);
    const totalCards = groupSlugs?.size ?? 0;

    let ownedCards = 0;
    if (groupSlugs) {
      for (const s of groupSlugs) {
        if (ownedSlugs.has(s)) ownedCards++;
      }
    }

    const prefixes = [...new Set(defs.map((d) => d.prefix))].sort();
    const relDates = defs
      .map((d) => d.releaseDate)
      .filter((d): d is string => Boolean(d))
      .sort();
    const releaseDate = relDates[0] ?? null;

    let hard = 0;
    let shared = 0;
    let uniqueShort = 0;
    const impactedDecks = new Set<string>();

    for (const [slug, sh] of shortages) {
      if (sh.concurrentMissing <= 0 && sh.peakMissing <= 0) continue;
      const cardGroups = cardToGroups.get(slug);
      if (!cardGroups?.has(group.uuid)) continue;
      hard += sh.peakMissing;
      shared += sh.concurrentMissing - sh.peakMissing;
      uniqueShort++;
      for (const dId of sh.deckIds) {
        if (dId !== "wantlist") impactedDecks.add(dId);
      }
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
      completionPercent:
        totalCards > 0 ? Math.round((ownedCards / totalCards) * 100) : 0,
      releaseDate,
      childPrefixes: prefixes,
      category: categoryFromNames(defs.map((d) => d.name)),
      hasDecks: hasDeckReleases(defs.map((d) => d.name)),
      hasBooster: hasBoosterReleases(defs.map((d) => d.name)),
      isHidden: hidden.includes(group.uuid),
    });
  }

  summaries.sort((a, b) => {
    if (a.isHidden !== b.isHidden) return a.isHidden ? 1 : -1;
    if (a.totalShortageCopies !== b.totalShortageCopies)
      return b.totalShortageCopies - a.totalShortageCopies;
    if (a.completionPercent !== b.completionPercent)
      return a.completionPercent - b.completionPercent;
    return a.groupName.localeCompare(b.groupName);
  });

  return summaries;
}
