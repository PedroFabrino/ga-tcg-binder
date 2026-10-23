import type { SeatId, SeatState, TableRole, TableState, TableClientMessage } from "@ga/contracts";
import type { UnifiedSocket } from "./unified-socket";

export type HelloMessage = Extract<TableClientMessage, { type: "TABLE_HELLO" }>;
export type PinSetMessage = Extract<TableClientMessage, { type: "PIN_SET" }>;

export interface ConnectionInfo {
  role: TableRole;
  seatId: SeatId | null;
}

export interface TableRoomOptions {
  initialState?: TableState;
  onStateChange?: (state: TableState) => void;
  /**
   * Fires whenever a socket's binding changes, including displacement
   * (`seatId: null`), so a host can persist the binding for hibernation.
   */
  onBindingChange?: (socket: UnifiedSocket, role: TableRole, seatId: SeatId | null) => void;
}

export function emptyTableState(code: string): TableState {
  return {
    code,
    seats: {},
    active: null,
    pins: {},
    recent: [],
    ripples: [],
    log: [],
  };
}

export function defaultSeat(seatId: SeatId, displayName?: string): SeatState {
  return {
    displayName: displayName ?? seatId,
    championSlug: null,
    damage: 0,
    memory: 0,
    hand: 0,
  };
}
