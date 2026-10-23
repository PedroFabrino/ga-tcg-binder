import type {
  ParticipantInfo,
  SeatId,
  SeatState,
  SignalTarget,
  TableServerMessage,
  TableState,
} from "@ga/contracts";

/**
 * The client-side view of one Table: the last authoritative snapshot plus the
 * transient data the UI needs (presence, the last WebRTC signal, and the last
 * error). The server remains the only writer of `TableState`; the reducer only
 * mirrors snapshots and overlays the local Seat's optimistic patch.
 */
export interface TableClientState {
  table: TableState | null;
  participants: ParticipantInfo[];
  signal: { from: SignalTarget; data: unknown } | null;
  error: { code: string; message: string } | null;
}

export type TableClientAction =
  | { type: "SNAPSHOT"; state: TableState }
  | { type: "PATCH"; seat: SeatId; patch: Partial<SeatState> }
  | { type: "PRESENCE"; participants: ParticipantInfo[] }
  | { type: "SIGNAL"; from: SignalTarget; data: unknown }
  | { type: "ERROR"; code: string; message: string }
  | { type: "CLEAR_ERROR" }
  | { type: "RESET" };

export const initialTableClientState: TableClientState = {
  table: null,
  participants: [],
  signal: null,
  error: null,
};

/**
 * Pure reducer over the Table's client view. Every branch returns a new object
 * and leaves its inputs untouched; the same action always produces the same
 * result.
 */
export function tableClientReducer(
  state: TableClientState,
  action: TableClientAction
): TableClientState {
  switch (action.type) {
    case "SNAPSHOT":
      // A snapshot replaces the authoritative table, but transient UI data
      // (a takeover notice, the last signal, presence) survives it.
      return { ...state, table: action.state };

    case "PATCH":
      return patchSeat(state, action.seat, action.patch);

    case "PRESENCE":
      return { ...state, participants: action.participants };

    case "SIGNAL":
      // A fresh object per signal so an effect keyed on `signal` runs once.
      return { ...state, signal: { from: action.from, data: action.data } };

    case "ERROR":
      return { ...state, error: { code: action.code, message: action.message } };

    case "CLEAR_ERROR":
      return state.error === null ? state : { ...state, error: null };

    case "RESET":
      return { table: null, participants: [], signal: null, error: null };
  }
}

/**
 * Adapt a server message to a reducer action. The socket layer validates with
 * `isTableServerMessage` before calling this; an unknown message is ignored so
 * a newer server cannot crash an older client.
 */
export function tableClientActionFromMessage(
  message: TableServerMessage
): TableClientAction | null {
  switch (message.type) {
    case "TABLE_STATE":
      return { type: "SNAPSHOT", state: message.state };
    case "PRESENCE":
      return { type: "PRESENCE", participants: message.participants };
    case "SIGNAL":
      return { type: "SIGNAL", from: message.from, data: message.data };
    case "TABLE_ERROR":
      return { type: "ERROR", code: message.code, message: message.message };
    default:
      return null;
  }
}

/** Apply one server message. Pure sugar around the adapter and the reducer. */
export function applyServerMessage(
  state: TableClientState,
  message: TableServerMessage
): TableClientState {
  const action = tableClientActionFromMessage(message);
  return action ? tableClientReducer(state, action) : state;
}

/**
 * Overlay an optimistic Seat edit. The server creates the Seat on join, so a
 * patch before the first snapshot (or for a Seat this Table does not have) is
 * ignored rather than inventing a Seat the server has not confirmed.
 */
function patchSeat(
  state: TableClientState,
  seat: SeatId,
  patch: Partial<SeatState>
): TableClientState {
  if (!state.table) return state;
  const current = state.table.seats[seat];
  if (!current) return state;

  return {
    ...state,
    table: {
      ...state.table,
      seats: {
        ...state.table.seats,
        [seat]: { ...current, ...patch },
      },
    },
  };
}
