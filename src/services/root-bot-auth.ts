import crypto from "crypto";
import {
  findRootBotInstallByTokenHash,
  upsertRootBotInstall,
  type RootBotInstallDatabase,
} from "../db/repositories/root-bot-install-repository";

/**
 * The one app id allowed to install. It is public (it is the bot's manifest
 * id), not a secret; it is the only trust anchor Root exposes today because
 * outbound requests are not signed.
 */
export const DEFAULT_ROOT_BOT_APP_ID = "ADH-6fbvigmppj1_qgZSmw";

export function hashRootBotToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function allowedAppId(): string {
  return process.env.ROOT_BOT_APP_ID || DEFAULT_ROOT_BOT_APP_ID;
}

export interface IssuedRootBotToken {
  token: string;
  appId: string;
  communityId: string;
}

/**
 * Mints (or rotates) a per-install token for `(appId, communityId)` and stores
 * only its hash. Returns null when the app id is not allowlisted or the
 * community id is empty.
 */
export async function issueRootBotToken(
  appId: string,
  communityId: string,
  database?: RootBotInstallDatabase
): Promise<IssuedRootBotToken | null> {
  if (appId !== allowedAppId()) {
    return null;
  }

  const normalizedCommunityId = communityId.trim();
  if (normalizedCommunityId.length === 0) {
    return null;
  }

  const token = crypto.randomBytes(32).toString("base64url");
  await upsertRootBotInstall(
    {
      appId,
      communityId: normalizedCommunityId,
      tokenHash: hashRootBotToken(token),
    },
    database
  );

  return { token, appId, communityId: normalizedCommunityId };
}

export interface RootBotCaller {
  appId: string;
  communityId: string;
}

/**
 * Authenticates a Root bot request: `Authorization: Bearer <token>` plus
 * `x-root-community-id`. The token must match a non-revoked install and the
 * header community must match the install's community.
 */
export async function authenticateRootBot(
  request: Request,
  database?: RootBotInstallDatabase
): Promise<RootBotCaller | null> {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return null;
  }

  const token = match[1].trim();
  const communityId = request.headers.get("x-root-community-id")?.trim();
  if (!token || !communityId) {
    return null;
  }

  const row = await findRootBotInstallByTokenHash(
    hashRootBotToken(token),
    database
  );
  if (!row || row.revokedAt || row.communityId !== communityId) {
    return null;
  }

  return { appId: row.appId, communityId: row.communityId };
}
