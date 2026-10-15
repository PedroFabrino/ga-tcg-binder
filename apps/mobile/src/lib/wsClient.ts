/**
 * Real-time WebSocket Client for Mobile Companion Scanner.
 * Connects to the session gateway room, handles automatic exponential-backoff
 * reconnection, ping-pong heartbeats, and card streaming payloads.
 */

import type {
  PairingQrPayload,
  WsJoinMessage,
  WsScanIdentifyRequest,
  WsCardCommittedMessage,
  WsCardUpdateFinishMessage,
  WsPingMessage,
  WsServerMessage,
  CommittedCardPayload,
  CardMatchResult,
} from "@ga/contracts";

export type WsConnectionStatus = "DISCONNECTED" | "CONNECTING" | "ACTIVE_SCANNING" | "RECONNECTING";

export interface WsClientCallbacks {
  onStatusChange: (status: WsConnectionStatus, desktopName?: string) => void;
  onLatencyUpdate: (ms: number) => void;
  onIdentifyResponse?: (requestId: string, candidates: CardMatchResult[]) => void;
  onError?: (error: string) => void;
}

export class MobileWsClient {
  private socket: WebSocket | null = null;
  private pairingInfo: PairingQrPayload | null = null;
  private status: WsConnectionStatus = "DISCONNECTED";
  private pingInterval: NodeJS.Timeout | null = null;
  private pingStartTime = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private intentionalClose = false;
  private callbacks: WsClientCallbacks;

  constructor(callbacks: WsClientCallbacks) {
    this.callbacks = callbacks;
  }

  public getStatus(): WsConnectionStatus {
    return this.status;
  }

  public connect(pairing: PairingQrPayload): void {
    this.pairingInfo = pairing;
    this.intentionalClose = false;
    this.reconnectAttempts = 0;
    this.initiateConnection();
  }

  public disconnect(): void {
    this.intentionalClose = true;
    this.clearTimers();
    if (this.socket) {
      if (this.socket.readyState === WebSocket.OPEN && this.pairingInfo) {
        try {
          this.socket.send(
            JSON.stringify({
              type: "SESSION_DISCONNECT",
              sessionId: this.pairingInfo.sessionId,
              timestamp: Date.now(),
            })
          );
        } catch {
          // Ignore close errors
        }
      }
      this.socket.close();
      this.socket = null;
    }
    this.status = "DISCONNECTED";
    this.callbacks.onStatusChange("DISCONNECTED");
  }

  public sendCardCommitted(card: CommittedCardPayload): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.pairingInfo) {
      return false;
    }

    const msg: WsCardCommittedMessage = {
      type: "CARD_COMMITTED",
      sessionId: this.pairingInfo.sessionId,
      timestamp: Date.now(),
      card,
    };
    this.socket.send(JSON.stringify(msg));
    return true;
  }

  public sendFinishUpdate(editionId: string, foil: boolean): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.pairingInfo) {
      return false;
    }

    const msg: WsCardUpdateFinishMessage = {
      type: "CARD_UPDATE_FINISH",
      sessionId: this.pairingInfo.sessionId,
      timestamp: Date.now(),
      editionId,
      foil,
    };
    this.socket.send(JSON.stringify(msg));
    return true;
  }

  public sendIdentifyRequest(requestId: string, phash: string, headerText: string, footerText: string): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.pairingInfo) {
      return false;
    }

    const msg: WsScanIdentifyRequest = {
      type: "SCAN_IDENTIFY_REQUEST",
      sessionId: this.pairingInfo.sessionId,
      requestId,
      phash,
      headerText,
      footerText,
      timestamp: Date.now(),
    };
    this.socket.send(JSON.stringify(msg));
    return true;
  }

  private initiateConnection(): void {
    if (!this.pairingInfo) return;

    this.clearTimers();
    this.status = this.reconnectAttempts > 0 ? "RECONNECTING" : "CONNECTING";
    this.callbacks.onStatusChange(this.status);

    try {
      this.socket = new WebSocket(this.pairingInfo.wsEndpoint);

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.status = "ACTIVE_SCANNING";

        const joinMsg: WsJoinMessage = {
          type: "SESSION_JOIN",
          sessionId: this.pairingInfo!.sessionId,
          token: this.pairingInfo!.token,
          role: "scanner",
          deviceName: "GA Companion Phone",
          timestamp: Date.now(),
        };
        this.socket?.send(JSON.stringify(joinMsg));

        this.callbacks.onStatusChange("ACTIVE_SCANNING", "Desktop Receiver");
        this.startHeartbeat();
      };

      this.socket.onmessage = (event) => {
        try {
          const msg: WsServerMessage = JSON.parse(event.data.toString());
          this.handleServerMessage(msg);
        } catch {
          // Ignore malformed envelopes
        }
      };

      this.socket.onclose = () => {
        if (!this.intentionalClose) {
          this.scheduleReconnect();
        }
      };

      this.socket.onerror = (e) => {
        this.callbacks.onError?.("WebSocket connection failed");
        if (!this.intentionalClose) {
          this.scheduleReconnect();
        }
      };
    } catch (err: any) {
      this.scheduleReconnect();
    }
  }

  private handleServerMessage(msg: WsServerMessage): void {
    if (msg.type === "SESSION_PONG") {
      if (this.pingStartTime > 0) {
        const latency = Date.now() - this.pingStartTime;
        this.callbacks.onLatencyUpdate(latency);
      }
    } else if (msg.type === "SESSION_STATUS") {
      if (msg.status === "paired" || msg.status === "waiting_for_companion") {
        this.callbacks.onStatusChange("ACTIVE_SCANNING", msg.pairedDevice || "Desktop Receiver");
      }
    } else if (msg.type === "SCAN_IDENTIFY_RESPONSE") {
      this.callbacks.onIdentifyResponse?.(msg.requestId, msg.candidates);
    }
  }

  private startHeartbeat(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN && this.pairingInfo) {
        this.pingStartTime = Date.now();
        const pingMsg: WsPingMessage = {
          type: "SESSION_PING",
          sessionId: this.pairingInfo.sessionId,
          timestamp: Date.now(),
        };
        this.socket.send(JSON.stringify(pingMsg));
      }
    }, 12000);
  }

  private scheduleReconnect(): void {
    this.clearTimers();
    if (this.intentionalClose || !this.pairingInfo) return;

    this.reconnectAttempts++;
    this.status = "RECONNECTING";
    this.callbacks.onStatusChange("RECONNECTING");

    // Exponential backoff: 1s, 2s, 4s, capped at 10s
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);
    this.reconnectTimeout = setTimeout(() => {
      this.initiateConnection();
    }, delay);
  }

  private clearTimers(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
}
