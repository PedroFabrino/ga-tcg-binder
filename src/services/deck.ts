import {
  getUserDecks,
  getDeckCardsCounts,
  getDeckById,
  createDeckWithCards,
  updateDeck,
  deleteDeck,
  insertDeckCards,
  deleteDeckCard,
  updateDeckCard,
  replaceDeckCards,
  getDeckCardsWithDetails,
  getEditionsForCardSlugs,
  type DeckDatabase,
  type DeckCardInsert,
  type DeckInsert,
  type DeckRow,
} from "@/db/repositories/deck-repository";
import {
  findCardByNameCaseInsensitive,
} from "@/db/repositories/collection-repository";
import {
  upsertCatalogCard,
} from "@/db/repositories/catalog-repository";
import { parseOmnidexText, serializeOmnidexText, decodeHtmlEntities } from "@/services/omnidex";

export class DeckValidationError extends Error {}
export class DeckNotFoundError extends Error {}

export interface DeckSummary extends DeckRow {
  mainCount: number;
  materialCount: number;
  sideCount: number;
  totalCards: number;
}

export async function getUserDecksSummary(
  userId: string,
  database?: DeckDatabase
): Promise<DeckSummary[]> {
  const userDecks = await getUserDecks(userId, database);

  const result: DeckSummary[] = [];
  for (const d of userDecks) {
    const allCards = await getDeckCardsCounts(d.id, database);

    const mainCount = allCards
      .filter((c) => c.zone === "main")
      .reduce((sum, c) => sum + c.quantity, 0);
    const materialCount = allCards
      .filter((c) => c.zone === "material")
      .reduce((sum, c) => sum + c.quantity, 0);
    const sideCount = allCards
      .filter((c) => c.zone === "side")
      .reduce((sum, c) => sum + c.quantity, 0);

    result.push({
      ...d,
      mainCount,
      materialCount,
      sideCount,
      totalCards: mainCount + materialCount + sideCount,
    });
  }

  return result;
}

export async function buildDeckCardsFromOmnidex(
  deckId: string,
  omnidexText: string,
  database?: DeckDatabase
): Promise<DeckCardInsert[]> {
  const decoded = decodeHtmlEntities(omnidexText);
  const parsed = parseOmnidexText(decoded);
  const zones: ("material" | "main" | "side")[] = ["material", "main", "side"];
  const cardsToInsert: DeckCardInsert[] = [];
  let idx = 1;

  for (const zone of zones) {
    for (const item of parsed[zone]) {
      let slug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const matchCard = await findCardByNameCaseInsensitive(item.name, database);

      if (matchCard) {
        slug = matchCard.slug;
      } else {
        await upsertCatalogCard(
          {
            slug,
            name: item.name,
            element: "NORM",
            class: "ALL",
            type: "UNKNOWN",
            subtypes: "[]",
          },
          database
        );
      }

      cardsToInsert.push({
        id: `dc-${deckId}-${idx++}`,
        deckId,
        cardSlug: slug,
        zone,
        quantity: item.quantity,
      });
    }
  }

  return cardsToInsert;
}

