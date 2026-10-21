import { db } from "../index";
import { users, decks, collectionItems } from "../schema";
import { DEFAULT_USER_ID } from "@/lib/default-user";
import { eq, and } from "drizzle-orm";

export type AuthDatabase = typeof db;
export type UserRow = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;

export async function findUserByEmail(
  email: string,
  database = db
): Promise<UserRow | undefined> {
  const normalizedEmail = email.toLowerCase().trim();
  const [user] = await database
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);
  return user;
}

export async function findUserById(
  id: string,
  database = db
): Promise<UserRow | undefined> {
  const [user] = await database
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return user;
}

export async function createUser(
  user: UserInsert,
  database = db
): Promise<UserRow> {
  await database.insert(users).values(user);
  const created = await findUserById(user.id, database);
  if (!created) throw new Error("Failed to create user");
  return created;
}

export async function updateUserProfile(
  id: string,
  updates: Partial<Pick<UserInsert, "name" | "image">>,
  database = db
): Promise<void> {
  await database
    .update(users)
    .set(updates)
    .where(eq(users.id, id));
}

export async function migrateDefaultUserDataToUser(
  targetUserId: string,
  database = db
): Promise<void> {
  if (!targetUserId || targetUserId === DEFAULT_USER_ID) return;

  const defaultItems = await database
    .select()
    .from(collectionItems)
    .where(eq(collectionItems.userId, DEFAULT_USER_ID));

  const deckMigration = database
    .update(decks)
    .set({ userId: targetUserId })
    .where(eq(decks.userId, DEFAULT_USER_ID));
  const statements: [
    Parameters<AuthDatabase["batch"]>[0][number],
    ...Array<Parameters<AuthDatabase["batch"]>[0][number]>,
  ] = [deckMigration];

  for (const item of defaultItems) {
    const [existing] = await database
      .select()
      .from(collectionItems)
      .where(
        and(
          eq(collectionItems.userId, targetUserId),
          eq(collectionItems.editionId, item.editionId),
          eq(collectionItems.foil, item.foil)
        )
      )
      .limit(1);

    if (existing) {
      statements.push(
        database
          .update(collectionItems)
          .set({
            quantity: existing.quantity + item.quantity,
            updatedAt: new Date(),
          })
          .where(eq(collectionItems.id, existing.id)),
        database
          .delete(collectionItems)
          .where(eq(collectionItems.id, item.id))
      );
    } else {
      statements.push(
        database
          .update(collectionItems)
          .set({ userId: targetUserId })
          .where(eq(collectionItems.id, item.id))
      );
    }
  }

  await database.batch(statements);
}
