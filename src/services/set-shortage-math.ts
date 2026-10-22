/**
 * Pure aggregation helpers for the Featured Set shortage ranking.
 * No I/O: callers pass already-loaded rows.
 */

export interface PerCardShortage {
  peakMissing: number;
  concurrentMissing: number;
  deckIds: string[];
}

/**
 * Compute shortage metrics for a single card given its deck demands and
 * the user's owned quantity. Used by both `computeShortages` (bulk) and
 * the checklist report (per-card).
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

/** peakMissing = max(0, peakDemand - owned), concurrentMissing = max(0, totalDemand - owned) */
export function computeShortages(
  allDeckCards: Array<{
    deckId: string;
    cardSlug: string;
    quantity: number;
  }>,
  userCollection: Array<{ cardSlug: string; quantity: number }>,
): Map<string, PerCardShortage> {
  const demandByCard = new Map<string, Map<string, number>>();
  for (const dc of allDeckCards) {
    let entry = demandByCard.get(dc.cardSlug);
    if (!entry) {
      entry = new Map();
      demandByCard.set(dc.cardSlug, entry);
    }
    entry.set(dc.deckId, (entry.get(dc.deckId) ?? 0) + dc.quantity);
  }

  const ownedByCard = new Map<string, number>();
  for (const ci of userCollection) {
    ownedByCard.set(
      ci.cardSlug,
      (ownedByCard.get(ci.cardSlug) ?? 0) + ci.quantity,
    );
  }

  const result = new Map<string, PerCardShortage>();
  for (const [slug, deckMap] of demandByCard) {
    const owned = ownedByCard.get(slug) ?? 0;
    const quantities = [...deckMap.values()];
    const { peakMissing, concurrentMissing } = computeCardShortage(
      quantities,
      owned,
    );
    result.set(slug, {
      peakMissing,
      concurrentMissing,
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
    let groups = m.get(e.cardSlug);
    if (!groups) {
      groups = new Set();
      m.set(e.cardSlug, groups);
    }
    groups.add(g);
  }
  return m;
}

/** Map set definitions to their group UUID. */
export function groupDefs<T extends { groupUuid: string }>(
  defs: T[],
): Map<string, T[]> {
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
    let s = m.get(g);
    if (!s) {
      s = new Set();
      m.set(g, s);
    }
    s.add(e.cardSlug);
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