import { db } from "../index";
import {
  cards,
  cardEditions,
  collectionItems,
  decks,
  deckCards,
  users,
  mypCards,
  mypMarketCards,
  mypWatchlist,
  metaStaples,
} from "../schema";
import { eq, inArray } from "drizzle-orm";

export { loadDeckShortageData } from "./deck-shortage-repository";

export async function hasCatalogData(database = db): Promise<boolean> {
  const existingCards = await database.select().from(cards).limit(1);
  return existingCards.length > 0;
}

export async function loadAggregatedShortageData(
  effectiveUserId: string,
  database = db
) {
  const [user] = await database
    .select({
      id: users.id,
      mypUsername: users.mypUsername,
      watchlistPolicyHard: users.watchlistPolicyHard,
      watchlistPolicyShared: users.watchlistPolicyShared,
      watchlistPolicyStaples: users.watchlistPolicyStaples,
      mypPasswordEncrypted: users.mypPasswordEncrypted,
      watchlistSyncToken: users.watchlistSyncToken,
    })
    .from(users)
    .where(eq(users.id, effectiveUserId))
    .limit(1);

  const userWatchlistRows = await database
    .select()
    .from(mypWatchlist)
    .where(eq(mypWatchlist.userId, effectiveUserId));

  const userDecks = await database
    .select({
      id: decks.id,
      name: decks.name,
      champion: decks.champion,
      format: decks.format,
    })
    .from(decks)
    .where(eq(decks.userId, effectiveUserId));

  const deckIds = userDecks.map((d) => d.id);
  let allDeckCards: Array<{
    id: string;
    deckId: string;
    cardSlug: string;
    zone: string;
    quantity: number;
    assignedEditionId: string | null;
    deckName: string;
    cardName: string | null;
    element: string | null;
    class: string | null;
    type: string | null;
  }> = [];

  if (deckIds.length > 0) {
    allDeckCards = await database
      .select({
        id: deckCards.id,
        deckId: deckCards.deckId,
        cardSlug: deckCards.cardSlug,
        zone: deckCards.zone,
        quantity: deckCards.quantity,
        assignedEditionId: deckCards.assignedEditionId,
        deckName: decks.name,
        cardName: cards.name,
        element: cards.element,
        class: cards.class,
        type: cards.type,
      })
      .from(deckCards)
      .innerJoin(decks, eq(deckCards.deckId, decks.id))
      .leftJoin(cards, eq(deckCards.cardSlug, cards.slug))
      .where(inArray(deckCards.deckId, deckIds));
  }

  const userInventory = await database
    .select({
      id: collectionItems.id,
      editionId: collectionItems.editionId,
      cardSlug: cardEditions.cardSlug,
      foil: collectionItems.foil,
      quantity: collectionItems.quantity,
      isDedicated: collectionItems.isDedicated,
    })
    .from(collectionItems)
    .innerJoin(cardEditions, eq(collectionItems.editionId, cardEditions.id))
    .where(eq(collectionItems.userId, effectiveUserId));

  let userMypListings: Array<{
    cardSlug: string | null;
    editionId: string | null;
    setPrefix: string | null;
    mypItemId: string | null;
    quantity: number;
  }> = [];
  try {
    userMypListings = await database
      .select({
        cardSlug: mypCards.cardSlug,
        editionId: mypCards.editionId,
        setPrefix: mypCards.setPrefix,
        mypItemId: mypCards.mypItemId,
        quantity: mypCards.quantity,
      })
      .from(mypCards)
      .where(eq(mypCards.userId, effectiveUserId));
  } catch {
    // fallback
  }

  let marketListings: Array<{
    cardSlug: string | null;
    editionId: string | null;
    setPrefix: string | null;
    mypItemId: string | null;
    quantity: number;
    price: string;
    priceNumeric: number | null;
    tcgPrice: string | null;
    tcgPriceNumeric: number | null;
    mypProductUrl: string | null;
    vendorName: string | null;
    vendorUrl: string | null;
  }> = [];
  try {
    marketListings = await database
      .select({
        cardSlug: mypMarketCards.cardSlug,
        editionId: mypMarketCards.editionId,
        setPrefix: mypMarketCards.setPrefix,
        mypItemId: mypMarketCards.mypItemId,
        quantity: mypMarketCards.quantity,
        price: mypMarketCards.price,
        priceNumeric: mypMarketCards.priceNumeric,
        tcgPrice: mypMarketCards.tcgPrice,
        tcgPriceNumeric: mypMarketCards.tcgPriceNumeric,
        mypProductUrl: mypMarketCards.mypProductUrl,
        vendorName: mypMarketCards.vendorName,
        vendorUrl: mypMarketCards.vendorUrl,
      })
      .from(mypMarketCards);
  } catch {
    // fallback
  }

  const stapleMap = new Map<string, number>();
  const stapleSlugs: string[] = [];
  if (user?.watchlistPolicyStaples) {
    try {
      const staples = await database
        .select({
          cardSlug: metaStaples.cardSlug,
          recommendedCopies: metaStaples.recommendedCopies,
        })
        .from(metaStaples);
      for (const st of staples) {
        stapleMap.set(st.cardSlug, st.recommendedCopies);
        stapleSlugs.push(st.cardSlug);
      }
    } catch {
      // fallback
    }
  }

  const deckSlugs = allDeckCards.map((c) => c.cardSlug);
  const uniqueSlugs = Array.from(new Set([...deckSlugs, ...stapleSlugs]));

  let allEditions: Array<{
    id: string;
    cardSlug: string;
    setPrefix: string;
    setName: string;
    collectorNumber: string;
    rarity: number;
    imageUrl: string;
  }> = [];
  if (uniqueSlugs.length > 0) {
    allEditions = await database
      .select({
        id: cardEditions.id,
        cardSlug: cardEditions.cardSlug,
        setPrefix: cardEditions.setPrefix,
        setName: cardEditions.setName,
        collectorNumber: cardEditions.collectorNumber,
        rarity: cardEditions.rarity,
        imageUrl: cardEditions.imageUrl,
      })
      .from(cardEditions)
      .where(inArray(cardEditions.cardSlug, uniqueSlugs));
  }

  return {
    user,
    userDecks,
    allDeckCards,
    userInventory,
    userMypListings,
    marketListings,
    allEditions,
    uniqueSlugs,
    userWatchlistRows,
    stapleMap,
  };
}
