import { and, eq } from "drizzle-orm";
import { db } from "../index";
import {
  rootBotInstalls,
  type RootBotInstallRow,
} from "../schema";

export type RootBotInstallDatabase = typeof db;

export async function findRootBotInstall(
  appId: string,
  communityId: string,
  database: RootBotInstallDatabase = db
): Promise<RootBotInstallRow | undefined> {
  const [row] = await database
    .select()
    .from(rootBotInstalls)
    .where(
      and(
        eq(rootBotInstalls.appId, appId),
        eq(rootBotInstalls.communityId, communityId)
      )
    )
    .limit(1);

  return row;
}

export async function findRootBotInstallByTokenHash(
  tokenHash: string,
  database: RootBotInstallDatabase = db
): Promise<RootBotInstallRow | undefined> {
  const [row] = await database
    .select()
    .from(rootBotInstalls)
    .where(eq(rootBotInstalls.tokenHash, tokenHash))
    .limit(1);

  return row;
}

export async function upsertRootBotInstall(
  record: {
    appId: string;
    communityId: string;
    tokenHash: string;
    createdAt?: Date;
  },
  database: RootBotInstallDatabase = db
): Promise<void> {
  await database
    .insert(rootBotInstalls)
    .values({
      appId: record.appId,
      communityId: record.communityId,
      tokenHash: record.tokenHash,
      createdAt: record.createdAt ?? new Date(),
      revokedAt: null,
    })
    .onConflictDoUpdate({
      target: [rootBotInstalls.appId, rootBotInstalls.communityId],
      set: {
        tokenHash: record.tokenHash,
        revokedAt: null,
      },
    });
}

export async function revokeRootBotInstall(
  appId: string,
  communityId: string,
  database: RootBotInstallDatabase = db
): Promise<void> {
  await database
    .update(rootBotInstalls)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(rootBotInstalls.appId, appId),
        eq(rootBotInstalls.communityId, communityId)
      )
    );
}
