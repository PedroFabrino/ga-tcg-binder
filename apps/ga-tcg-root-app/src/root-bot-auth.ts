import { rootServer } from "@rootsdk/server-bot";
import { ROOT_BOT_API_BASE_URL } from "./root-bot-config";

const TOKEN_KEY_PREFIX = "rootBot.installToken";

/** The minimal per-install key-value surface (Root's `dataStore.appData`). */
export interface InstallTokenStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(value: { key: string; value: T }): Promise<void>;
}

export interface RootBotTokenOptions {
  communityId: string;
  appId?: string;
  apiBaseUrl?: string;
  store?: InstallTokenStore;
  fetchImpl?: typeof fetch;
}

/**
 * Returns this install's API token, registering once if needed. The token is
 * persisted in Root's per-install key-value store, so it survives restarts and
 * never lives in `.env` or the compiled code.
 */
export async function getRootBotToken(
  options: RootBotTokenOptions
): Promise<string> {
  const store = options.store ?? rootServer.dataStore.appData;
  const appId = options.appId ?? String(rootServer.appId);
  const apiBaseUrl = (options.apiBaseUrl ?? ROOT_BOT_API_BASE_URL).replace(
    /\/+$/,
    ""
  );
  const fetchImpl = options.fetchImpl ?? fetch;
  const key = `${TOKEN_KEY_PREFIX}:${options.communityId}`;

  const cached = await store.get<string>(key);
  if (cached) {
    return cached;
  }

  const response = await fetchImpl(`${apiBaseUrl}/api/root-bot/install`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appId, communityId: options.communityId }),
  });

  if (!response.ok) {
    throw new Error(`Root bot install failed (${response.status})`);
  }

  const data = (await response.json()) as { token?: string };
  if (!data.token) {
    throw new Error("Root bot install response did not include a token");
  }

  await store.set({ key, value: data.token });
  return data.token;
}
