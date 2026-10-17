import { db } from "../db";
import { users, decks, collectionItems } from "../db/schema";
import { runMigrations } from "../db/init";
import { seedMetaArchetypes } from "./meta";
import { eq, and, sql } from "drizzle-orm";

export const DEFAULT_USER_ID = "user_default";

export async function migrateDefaultUserDataToUser(targetUserId: string, database = db) {
  if (!targetUserId || targetUserId === DEFAULT_USER_ID) return;

  try {
    // 1. Move any decks belonging to DEFAULT_USER_ID to targetUserId
    await database
      .update(decks)
      .set({ userId: targetUserId })
      .where(eq(decks.userId, DEFAULT_USER_ID));

    // 2. Move or merge collection items
    const defaultItems = await database
      .select()
      .from(collectionItems)
      .where(eq(collectionItems.userId, DEFAULT_USER_ID));

    for (const item of defaultItems) {
      const existing = await database
        .select()
        .from(collectionItems)
        .where(
          and(
            eq(collectionItems.userId, targetUserId),
            eq(collectionItems.editionId, item.editionId),
            eq(collectionItems.foil, item.foil)
          )
        )
        .get();

      if (existing) {
        await database
          .update(collectionItems)
          .set({
            quantity: existing.quantity + item.quantity,
            updatedAt: sql`(strftime('%s', 'now'))`,
          })
          .where(eq(collectionItems.id, existing.id));
        await database
          .delete(collectionItems)
          .where(eq(collectionItems.id, item.id));
      } else {
        await database
          .update(collectionItems)
          .set({ userId: targetUserId })
          .where(eq(collectionItems.id, item.id));
      }
    }
  } catch (err) {
    console.error("Error migrating default user data to user:", err);
  }
}

async function doSeed(database = db) {
  const existing = await database
    .select()
    .from(users)
    .where(eq(users.id, DEFAULT_USER_ID))
    .get();

  if (!existing) {
    await database.insert(users).values({
      id: DEFAULT_USER_ID,
      name: "Alex",
      email: "alex@grandarchive.local",
      friendCode: "GA-ALEX01",
      lowPopThreshold: 1000,
    });
  }

  // Also seed a demo friend to demonstrate idle borrowing right away
  const demoFriend = await database
    .select()
    .from(users)
    .where(eq(users.id, "user_friend_bob"))
    .get();

  if (!demoFriend) {
    await database.insert(users).values({
      id: "user_friend_bob",
      name: "Bob (Playgroup Friend)",
      email: "bob@grandarchive.local",
      friendCode: "GA-BOB77",
      lowPopThreshold: 1000,
    });
  }

  await seedMetaArchetypes(database);
}

export async function ensureDefaultUserAndSeed(database = db) {
  try {
    await doSeed(database);
  } catch (err: any) {
    const errorMsg = (err?.message || "").toLowerCase();
    if (
      errorMsg.includes("no such table") ||
      errorMsg.includes("no such column") ||
      errorMsg.includes("sqlite_error")
    ) {
      await runMigrations();
      await doSeed(database);
      return;
    }
    throw err;
  }
}
