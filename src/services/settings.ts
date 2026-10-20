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

export interface UserCapabilities {
  hasVendorCapability: boolean;
  hasShippingCapability: boolean;
}

export interface SafeUser extends Omit<UserRow, "mypPasswordEncrypted" | "superfreteApiKeyEncrypted">, UserCapabilities {
  hasSavedMypCredentials: boolean;
  hasSavedSuperfreteApiKey: boolean;
}

export function getUserCapabilities(user: Pick<UserRow, "sellerModeEnabled" | "mypUsername" | "mypPasswordEncrypted" | "superfreteApiKeyEncrypted">): UserCapabilities {
  const hasVendorCapability = Boolean(user.sellerModeEnabled && user.mypUsername?.trim() && user.mypPasswordEncrypted);
  return {
    hasVendorCapability,
    hasShippingCapability: hasVendorCapability && Boolean(user.superfreteApiKeyEncrypted),
  };
}

export function sanitizeUser(user: UserRow | undefined): SafeUser | null {
  if (!user) return null;
  const { mypPasswordEncrypted, superfreteApiKeyEncrypted, ...safeUser } = user;
  return {
    ...safeUser,
    hasSavedMypCredentials: Boolean(mypPasswordEncrypted),
    hasSavedSuperfreteApiKey: Boolean(superfreteApiKeyEncrypted),
    ...getUserCapabilities(user),
  };
}

export async function userHasCapability(userId: string, capability: keyof UserCapabilities): Promise<boolean> {
  const user = await getUserById(userId);
  return Boolean(user && getUserCapabilities(user)[capability]);
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
  if (input.sellerModeEnabled !== undefined) {
    updateData.sellerModeEnabled = input.sellerModeEnabled;
  }
  if (input.mypUsername !== undefined && !input.mypUsername?.trim()) {
    updateData.sellerModeEnabled = false;
    updateData.mypAutoWatchlistEnabled = false;
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
    updateData.sellerModeEnabled = false;
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

  // Superfrete API Key update
  if (input.clearSuperfreteApiKey) {
    updateData.superfreteApiKeyEncrypted = null;
  } else if (input.superfreteApiKey !== undefined && input.superfreteApiKey !== null) {
    const trimmed = input.superfreteApiKey.trim();
    if (trimmed) {
      updateData.superfreteApiKeyEncrypted = encryptMypPassword(trimmed);
    }
  }

  // Price fairness multipliers
  if (input.slightlyOverpricedMultiplier !== undefined) {
    updateData.slightlyOverpricedMultiplier = input.slightlyOverpricedMultiplier;
  }
  if (input.heavilyOverpricedMultiplier !== undefined) {
    updateData.heavilyOverpricedMultiplier = input.heavilyOverpricedMultiplier;
  }

  // Shipping package configuration is private to Shipping-Capable sellers
  const currentUser = await getUserById(userId, dbParam);
  const canConfigureShipping = currentUser
    ? getUserCapabilities({ ...currentUser, ...updateData }).hasShippingCapability
    : false;
  if (canConfigureShipping) {
    if (input.shippingPackagePreset !== undefined) {
      updateData.shippingPackagePreset = input.shippingPackagePreset;
    }
    if (input.shippingPackageHeight !== undefined) {
      updateData.shippingPackageHeight = input.shippingPackageHeight;
    }
    if (input.shippingPackageWidth !== undefined) {
      updateData.shippingPackageWidth = input.shippingPackageWidth;
    }
    if (input.shippingPackageLength !== undefined) {
      updateData.shippingPackageLength = input.shippingPackageLength;
    }
    if (input.shippingPackageBaseWeight !== undefined) {
      updateData.shippingPackageBaseWeight = input.shippingPackageBaseWeight;
    }
    if (input.shippingPackageTapeWeight !== undefined) {
      updateData.shippingPackageTapeWeight = input.shippingPackageTapeWeight;
    }
    if (input.shippingCardWeight !== undefined) {
      updateData.shippingCardWeight = input.shippingCardWeight;
    }
  }

  // Ensure user has a watchlistSyncToken for Browser Userscript Bridge
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

  if (updatedUser && (!updatedUser.mypUsername?.trim() || !updatedUser.mypPasswordEncrypted) && updatedUser.sellerModeEnabled) {
    updatedUser = await updateUserSettings(userId, { sellerModeEnabled: false }, dbParam);
  }

  return sanitizeUser(updatedUser);
}
