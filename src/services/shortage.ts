import { eq, and, inArray, sql } from "drizzle-orm";
import {
  cards,
  cardEditions,
  collectionItems,
  decks,
  deckCards,
  friendLinks,
  users,
  mypCards,
  mypMarketCards,
} from "../db/schema";
import { db } from "../db";
import { DEFAULT_USER_ID } from "./seed";
import { parseBrlPrice } from "./marketplace";

export interface FriendIdleCard {
  friendId: string;
  friendName: string;
  friendCode: string;
  idleQuantity: number;
}

export interface CardShortageDetail {
  cardSlug: string;
  cardName: string;
  zone: string;
  imageUrl?: string | null;
  requiredQuantity: number;
  availableQuantity: number;
  missingQuantity: number;
  isContended: boolean;
  contendingDeckNames: string[];
  dedicatedCopiesOwned: number;
  sharedCopiesOwned: number;
  friendsWithIdle: FriendIdleCard[];
  mypAvailableCopies?: number;
  marketAvailableCopies?: number;
  marketLowestPriceBrl?: number;
  marketLowestPriceStr?: string;
  marketProductUrl?: string | null;
}

export interface DeckShortageReport {
  deckId: string;
  deckName: string;
  totalCardsRequired: number;
  totalCardsMissing: number;
  items: CardShortageDetail[];
}

