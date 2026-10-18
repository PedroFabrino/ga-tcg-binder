export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface SettingsUpdateInput {
  lowPopThreshold?: number;
  mypUsername?: string | null;
  mypLogin?: string | null;
  mypPassword?: string | null;
  clearMypCredentials?: boolean;
  mypAutoWatchlistEnabled?: boolean;
  watchlistPolicyHard?: boolean;
  watchlistPolicyShared?: boolean;
  watchlistPolicyStaples?: boolean;
  superfreteApiKey?: string | null;
  clearSuperfreteApiKey?: boolean;
  slightlyOverpricedMultiplier?: number;
  heavilyOverpricedMultiplier?: number;
}

export function parseSettingsInput(raw: unknown): ValidationResult<SettingsUpdateInput> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { success: false, error: "Request body must be a JSON object" };
  }
  const body = raw as Record<string, unknown>;
  const data: SettingsUpdateInput = {};

  if (body.lowPopThreshold !== undefined) {
    if (typeof body.lowPopThreshold !== "number" || isNaN(body.lowPopThreshold) || body.lowPopThreshold < 0) {
      return { success: false, error: "lowPopThreshold must be a non-negative number" };
    }
    data.lowPopThreshold = body.lowPopThreshold;
  }

  if (body.mypUsername !== undefined) {
    if (body.mypUsername !== null && typeof body.mypUsername !== "string") {
      return { success: false, error: "mypUsername must be a string or null" };
    }
    data.mypUsername = body.mypUsername;
  }

  if (body.mypLogin !== undefined) {
    if (body.mypLogin !== null && typeof body.mypLogin !== "string") {
      return { success: false, error: "mypLogin must be a string or null" };
    }
    data.mypLogin = body.mypLogin;
  }

  if (body.mypPassword !== undefined) {
    if (body.mypPassword !== null && typeof body.mypPassword !== "string") {
      return { success: false, error: "mypPassword must be a string or null" };
    }
    data.mypPassword = body.mypPassword;
  }

  if (body.clearMypCredentials !== undefined) {
    if (typeof body.clearMypCredentials !== "boolean") {
      return { success: false, error: "clearMypCredentials must be a boolean" };
    }
    data.clearMypCredentials = body.clearMypCredentials;
  }

  if (body.mypAutoWatchlistEnabled !== undefined) {
    if (typeof body.mypAutoWatchlistEnabled !== "boolean") {
      return { success: false, error: "mypAutoWatchlistEnabled must be a boolean" };
    }
    data.mypAutoWatchlistEnabled = body.mypAutoWatchlistEnabled;
  }

  if (body.watchlistPolicyHard !== undefined) {
    if (typeof body.watchlistPolicyHard !== "boolean") {
      return { success: false, error: "watchlistPolicyHard must be a boolean" };
    }
    data.watchlistPolicyHard = body.watchlistPolicyHard;
  }

  if (body.watchlistPolicyShared !== undefined) {
    if (typeof body.watchlistPolicyShared !== "boolean") {
      return { success: false, error: "watchlistPolicyShared must be a boolean" };
    }
    data.watchlistPolicyShared = body.watchlistPolicyShared;
  }

  if (body.watchlistPolicyStaples !== undefined) {
    if (typeof body.watchlistPolicyStaples !== "boolean") {
      return { success: false, error: "watchlistPolicyStaples must be a boolean" };
    }
    data.watchlistPolicyStaples = body.watchlistPolicyStaples;
  }

  if (body.superfreteApiKey !== undefined) {
    if (body.superfreteApiKey !== null && typeof body.superfreteApiKey !== "string") {
      return { success: false, error: "superfreteApiKey must be a string or null" };
    }
    data.superfreteApiKey = body.superfreteApiKey;
  }

  if (body.clearSuperfreteApiKey !== undefined) {
    if (typeof body.clearSuperfreteApiKey !== "boolean") {
      return { success: false, error: "clearSuperfreteApiKey must be a boolean" };
    }
    data.clearSuperfreteApiKey = body.clearSuperfreteApiKey;
  }

  if (body.slightlyOverpricedMultiplier !== undefined) {
    if (typeof body.slightlyOverpricedMultiplier !== "number" || isNaN(body.slightlyOverpricedMultiplier) || body.slightlyOverpricedMultiplier <= 1.0) {
      return { success: false, error: "slightlyOverpricedMultiplier must be a number greater than 1.0" };
    }
    data.slightlyOverpricedMultiplier = body.slightlyOverpricedMultiplier;
  }

  if (body.heavilyOverpricedMultiplier !== undefined) {
    if (typeof body.heavilyOverpricedMultiplier !== "number" || isNaN(body.heavilyOverpricedMultiplier) || body.heavilyOverpricedMultiplier <= 1.0) {
      return { success: false, error: "heavilyOverpricedMultiplier must be a number greater than 1.0" };
    }
    data.heavilyOverpricedMultiplier = body.heavilyOverpricedMultiplier;
  }

  if (
    data.slightlyOverpricedMultiplier !== undefined &&
    data.heavilyOverpricedMultiplier !== undefined &&
    data.heavilyOverpricedMultiplier < data.slightlyOverpricedMultiplier
  ) {
    return { success: false, error: "heavilyOverpricedMultiplier must be greater than or equal to slightlyOverpricedMultiplier" };
  }

  return { success: true, data };
}

