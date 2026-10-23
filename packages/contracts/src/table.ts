/**
 * GrandTable tabletop contracts.
 *
 * The single source of truth for every shape that crosses a Table boundary:
 * seat state, pins, ripples, the action log, and the room message union.
 * These are the "fence" the room state machine (server) and the state reducer
 * (client) both build against, so neither can drift from the other.
 */

export type SeatId = "p1" | "p2";

export type TableRole = "seat" | "capture" | "viewer";

/**
 * A Seat's mirrored HUD. All fields are manually operated and publicly visible;
 * nothing here is hidden information. `championSlug` is null until a Champion is
 * pinned. Damage counts up; a Seat is defeated when damage >= the Champion's
 * printed life (read from the card, not stored here).
 */
export interface SeatState {
  displayName: string;
  championSlug: string | null;
  damage: number;
  memory: number;
  hand: number;
}

/**
 * A card a Seat has deliberately shown to the whole Table. `cardSlug` is the
 * canonical Card; `printingSlug` optionally picks a specific art.
 */
export interface Pin {
  seat: SeatId;
  cardSlug: string;
  printingSlug?: string;
  at: number;
}

/** A transient pointer marker dropped on a Feed, at normalized 0..1 coordinates. */
export interface Ripple {
  seat: SeatId;
  x: number;
  y: number;
  at: number;
}

/** One attributed entry in the append-only action log. */
export interface LogEntry {
  at: number;
  seat: SeatId;
  kind: string;
  detail: string;
}

/**
 * The full state of one Table. Broadcast as a snapshot on join and re-broadcast
 * after every change; the state is small enough that deltas are not worth a
 * second, more error-prone code path.
 */
export interface TableState {
  code: string;
  seats: Partial<Record<SeatId, SeatState>>;
  active: SeatId | null;
  pins: Partial<Record<SeatId, Pin>>;
  recent: Pin[];
  ripples: Ripple[];
  log: LogEntry[];
}

/** Address of a peer for signaling: a seat plus the role of its connection. */
export interface SignalTarget {
  seat: SeatId;
  role: TableRole;
}

export type TableClientMessage =
  | { type: "TABLE_HELLO"; token: string; role: TableRole; displayName?: string }
  | { type: "SEAT_UPDATE"; patch: Partial<SeatState> }
  | { type: "TURN_START" }
  | { type: "TURN_END" }
  | { type: "PIN_SET"; cardSlug: string; printingSlug?: string }
  | { type: "PIN_CLEAR" }
  | { type: "RIPPLE"; x: number; y: number }
  | { type: "SIGNAL"; to: SignalTarget; data: unknown };

export interface ParticipantInfo {
  seat: SeatId | null;
  role: TableRole;
  displayName?: string;
}

export type TableServerMessage =
  | { type: "TABLE_STATE"; state: TableState }
  | { type: "SIGNAL"; from: SignalTarget; data: unknown }
  | { type: "PRESENCE"; participants: ParticipantInfo[] }
  | { type: "TABLE_ERROR"; code: string; message: string };

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isSeatId(value: unknown): value is SeatId {
  return value === "p1" || value === "p2";
}

export function isTableRole(value: unknown): value is TableRole {
  return value === "seat" || value === "capture" || value === "viewer";
}

export function isSeatState(value: unknown): value is SeatState {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.displayName === "string" &&
    (typeof s.championSlug === "string" || s.championSlug === null) &&
    typeof s.damage === "number" &&
    typeof s.memory === "number" &&
    typeof s.hand === "number"
  );
}

/** A partial SeatState with no unknown keys and correctly typed values. */
export function isSeatStatePatch(value: unknown): value is Partial<SeatState> {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;
  const allowed = new Set(["displayName", "championSlug", "damage", "memory", "hand"]);
  for (const key of Object.keys(p)) {
    if (!allowed.has(key)) return false;
  }
  if ("displayName" in p && typeof p.displayName !== "string") return false;
  if ("championSlug" in p && typeof p.championSlug !== "string" && p.championSlug !== null) return false;
  for (const key of ["damage", "memory", "hand"]) {
    if (key in p && typeof p[key] !== "number") return false;
  }
  return true;
}

export function isPin(value: unknown): value is Pin {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    isSeatId(p.seat) &&
    typeof p.cardSlug === "string" &&
    (p.printingSlug === undefined || typeof p.printingSlug === "string") &&
    typeof p.at === "number"
  );
}

export function isSignalTarget(value: unknown): value is SignalTarget {
  if (typeof value !== "object" || value === null) return false;
  const t = value as Record<string, unknown>;
  return isSeatId(t.seat) && isTableRole(t.role);
}

export function isTableClientMessage(value: unknown): value is TableClientMessage {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  switch (m.type) {
    case "TABLE_HELLO":
      return typeof m.token === "string" && isTableRole(m.role);
    case "SEAT_UPDATE":
      return isSeatStatePatch(m.patch);
    case "TURN_START":
    case "TURN_END":
    case "PIN_CLEAR":
      return true;
    case "PIN_SET":
      return typeof m.cardSlug === "string";
    case "RIPPLE":
      return typeof m.x === "number" && typeof m.y === "number";
    case "SIGNAL":
      return isSignalTarget(m.to);
    default:
      return false;
  }
}

export function isTableServerMessage(value: unknown): value is TableServerMessage {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  switch (m.type) {
    case "TABLE_STATE":
      return typeof m.state === "object" && m.state !== null;
    case "SIGNAL":
      return isSignalTarget(m.from);
    case "PRESENCE":
      return Array.isArray(m.participants);
    case "TABLE_ERROR":
      return typeof m.code === "string" && typeof m.message === "string";
    default:
      return false;
  }
}
