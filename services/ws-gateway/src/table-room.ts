import { type UnifiedSocket } from "./unified-socket";
import { sendTableError } from "./table-messages";
import {
  type SeatId,
  type TableRole,
  type SeatState,
  type Pin,
  type TableCredentials,
  type TableState,
  type TableClientMessage,
  type TableServerMessage,
  type SignalTarget,
  type ParticipantInfo,
  isTableClientMessage,
} from "@ga/contracts";

import {
  type ConnectionInfo,
  type HelloMessage,
  type PinSetMessage,
  type TableRoomOptions,
  defaultSeat,
} from "./table-room-types";

export type { TableRoomOptions };

/**
 * The state machine for a single Table: two Seats, partitioned writes, Turn
 * handoff, Seat takeover, and signal relay between a Seat and its Capture
 * Device. It is the server-side authority for everything in TableState.
 *
 * One instance maps to one Durable Object in production; the `UnifiedSocket`
 * abstraction keeps it testable without a network.
 */
export class TableRoom {
  private readonly code: string;
  private readonly p1Token: string;
  private readonly p2Token: string;
  private readonly viewerToken?: string;
  private readonly options?: TableRoomOptions;

  private readonly seatSockets = new Map<SeatId, UnifiedSocket>();
  private readonly captureSockets = new Map<SeatId, UnifiedSocket>();
  private readonly connectionInfo = new Map<UnifiedSocket, ConnectionInfo>();

  private state: TableState;

  constructor(
    code: string,
    p1Token: string,
    p2Token: string,
    viewerToken?: string,
    options?: TableRoomOptions
  ) {
    this.code = code;
    this.p1Token = p1Token;
    this.p2Token = p2Token;
    this.viewerToken = viewerToken;
    this.options = options;
    this.state = options?.initialState ?? {
      code,
      seats: {},
      active: null,
      pins: {},
      recent: [],
      ripples: [],
      log: [],
    };
  }

  public getState(): TableState {
    return this.state;
  }

  public handleConnection(_socket: UnifiedSocket): void {
    // Connections are registered lazily on TABLE_HELLO.
  }

