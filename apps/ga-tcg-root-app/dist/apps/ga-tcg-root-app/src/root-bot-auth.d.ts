/** The minimal per-install key-value surface (Root's `dataStore.appData`). */
export interface InstallTokenStore {
    get<T>(key: string): Promise<T | undefined>;
    set<T>(value: {
        key: string;
        value: T;
    }): Promise<void>;
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
export declare function getRootBotToken(options: RootBotTokenOptions): Promise<string>;
