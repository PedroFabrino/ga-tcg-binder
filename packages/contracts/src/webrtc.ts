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

function isIceServerConfig(value: unknown): value is IceServerConfig {
  if (typeof value !== "object" || value === null) return false;
  const server = value as Record<string, unknown>;
  const urls = server.urls;
  const validUrls =
    typeof urls === "string" ||
    (Array.isArray(urls) && urls.length > 0 && urls.every((url) => typeof url === "string"));
  if (!validUrls) return false;
  if ("username" in server && typeof server.username !== "string") return false;
  if ("credential" in server && typeof server.credential !== "string") return false;
  return true;
}

/** Validate the GET /turn body before an ICE server list reaches RTCPeerConnection. */
export function isIceServersResponse(value: unknown): value is IceServersResponse {
  if (typeof value !== "object" || value === null) return false;
  const response = value as Record<string, unknown>;
  return (
    Array.isArray(response.iceServers) &&
    response.iceServers.every(isIceServerConfig) &&
    typeof response.ttlSeconds === "number" &&
    Number.isFinite(response.ttlSeconds) &&
    response.ttlSeconds >= 0
  );
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
