import {
  createPairingToken,
  findValidPairingToken,
  consumePairingToken,
  upsertCollectorIdentity,
  findIdentitiesByCollectorId,
  unlinkCollectorIdentity,
  findCollectorByIdentity,
  type CollectorIdentity,
  type CollectorProfile,
} from "../db/repositories/assistant-repository";
import { getUserDecks } from "../db/repositories/deck-repository";
import { getUserCollectionItems } from "../db/repositories/collection-repository";
import { calculateDeckShortage } from "./shortage";
import type {
  AssistantDeckSummary,
  AssistantShortageItem,
  AssistantDeckShortagesResponse,
  AssistantCollectionCard,
  AssistantCollectionResponse,
  AssistantDeckWantlistGroup,
  AssistantWantlistResponse,
} from "@ga/contracts";
import crypto from "crypto";

export type { CollectorIdentity, CollectorProfile };

/**
 * Generates an uppercase 6-character alphanumeric pairing token.
 */
function generateRandomCode(): string {
  // Avoid ambiguous characters like 0, O, 1, I
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = crypto.randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/**
 * Generates a fresh 10-minute pairing token for a Collector.
 */
export async function generatePairingCodeForCollector(
  collectorId: string
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateRandomCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes TTL

  const record = await createPairingToken(collectorId, token, expiresAt);
  return { token: record.token, expiresAt: record.expiresAt };
}

/**
 * Validates a pairing code and links the chat platform identity to the Collector.
 */
export async function linkIdentityWithToken(
  params: {
    token: string;
    provider: "discord" | "root";
    providerUserId: string;
    providerUsername?: string | null;
  },
  database?: unknown
): Promise<{ success: boolean; collector?: CollectorProfile; error?: string }> {
  const validToken = await findValidPairingToken(params.token, new Date(), database as any);
  if (!validToken) {
    return {
      success: false,
      error: "INVALID_OR_EXPIRED_TOKEN",
    };
  }

  // Consume token
  await consumePairingToken(validToken.id, new Date(), database as any);

  // Upsert identity
  await upsertCollectorIdentity(
    {
      collectorId: validToken.collectorId,
      provider: params.provider,
      providerUserId: params.providerUserId,
      providerUsername: params.providerUsername,
    },
    database as any
  );

  const resolved = await findCollectorByIdentity(params.provider, params.providerUserId, database as any);
  if (!resolved) {
    return { success: false, error: "FAILED_TO_RESOLVE_COLLECTOR" };
  }

  return { success: true, collector: resolved.collector };
}

/**
 * Retrieves all connected chat platform identities for a Collector.
 */
export async function getLinkedIdentities(
  collectorId: string
): Promise<CollectorIdentity[]> {
  return findIdentitiesByCollectorId(collectorId);
}

/**
 * Removes a chat platform identity link for a Collector.
 */
export async function removeLinkedIdentity(
  collectorId: string,
  provider: "discord" | "root"
): Promise<boolean> {
  return unlinkCollectorIdentity(collectorId, provider);
}

/**
 * Resolves a Collector profile from a chat platform identity.
 */
export async function resolveCollectorByPlatform(
  provider: "discord" | "root",
  providerUserId: string,
  database?: unknown
): Promise<{ identity: CollectorIdentity; collector: CollectorProfile } | null> {
  return findCollectorByIdentity(provider, providerUserId, database as any);
}

/**
 * Fetches all active decks for a Collector with card counts and sleeve completion.
 */
export async function getCollectorDecks(
  collectorId: string,
  database?: unknown
): Promise<AssistantDeckSummary[]> {
  const userDecks = await getUserDecks(collectorId, database as any);
  if (!userDecks || userDecks.length === 0) {
    return [];
  }

  const summaries: AssistantDeckSummary[] = [];

  for (const deck of userDecks) {
    const report = await calculateDeckShortage(deck.id, collectorId, database as any);

    let hardShortageCount = 0;
    let sharedShortageCount = 0;
    let totalHardMissingCopies = 0;

    for (const item of report.items) {
      const totalOwned = item.dedicatedCopiesOwned + item.sharedCopiesOwned;
      const hardMissing = Math.max(0, item.requiredQuantity - totalOwned);

      if (hardMissing > 0) {
        hardShortageCount++;
        totalHardMissingCopies += hardMissing;
      } else if (item.missingQuantity > 0 || item.isContended) {
        sharedShortageCount++;
      }
    }

    const totalCards = report.totalCardsRequired;
    const playableOwned = Math.max(0, totalCards - totalHardMissingCopies);
    const completionPercentage =
      totalCards > 0 ? Math.max(0, Math.min(100, Math.round((playableOwned / totalCards) * 100))) : 100;

    summaries.push({
      id: deck.id,
      name: deck.name,
      format: deck.format || "standard",
      champion: deck.champion || null,
      totalCards,
      uniqueCards: report.items.length,
      completionPercentage,
      hardShortageCount,
      sharedShortageCount,
    });
  }

  return summaries;
}

/**
 * Calculates itemized Hard and Shared shortages for a specific Deck.
 */
export async function getDeckShortages(
  collectorId: string,
  deckIdOrName: string,
  database?: unknown
): Promise<AssistantDeckShortagesResponse> {
  const userDecks = await getUserDecks(collectorId, database as any);
  const cleanQuery = deckIdOrName.trim().toLowerCase();

  const deck =
    userDecks.find((d) => d.id === deckIdOrName) ||
    userDecks.find((d) => d.name.toLowerCase() === cleanQuery) ||
    userDecks.find((d) => d.name.toLowerCase().includes(cleanQuery));

  if (!deck) {
    throw new Error(`Deck not found: ${deckIdOrName}`);
  }

  const report = await calculateDeckShortage(deck.id, collectorId, database as any);

  const hardShortages: AssistantShortageItem[] = [];
  const sharedShortages: AssistantShortageItem[] = [];
  let totalHardMissingCopies = 0;

  for (const item of report.items) {
    const totalOwned = item.dedicatedCopiesOwned + item.sharedCopiesOwned;
    const hardMissing = Math.max(0, item.requiredQuantity - totalOwned);

    if (hardMissing > 0) {
      totalHardMissingCopies += hardMissing;
      hardShortages.push({
        cardSlug: item.cardSlug,
        cardName: item.cardName,
        element: "Norm",
        rarity: null,
        requiredQuantity: item.requiredQuantity,
        missingQuantity: hardMissing,
        sharedQuantity: 0,
        competingDecks: item.contendingDeckNames || [],
        type: "hard",
        zone: item.zone,
        imageUrl: item.imageUrl,
      });
    } else if (item.missingQuantity > 0 || item.isContended) {
      const sharedMissing = item.missingQuantity > 0 ? item.missingQuantity : item.requiredQuantity;
      sharedShortages.push({
        cardSlug: item.cardSlug,
        cardName: item.cardName,
        element: "Norm",
        rarity: null,
        requiredQuantity: item.requiredQuantity,
        missingQuantity: 0,
        sharedQuantity: sharedMissing,
        competingDecks: item.contendingDeckNames || [],
        type: "shared",
        zone: item.zone,
        imageUrl: item.imageUrl,
      });
    }
  }

  const totalCards = report.totalCardsRequired;
  const playableOwned = Math.max(0, totalCards - totalHardMissingCopies);
  const completionPercentage =
    totalCards > 0 ? Math.max(0, Math.min(100, Math.round((playableOwned / totalCards) * 100))) : 100;

  return {
    collectorId,
    deckId: deck.id,
    deckName: deck.name,
    format: deck.format || "standard",
    completionPercentage,
    hardShortages,
    sharedShortages,
    totalHardShortages: hardShortages.length,
    totalSharedShortages: sharedShortages.length,
  };
}

/**
 * Searches a Collector's personal Binder collection by card name.
 */
export async function searchCollectorCollection(
  collectorId: string,
  query: string,
  database?: unknown
): Promise<AssistantCollectionResponse> {
  const items = await getUserCollectionItems(collectorId, database as any);
  const cleanQuery = query.toLowerCase().trim();

  const matchingItems = items.filter(
    (item) =>
      item.cardName.toLowerCase().includes(cleanQuery) ||
      item.cardSlug.toLowerCase().includes(cleanQuery)
  );

  const cardMap = new Map<string, AssistantCollectionCard>();

  for (const item of matchingItems) {
    let card = cardMap.get(item.cardSlug);
    if (!card) {
      card = {
        cardSlug: item.cardSlug,
        cardName: item.cardName,
        element: item.element,
        class: item.class,
        type: item.type,
        totalOwned: 0,
        dedicatedTotal: 0,
        idleTotal: 0,
        printings: [],
      };
      cardMap.set(item.cardSlug, card);
    }

    const dedicatedCount = item.isDedicated ? item.quantity : 0;
    const idleCount = item.isDedicated ? 0 : item.quantity;

    card.totalOwned += item.quantity;
    card.dedicatedTotal += dedicatedCount;
    card.idleTotal += idleCount;

    card.printings.push({
      editionId: item.editionId,
      cardSlug: item.cardSlug,
      setPrefix: item.setPrefix,
      setName: item.setName,
      collectorNumber: item.collectorNumber,
      rarity: item.rarity,
      imageUrl: item.imageUrl,
      foil: item.foil,
      quantity: item.quantity,
      isDedicated: item.isDedicated,
      dedicatedCount,
      idleCount,
    });
  }

  return {
    collectorId,
    query,
    cards: Array.from(cardMap.values()),
  };
}

/**
 * Generates an aggregated wantlist itemizing shortages partitioned by Deck.
 */
export async function getDeckPartitionedWantlist(
  collectorId: string,
  optionalDeckIdOrName?: string,
  database?: unknown
): Promise<AssistantWantlistResponse> {
  const userDecks = await getUserDecks(collectorId, database as any);
  const groups: AssistantDeckWantlistGroup[] = [];

  const targetDecks = optionalDeckIdOrName
    ? userDecks.filter(
        (d) =>
          d.id === optionalDeckIdOrName ||
          d.name.toLowerCase() === optionalDeckIdOrName.trim().toLowerCase() ||
          d.name.toLowerCase().includes(optionalDeckIdOrName.trim().toLowerCase())
      )
    : userDecks;

  let grandTotalHard = 0;
  let grandTotalShared = 0;

  for (const deck of targetDecks) {
    const shortages = await getDeckShortages(collectorId, deck.id, database as any);
    if (shortages.hardShortages.length > 0 || shortages.sharedShortages.length > 0) {
      groups.push({
        deckId: deck.id,
        deckName: deck.name,
        format: deck.format || "standard",
        hardShortages: shortages.hardShortages,
        sharedShortages: shortages.sharedShortages,
        totalShortages: shortages.hardShortages.length + shortages.sharedShortages.length,
      });

      grandTotalHard += shortages.totalHardShortages;
      grandTotalShared += shortages.totalSharedShortages;
    }
  }

  return {
    collectorId,
    decks: groups,
    totalDecks: groups.length,
    grandTotalHard,
    grandTotalShared,
  };
}

