import {
  upsertCatalogCard,
  upsertCatalogCardEdition,
  upsertCatalogCardCirculation,
} from "@/db/repositories/catalog-repository";

export interface GatcgApiCirculation {
  uuid?: string;
  kind?: string;
  foil?: boolean;
  population?: number;
  printing?: boolean;
}

export interface GatcgApiEdition {
  uuid: string;
  collector_number?: string;
  rarity?: number;
  image?: string;
  set?: {
    prefix?: string;
    name?: string;
  };
  circulations?: GatcgApiCirculation[];
}

export interface GatcgApiCard {
  slug: string;
  name: string;
  element?: string;
  elements?: string[];
  classes?: string[];
  types?: string[];
  subtypes?: string[];
  effect?: string;
  effect_raw?: string;
  cost_reserve?: number | null;
  cost_memory?: number | null;
  level?: number | null;
  speed?: boolean | null;
  editions?: GatcgApiEdition[];
  result_editions?: GatcgApiEdition[];
}

export interface GatcgApiResponse {
  data: GatcgApiCard[];
  has_more: boolean;
  page: number;
  page_size: number;
  total_cards: number;
  total_pages: number;
}

export interface SyncStats {
  cardsSynced: number;
  editionsSynced: number;
  circulationsSynced: number;
  pagesFetched: number;
  durationMs: number;
}

function resolveBaseElement(card: GatcgApiCard): string {
  const nonExalted = card.elements?.find((el) => el.toUpperCase() !== "EXALTED");
  if (nonExalted) return nonExalted;
  if (card.element && card.element.toUpperCase() !== "EXALTED") return card.element;
  return "NORM";
}

export async function syncCatalogFromApi(
  options: {
    targetDb?: any;
    maxPages?: number;
    onProgress?: (progress: { page: number; totalPages: number; cardsCount: number }) => void;
  } = {}
): Promise<SyncStats> {
  const database = options.targetDb;
  const startTime = Date.now();
  let currentPage = 1;
  let totalPages = 1;
  let totalCardsCount = 0;
  let totalEditionsCount = 0;
  let totalCirculationsCount = 0;

  while (currentPage <= totalPages) {
    if (options.maxPages && currentPage > options.maxPages) {
      break;
    }

    const response = await fetch(`https://api.gatcg.com/cards/search?page=${currentPage}&page_size=50`);
    if (!response.ok) {
      throw new Error(`Failed to fetch page ${currentPage} from api.gatcg.com: ${response.statusText}`);
    }

    const json: GatcgApiResponse = await response.json();
    totalPages = json.total_pages || 1;
    const cardsData = json.data || [];

    for (const card of cardsData) {
      const element = resolveBaseElement(card);
      const cardClass = (card.classes && card.classes[0]) || "ALL";
      const cardType = (card.types && card.types[0]) || "UNKNOWN";
      const subtypes = JSON.stringify(card.subtypes || []);
      const effect = card.effect || card.effect_raw || "";

      await upsertCatalogCard(
        {
          slug: card.slug,
          name: card.name,
          element,
          class: cardClass,
          type: cardType,
          subtypes,
          effect,
          costReserve: card.cost_reserve ?? null,
          costMemory: card.cost_memory ?? null,
          level: card.level ?? null,
          speed: card.speed ? true : false,
        },
        database
      );
      totalCardsCount++;

      const editionsList = card.editions || card.result_editions || [];
      for (const edition of editionsList) {
        if (!edition.uuid) continue;
        const setPrefix = edition.set?.prefix || "UNK";
        const setName = edition.set?.name || "Unknown Set";
        const collectorNumber = edition.collector_number || "000";
        const rarity = edition.rarity ?? 0;
        const imageUrl = edition.image
          ? edition.image.startsWith("http")
            ? edition.image
            : `https://api.gatcg.com${edition.image}`
          : "";

        await upsertCatalogCardEdition(
          {
            id: edition.uuid,
            cardSlug: card.slug,
            setPrefix,
            setName,
            collectorNumber,
            rarity,
            imageUrl,
          },
          database
        );
        totalEditionsCount++;

        const circulationsList = edition.circulations || [];
        for (const circ of circulationsList) {
          const circId = circ.uuid || `${edition.uuid}-${circ.kind || "CIRC"}-${circ.foil ? "FOIL" : "NON"}`;
          const kind = circ.kind || (circ.foil ? "FOIL" : "NONFOIL");
          const population = circ.population ?? 0;
          const foil = Boolean(circ.foil);
          const printing = Boolean(circ.printing);

          await upsertCatalogCardCirculation(
            {
              id: circId,
              editionId: edition.uuid,
              kind,
              population,
              foil,
              printing,
            },
            database
          );
          totalCirculationsCount++;
        }
      }
    }

    if (options.onProgress) {
      options.onProgress({
        page: currentPage,
        totalPages,
        cardsCount: totalCardsCount,
      });
    }

    currentPage++;
  }

  return {
    cardsSynced: totalCardsCount,
    editionsSynced: totalEditionsCount,
    circulationsSynced: totalCirculationsCount,
    pagesFetched: currentPage - 1,
    durationMs: Date.now() - startTime,
  };
}

