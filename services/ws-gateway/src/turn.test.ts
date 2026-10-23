import { describe, it, expect } from "vitest";
import { buildIceServers, getIceServersResponse } from "./turn";

describe("turn", () => {
  it("always includes a public STUN server", () => {
    const servers = buildIceServers();
    expect(servers).toHaveLength(1);
    expect(servers[0].urls).toBe("stun:stun.l.google.com:19302");
  });

  it("adds a TURN server when credentials are provided", () => {
    const servers = buildIceServers({
      urls: "turn:turn.example.com:3478",
      username: "u",
      credential: "c",
    });
    expect(servers).toHaveLength(2);
    expect(servers[1]).toEqual({
      urls: "turn:turn.example.com:3478",
      username: "u",
      credential: "c",
    });
  });

  it("returns STUN-only when TURN configuration is incomplete", () => {
    const res = getIceServersResponse({ turnUrl: "turn:turn.example.com:3478" });
    expect(res.iceServers).toHaveLength(1);
    expect(res.ttlSeconds).toBeGreaterThan(0);
  });

  it("returns TURN with a shorter TTL when fully configured", () => {
    const res = getIceServersResponse({
      turnUrl: "turn:turn.example.com:3478",
      turnUsername: "u",
      turnCredential: "c",
    });
    expect(res.iceServers).toHaveLength(2);
    expect(res.ttlSeconds).toBe(3600);
  });
});
