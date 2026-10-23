import { afterEach, describe, expect, it, vi } from "vitest";
import { tableWebSocketUrl } from "../gateway";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("tableWebSocketUrl", () => {
  it("defaults to the local gateway and upgrades the scheme to ws", () => {
    vi.stubEnv("NEXT_PUBLIC_GATEWAY_URL", "");
    expect(tableWebSocketUrl("abc123")).toBe("ws://localhost:3001/t/ABC123");
  });

  it("uses wss for an https gateway and normalizes the code", () => {
    vi.stubEnv("NEXT_PUBLIC_GATEWAY_URL", "https://gateway.example.com");
    expect(tableWebSocketUrl("f5tlsv")).toBe("wss://gateway.example.com/t/F5TLSV");
  });

  it("drops any path, query, or hash from the configured base URL", () => {
    vi.stubEnv("NEXT_PUBLIC_GATEWAY_URL", "https://example.com/base?x=1#frag");
    expect(tableWebSocketUrl("abc")).toBe("wss://example.com/t/ABC");
  });
});
