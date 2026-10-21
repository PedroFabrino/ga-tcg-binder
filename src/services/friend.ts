import {
  getFriendLinksForUser,
  getUsersByIds,
  findUserByFriendCode,
  findFriendLinkBetween,
  createFriendLink,
  type FriendDatabase,
} from "@/db/repositories/friend-repository";
import { findUserById } from "@/db/repositories/auth-repository";

export class FriendValidationError extends Error {}
export class FriendNotFoundError extends Error {}

export async function getFriendsListService(
  userId: string,
  database?: FriendDatabase
) {
  const selfUser = await findUserById(userId, database);
  const links = await getFriendLinksForUser(userId, database);

  const friendIds = links.map((l) => (l.userId1 === userId ? l.userId2 : l.userId1));
  const friends = await getUsersByIds(friendIds, database);

  return {
    currentUser: selfUser,
    friends,
  };
}

export async function addFriendByCodeService(
  userId: string,
  friendCode: string,
  database?: FriendDatabase
) {
  const cleanCode = friendCode.trim();
  if (!cleanCode) {
    throw new FriendValidationError("friendCode is required");
  }

  const targetUser = await findUserByFriendCode(cleanCode, database);
  if (!targetUser) {
    throw new FriendNotFoundError("No collector found with that friend code");
  }

  if (targetUser.id === userId) {
    throw new FriendValidationError("You cannot add yourself as a friend");
  }

  const existing = await findFriendLinkBetween(userId, targetUser.id, database);
  if (existing) {
    return { message: "Already connected", friend: targetUser };
  }

  const linkId = `fl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  await createFriendLink(linkId, userId, targetUser.id, database);

  return { success: true, friend: targetUser };
}
