import type { SeatId } from "@ga/contracts";

export interface SeatSession {
  seat: SeatId;
  token: string;
}

/** The read surface of `URLSearchParams` / Next's `ReadonlyURLSearchParams`. */
export interface SeatSearchParams {
  get(name: string): string | null;
}

/** The part of `Storage` this module needs; tests pass a small fake. */
export interface SeatStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORAGE_PREFIX = "gt.table.";

export function tableStorageKey(code: string): string {
  return `${STORAGE_PREFIX}${code.toUpperCase()}`;
}

/** The Seat session carried by the URL (the invite link), if complete. */
export function parseSeatSession(search: SeatSearchParams): SeatSession | null {
  const seat = search.get("seat");
  const token = search.get("token");
  if ((seat === "p1" || seat === "p2") && token) {
    return { seat, token };
  }
  return null;
}

export function isSeatSession(value: unknown): value is SeatSession {
  if (typeof value !== "object" || value === null) return false;
  const session = value as Record<string, unknown>;
  return (
    (session.seat === "p1" || session.seat === "p2") &&
    typeof session.token === "string" &&
    session.token.length > 0
  );
}

export function readStoredSeatSession(
  code: string,
  storage: Pick<SeatStorage, "getItem"> | null
): SeatSession | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(tableStorageKey(code));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSeatSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSeatSession(
  code: string,
  session: SeatSession,
  storage: Pick<SeatStorage, "setItem"> | null
): void {
  if (!storage) return;
  try {
    storage.setItem(tableStorageKey(code), JSON.stringify(session));
  } catch {
    // Private mode or a full quota: the URL token still works for this visit.
  }
}

/**
 * Resolve the Seat for this visit. The URL wins when it carries both a Seat and
 * a token (the invite link); otherwise the last session for the Table is used.
 * A URL naming a different Seat or token than the stored one is rejected rather
 * than silently connecting as the wrong side.
 */
export function readSeatSession(
  code: string,
  search: SeatSearchParams,
  storage: Pick<SeatStorage, "getItem"> | null
): SeatSession | null {
  const urlSeat = search.get("seat");
  const urlToken = search.get("token");

  if ((urlSeat === "p1" || urlSeat === "p2") && urlToken) {
    return { seat: urlSeat, token: urlToken };
  }

  const stored = readStoredSeatSession(code, storage);
  if (!stored) return null;

  if (urlSeat === "p1" || urlSeat === "p2") {
    return stored.seat === urlSeat ? stored : null;
  }
  if (urlToken) {
    return stored.token === urlToken ? stored : null;
  }
  return stored;
}

/** The browser's storage, or null during server rendering. */
export function browserStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}
