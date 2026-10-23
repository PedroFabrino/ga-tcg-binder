/**
 * Card detail cache (IndexedDB), matching MVP_SPEC §6.8.
 *
 * One object store keyed by the canonical card slug, holding the flattened
 * `CardDetail` plus its fetch timestamp. A private-mode / unavailable
 * `indexedDB` degrades to a no-op cache: the in-session dedupe lives separately
 * in the React hook, so a single visit still avoids refetching the same card.
 */

import type { CardDetailCache, CachedCardDetail } from "./card-catalog";

export type { CachedCardDetail, CardDetailCache } from "./card-catalog";

const DB_NAME = "grandtable";
const STORE_NAME = "card-details";
const DB_VERSION = 1;

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // A blocked upgrade/delete (e.g. another tab holding a connection) can
    // queue `open` indefinitely. Time out so the caller falls back to network.
    const timer = setTimeout(
      () => reject(new Error("Card cache open timed out")),
      3_000
    );
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => {
      clearTimeout(timer);
      resolve(request.result);
    };
    request.onerror = () => {
      clearTimeout(timer);
      reject(request.error ?? new Error("Could not open the card cache database"));
    };
  });
}

/**
 * An IndexedDB-backed detail cache. When `indexedDB` is unavailable or the
 * database cannot be opened, it returns a no-op cache: the caller still falls
 * back to the network, and a private-mode visit simply does not persist detail.
 */
export function createIndexedDbDetailCache(): CardDetailCache {
  if (typeof indexedDB === "undefined") {
    return createNoopDetailCache();
  }

  let database: Promise<IDBDatabase> | null = null;
  let warned = false;
  const warnOnce = (error: unknown) => {
    if (warned) return;
    warned = true;
    console.warn("[card-cache] IndexedDB unavailable; falling back to network", error);
  };

  const open = () => {
    database ??= openDatabase();
    return database;
  };

  return {
    async get(slug) {
      try {
        const db = await open();
        const transaction = db.transaction(STORE_NAME, "readonly");
        const result = await requestToPromise(
          transaction.objectStore(STORE_NAME).get(slug) as IDBRequest<CachedCardDetail | undefined>
        );
        if (!result) return null;
        return result;
      } catch (error) {
        warnOnce(error);
        return null;
      }
    },
    async set(slug, value) {
      try {
        const db = await open();
        const transaction = db.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).put(value, slug);
        await transactionDone(transaction);
      } catch (error) {
        // Private mode or a transient quota error: this visit works in-memory.
        warnOnce(error);
      }
    },
  };
}

function createNoopDetailCache(): CardDetailCache {
  return {
    get: async () => null,
    set: async () => undefined,
  };
}