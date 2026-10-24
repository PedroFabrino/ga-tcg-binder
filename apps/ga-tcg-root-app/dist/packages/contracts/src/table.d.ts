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
/** How long a pointer marker stays on the Table. It is never persisted. */
export declare const RIPPLE_TTL_MS = 4000;
/** A transient pointer marker dropped on a Feed, at normalized 0..1 coordinates. */
export interface Ripple {
    seat: SeatId;
    x: number;
    y: number;
    /** Server-assigned marker number, stable for the marker's lifetime. */
    n: number;
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
export type TableClientMessage = {
    type: "TABLE_HELLO";
    code: string;
    token: string;
    role: TableRole;
    displayName?: string;
} | {
    type: "SEAT_UPDATE";
    patch: Partial<SeatState>;
} | {
    type: "TURN_START";
} | {
    type: "TURN_END";
} | {
    type: "PIN_SET";
    cardSlug: string;
    printingSlug?: string;
} | {
    type: "PIN_CLEAR";
} | {
    type: "RIPPLE";
    x: number;
    y: number;
} | {
    type: "SIGNAL";
    to: SignalTarget;
    data: unknown;
};
export interface ParticipantInfo {
    seat: SeatId | null;
    role: TableRole;
    displayName?: string;
}
export type TableServerMessage = {
    type: "TABLE_STATE";
    state: TableState;
} | {
    type: "SIGNAL";
    from: SignalTarget;
    data: unknown;
} | {
    type: "PRESENCE";
    participants: ParticipantInfo[];
} | {
    type: "TABLE_ERROR";
    code: string;
    message: string;
};
/**
 * The secrets a Table is born with, returned by the create endpoint. The p1
 * token stays with the creator, the p2 token travels in the invite link, and
 * the viewer token grants read-only access. They are never part of TableState.
 */
export interface TableCredentials {
    code: string;
    p1Token: string;
    p2Token: string;
    viewerToken: string;
}
export declare function isSeatId(value: unknown): value is SeatId;
export declare function isTableRole(value: unknown): value is TableRole;
export declare function isSeatState(value: unknown): value is SeatState;
/** A partial SeatState with no unknown keys and correctly typed values. */
export declare function isSeatStatePatch(value: unknown): value is Partial<SeatState>;
export declare function isPin(value: unknown): value is Pin;
export declare function isSignalTarget(value: unknown): value is SignalTarget;
export declare function isTableClientMessage(value: unknown): value is TableClientMessage;
export declare function isTableCredentials(value: unknown): value is TableCredentials;
export declare function isTableServerMessage(value: unknown): value is TableServerMessage;
