import {
  getUserById,
  updateUserSettings,
  type UserRow,
  type UserInsert,
} from "@/db/repositories/settings-repository";
import { encryptMypPassword } from "@/lib/crypto";
import { reconcileUserWatchlist } from "./watchlist";
import { normalizePolicyFlags } from "./watchlist-policy";
import type { SettingsUpdateInput } from "@/lib/validation/watchlist-schemas";
import crypto from "crypto";

export interface SafeUser extends Omit<UserRow, "mypPasswordEncrypted"> {
  hasSavedMypCredentials: boolean;
}

export function sanitizeUser(user: UserRow | undefined): SafeUser | null {
  if (!user) return null;
  const { mypPasswordEncrypted, ...safeUser } = user;
  return {
    ...safeUser,
    hasSavedMypCredentials: Boolean(mypPasswordEncrypted),
  };
}

export async function getUserSettings(userId: string, database?: unknown): Promise<SafeUser | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- repositories accept in-memory test database or singleton db
  const dbParam = database as any;
  const user = await getUserById(userId, dbParam);
  return sanitizeUser(user);
}

export async function updateUserSettingsService(
  userId: string,
  input: SettingsUpdateInput & { name?: string; watchlistPolicy?: string },
  database?: unknown
): Promise<SafeUser | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- repositories accept in-memory test database or singleton db
  const dbParam = database as any;
  const updateData: Partial<UserInsert> = {};

  if (input.lowPopThreshold !== undefined) {
    updateData.lowPopThreshold = input.lowPopThreshold;
  }
  if (input.name !== undefined && input.name.trim()) {
    updateData.name = input.name.trim();
  }
  if (input.mypUsername !== undefined) {
    updateData.mypUsername = input.mypUsername?.trim() || null;
  }
  if (input.mypAutoWatchlistEnabled !== undefined) {
    updateData.mypAutoWatchlistEnabled = input.mypAutoWatchlistEnabled;
  }

  // Quota policy updates (handles both individual boolean flags and legacy single policy name)
  if (
    input.watchlistPolicyHard !== undefined ||
    input.watchlistPolicyShared !== undefined ||
    input.watchlistPolicyStaples !== undefined ||
    input.watchlistPolicy !== undefined
  ) {
    const flags = normalizePolicyFlags({
      hard: input.watchlistPolicyHard,
      shared: input.watchlistPolicyShared,
      staples: input.watchlistPolicyStaples,
      legacyPolicy: input.watchlistPolicy,
    });
    updateData.watchlistPolicyHard = flags.hard;
    updateData.watchlistPolicyShared = flags.shared;
    updateData.watchlistPolicyStaples = flags.staples;
  }

  // MyP credentials update
  if (input.clearMypCredentials) {
    updateData.mypLogin = null;
    updateData.mypPasswordEncrypted = null;
    updateData.mypAutoWatchlistEnabled = false;
  } else {
    if (input.mypPassword && input.mypPassword.trim()) {
      updateData.mypPasswordEncrypted = encryptMypPassword(input.mypPassword.trim());
      // Ensure sync token exists
      const existing = await getUserById(userId, dbParam);
      if (!existing?.watchlistSyncToken) {
        updateData.watchlistSyncToken = crypto.randomUUID();
      }
    }
    if (input.mypLogin !== undefined && input.mypLogin !== null) {
      updateData.mypLogin = input.mypLogin.trim();
    }
  }

  // Ensure user has a watchlistSyncToken for Browser Userscript Bridge
  const currentUser = await getUserById(userId, dbParam);
  if (!currentUser?.watchlistSyncToken && !updateData.watchlistSyncToken) {
    updateData.watchlistSyncToken = crypto.randomUUID();
  }

  let updatedUser: UserRow | undefined;
  if (Object.keys(updateData).length > 0) {
    updatedUser = await updateUserSettings(userId, updateData, dbParam);
  } else {
    updatedUser = currentUser;
  }

  // Trigger reconciliation if policy or credentials changed
  const shouldReconcile = Boolean(
    input.watchlistPolicy ||
    input.watchlistPolicyHard !== undefined ||
    input.watchlistPolicyShared !== undefined ||
    input.watchlistPolicyStaples !== undefined ||
    input.mypUsername ||
    input.mypPassword ||
    input.clearMypCredentials
  );

  if (shouldReconcile) {
    try {
      await reconcileUserWatchlist(userId, { database: dbParam });
    } catch {
      // Background reconciliation error non-fatal
    }
  }

  return sanitizeUser(updatedUser);
}