/**
 * On-demand sync for a single card by slug or name query from official Grand Archive API.
 * Ensures cards imported from Omnidex/TTS decklists that aren't yet in local catalog can be added immediately.
 */
export async function syncSingleCardFromApi(
  query: string,
  targetDb?: any
): Promise<{ cardSlug: string; editionId: string } | null> {
  try {
    const res = await fetch(`https://api.gatcg.com/cards/search?name=${encodeURIComponent(query)}`);
    if (!res.ok) return null;
    const json: GatcgApiResponse = await res.json();
    const cardData = json.data?.[0];
    if (!cardData) return null;

    const element = resolveBaseElement(cardData);
    const cardClass = (cardData.classes && cardData.classes[0]) || "ALL";
    const cardType = (cardData.types && cardData.types[0]) || "UNKNOWN";
    const subtypes = JSON.stringify(cardData.subtypes || []);
    const effect = cardData.effect || cardData.effect_raw || "";

    await upsertCatalogCard(
      {
        slug: cardData.slug,
        name: cardData.name,
        element,
        class: cardClass,
        type: cardType,
        subtypes,
        effect,
        costReserve: cardData.cost_reserve ?? null,
        costMemory: cardData.cost_memory ?? null,
        level: cardData.level ?? null,
        speed: cardData.speed ? true : false,
      },
      targetDb
    );

    const editionsList = cardData.editions || cardData.result_editions || [];
    let firstEditionId = "";

    for (const edition of editionsList) {
      if (!edition.uuid) continue;
      if (!firstEditionId) firstEditionId = edition.uuid;
      const setPrefix = edition.set?.prefix || "UNK";
      const setName = edition.set?.name || "Unknown Set";
      const collectorNumber = edition.collector_number || "000";
      const rarity = edition.rarity ?? 0;
      const imageUrl = edition.image
        ? edition.image.startsWith("http")
          ? edition.image
          : `https://api.gatcg.com${edition.image}`
        : "";

      await upsertCatalogCardEdition(
        {
          id: edition.uuid,
          cardSlug: cardData.slug,
          setPrefix,
          setName,
          collectorNumber,
          rarity,
          imageUrl,
        },
        targetDb
      );

      const circulationsList = edition.circulations || [];
      for (const circ of circulationsList) {
        const circId = circ.uuid || `${edition.uuid}-${circ.kind || "CIRC"}-${circ.foil ? "FOIL" : "NON"}`;
        const kind = circ.kind || (circ.foil ? "FOIL" : "NONFOIL");
        const population = circ.population ?? 0;
        const foil = Boolean(circ.foil);
        const printing = Boolean(circ.printing);

        await upsertCatalogCardCirculation(
          {
            id: circId,
            editionId: edition.uuid,
            kind,
            population,
            foil,
            printing,
          },
          targetDb
        );
      }
    }

    return firstEditionId ? { cardSlug: cardData.slug, editionId: firstEditionId } : null;
  } catch (e) {
    console.error("Failed to sync single card on demand:", e);
    return null;
  }
}
