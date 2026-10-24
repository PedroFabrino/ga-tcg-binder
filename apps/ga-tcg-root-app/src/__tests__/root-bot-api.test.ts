import { describe, expect, it, vi } from "vitest";
import { RootBotApi, RootBotApiError } from "../root-bot-api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("RootBotApi", () => {
  it("sends the install token and community id on every call", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ chunks: [] }));
    const api = new RootBotApi({
      communityId: "comm-1",
      baseUrl: "https://api.example",
      token: "tok-1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await api.getMarketNotifications();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://api.example/api/root-bot/market-notifications"
    );
    const headers = init.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer tok-1");
    expect(headers.get("x-root-community-id")).toBe("comm-1");
  });

  it("throws a typed error on a non-ok response", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: "UNAUTHORIZED", message: "nope" }, 401));
    const api = new RootBotApi({
      communityId: "comm-1",
      baseUrl: "https://api.example",
      token: "tok-1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(api.getDealAlerts()).rejects.toBeInstanceOf(RootBotApiError);
  });
});
