/**
 * WebRTC signaling and ICE server contracts for the GrandTable Feed.
 *
 * These are the typed shapes the browser-side Feed manager and the server's
 * GET /turn endpoint both build against, so the signaling payload and the ICE
 * server list cannot drift between client and server.
 */

/** The payload carried inside a SIGNAL message: an SDP offer/answer or an ICE candidate. */
export type SignalPayload =
  | { kind: "offer"; sdp: string }
  | { kind: "answer"; sdp: string }
  | { kind: "ice"; candidate: string };

/** A single ICE server, mirroring the WebRTC `RTCIceServer` shape. */
export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/** The body returned by GET /turn. */
export interface IceServersResponse {
  iceServers: IceServerConfig[];
  /** Seconds until the client should re-fetch; relay credentials may be short-lived. */
  ttlSeconds: number;
}

/** The signaling channel the Feed manager depends on, injected at construction. */
export interface FeedSignaling {
  send(payload: SignalPayload): void;
  /** Returns an unsubscribe function. */
  onSignal(handler: (payload: SignalPayload) => void): () => void;
}

export function isSignalPayload(value: unknown): value is SignalPayload {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;
  if (p.kind === "offer" || p.kind === "answer") {
    return typeof p.sdp === "string";
  }
  if (p.kind === "ice") {
    return typeof p.candidate === "string";
  }
  return false;
}
