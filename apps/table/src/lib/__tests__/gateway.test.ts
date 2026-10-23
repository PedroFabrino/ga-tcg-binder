import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchIceServers, tableWebSocketUrl } from "../gateway";

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

describe("fetchIceServers", () => {
  it("fetches /turn and returns validated servers", async () => {
    const calls: string[] = [];
    const fetcher = async (input: string) => {
      calls.push(input);
      return new Response(
        JSON.stringify({
          iceServers: [{ urls: "stun:stun.example.com:3478" }],
          ttlSeconds: 3600,
        }),
        { status: 200 }
      );
    };

    await expect(
      fetchIceServers(fetcher, "https://gateway.example.com/base")
    ).resolves.toEqual([{ urls: "stun:stun.example.com:3478" }]);
    expect(calls).toEqual(["https://gateway.example.com/turn"]);
  });

  it("rejects a non-OK response", async () => {
    const fetcher = async () => new Response("nope", { status: 503 });
    await expect(fetchIceServers(fetcher, "https://gateway.example.com")).rejects.toThrow(
      "503"
    );
  });

  it("rejects an unexpected body", async () => {
    const fetcher = async () =>
      new Response(JSON.stringify({ iceServers: [{ urls: 42 }], ttlSeconds: 1 }), {
        status: 200,
      });
    await expect(fetchIceServers(fetcher, "https://gateway.example.com")).rejects.toThrow(
      "unexpected response"
    );
  });
});