export async function createDeckService(
  userId: string,
  data: {
    name: string;
    champion?: string;
    format?: string;
    omnidexText?: string;
  },
  database?: DeckDatabase
): Promise<{ id: string }> {
  const name = decodeHtmlEntities(data.name?.trim() || "");
  const champion = decodeHtmlEntities(data.champion?.trim() || "");
  const format = data.format || "standard";
  const omnidexText = data.omnidexText ? decodeHtmlEntities(data.omnidexText) : undefined;

  if (!name) {
    throw new DeckValidationError("Deck name is required");
  }

  const deckId = `deck-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const cardsToInsert: DeckCardInsert[] = omnidexText
    ? await buildDeckCardsFromOmnidex(deckId, omnidexText, database)
    : [];

  await createDeckWithCards(
    {
      id: deckId,
      userId,
      name,
      champion,
      format,
    },
    cardsToInsert,
    database
  );

  return { id: deckId };
}

export async function getDeckDetailService(
  deckId: string,
  database?: DeckDatabase
) {
  const deck = await getDeckById(deckId, database);
  if (!deck) return null;

  const cardsInDeck = await getDeckCardsWithDetails(deckId, database);

  const deckSlugs = Array.from(new Set(cardsInDeck.map((c) => c.cardSlug)));
  let deckEditions: { id: string; cardSlug: string; imageUrl: string }[] = [];
  if (deckSlugs.length > 0) {
    deckEditions = await getEditionsForCardSlugs(deckSlugs, database);
  }

  const cardsWithImages = cardsInDeck.map((c) => {
    const ed = c.assignedEditionId
      ? deckEditions.find((e) => e.id === c.assignedEditionId)
      : deckEditions.find((e) => e.cardSlug === c.cardSlug);
    return {
      ...c,
      imageUrl: ed?.imageUrl || null,
    };
  });

  const material = cardsWithImages.filter((c) => c.zone === "material");
  const main = cardsWithImages.filter((c) => c.zone === "main");
  const side = cardsWithImages.filter((c) => c.zone === "side");

  const omnidexText = serializeOmnidexText({
    material: material.map((c) => ({ name: c.cardName || c.cardSlug, quantity: c.quantity })),
    main: main.map((c) => ({ name: c.cardName || c.cardSlug, quantity: c.quantity })),
    side: side.map((c) => ({ name: c.cardName || c.cardSlug, quantity: c.quantity })),
  });

  return {
    deck,
    cards: {
      material,
      main,
      side,
    },
    omnidexText,
  };
}

export async function updateDeckService(
  deckId: string,
  body: {
    name?: string;
    champion?: string;
    format?: string;
    omnidexText?: string;
    cardUpdates?: Array<{
      action: "add" | "delete" | "update";
      deckCardId?: string;
      cardSlug?: string;
      zone?: string;
      quantity?: number;
      assignedEditionId?: string;
    }>;
  },
  database?: DeckDatabase
) {
  if (!await getDeckById(deckId, database)) {
    throw new DeckNotFoundError("Deck not found");
  }

  const { name, champion, format, omnidexText, cardUpdates } = body;
  const updateData: Partial<DeckInsert> = {};
  if (name) updateData.name = decodeHtmlEntities(name.trim());
  if (champion !== undefined) updateData.champion = decodeHtmlEntities(champion.trim());
  if (format) updateData.format = format;

  if (Object.keys(updateData).length > 0) {
    await updateDeck(deckId, updateData, database);
  }

  if (typeof omnidexText === "string") {
    const cardsToInsert = await buildDeckCardsFromOmnidex(deckId, omnidexText, database);
    await replaceDeckCards(deckId, cardsToInsert, database);
  } else if (cardUpdates && Array.isArray(cardUpdates)) {
    for (const cu of cardUpdates) {
      if (cu.action === "add" && cu.cardSlug) {
        const id = `dc-${deckId}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        await insertDeckCards(
          [
            {
              id,
              deckId,
              cardSlug: cu.cardSlug,
              zone: cu.zone || "main",
              quantity: cu.quantity || 1,
              assignedEditionId: cu.assignedEditionId,
            },
          ],
          database
        );
      } else if (cu.action === "delete" && cu.deckCardId) {
        await deleteDeckCard(cu.deckCardId, database);
      } else if (cu.action === "update" && cu.deckCardId) {
        await updateDeckCard(
          cu.deckCardId,
          {
            quantity: cu.quantity,
            assignedEditionId: cu.assignedEditionId !== undefined ? cu.assignedEditionId : undefined,
          },
          database
        );
      }
    }
  }
}

export async function deleteDeckService(
  deckId: string,
  database?: DeckDatabase
): Promise<void> {
  if (!await getDeckById(deckId, database)) {
    throw new DeckNotFoundError("Deck not found");
  }
  await deleteDeck(deckId, database);
}
