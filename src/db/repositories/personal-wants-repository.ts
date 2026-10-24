import { db } from "../index";
import { cards, cardEditions } from "../schema";
import {
  collectorWants,
  collectorIdentities,
  type CollectorWant,
  type InsertCollectorWant,
} from "../assistant-schema";
import { eq, and, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";

export type PersonalWantsDatabase = typeof db;

export interface PersonalWantItem {
  id: string;
  collectorId: string;
  cardSlug: string;
  cardName: string;
  element: string;
  type: string;
  class: string | null;
  editionId: string | null;
  setPrefix: string | null;
  setName: string | null;
  collectorNumber: string | null;
  imageUrl: string | null;
  desiredQuantity: number;
  foil: boolean | null;
  targetMaxPrice: number | null;
  source: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface UpsertPersonalWantInput {
  collectorId: string;
  cardSlug: string;
  editionId?: string | null;
  desiredQuantity?: number;
  foil?: boolean | null;
  targetMaxPrice?: number | null;
  source?: "manual" | "omnidex";
}

export interface RemovePersonalWantResult {
  success: boolean;
  remainingQuantity: number;
  removed: boolean;
}

export type UpsertPersonalWantResult =
  | { success: true; item: PersonalWantItem }
  | { success: false; item: null };

/**
 * Lists all active personal wants for a collector, joined with canonical card & edition data.
 */
export async function listPersonalWants(
  collectorId: string,
  database = db
): Promise<PersonalWantItem[]> {
  const rows = await database
    .select({
      id: collectorWants.id,
      collectorId: collectorWants.collectorId,
      cardSlug: collectorWants.cardSlug,
      cardName: cards.name,
      element: cards.element,
      type: cards.type,
      class: cards.class,
      editionId: collectorWants.editionId,
      setPrefix: cardEditions.setPrefix,
      setName: cardEditions.setName,
      collectorNumber: cardEditions.collectorNumber,
      imageUrl: cardEditions.imageUrl,
      desiredQuantity: collectorWants.desiredQuantity,
      foil: collectorWants.foil,
      targetMaxPrice: collectorWants.targetMaxPrice,
      source: collectorWants.source,
      createdAt: collectorWants.createdAt,
      updatedAt: collectorWants.updatedAt,
    })
    .from(collectorWants)
    .innerJoin(cards, eq(collectorWants.cardSlug, cards.slug))
    .leftJoin(cardEditions, eq(collectorWants.editionId, cardEditions.id))
    .where(eq(collectorWants.collectorId, collectorId));

  return rows.map((r) => ({
    ...r,
    foil: r.foil === null ? null : Boolean(r.foil),
  }));
}

/**
 * Inserts or increments a personal want for a collector.
 *
 * Validates that the card slug references a real catalog card before writing, so an
 * unresolvable slug returns `{ success: false, item: null }` instead of throwing a
 * foreign-key constraint error (or silently returning `undefined` from a join miss).
 */
export async function upsertPersonalWant(
  data: UpsertPersonalWantInput,
  database = db
): Promise<UpsertPersonalWantResult> {
  const desiredQty = data.desiredQuantity ?? 1;
  const foilVal = data.foil === undefined ? null : data.foil === null ? null : data.foil;
  const editionVal = data.editionId ?? null;

  // Enforce the cards.slug foreign-key invariant before writing.
  const card = await database
    .select({ slug: cards.slug })
    .from(cards)
    .where(eq(cards.slug, data.cardSlug))
    .get();
  if (!card) {
    return { success: false, item: null };
  }

  const conditions = [
    eq(collectorWants.collectorId, data.collectorId),
    eq(collectorWants.cardSlug, data.cardSlug),
    editionVal ? eq(collectorWants.editionId, editionVal) : isNull(collectorWants.editionId),
    foilVal === null ? isNull(collectorWants.foil) : eq(collectorWants.foil, foilVal),
  ];

  const existing = await database
    .select()
    .from(collectorWants)
    .where(and(...conditions))
    .get();

  const now = new Date();

  if (existing) {
    const newQty = existing.desiredQuantity + desiredQty;
    await database
      .update(collectorWants)
      .set({
        desiredQuantity: newQty,
        targetMaxPrice: data.targetMaxPrice !== undefined ? data.targetMaxPrice : existing.targetMaxPrice,
        source: data.source ?? existing.source,
        updatedAt: now,
      })
      .where(eq(collectorWants.id, existing.id));

    const updated = await listPersonalWants(data.collectorId, database);
    const item = updated.find((u) => u.id === existing.id);
    return item ? { success: true, item } : { success: false, item: null };
  }

  const newId = randomUUID();
  const row: InsertCollectorWant = {
    id: newId,
    collectorId: data.collectorId,
    cardSlug: data.cardSlug,
    editionId: editionVal,
    desiredQuantity: desiredQty,
    foil: foilVal,
    targetMaxPrice: data.targetMaxPrice ?? null,
    source: data.source ?? "manual",
    createdAt: now,
    updatedAt: now,
  };

  await database.insert(collectorWants).values(row);
  const items = await listPersonalWants(data.collectorId, database);
  const item = items.find((u) => u.id === newId);
  return item ? { success: true, item } : { success: false, item: null };
}

/**
 * Inserts or increments multiple personal wants in a single optimized batch.
 */
export async function batchUpsertPersonalWants(
  items: UpsertPersonalWantInput[],
  database = db
): Promise<number> {
  if (items.length === 0) return 0;
  const collectorId = items[0].collectorId;

  const existingWants = await database
    .select()
    .from(collectorWants)
    .where(eq(collectorWants.collectorId, collectorId));

  const existingMap = new Map<string, typeof existingWants[number]>();
  for (const w of existingWants) {
    const key = `${w.cardSlug}:${w.editionId ?? ""}:${w.foil ?? ""}`;
    existingMap.set(key, w);
  }

  const now = new Date();
  const toInsert: InsertCollectorWant[] = [];

  for (const item of items) {
    const desiredQty = item.desiredQuantity ?? 1;
    const foilVal = item.foil === undefined ? null : item.foil === null ? null : item.foil;
    const editionVal = item.editionId ?? null;
    const key = `${item.cardSlug}:${editionVal ?? ""}:${foilVal ?? ""}`;

    const existing = existingMap.get(key);
    if (existing) {
      existing.desiredQuantity += desiredQty;
      await database
        .update(collectorWants)
        .set({
          desiredQuantity: existing.desiredQuantity,
          targetMaxPrice:
            item.targetMaxPrice !== undefined ? item.targetMaxPrice : existing.targetMaxPrice,
          source: item.source ?? existing.source,
          updatedAt: now,
        })
        .where(eq(collectorWants.id, existing.id));
    } else {
      toInsert.push({
        id: randomUUID(),
        collectorId: item.collectorId,
        cardSlug: item.cardSlug,
        editionId: editionVal,
        desiredQuantity: desiredQty,
        foil: foilVal,
        targetMaxPrice: item.targetMaxPrice ?? null,
        source: item.source ?? "manual",
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  if (toInsert.length > 0) {
    await database.insert(collectorWants).values(toInsert);
  }

  return items.length;
}

/**
 * Decrements or deletes a personal want for a collector by card slug.
 */
export async function removePersonalWant(
  collectorId: string,
  cardSlug: string,
  quantity?: number,
  database = db
): Promise<RemovePersonalWantResult> {
  const existing = await database
    .select()
    .from(collectorWants)
    .where(
      and(
        eq(collectorWants.collectorId, collectorId),
        eq(collectorWants.cardSlug, cardSlug)
      )
    )
    .get();

  if (!existing) {
    return { success: false, remainingQuantity: 0, removed: false };
  }

  if (quantity === undefined || quantity >= existing.desiredQuantity) {
    await database
      .delete(collectorWants)
      .where(eq(collectorWants.id, existing.id));
    return { success: true, remainingQuantity: 0, removed: true };
  }

  const remaining = existing.desiredQuantity - quantity;
  await database
    .update(collectorWants)
    .set({
      desiredQuantity: remaining,
      updatedAt: new Date(),
    })
    .where(eq(collectorWants.id, existing.id));

  return { success: true, remainingQuantity: remaining, removed: false };
}

/**
 * Sets the wantlist notifications preference for a collector on a specific platform.
 */
export async function setWantlistNotificationPreference(
  collectorId: string,
  provider: string,
  enabled: boolean,
  database = db
): Promise<boolean> {
  const res = await database
    .update(collectorIdentities)
    .set({ wantlistNotificationsEnabled: enabled })
    .where(
      and(
        eq(collectorIdentities.collectorId, collectorId),
        eq(collectorIdentities.provider, provider)
      )
    );

  return true;
}

/**
 * Retrieves the wantlist notifications preference for a collector on a specific platform.
 */
export async function getWantlistNotificationPreference(
  collectorId: string,
  provider: string,
  database = db
): Promise<boolean> {
  const identity = await database
    .select({ enabled: collectorIdentities.wantlistNotificationsEnabled })
    .from(collectorIdentities)
    .where(
      and(
        eq(collectorIdentities.collectorId, collectorId),
        eq(collectorIdentities.provider, provider)
      )
    )
    .get();

  return Boolean(identity?.enabled);
}
