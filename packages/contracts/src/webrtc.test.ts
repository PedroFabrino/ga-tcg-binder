import { describe, it, expect } from "vitest";
import {
  isIceServersResponse,
  isSignalPayload,
  type SignalPayload,
  type IceServerConfig,
  type IceServersResponse,
  type FeedSignaling,
} from "./index";

describe("webrtc contracts", () => {
  it("validates SignalPayload", () => {
    expect(isSignalPayload({ kind: "offer", sdp: "v=0\r\n" })).toBe(true);
    expect(isSignalPayload({ kind: "answer", sdp: "v=0\r\n" })).toBe(true);
    expect(isSignalPayload({ kind: "ice", candidate: "candidate:1 1 udp 1 0.0.0.0 1 typ host" })).toBe(true);

    expect(isSignalPayload({ kind: "offer" })).toBe(false);
    expect(isSignalPayload({ kind: "ice" })).toBe(false);
    expect(isSignalPayload({ kind: "answer", sdp: 42 })).toBe(false);
    expect(isSignalPayload({ kind: "bogus", sdp: "x" })).toBe(false);
    expect(isSignalPayload(null)).toBe(false);
    expect(isSignalPayload({})).toBe(false);
  });

  it("exposes the typed interfaces used by the Feed manager", () => {
    const servers: IceServerConfig[] = [{ urls: "stun:stun.l.google.com:19302" }];
    const response: IceServersResponse = { iceServers: servers, ttlSeconds: 3600 };
    const signaling: FeedSignaling = {
      send: (_p: SignalPayload) => {},
      onSignal: (_h: (p: SignalPayload) => void) => () => {},
    };
    expect(response.iceServers).toHaveLength(1);
    expect(signaling).toBeDefined();
  });

  it("validates the GET /turn body", () => {
    expect(
      isIceServersResponse({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          {
            urls: ["turn:turn.example.com:3478?transport=udp"],
            username: "user",
            credential: "secret",
          },
        ],
        ttlSeconds: 3600,
      })
    ).toBe(true);

    expect(isIceServersResponse({ iceServers: [], ttlSeconds: 86400 })).toBe(true);
    expect(isIceServersResponse({ iceServers: [], ttlSeconds: "3600" })).toBe(false);
    expect(isIceServersResponse({ iceServers: [], ttlSeconds: -1 })).toBe(false);
    expect(isIceServersResponse({ iceServers: [{ urls: [] }], ttlSeconds: 1 })).toBe(false);
    expect(isIceServersResponse({ iceServers: [{ urls: 42 }], ttlSeconds: 1 })).toBe(false);
    expect(
      isIceServersResponse({ iceServers: [{ urls: "stun:x", username: 42 }], ttlSeconds: 1 })
    ).toBe(false);
    expect(isIceServersResponse({ iceServers: [] })).toBe(false);
    expect(isIceServersResponse(null)).toBe(false);
  });
});