  public handleRawMessage(socket: UnifiedSocket, rawData: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawData);
    } catch {
      sendTableError(socket, "BAD_REQUEST", "Payload must be valid JSON");
      return;
    }

    if (!isTableClientMessage(parsed)) {
      sendTableError(socket, "INVALID_MESSAGE", "Payload does not conform to TableClientMessage");
      return;
    }

    this.processMessage(socket, parsed);
  }

  public processMessage(socket: UnifiedSocket, msg: TableClientMessage): void {
    switch (msg.type) {
      case "TABLE_HELLO":
        this.join(socket, msg);
        break;
      case "SEAT_UPDATE":
        this.seatUpdate(socket, msg.patch);
        break;
      case "TURN_START":
        this.turnStart(socket);
        break;
      case "TURN_END":
        this.turnEnd(socket);
        break;
      case "PIN_SET":
        this.pinSet(socket, msg);
        break;
      case "PIN_CLEAR":
        this.pinClear(socket);
        break;
      case "RIPPLE":
        this.ripple(socket, msg.x, msg.y);
        break;
      case "SIGNAL":
        this.relaySignal(socket, msg.to, msg.data);
        break;
    }
  }

  public handleDisconnect(socket: UnifiedSocket): void {
    const info = this.connectionInfo.get(socket);
    if (!info) return;
    this.connectionInfo.delete(socket);

    if (info.seatId) {
      if (info.role === "seat" && this.seatSockets.get(info.seatId) === socket) {
        this.seatSockets.delete(info.seatId);
        this.appendLog(info.seatId, "disconnect", "left the seat");
      }
      if (info.role === "capture" && this.captureSockets.get(info.seatId) === socket) {
        this.captureSockets.delete(info.seatId);
      }
    }

    this.broadcastState();
    this.broadcastPresence();
  }

  // -------------------------------------------------------------------------
  // Join
  // -------------------------------------------------------------------------

  private join(socket: UnifiedSocket, msg: HelloMessage): void {
    if (msg.code !== this.code) {
      sendTableError(socket, "WRONG_CODE", "Room code does not match this table");
      return;
    }

    const seatId = this.tokenToSeat(msg.token);

    switch (msg.role) {
      case "seat": {
        if (!seatId) {
          sendTableError(socket, "INVALID_TOKEN", "Token does not grant a seat at this table");
          return;
        }
        const existing = this.seatSockets.get(seatId);
        if (existing && existing !== socket) {
          sendTableError(existing, "DISPLACED", "This seat was opened in another tab");
          this.connectionInfo.set(existing, { role: "seat", seatId: null });
          this.options?.onBindingChange?.(existing, "seat", null);
        }
        this.seatSockets.set(seatId, socket);
        this.connectionInfo.set(socket, { role: "seat", seatId });

        const current = this.state.seats[seatId];
        this.state.seats[seatId] = current
          ? { ...current, displayName: msg.displayName ?? current.displayName }
          : defaultSeat(seatId, msg.displayName);
        this.appendLog(seatId, "join", "claimed the seat");
        break;
      }
      case "capture": {
        if (!seatId) {
          sendTableError(socket, "INVALID_TOKEN", "Token does not grant a seat at this table");
          return;
        }
        const previous = this.captureSockets.get(seatId);
        if (previous && previous !== socket) {
          this.connectionInfo.set(previous, { role: "capture", seatId: null });
          this.options?.onBindingChange?.(previous, "capture", null);
        }
        this.captureSockets.set(seatId, socket);
        this.connectionInfo.set(socket, { role: "capture", seatId });
        break;
      }
      case "viewer": {
        if (this.viewerToken && msg.token !== this.viewerToken) {
          sendTableError(socket, "INVALID_TOKEN", "Token does not grant viewer access");
          return;
        }
        this.connectionInfo.set(socket, { role: "viewer", seatId: null });
        break;
      }
    }

    this.options?.onBindingChange?.(socket, msg.role, seatId);
    this.broadcastState();
    this.broadcastPresence();
  }

  // -------------------------------------------------------------------------
  // Seat-only actions
  // -------------------------------------------------------------------------

  private seatUpdate(socket: UnifiedSocket, patch: Partial<SeatState>): void {
    const seatId = this.seatOf(socket);
    if (!seatId) {
      sendTableError(socket, "FORBIDDEN", "No seat to update");
      return;
    }
    const current = this.state.seats[seatId] ?? defaultSeat(seatId);
    this.state.seats[seatId] = { ...current, ...patch };
    this.appendLog(seatId, "hud", Object.keys(patch).sort().join(","));
    this.broadcastState();
  }

  private turnStart(socket: UnifiedSocket): void {
    const seatId = this.seatOf(socket);
    if (!seatId) {
      sendTableError(socket, "FORBIDDEN", "No seat to act from");
      return;
    }
    if (this.state.active !== null) {
      sendTableError(socket, "NOT_YOUR_TURN", "A turn is already active");
      return;
    }
    this.state.active = seatId;
    this.appendLog(seatId, "turn", "start");
    this.broadcastState();
  }

  private turnEnd(socket: UnifiedSocket): void {
    const seatId = this.seatOf(socket);
    if (!seatId) {
      sendTableError(socket, "FORBIDDEN", "No seat to act from");
      return;
    }
    if (this.state.active !== seatId) {
      sendTableError(socket, "NOT_YOUR_TURN", "Only the active seat may end the turn");
      return;
    }
    this.state.active = null;
    this.appendLog(seatId, "turn", "end");
    this.broadcastState();
  }

  private pinSet(socket: UnifiedSocket, msg: PinSetMessage): void {
    const seatId = this.seatOf(socket);
    if (!seatId) {
      sendTableError(socket, "FORBIDDEN", "No seat to pin from");
      return;
    }
    const pin: Pin = {
      seat: seatId,
      cardSlug: msg.cardSlug,
      printingSlug: msg.printingSlug,
      at: Date.now(),
    };
    this.state.pins[seatId] = pin;
    this.state.recent = [pin, ...this.state.recent].slice(0, 3);
    this.appendLog(seatId, "pin", msg.cardSlug);
    this.broadcastState();
  }

  private pinClear(socket: UnifiedSocket): void {
    const seatId = this.seatOf(socket);
    if (!seatId) {
      sendTableError(socket, "FORBIDDEN", "No seat to unpin from");
      return;
    }
    delete this.state.pins[seatId];
    this.appendLog(seatId, "pin", "cleared");
    this.broadcastState();
  }

  private ripple(socket: UnifiedSocket, x: number, y: number): void {
    const seatId = this.seatOf(socket);
    if (!seatId) {
      sendTableError(socket, "FORBIDDEN", "No seat to ripple from");
      return;
    }
    this.state.ripples = [...this.state.ripples, { seat: seatId, x, y, at: Date.now() }].slice(-8);
    this.appendLog(seatId, "ripple", `${x},${y}`);
    this.broadcastState();
  }

  // -------------------------------------------------------------------------
  // Signaling
  // -------------------------------------------------------------------------

  private relaySignal(socket: UnifiedSocket, to: SignalTarget, data: unknown): void {
    const from = this.connectionInfo.get(socket);
    if (!from || (from.role !== "seat" && from.role !== "capture") || from.seatId === null) {
      sendTableError(socket, "FORBIDDEN", "Not permitted to signal");
      return;
    }
    const target = this.resolveTarget(to);
    if (!target) {
      sendTableError(socket, "NO_TARGET", "Signal target is not connected");
      return;
    }
    const msg: TableServerMessage = {
      type: "SIGNAL",
      from: { seat: from.seatId, role: from.role },
      data,
    };
    target.send(JSON.stringify(msg));
  }

  private resolveTarget(to: SignalTarget): UnifiedSocket | null {
    if (to.role === "seat") return this.seatSockets.get(to.seat) ?? null;
    if (to.role === "capture") return this.captureSockets.get(to.seat) ?? null;
    return null;
  }

  public rehydrateConnection(
    socket: UnifiedSocket,
    role: TableRole,
    seatId: SeatId | null
  ): void {
    if (role === "seat" && seatId) {
      this.seatSockets.set(seatId, socket);
      this.connectionInfo.set(socket, { role: "seat", seatId });
    } else if (role === "capture" && seatId) {
      this.captureSockets.set(seatId, socket);
      this.connectionInfo.set(socket, { role: "capture", seatId });
    } else if (role === "viewer") {
      this.connectionInfo.set(socket, { role: "viewer", seatId: null });
    }
  }

  public getCredentials(): TableCredentials {
    return {
      code: this.code,
      p1Token: this.p1Token,
      p2Token: this.p2Token,
      viewerToken: this.viewerToken ?? "",
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** The seat a "seat" role may act for; null for capture/viewer or a displaced socket. */
  private seatOf(socket: UnifiedSocket): SeatId | null {
    const info = this.connectionInfo.get(socket);
    if (!info || info.role !== "seat") return null;
    return info.seatId;
  }

  private tokenToSeat(token: string): SeatId | null {
    if (token === this.p1Token) return "p1";
    if (token === this.p2Token) return "p2";
    return null;
  }

  private appendLog(seat: SeatId, kind: string, detail: string): void {
    this.state.log = [...this.state.log, { at: Date.now(), seat, kind, detail }].slice(-50);
  }

  private broadcastState(): void {
    this.options?.onStateChange?.(this.state);
    this.broadcast({ type: "TABLE_STATE", state: this.state });
  }

  private broadcastPresence(): void {
    const participants: ParticipantInfo[] = [];
    this.connectionInfo.forEach((info) => {
      participants.push({
        seat: info.seatId,
        role: info.role,
        displayName:
          info.role === "seat" && info.seatId ? this.state.seats[info.seatId]?.displayName : undefined,
      });
    });
    this.broadcast({ type: "PRESENCE", participants });
  }

  private broadcast(msg: TableServerMessage): void {
    const json = JSON.stringify(msg);
    this.connectionInfo.forEach((_info, socket) => {
      try {
        socket.send(json);
      } catch {
        // The socket is gone; the next handleDisconnect will clean it up.
      }
    });
  }

}
