import { db } from "../index";
import { featuredSetGroups, setDefinitions } from "../featured-set-schema";
import { users, cards, cardEditions, collectionItems, decks, deckCards } from "../schema";
import { eq, asc, inArray } from "drizzle-orm";
import type { FeaturedSetGroup, InsertFeaturedSetGroup, SetDefinition, InsertSetDefinition } from "../featured-set-schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type SetRepositoryDatabase = typeof db;

export interface FeaturedSetGroupWithDefinitions extends FeaturedSetGroup {
  setDefinitions: SetDefinition[];
}

// ---------------------------------------------------------------------------
// Featured Set Groups
// ---------------------------------------------------------------------------

/**
 * Returns all featured set groups with their nested set definitions,
 * ordered by sortOrder ascending, then by name ascending.
 */
export async function getAllFeaturedSetGroups(
  database?: typeof db,
): Promise<FeaturedSetGroupWithDefinitions[]> {
  const d = database ?? db;

  const groups = await d
    .select()
    .from(featuredSetGroups)
    .orderBy(asc(featuredSetGroups.sortOrder), asc(featuredSetGroups.name));

  if (groups.length === 0) return [];

  const allDefinitions = await d
    .select()
    .from(setDefinitions)
    .orderBy(asc(setDefinitions.name));

  const defsByGroup = new Map<string, SetDefinition[]>();
  for (const def of allDefinitions) {
    const list = defsByGroup.get(def.groupUuid);
    if (list) {
      list.push(def);
    } else {
      defsByGroup.set(def.groupUuid, [def]);
    }
  }

  return groups.map((g) => ({
    ...g,
    setDefinitions: defsByGroup.get(g.uuid) ?? [],
  }));
}

/**
 * Returns a single featured set group by slug with nested set definitions,
 * or null if not found.
 */
export async function getFeaturedSetGroupBySlug(
  slug: string,
  database?: typeof db,
): Promise<FeaturedSetGroupWithDefinitions | null> {
  const d = database ?? db;

  const rows = await d
    .select()
    .from(featuredSetGroups)
    .where(eq(featuredSetGroups.slug, slug))
    .limit(1);

  if (rows.length === 0) return null;

  const group = rows[0];

  const defs = await d
    .select()
    .from(setDefinitions)
    .where(eq(setDefinitions.groupUuid, group.uuid))
    .orderBy(asc(setDefinitions.name));

  return { ...group, setDefinitions: defs };
}

/**
 * Returns a single featured set group by uuid with nested set definitions,
 * or null if not found.
 */
export async function getFeaturedSetGroupByUuid(
  uuid: string,
  database?: typeof db,
): Promise<FeaturedSetGroupWithDefinitions | null> {
  const d = database ?? db;

  const rows = await d
    .select()
    .from(featuredSetGroups)
    .where(eq(featuredSetGroups.uuid, uuid))
    .limit(1);

  if (rows.length === 0) return null;

  const group = rows[0];

  const defs = await d
    .select()
    .from(setDefinitions)
    .where(eq(setDefinitions.groupUuid, uuid))
    .orderBy(asc(setDefinitions.name));

  return { ...group, setDefinitions: defs };
}

// ---------------------------------------------------------------------------
// Upserts
// ---------------------------------------------------------------------------

/**
 * Inserts or updates a featured set group keyed by uuid.
 * On conflict (uuid already exists), updates name, slug, imageUrl, sortOrder,
 * and refreshes updatedAt. Returns the upserted row.
 */
export async function upsertFeaturedSetGroup(
  data: InsertFeaturedSetGroup & { uuid: string },
  database?: typeof db,
): Promise<FeaturedSetGroup> {
  const d = database ?? db;

  const now = new Date();

  const result = await d
    .insert(featuredSetGroups)
    .values({
      uuid: data.uuid,
      name: data.name,
      slug: data.slug,
      imageUrl: data.imageUrl ?? null,
      sortOrder: data.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: featuredSetGroups.uuid,
      set: {
        name: data.name,
        slug: data.slug,
        imageUrl: data.imageUrl ?? null,
        sortOrder: data.sortOrder ?? 0,
        updatedAt: now,
      },
    })
    .returning();

  return result[0];
}

/**
 * Inserts or updates a set definition keyed by id.
 * On conflict (id already exists), updates groupUuid, prefix, name, language,
 * releaseDate, and refreshes updatedAt. Returns the upserted row.
 */
export async function upsertSetDefinition(
  data: InsertSetDefinition & { id: string },
  database?: typeof db,
): Promise<SetDefinition> {
  const d = database ?? db;

  const now = new Date();

  const result = await d
    .insert(setDefinitions)
    .values({
      id: data.id,
      groupUuid: data.groupUuid,
      prefix: data.prefix,
      name: data.name,
      language: data.language ?? "EN",
      releaseDate: data.releaseDate ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: setDefinitions.id,
      set: {
        groupUuid: data.groupUuid,
        prefix: data.prefix,
        name: data.name,
        language: data.language ?? "EN",
        releaseDate: data.releaseDate ?? null,
        updatedAt: now,
      },
    })
    .returning();

  return result[0];
}

