import crypto from "crypto";
import {
  findRootBotInstall,
  findRootBotInstallByTokenHash,
  upsertRootBotInstall,
  type RootBotInstallDatabase,
} from "../db/repositories/root-bot-install-repository";

/**
 * The manifest id and the internal app GUID both identify the same Root app.
 * Root's cloud may report either at runtime, so the allowlist accepts both.
 * They are public identifiers, not secrets.
 */
export const DEFAULT_ROOT_BOT_APP_ID = "ADH8HL2viwm_XPEqJ9om9w";
export const DEFAULT_ROOT_BOT_APP_GUID =
  "0031fc1c-bdaf-8b09-bf5c-f12a27da26f7";

export function hashRootBotToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function allowedAppIds(): Set<string> {
  return new Set(
    [
      process.env.ROOT_BOT_APP_ID,
      DEFAULT_ROOT_BOT_APP_ID,
      DEFAULT_ROOT_BOT_APP_GUID,
    ].filter((id): id is string => typeof id === "string" && id.length > 0)
  );
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
  if (!allowedAppIds().has(appId)) {
    return null;
  }

  const normalizedCommunityId = communityId.trim();
  if (normalizedCommunityId.length === 0) {
    return null;
  }

  // A revoked install must not be silently revived by re-registering.
  const existing = await findRootBotInstall(
    appId,
    normalizedCommunityId,
    database
  );
  if (existing?.revokedAt) {
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
