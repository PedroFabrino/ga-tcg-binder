import { db } from "../index";
import { users } from "../schema";
import { eq, isNotNull, and } from "drizzle-orm";

export type UserRow = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;

export async function getUserById(
  userId: string,
  database = db
): Promise<UserRow | undefined> {
  const [user] = await database
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user;
}

export async function updateUserSettings(
  userId: string,
  values: Partial<UserInsert>,
  database = db
): Promise<UserRow | undefined> {
  await database
    .update(users)
    .set(values)
    .where(eq(users.id, userId));

  return getUserById(userId, database);
}

export async function getUsersWithMypUsername(
  targetUserId?: string,
  database = db
): Promise<UserRow[]> {
  if (targetUserId) {
    return database
      .select()
      .from(users)
      .where(eq(users.id, targetUserId));
  }
  return database
    .select()
    .from(users)
    .where(isNotNull(users.mypUsername));
}

export async function getUsersForAutomatedWatchlistSync(
  targetUserId?: string,
  database = db
): Promise<UserRow[]> {
  if (targetUserId) {
    return database
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, targetUserId),
          isNotNull(users.mypPasswordEncrypted)
        )
      );
  }
  return database
    .select()
    .from(users)
    .where(isNotNull(users.mypPasswordEncrypted));
}