export async function calculateDeckShortage(
  deckId: string,
  userId?: string,
  database: any = db
): Promise<DeckShortageReport> {
  // 1. Fetch current deck
  const deck = await database
    .select()
    .from(decks)
    .where(eq(decks.id, deckId))
    .get();

  if (!deck) {
    throw new Error(`Deck not found with id ${deckId}`);
  }

  // If userId is unspecified or default, use the deck owner's ID
  const effectiveUserId = !userId || userId === DEFAULT_USER_ID ? deck.userId : userId;

  // 2. Fetch cards in this deck
  const targetDeckCards = await database
    .select({
      id: deckCards.id,
      deckId: deckCards.deckId,
      cardSlug: deckCards.cardSlug,
      zone: deckCards.zone,
      quantity: deckCards.quantity,
      assignedEditionId: deckCards.assignedEditionId,
      name: cards.name,
    })
    .from(deckCards)
    .leftJoin(cards, eq(deckCards.cardSlug, cards.slug))
    .where(eq(deckCards.deckId, deckId));

  // 3. Fetch all other decks owned by user (to check contention and dedicated allocations)
  const allUserDecks = await database
    .select()
    .from(decks)
    .where(eq(decks.userId, effectiveUserId));

  const otherDeckIds = allUserDecks
    .filter((d: any) => d.id !== deckId)
    .map((d: any) => d.id);

  let otherDeckCards: any[] = [];
  if (otherDeckIds.length > 0) {
    otherDeckCards = await database
      .select({
        deckId: deckCards.deckId,
        cardSlug: deckCards.cardSlug,
        quantity: deckCards.quantity,
        assignedEditionId: deckCards.assignedEditionId,
        deckName: decks.name,
      })
      .from(deckCards)
      .leftJoin(decks, eq(deckCards.deckId, decks.id))
      .where(inArray(deckCards.deckId, otherDeckIds));
  }

  // 4. Fetch user's collection items with edition info
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

  // 5. Fetch accepted friends
  const friendLinks1 = await database
    .select({
      friendId: friendLinks.userId2,
    })
    .from(friendLinks)
    .where(and(eq(friendLinks.userId1, effectiveUserId), eq(friendLinks.status, "accepted")));

  const friendLinks2 = await database
    .select({
      friendId: friendLinks.userId1,
    })
    .from(friendLinks)
    .where(and(eq(friendLinks.userId2, effectiveUserId), eq(friendLinks.status, "accepted")));

  const friendIds = Array.from(
    new Set([...friendLinks1.map((f: any) => f.friendId), ...friendLinks2.map((f: any) => f.friendId)])
  );

  let friendUsers: any[] = [];
  let friendCollection: any[] = [];
  let friendDecks: any[] = [];

  if (friendIds.length > 0) {
    friendUsers = await database
      .select()
      .from(users)
      .where(inArray(users.id, friendIds));

    friendCollection = await database
      .select({
        id: collectionItems.id,
        userId: collectionItems.userId,
        editionId: collectionItems.editionId,
        cardSlug: cardEditions.cardSlug,
        quantity: collectionItems.quantity,
        isDedicated: collectionItems.isDedicated,
      })
      .from(collectionItems)
      .innerJoin(cardEditions, eq(collectionItems.editionId, cardEditions.id))
      .where(inArray(collectionItems.userId, friendIds));

    // Friend decks and assignments to compute idle availability
    friendDecks = await database
      .select({
        deckId: deckCards.deckId,
        userId: decks.userId,
        cardSlug: deckCards.cardSlug,
        quantity: deckCards.quantity,
      })
      .from(deckCards)
      .innerJoin(decks, eq(deckCards.deckId, decks.id))
      .where(inArray(decks.userId, friendIds));
  }

  // 5b. Fetch user personal MyP store and global market listings
  let userMypListings: any[] = [];
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
    // Graceful fallback
  }

  let marketListings: any[] = [];
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
        mypProductUrl: mypMarketCards.mypProductUrl,
      })
      .from(mypMarketCards);
  } catch {
    // Graceful fallback
  }

  // 6. Aggregate shortage per card in target deck
  const items: CardShortageDetail[] = [];
  let totalCardsRequired = 0;
  let totalCardsMissing = 0;

  const targetSlugs: string[] = Array.from(new Set(targetDeckCards.map((c: any) => c.cardSlug as string)));
  let targetEditions: any[] = [];
  if (targetSlugs.length > 0) {
    targetEditions = await database
      .select({
        id: cardEditions.id,
        cardSlug: cardEditions.cardSlug,
        imageUrl: cardEditions.imageUrl,
      })
      .from(cardEditions)
      .where(inArray(cardEditions.cardSlug, targetSlugs));
  }

  for (const dc of targetDeckCards) {
    const slug = dc.cardSlug;
    const cardName = dc.name || slug;
    const required = dc.quantity;
    totalCardsRequired += required;

    const matchingEd = dc.assignedEditionId
      ? targetEditions.find((e: any) => e.id === dc.assignedEditionId)
      : targetEditions.find((e: any) => e.cardSlug === slug);
    const imageUrl = matchingEd?.imageUrl || null;

    // Copies owned by user for this card slug
    const ownedForSlug = userInventory.filter((inv: any) => inv.cardSlug === slug);
    const dedicatedOwned = ownedForSlug
      .filter((inv: any) => inv.isDedicated)
      .reduce((sum: number, inv: any) => sum + inv.quantity, 0);
    const sharedOwned = ownedForSlug
      .filter((inv: any) => !inv.isDedicated)
      .reduce((sum: number, inv: any) => sum + inv.quantity, 0);
    const totalOwned = dedicatedOwned + sharedOwned;

    // Check copies dedicated to OTHER decks
    // If a dedicated copy is assigned to another deck, it cannot be used by this deck
    const dedicatedToOtherDecks = otherDeckCards
      .filter((od: any) => od.cardSlug === slug && od.assignedEditionId)
      .reduce((sum: number, od: any) => sum + od.quantity, 0);

    // Available copies for this deck = totalOwned - dedicatedToOtherDecks
    const available = Math.max(0, totalOwned - dedicatedToOtherDecks);
    const missing = Math.max(0, required - available);
    totalCardsMissing += missing;

    // Check multi-deck contention
    // Contention occurs if total demand across ALL user decks exceeds total owned copies
    const otherDemandForSlug = otherDeckCards
      .filter((od: any) => od.cardSlug === slug)
      .reduce((sum: number, od: any) => sum + od.quantity, 0);
    const totalSystemDemand = required + otherDemandForSlug;
    const isContended = totalSystemDemand > totalOwned && otherDemandForSlug > 0;

    const contendingDeckNames = otherDeckCards
      .filter((od: any) => od.cardSlug === slug && od.deckName)
      .map((od: any) => od.deckName as string)
      .filter((name, idx, arr) => arr.indexOf(name) === idx);

    // Friend idle search if missing > 0
    const friendsWithIdle: FriendIdleCard[] = [];
    if (missing > 0 && friendIds.length > 0) {
      for (const friendId of friendIds) {
        const friend = friendUsers.find((u: any) => u.id === friendId);
        if (!friend) continue;

        // Friend owned non-dedicated copies of this slug
        const friendOwned = friendCollection
          .filter((fc: any) => fc.userId === friendId && fc.cardSlug === slug && !fc.isDedicated)
          .reduce((sum: number, fc: any) => sum + fc.quantity, 0);

        // Friend used copies in their active decks
        const friendUsedInDecks = friendDecks
          .filter((fd: any) => fd.userId === friendId && fd.cardSlug === slug)
          .reduce((sum: number, fd: any) => Math.max(sum, fd.quantity), 0); // Shared max across friend decks

        const friendIdle = Math.max(0, friendOwned - friendUsedInDecks);
        if (friendIdle > 0) {
          friendsWithIdle.push({
            friendId,
            friendName: friend.name || "Playgroup Friend",
            friendCode: friend.friendCode,
            idleQuantity: friendIdle,
          });
        }
      }
    }

    // Personal MyP store copies
    const mypAvailableCopies = userMypListings
      .filter((m: any) => m.cardSlug === slug)
      .reduce((sum: number, m: any) => sum + Number(m.quantity || 0), 0);

    // Global Market availability (net external stock)
    const matchingMarketRows = marketListings.filter((m: any) => m.cardSlug === slug);
    let marketAvailableCopies = 0;
    let lowestPriceBrl = Infinity;
    let lowestPriceStr: string | undefined;
    let marketProductUrl: string | null = null;

    for (const mRow of matchingMarketRows) {
      let personalStoreQty = 0;
      for (const userMyp of userMypListings) {
        if (mRow.mypItemId && userMyp.mypItemId && mRow.mypItemId === userMyp.mypItemId) {
          personalStoreQty += Number(userMyp.quantity) || 0;
        } else if (mRow.editionId && userMyp.editionId && mRow.editionId === userMyp.editionId) {
          personalStoreQty += Number(userMyp.quantity) || 0;
        } else if (
          mRow.cardSlug === userMyp.cardSlug &&
          mRow.setPrefix.toUpperCase() === (userMyp.setPrefix || "").toUpperCase()
        ) {
          personalStoreQty += Number(userMyp.quantity) || 0;
        }
      }

      const netExternal = Math.max(0, Number(mRow.quantity) - personalStoreQty);
      if (netExternal > 0) {
        marketAvailableCopies += netExternal;
        const priceNum = Number(mRow.priceNumeric) || parseBrlPrice(mRow.price);
        if (priceNum < lowestPriceBrl) {
          lowestPriceBrl = priceNum;
          lowestPriceStr = mRow.price;
          marketProductUrl = mRow.mypProductUrl;
        }
      }
    }

    items.push({
      cardSlug: slug,
      cardName,
      zone: dc.zone,
      imageUrl,
      requiredQuantity: required,
      availableQuantity: available,
      missingQuantity: missing,
      isContended,
      contendingDeckNames,
      dedicatedCopiesOwned: dedicatedOwned,
      sharedCopiesOwned: sharedOwned,
      friendsWithIdle,
      mypAvailableCopies: mypAvailableCopies > 0 ? mypAvailableCopies : undefined,
      marketAvailableCopies: marketAvailableCopies > 0 ? marketAvailableCopies : undefined,
      marketLowestPriceBrl: lowestPriceBrl === Infinity ? undefined : lowestPriceBrl,
      marketLowestPriceStr: lowestPriceStr,
      marketProductUrl,
    });
  }

  return {
    deckId,
    deckName: deck.name,
    totalCardsRequired,
    totalCardsMissing,
    items,
  };
}

