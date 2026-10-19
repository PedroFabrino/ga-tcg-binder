import {
  queryCatalogCards,
  queryMetaStaplesByCardSlugs,
  queryEditionsByCardSlugs,
  queryCirculationsByEditionIds,
  queryDeckUsageForUserCards,
  type CardRow,
} from "@/db/repositories/catalog-repository";

export interface CatalogSearchFilters {
  query?: string;
  element?: string;
  class?: string;
  type?: string;
  setPrefix?: string;
  lowPopOnly?: boolean;
  staplesOnly?: boolean;
  lowPopThreshold?: number;
  userId?: string;
  limit?: number;
  offset?: number;
}

export interface DeckUsage {
  deckId: string;
  deckName: string;
  quantity: number;
  zone: string;
}

export interface EditionWithCirculations {
  id: string;
  cardSlug: string;
  setPrefix: string;
  setName: string;
  collectorNumber: string;
  rarity: number;
  imageUrl: string;
  lowestPopulation: number;
  isLowPop: boolean;
  circulations: {
    id: string;
    kind: string;
    population: number;
    foil: boolean;
    printing: boolean;
  }[];
}

export interface CatalogCardResult {
  slug: string;
  name: string;
  element: string;
  class: string;
  type: string;
  subtypes: string[];
  effect: string | null;
  costReserve: number | null;
  costMemory: number | null;
  level: number | null;
  speed: boolean | null;
  hasLowPopEdition: boolean;
  isMetaStaple: boolean;
  stapleInclusionRate: string | null;
  stapleRecommendedCopies: number | null;
  stapleCategories: string[];
  deckUsage: DeckUsage[];
  editions: EditionWithCirculations[];
}

export async function searchCatalog(
  filters: CatalogSearchFilters,
  database?: any
): Promise<{ cards: CatalogCardResult[]; total: number }> {
  const threshold = filters.lowPopThreshold ?? 1000;
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  const matchingCards: CardRow[] = await queryCatalogCards(
    {
      query: filters.query,
      element: filters.element,
      class: filters.class,
      type: filters.type,
    },
    database
  );

  if (matchingCards.length === 0) {
    return { cards: [], total: 0 };
  }

  const matchingSlugs = matchingCards.map((c) => c.slug);

  // Fetch meta staples for matching cards
  const staplesData = await queryMetaStaplesByCardSlugs(matchingSlugs, database);
  const staplesBySlug = new Map<string, any>();
  for (const s of staplesData) {
    staplesBySlug.set(s.cardSlug, s);
  }

  // Fetch editions for these cards
  const editionsData = await queryEditionsByCardSlugs(
    matchingSlugs,
    filters.setPrefix,
    database
  );
  const editionIds = editionsData.map((e: any) => e.id);

  const circulationsData = await queryCirculationsByEditionIds(editionIds, database);

  // Fetch deck usage if userId is provided
  let deckUsageData: any[] = [];
  if (filters.userId && matchingSlugs.length > 0) {
    deckUsageData = await queryDeckUsageForUserCards(
      filters.userId,
      matchingSlugs,
      database
    );
  }

  // Group editions and circulations by card slug
  const results: CatalogCardResult[] = [];

  for (const card of matchingCards) {
    const stapleRecord = staplesBySlug.get(card.slug);
    const isMetaStaple = Boolean(stapleRecord);

    if (filters.staplesOnly && !isMetaStaple) {
      continue;
    }

    const cardEds = editionsData.filter((e: any) => e.cardSlug === card.slug);
    if (filters.setPrefix && filters.setPrefix !== "ALL" && cardEds.length === 0) {
      continue; // Filtered out by set prefix
    }

    const populatedEditions: EditionWithCirculations[] = [];
    let cardHasLowPop = false;

    for (const ed of cardEds) {
      const circs = circulationsData.filter((c: any) => c.editionId === ed.id);
      const lowestPop =
        circs.length > 0
          ? Math.min(...circs.map((c: any) => c.population))
          : 999999;
      const isLowPop = lowestPop <= threshold;
      if (isLowPop) {
        cardHasLowPop = true;
      }

      populatedEditions.push({
        id: ed.id,
        cardSlug: ed.cardSlug,
        setPrefix: ed.setPrefix,
        setName: ed.setName,
        collectorNumber: ed.collectorNumber,
        rarity: ed.rarity,
        imageUrl: ed.imageUrl,
        lowestPopulation: lowestPop,
        isLowPop,
        circulations: circs.map((c: any) => ({
          id: c.id,
          kind: c.kind,
          population: c.population,
          foil: Boolean(c.foil),
          printing: Boolean(c.printing),
        })),
      });
    }

    if (filters.lowPopOnly && !cardHasLowPop) {
      continue;
    }

    const cardDeckUsage: DeckUsage[] = deckUsageData
      .filter((d: any) => d.cardSlug === card.slug)
      .map((d: any) => ({
        deckId: d.deckId,
        deckName: d.deckName,
        quantity: d.quantity,
        zone: d.zone,
      }));

    let stapleCategories: string[] = [];
    if (stapleRecord?.categories) {
      try {
        stapleCategories = JSON.parse(stapleRecord.categories);
      } catch {
        stapleCategories = [];
      }
    }

    results.push({
      slug: card.slug,
      name: card.name,
      element: card.element,
      class: card.class,
      type: card.type,
      subtypes: JSON.parse(card.subtypes || "[]"),
      effect: card.effect,
      costReserve: card.costReserve,
      costMemory: card.costMemory,
      level: card.level,
      speed: card.speed,
      hasLowPopEdition: cardHasLowPop,
      isMetaStaple,
      stapleInclusionRate: stapleRecord?.inclusionRate ?? null,
      stapleRecommendedCopies: stapleRecord?.recommendedCopies ?? null,
      stapleCategories,
      deckUsage: cardDeckUsage,
      editions: populatedEditions,
    });
  }

  const paginated = results.slice(offset, offset + limit);

  return {
    cards: paginated,
    total: results.length,
  };
}
