import { db } from "../db";
import { cards, cardEditions, cardCirculations } from "../db/schema";
import { sql } from "drizzle-orm";

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

export async function syncCatalogFromApi(
  options: {
    targetDb?: any;
    maxPages?: number;
    onProgress?: (progress: { page: number; totalPages: number; cardsCount: number }) => void;
  } = {}
): Promise<SyncStats> {
  const database = options.targetDb || db;
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
      const element = card.element || (card.elements && card.elements[0]) || "NORM";
      const cardClass = (card.classes && card.classes[0]) || "ALL";
      const cardType = (card.types && card.types[0]) || "UNKNOWN";
      const subtypes = JSON.stringify(card.subtypes || []);
      const effect = card.effect || card.effect_raw || "";

      await database
        .insert(cards)
        .values({
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
        })
        .onConflictDoUpdate({
          target: cards.slug,
          set: {
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
            updatedAt: sql`(strftime('%s', 'now'))`,
          },
        });
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

        await database
          .insert(cardEditions)
          .values({
            id: edition.uuid,
            cardSlug: card.slug,
            setPrefix,
            setName,
            collectorNumber,
            rarity,
            imageUrl,
          })
          .onConflictDoUpdate({
            target: cardEditions.id,
            set: {
              cardSlug: card.slug,
              setPrefix,
              setName,
              collectorNumber,
              rarity,
              imageUrl,
            },
          });
        totalEditionsCount++;

        const circulationsList = edition.circulations || [];
        for (const circ of circulationsList) {
          const circId = circ.uuid || `${edition.uuid}-${circ.kind || "CIRC"}-${circ.foil ? "FOIL" : "NON"}`;
          const kind = circ.kind || (circ.foil ? "FOIL" : "NONFOIL");
          const population = circ.population ?? 0;
          const foil = Boolean(circ.foil);
          const printing = Boolean(circ.printing);

          await database
            .insert(cardCirculations)
            .values({
              id: circId,
              editionId: edition.uuid,
              kind,
              population,
              foil,
              printing,
            })
            .onConflictDoUpdate({
              target: cardCirculations.id,
              set: {
                kind,
                population,
                foil,
                printing,
              },
            });
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
