import {
  type WsClientMessage,
  type WsServerMessage,
  type SessionRole,
  isWsClientMessage,
} from "@ga/contracts";

export interface UnifiedSocket {
  send(data: string): void;
  close?(code?: number, reason?: string): void;
}

interface Participant {
  socket: UnifiedSocket;
  role: SessionRole;
  deviceName?: string;
  joinedAt: number;
}

interface Room {
  sessionId: string;
  token?: string;
  participants: Map<UnifiedSocket, Participant>;
}

export class SessionRoomManager {
  private rooms = new Map<string, Room>();
  private socketToRoom = new Map<UnifiedSocket, string>();

  public getRoomCount(): number {
    return this.rooms.size;
  }

  public getParticipantCount(sessionId: string): number {
    return this.rooms.get(sessionId)?.participants.size ?? 0;
  }

  public getScannerCount(sessionId: string): number {
    const room = this.rooms.get(sessionId);
    if (!room) return 0;
    let count = 0;
    for (const p of room.participants.values()) {
      if (p.role === "scanner") count++;
    }
    return count;
  }

  public handleConnection(socket: UnifiedSocket): void {
    // Socket connected, awaiting SESSION_JOIN message
  }

  public handleRawMessage(socket: UnifiedSocket, rawData: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawData);
    } catch {
      this.sendError(socket, "BAD_REQUEST", "Payload must be valid JSON");
      return;
    }

    if (!isWsClientMessage(parsed)) {
      this.sendError(socket, "INVALID_MESSAGE", "Payload does not conform to WsClientMessage contract");
      return;
    }

    this.processMessage(socket, parsed);
  }

  public processMessage(socket: UnifiedSocket, msg: WsClientMessage): void {
    switch (msg.type) {
      case "SESSION_JOIN":
        this.joinRoom(socket, msg.sessionId, msg.role, msg.token, msg.deviceName);
        break;

      case "SESSION_PING":
        this.send(socket, {
          type: "SESSION_PONG",
          sessionId: msg.sessionId,
          timestamp: Date.now(),
        });
        break;

      case "CARD_PREVIEW":
      case "CARD_COMMITTED":
      case "CARD_UPDATE_FINISH":
      case "SCAN_IDENTIFY_REQUEST":
        this.forwardToReceivers(socket, msg);
        break;

      case "SESSION_DISCONNECT":
        this.handleDisconnect(socket);
        break;
    }
  }

  public handleDisconnect(socket: UnifiedSocket): void {
    const sessionId = this.socketToRoom.get(socket);
    if (!sessionId) return;

    this.socketToRoom.delete(socket);
    const room = this.rooms.get(sessionId);
    if (!room) return;

    const participant = room.participants.get(socket);
    room.participants.delete(socket);

    if (room.participants.size === 0) {
      this.rooms.delete(sessionId);
    } else {
      this.broadcastStatus(room);
    }
  }

  private joinRoom(
    socket: UnifiedSocket,
    sessionId: string,
    role: SessionRole,
    token: string,
    deviceName?: string
  ): void {
    let room = this.rooms.get(sessionId);
    if (!room) {
      room = {
        sessionId,
        token,
        participants: new Map(),
      };
      this.rooms.set(sessionId, room);
    }

    // Optional token validation if room already has a token
    if (room.token && token && room.token !== token) {
      this.sendError(socket, "UNAUTHORIZED", "Invalid session token for this room", sessionId);
      return;
    }

    room.participants.set(socket, {
      socket,
      role,
      deviceName,
      joinedAt: Date.now(),
    });
    this.socketToRoom.set(socket, sessionId);

    this.broadcastStatus(room);
  }

  private broadcastStatus(room: Room): void {
    let scannerCount = 0;
    let latestScannerName: string | undefined;

    for (const p of room.participants.values()) {
      if (p.role === "scanner") {
        scannerCount++;
        if (p.deviceName) latestScannerName = p.deviceName;
      }
    }

    const statusMsg: WsServerMessage = {
      type: "SESSION_STATUS",
      sessionId: room.sessionId,
      timestamp: Date.now(),
      status: scannerCount > 0 ? "paired" : "waiting_for_companion",
      pairedDevice: latestScannerName,
      activeScanners: scannerCount,
    };

    this.broadcast(room, statusMsg);
  }

  private forwardToReceivers(sender: UnifiedSocket, msg: WsClientMessage): void {
    const sessionId = this.socketToRoom.get(sender);
    if (!sessionId) return;
    const room = this.rooms.get(sessionId);
    if (!room) return;

    if (msg.type === "CARD_COMMITTED") {
      const broadcastMsg: WsServerMessage = {
        type: "CARD_BROADCAST",
        sessionId,
        timestamp: Date.now(),
        card: msg.card,
      };
      this.broadcastToReceivers(room, broadcastMsg);
    } else if (msg.type === "CARD_UPDATE_FINISH") {
      const finishMsg: WsServerMessage = {
        type: "CARD_FINISH_UPDATED",
        sessionId,
        timestamp: Date.now(),
        editionId: msg.editionId,
        foil: msg.foil,
      };
      this.broadcastToReceivers(room, finishMsg);
    } else if (msg.type === "CARD_PREVIEW") {
      // Forward card preview to receivers
      for (const p of room.participants.values()) {
        if (p.role === "receiver") {
          this.send(p.socket, msg as any);
        }
      }
    }
  }

  public broadcast(room: Room, msg: WsServerMessage): void {
    const json = JSON.stringify(msg);
    for (const p of room.participants.values()) {
      p.socket.send(json);
    }
  }

  public broadcastToReceivers(room: Room, msg: WsServerMessage): void {
    const json = JSON.stringify(msg);
    for (const p of room.participants.values()) {
      if (p.role === "receiver") {
        p.socket.send(json);
      }
    }
  }

  private send(socket: UnifiedSocket, msg: WsServerMessage): void {
    socket.send(JSON.stringify(msg));
  }

  private sendError(socket: UnifiedSocket, code: string, message: string, sessionId?: string): void {
    const errorMsg: WsServerMessage = {
      type: "ERROR",
      code,
      message,
      sessionId,
    };
    socket.send(JSON.stringify(errorMsg));
  }
}
