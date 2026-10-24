import { db } from "../index";
import {
  users,
  decks,
  deckCards,
  collectionItems,
  cardEditions,
  cards,
} from "../schema";
import {
  collectorIdentities,
  collectorPairingTokens,
  type CollectorIdentity,
  type InsertCollectorIdentity,
  type CollectorPairingToken,
  type InsertCollectorPairingToken,
} from "../assistant-schema";
import { eq, and, gt, isNull, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";

export type AssistantDatabase = typeof db;
export type {
  CollectorIdentity,
  InsertCollectorIdentity,
  CollectorPairingToken,
  InsertCollectorPairingToken,
};

export interface CollectorProfile {
  id: string;
  name: string | null;
  email: string | null;
  friendCode: string;
  locale: string;
}

/**
 * Creates an ephemeral 6-digit alphanumeric pairing token for a Collector.
 */
export async function createPairingToken(
  collectorId: string,
  token: string,
  expiresAt: Date,
  database = db
): Promise<CollectorPairingToken> {
  const row: InsertCollectorPairingToken = {
    id: randomUUID(),
    collectorId,
    token: token.toUpperCase(),
    expiresAt,
    usedAt: null,
  };

  await database.insert(collectorPairingTokens).values(row);
  return (await database
    .select()
    .from(collectorPairingTokens)
    .where(eq(collectorPairingTokens.id, row.id))
    .get())!;
}

/**
 * Finds an unexpired, unused pairing token.
 */
export async function findValidPairingToken(
  token: string,
  now: Date = new Date(),
  database = db
): Promise<CollectorPairingToken | null> {
  const result = await database
    .select()
    .from(collectorPairingTokens)
    .where(
      and(
        eq(collectorPairingTokens.token, token.toUpperCase()),
        isNull(collectorPairingTokens.usedAt),
        gt(collectorPairingTokens.expiresAt, now)
      )
    )
    .get();

  return result ?? null;
}

/**
 * Marks a pairing token as consumed.
 */
export async function consumePairingToken(
  tokenId: string,
  consumedAt: Date = new Date(),
  database = db
): Promise<void> {
  await database
    .update(collectorPairingTokens)
    .set({ usedAt: consumedAt })
    .where(eq(collectorPairingTokens.id, tokenId));
}

/**
 * Upserts a chat platform identity link for a Collector.
 */
export async function upsertCollectorIdentity(
  data: {
    collectorId: string;
    provider: string;
    providerUserId: string;
    providerUsername?: string | null;
  },
  database = db
): Promise<CollectorIdentity> {
  const existing = await database
    .select()
    .from(collectorIdentities)
    .where(
      and(
        eq(collectorIdentities.provider, data.provider),
        eq(collectorIdentities.providerUserId, data.providerUserId)
      )
    )
    .get();

  const now = new Date();

  if (existing) {
    await database
      .update(collectorIdentities)
      .set({
        collectorId: data.collectorId,
        providerUsername: data.providerUsername ?? existing.providerUsername,
        linkedAt: now,
      })
      .where(eq(collectorIdentities.id, existing.id));

    return (await database
      .select()
      .from(collectorIdentities)
      .where(eq(collectorIdentities.id, existing.id))
      .get())!;
  }

  const id = randomUUID();
  await database.insert(collectorIdentities).values({
    id,
    collectorId: data.collectorId,
    provider: data.provider,
    providerUserId: data.providerUserId,
    providerUsername: data.providerUsername ?? null,
    linkedAt: now,
  });

  return (await database
    .select()
    .from(collectorIdentities)
    .where(eq(collectorIdentities.id, id))
    .get())!;
}

/**
 * Finds a Collector's profile by their external chat platform identity.
 */
export async function findCollectorByIdentity(
  provider: string,
  providerUserId: string,
  database = db
): Promise<{ identity: CollectorIdentity; collector: CollectorProfile } | null> {
  const identity = await database
    .select()
    .from(collectorIdentities)
    .where(
      and(
        eq(collectorIdentities.provider, provider),
        eq(collectorIdentities.providerUserId, providerUserId)
      )
    )
    .get();

  if (!identity) return null;

  const collector = await database
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      friendCode: users.friendCode,
      locale: users.locale,
    })
    .from(users)
    .where(eq(users.id, identity.collectorId))
    .get();

  if (!collector) return null;

  return { identity, collector };
}

/**
 * Retrieves all linked platform identities for a Collector.
 */
export async function findIdentitiesByCollectorId(
  collectorId: string,
  database = db
): Promise<CollectorIdentity[]> {
  return database
    .select()
    .from(collectorIdentities)
    .where(eq(collectorIdentities.collectorId, collectorId));
}

/**
 * Unlinks a specific chat platform identity for a Collector.
 */
export async function unlinkCollectorIdentity(
  collectorId: string,
  provider: string,
  database = db
): Promise<boolean> {
  const res = await database
    .delete(collectorIdentities)
    .where(
      and(
        eq(collectorIdentities.collectorId, collectorId),
        eq(collectorIdentities.provider, provider)
      )
    );

  return (res as any)?.rowsAffected ? (res as any).rowsAffected > 0 : true;
}

/**
 * Provisions a new Collector user record and binds their external chat platform identity.
 */
export async function createCollectorWithIdentity(
  data: {
    id?: string;
    name: string;
    friendCode: string;
    provider: string;
    providerUserId: string;
    providerUsername?: string | null;
    locale?: string;
  },
  database = db
): Promise<CollectorProfile> {
  const userId = data.id || `user_${data.provider}_${data.providerUserId}`;
  const now = new Date();

  await database.insert(users).values({
    id: userId,
    name: data.name,
    email: null,
    friendCode: data.friendCode,
    locale: data.locale || "en",
    lowPopThreshold: 1000,
  });

  const identityId = randomUUID();
  await database.insert(collectorIdentities).values({
    id: identityId,
    collectorId: userId,
    provider: data.provider,
    providerUserId: data.providerUserId,
    providerUsername: data.providerUsername ?? null,
    linkedAt: now,
  });

  return {
    id: userId,
    name: data.name,
    email: null,
    friendCode: data.friendCode,
    locale: data.locale || "en",
  };
}

/**
 * Loads all data needed for assistant deck shortage calculations in two fast batch queries.
 */
export async function loadAssistantCollectorDecksData(
  collectorId: string,
  database = db
) {
  const userDecks = await database
    .select({
      id: decks.id,
      name: decks.name,
      champion: decks.champion,
      format: decks.format,
    })
    .from(decks)
    .where(eq(decks.userId, collectorId));

  const deckIds = userDecks.map((d) => d.id);
  if (deckIds.length === 0) {
    return { userDecks: [], allDeckCards: [], userInventory: [] };
  }

  const [allDeckCards, userInventory] = await Promise.all([
    database
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
      })
      .from(deckCards)
      .innerJoin(decks, eq(deckCards.deckId, decks.id))
      .leftJoin(cards, eq(deckCards.cardSlug, cards.slug))
      .where(inArray(deckCards.deckId, deckIds)),
    database
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
      .where(eq(collectionItems.userId, collectorId)),
  ]);

  return { userDecks, allDeckCards, userInventory };
}

/**
 * Retrieves all linked identities for a provider with wantlist deal notifications enabled.
 */
export async function findIdentitiesWithNotificationsEnabled(
  provider: string,
  database = db
): Promise<CollectorIdentity[]> {
  return database
    .select()
    .from(collectorIdentities)
    .where(
      and(
        eq(collectorIdentities.provider, provider),
        eq(collectorIdentities.wantlistNotificationsEnabled, true)
      )
    );
}