// ---------------------------------------------------------------------------
// User Hidden Set UUID Preferences
// ---------------------------------------------------------------------------

/**
 * Returns the user's hidden set UUIDs as a string array.
 * Tolerates NULL, undefined, or malformed JSON by returning an empty array.
 */
export async function getUserHiddenSetUuids(
  userId: string,
  database?: typeof db,
): Promise<string[]> {
  const d = database ?? db;

  const rows = await d
    .select({ hiddenSetUuids: users.hiddenSetUuids })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (rows.length === 0) return [];

  return parseHiddenSetUuids(rows[0].hiddenSetUuids);
}

/**
 * Stores the user's hidden set UUIDs after deduplication.
 */
export async function setUserHiddenSetUuids(
  userId: string,
  hiddenUuids: string[],
  database?: typeof db,
): Promise<void> {
  const d = database ?? db;

  const deduped = [...new Set(hiddenUuids)];
  const json = JSON.stringify(deduped);

  await d
    .update(users)
    .set({ hiddenSetUuids: json })
    .where(eq(users.id, userId));
}

// ---------------------------------------------------------------------------
// Bulk Loaders for Set Shortage Service
// ---------------------------------------------------------------------------

export async function loadSetShortageAndInventoryData(
  userId: string,
  database?: typeof db,
) {
  const d = database ?? db;

  const [
    userDecks,
    allDeckCards,
    userCollection,
    allEditions,
    allGroups,
    allDefs,
    hiddenRaw,
  ] = await Promise.all([
    d.select({ id: decks.id, name: decks.name }).from(decks).where(eq(decks.userId, userId)),
    d.select({
      id: deckCards.id, deckId: deckCards.deckId, cardSlug: deckCards.cardSlug,
      zone: deckCards.zone, quantity: deckCards.quantity,
      assignedEditionId: deckCards.assignedEditionId, deckName: decks.name,
    }).from(deckCards).innerJoin(decks, eq(deckCards.deckId, decks.id)).where(eq(decks.userId, userId)),
    d.select({
      id: collectionItems.id, cardSlug: cardEditions.cardSlug,
      quantity: collectionItems.quantity, isDedicated: collectionItems.isDedicated,
    }).from(collectionItems).innerJoin(cardEditions, eq(collectionItems.editionId, cardEditions.id))
      .where(eq(collectionItems.userId, userId)),
    d.select({
      id: cardEditions.id, cardSlug: cardEditions.cardSlug,
      setPrefix: cardEditions.setPrefix, setName: cardEditions.setName,
      collectorNumber: cardEditions.collectorNumber, rarity: cardEditions.rarity,
      imageUrl: cardEditions.imageUrl,
    }).from(cardEditions),
    d.select().from(featuredSetGroups).orderBy(asc(featuredSetGroups.sortOrder), asc(featuredSetGroups.name)),
    d.select().from(setDefinitions).orderBy(asc(setDefinitions.name)),
    d.select({ hiddenSetUuids: users.hiddenSetUuids }).from(users).where(eq(users.id, userId)),
  ]);

  return { userDecks, allDeckCards, userCollection, allEditions, allGroups, allDefs,
    hidden: parseHiddenSetUuids(hiddenRaw[0]?.hiddenSetUuids) };
}

export async function loadSetGroupChecklist(
  groupUuid: string, userId: string, database?: typeof db,
) {
  const d = database ?? db;

  const groupRows = await d.select().from(featuredSetGroups).where(eq(featuredSetGroups.uuid, groupUuid));
  if (groupRows.length === 0) return null;

  const group = groupRows[0];
  const defs = await d.select().from(setDefinitions)
    .where(eq(setDefinitions.groupUuid, groupUuid)).orderBy(asc(setDefinitions.name));
  const prefixes = [...new Set(defs.map((d) => d.prefix))];

  const editions = prefixes.length > 0
    ? await d.select({
        id: cardEditions.id, cardSlug: cardEditions.cardSlug,
        setPrefix: cardEditions.setPrefix, setName: cardEditions.setName,
        collectorNumber: cardEditions.collectorNumber, rarity: cardEditions.rarity,
        imageUrl: cardEditions.imageUrl,
      }).from(cardEditions).where(inArray(cardEditions.setPrefix, prefixes))
    : [];

  const slugs = [...new Set(editions.map((e) => e.cardSlug))];
  const cardRows = slugs.length > 0
    ? await d.select({ slug: cards.slug, name: cards.name, element: cards.element,
        class: cards.class, type: cards.type }).from(cards).where(inArray(cards.slug, slugs))
    : [];

  const allCollection = await d.select({
    cardSlug: cardEditions.cardSlug, quantity: collectionItems.quantity, foil: collectionItems.foil,
  }).from(collectionItems).innerJoin(cardEditions, eq(collectionItems.editionId, cardEditions.id))
    .where(eq(collectionItems.userId, userId));

  const slugSet = new Set(slugs);
  return { group, defs, prefixes, editions, cards: cardRows,
    collection: allCollection.filter((c) => slugSet.has(c.cardSlug)) };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseHiddenSetUuids(raw: string | null | undefined): string[] {
  if (raw == null || raw === "") return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((item): item is string => typeof item === "string")) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}
