import { and, eq } from "drizzle-orm";
import { db } from "../index";
import { rootCommunityIdentities } from "../schema";

export type RootCommunityIdentityDatabase = typeof db;

export async function linkRootCommunityIdentity(
  communityId: string,
  providerUserId: string,
  database: RootCommunityIdentityDatabase = db
): Promise<void> {
  if (!communityId || !providerUserId) {
    return;
  }

  await database
    .insert(rootCommunityIdentities)
    .values({ communityId, providerUserId })
    .onConflictDoNothing();
}

export async function listRootCommunityIdentities(
  communityId: string,
  database: RootCommunityIdentityDatabase = db
): Promise<string[]> {
  const rows = await database
    .select({ providerUserId: rootCommunityIdentities.providerUserId })
    .from(rootCommunityIdentities)
    .where(eq(rootCommunityIdentities.communityId, communityId));

  return rows.map((row) => row.providerUserId);
}

export async function isRootCommunityIdentity(
  communityId: string,
  providerUserId: string,
  database: RootCommunityIdentityDatabase = db
): Promise<boolean> {
  const [row] = await database
    .select({ providerUserId: rootCommunityIdentities.providerUserId })
    .from(rootCommunityIdentities)
    .where(
      and(
        eq(rootCommunityIdentities.communityId, communityId),
        eq(rootCommunityIdentities.providerUserId, providerUserId)
      )
    )
    .limit(1);

  return Boolean(row);
}
