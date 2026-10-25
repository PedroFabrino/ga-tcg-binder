/**
 * WebRTC signaling and ICE server contracts for the GrandTable Feed.
 *
 * These are the typed shapes the browser-side Feed manager and the server's
 * GET /turn endpoint both build against, so the signaling payload and the ICE
 * server list cannot drift between client and server.
 */
/** The payload carried inside a SIGNAL message: an SDP offer/answer or an ICE candidate. */
export type SignalPayload = {
    kind: "offer";
    sdp: string;
} | {
    kind: "answer";
    sdp: string;
} | {
    kind: "ice";
    candidate: string;
};
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
/** Validate the GET /turn body before an ICE server list reaches RTCPeerConnection. */
export declare function isIceServersResponse(value: unknown): value is IceServersResponse;
/** The signaling channel the Feed manager depends on, injected at construction. */
export interface FeedSignaling {
    send(payload: SignalPayload): void;
    /** Returns an unsubscribe function. */
    onSignal(handler: (payload: SignalPayload) => void): () => void;
}
export declare function isSignalPayload(value: unknown): value is SignalPayload;