export interface DeckRequirement {
  deckId: string;
  deckName: string;
  quantity: number;
  zone: string;
}

export interface CardEditionSummary {
  id: string;
  setPrefix: string;
  setName: string;
  collectorNumber: string;
  rarity: number;
  imageUrl: string;
}

export interface AggregatedShortageCard {
  cardSlug: string;
  cardName: string;
  element: string;
  class: string;
  type: string;
  rarity: number;
  imageUrl: string | null;
  editions: CardEditionSummary[];
  deckRequirements: DeckRequirement[];
  totalDemand: number;
  peakDemand: number;
  totalOwned: number;
  dedicatedOwned: number;
  sharedOwned: number;
  peakMissing: number;
  concurrentMissing: number;
  mypAvailableCopies?: number;
  marketAvailableCopies?: number;
  marketLowestPriceBrl?: number;
  marketLowestPriceStr?: string;
  marketProductUrl?: string | null;
}

export interface AggregatedShortageReport {
  summary: {
    totalShortageCopies: number;
    totalPeakShortageCopies: number;
    uniqueShortageCards: number;
    deckCount: number;
  };
  cards: AggregatedShortageCard[];
}

export async function calculateAggregatedShortages(
  userId?: string,
  database: any = db
): Promise<AggregatedShortageReport> {
  const effectiveUserId = userId || DEFAULT_USER_ID;

  // 1. Fetch all decks for user
  const userDecks = await database
    .select({
      id: decks.id,
      name: decks.name,
      champion: decks.champion,
      format: decks.format,
    })
    .from(decks)
    .where(eq(decks.userId, effectiveUserId));

  if (!userDecks || userDecks.length === 0) {
    return {
      summary: {
        totalShortageCopies: 0,
        totalPeakShortageCopies: 0,
        uniqueShortageCards: 0,
        deckCount: 0,
      },
      cards: [],
    };
  }

  const deckIds = userDecks.map((d: any) => d.id);

  // 2. Fetch all cards across all user decks
  const allDeckCards = await database
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

  // 3. Fetch user collection items
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

  // 3b. Fetch user MyP Marketplace listings (if available)
  let userMypListings: any[] = [];
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
    // Graceful fallback if myp_cards table is not yet migrated
  }

  let marketListings: any[] = [];
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
        mypProductUrl: mypMarketCards.mypProductUrl,
      })
      .from(mypMarketCards);
  } catch {
    // Graceful fallback
  }

  // 4. Unique card slugs needed across all decks
  const uniqueSlugs: string[] = Array.from(new Set(allDeckCards.map((c: any) => String(c.cardSlug))));
  let allEditions: any[] = [];
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

  // 5. Aggregate by card slug
  const shortageCards: AggregatedShortageCard[] = [];

  for (const slug of uniqueSlugs) {
    const matchingDeckCards = allDeckCards.filter((c: any) => c.cardSlug === slug);
    const firstMatch = matchingDeckCards[0];
    const cardName = firstMatch?.cardName || slug;
    const element = firstMatch?.element || "NORM";
    const cardClass = firstMatch?.class || "WARRIOR";
    const cardType = firstMatch?.type || "ACTION";

    const editionsForSlug = allEditions
      .filter((e: any) => e.cardSlug === slug)
      .map((e: any) => ({
        id: e.id,
        setPrefix: e.setPrefix,
        setName: e.setName,
        collectorNumber: e.collectorNumber,
        rarity: e.rarity,
        imageUrl: e.imageUrl,
      }));

    // Best image and rarity
    const assignedEdId = matchingDeckCards.find((c: any) => c.assignedEditionId)?.assignedEditionId;
    const matchedEd = assignedEdId
      ? editionsForSlug.find((e: any) => e.id === assignedEdId)
      : editionsForSlug[0];
    const imageUrl = matchedEd?.imageUrl || null;
    const rarity = matchedEd?.rarity || editionsForSlug[0]?.rarity || 1;

    // Deck requirements (aggregate if same card in same deck across zones or list individually)
    const deckRequirements: DeckRequirement[] = matchingDeckCards.map((c: any) => ({
      deckId: c.deckId,
      deckName: c.deckName,
      quantity: c.quantity,
      zone: c.zone,
    }));

    const totalDemand = deckRequirements.reduce((sum, d) => sum + d.quantity, 0);

    // Peak demand in any single deck
    // Group quantities by deckId in case same card is in main + side of same deck
    const demandByDeck: Record<string, number> = {};
    for (const req of deckRequirements) {
      demandByDeck[req.deckId] = (demandByDeck[req.deckId] || 0) + req.quantity;
    }
    const peakDemand = Object.values(demandByDeck).reduce((max, q) => Math.max(max, q), 0);

    const ownedForSlug = userInventory.filter((inv: any) => inv.cardSlug === slug);
    const dedicatedOwned = ownedForSlug
      .filter((inv: any) => inv.isDedicated)
      .reduce((sum: number, inv: any) => sum + inv.quantity, 0);
    const sharedOwned = ownedForSlug
      .filter((inv: any) => !inv.isDedicated)
      .reduce((sum: number, inv: any) => sum + inv.quantity, 0);
    const totalOwned = dedicatedOwned + sharedOwned;

    const concurrentMissing = Math.max(0, totalDemand - totalOwned);
    const peakMissing = Math.max(0, peakDemand - totalOwned);

    const mypAvailableCopies = userMypListings
      .filter((m: any) => m.cardSlug === slug)
      .reduce((sum: number, m: any) => sum + Number(m.quantity || 0), 0);

    // Global Market availability (net external stock)
    const matchingMarketRows = marketListings.filter((m: any) => m.cardSlug === slug);
    let marketAvailableCopies = 0;
    let lowestPriceBrl = Infinity;
    let lowestPriceStr: string | undefined;
    let marketProductUrl: string | null = null;

    for (const mRow of matchingMarketRows) {
      let personalStoreQty = 0;
      for (const userMyp of userMypListings) {
        if (mRow.mypItemId && userMyp.mypItemId && mRow.mypItemId === userMyp.mypItemId) {
          personalStoreQty += Number(userMyp.quantity) || 0;
        } else if (mRow.editionId && userMyp.editionId && mRow.editionId === userMyp.editionId) {
          personalStoreQty += Number(userMyp.quantity) || 0;
        } else if (
          mRow.cardSlug === userMyp.cardSlug &&
          mRow.setPrefix.toUpperCase() === (userMyp.setPrefix || "").toUpperCase()
        ) {
          personalStoreQty += Number(userMyp.quantity) || 0;
        }
      }

      const netExternal = Math.max(0, Number(mRow.quantity) - personalStoreQty);
      if (netExternal > 0) {
        marketAvailableCopies += netExternal;
        const priceNum = Number(mRow.priceNumeric) || parseBrlPrice(mRow.price);
        if (priceNum < lowestPriceBrl) {
          lowestPriceBrl = priceNum;
          lowestPriceStr = mRow.price;
          marketProductUrl = mRow.mypProductUrl;
        }
      }
    }

    // Only include cards with a shortage
    if (concurrentMissing > 0 || peakMissing > 0) {
      shortageCards.push({
        cardSlug: slug,
        cardName,
        element,
        class: cardClass,
        type: cardType,
        rarity,
        imageUrl,
        editions: editionsForSlug,
        deckRequirements,
        totalDemand,
        peakDemand,
        totalOwned,
        dedicatedOwned,
        sharedOwned,
        peakMissing,
        concurrentMissing,
        mypAvailableCopies: mypAvailableCopies > 0 ? mypAvailableCopies : undefined,
        marketAvailableCopies: marketAvailableCopies > 0 ? marketAvailableCopies : undefined,
        marketLowestPriceBrl: lowestPriceBrl === Infinity ? undefined : lowestPriceBrl,
        marketLowestPriceStr: lowestPriceStr,
        marketProductUrl,
      });
    }
  }

  // Sort descending by concurrentMissing then peakMissing
  shortageCards.sort((a, b) => {
    if (b.concurrentMissing !== a.concurrentMissing) {
      return b.concurrentMissing - a.concurrentMissing;
    }
    return b.peakMissing - a.peakMissing;
  });

  const totalShortageCopies = shortageCards.reduce((sum, c) => sum + c.concurrentMissing, 0);
  const totalPeakShortageCopies = shortageCards.reduce((sum, c) => sum + c.peakMissing, 0);

  return {
    summary: {
      totalShortageCopies,
      totalPeakShortageCopies,
      uniqueShortageCards: shortageCards.length,
      deckCount: userDecks.length,
    },
    cards: shortageCards,
  };
}