export interface WatchlistActionInput {
  action: "re_enable" | "update_policy" | "trigger_sync";
  entryId?: string;
  policy?: "hard" | "shared" | "staples";
  policies?: {
    hard?: boolean;
    shared?: boolean;
    staples?: boolean;
  };
}

export function parseWatchlistActionInput(raw: unknown): ValidationResult<WatchlistActionInput> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { success: false, error: "Request body must be a JSON object" };
  }
  const body = raw as Record<string, unknown>;

  if (body.action !== "re_enable" && body.action !== "update_policy" && body.action !== "trigger_sync") {
    return { success: false, error: "Invalid action. Must be 're_enable', 'update_policy', or 'trigger_sync'" };
  }

  if (body.action === "re_enable") {
    if (!body.entryId || typeof body.entryId !== "string") {
      return { success: false, error: "entryId must be a non-empty string for re_enable action" };
    }
    return { success: true, data: { action: "re_enable", entryId: body.entryId } };
  }

  if (body.action === "update_policy") {
    if (body.policies && typeof body.policies === "object") {
      const p = body.policies as Record<string, unknown>;
      return {
        success: true,
        data: {
          action: "update_policy",
          policies: {
            hard: typeof p.hard === "boolean" ? p.hard : undefined,
            shared: typeof p.shared === "boolean" ? p.shared : undefined,
            staples: typeof p.staples === "boolean" ? p.staples : undefined,
          },
        },
      };
    }
    if (body.policy === "hard" || body.policy === "shared" || body.policy === "staples") {
      return { success: true, data: { action: "update_policy", policy: body.policy } };
    }
    return { success: false, error: "policy or policies must be provided for update_policy" };
  }

  return { success: true, data: { action: "trigger_sync" } };
}

export interface WatchlistConfirmInput {
  userId?: string;
  syncToken?: string;
  confirmedAddIds: string[];
  confirmedUpdateIds: string[];
  confirmedRemoveIds: string[];
}

export function parseWatchlistConfirmInput(raw: unknown): ValidationResult<WatchlistConfirmInput> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { success: false, error: "Request body must be a JSON object" };
  }
  const body = raw as Record<string, unknown>;

  const toStringArray = (val: unknown): string[] => {
    if (!Array.isArray(val)) return [];
    return val.filter((item): item is string => typeof item === "string");
  };

  return {
    success: true,
    data: {
      userId: typeof body.userId === "string" ? body.userId : undefined,
      syncToken: typeof body.syncToken === "string" ? body.syncToken : undefined,
      confirmedAddIds: toStringArray(body.confirmedAddIds),
      confirmedUpdateIds: toStringArray(body.confirmedUpdateIds),
      confirmedRemoveIds: toStringArray(body.confirmedRemoveIds),
    },
  };
}
