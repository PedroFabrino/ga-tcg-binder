const BACKOFF_BASE_MS = 5 * 60 * 1000;
const BACKOFF_MAX_MS = 60 * 60 * 1000;

export interface StoreBackoff {
  failures: number;
  nextPollAt: number;
}

/**
 * Per-store failure backoff for this process. Stops a persistently failing
 * origin (e.g. a Cloudflare 522) from being polled every cycle. State is
 * in-memory and resets when the process restarts.
 */
const storeBackoff = new Map<string, StoreBackoff>();

/** Clears per-store backoff state (used by tests). */
export function resetMarketCheckBackoff(): void {
  storeBackoff.clear();
}

export function getActiveBackoff(
  storeId: string,
  now: number
): StoreBackoff | null {
  const state = storeBackoff.get(storeId);
  return state && state.nextPollAt > now ? state : null;
}

export function recordStoreFailure(storeId: string, now: number): void {
  const failures = (storeBackoff.get(storeId)?.failures ?? 0) + 1;
  const delay = Math.min(BACKOFF_BASE_MS * 2 ** failures, BACKOFF_MAX_MS);
  storeBackoff.set(storeId, { failures, nextPollAt: now + delay });
}

export function recordStoreSuccess(storeId: string): void {
  storeBackoff.delete(storeId);
}
