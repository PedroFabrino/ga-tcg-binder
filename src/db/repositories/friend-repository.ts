import { db } from "../index";
import { users, friendLinks } from "../schema";
import { eq, and, or, sql, inArray } from "drizzle-orm";

export type FriendDatabase = typeof db;
export type FriendLinkRow = typeof friendLinks.$inferSelect;
export type UserSummary = {
  id: string;
  name: string | null;
  friendCode: string;
  createdAt: Date | null;
};

export async function getFriendLinksForUser(
  userId: string,
  database = db
): Promise<FriendLinkRow[]> {
  return database
    .select()
    .from(friendLinks)
    .where(
      and(
        or(eq(friendLinks.userId1, userId), eq(friendLinks.userId2, userId)),
        eq(friendLinks.status, "accepted")
      )
    );
}

export async function getUsersByIds(
  userIds: string[],
  database = db
): Promise<UserSummary[]> {
  if (userIds.length === 0) return [];
  const rows = await database
    .select({
      id: users.id,
      name: users.name,
      friendCode: users.friendCode,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(inArray(users.id, userIds));

  return rows;
}

export async function findUserByFriendCode(
  friendCode: string,
  database = db
) {
  const [user] = await database
    .select()
    .from(users)
    .where(sql`upper(${users.friendCode}) = upper(${friendCode})`)
    .limit(1);
  return user;
}

export async function findFriendLinkBetween(
  userId1: string,
  userId2: string,
  database = db
): Promise<FriendLinkRow | undefined> {
  const [link] = await database
    .select()
    .from(friendLinks)
    .where(
      or(
        and(eq(friendLinks.userId1, userId1), eq(friendLinks.userId2, userId2)),
        and(eq(friendLinks.userId1, userId2), eq(friendLinks.userId2, userId1))
      )
    )
    .limit(1);
  return link;
}

export async function createFriendLink(
  id: string,
  userId1: string,
  userId2: string,
  database = db
): Promise<void> {
  await database.insert(friendLinks).values({
    id,
    userId1,
    userId2,
    status: "accepted",
  });
}
