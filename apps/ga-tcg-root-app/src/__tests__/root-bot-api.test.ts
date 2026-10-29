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

  it("passes locale query parameter on getMarketNotifications", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ chunks: [] }));
    const api = new RootBotApi({
      communityId: "comm-1",
      baseUrl: "https://api.example",
      token: "tok-1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await api.getMarketNotifications("pt-BR");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://api.example/api/root-bot/market-notifications?locale=pt-BR"
    );
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

  it("calls register endpoint with correct payload", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        collector: { id: "col-1", name: "User", friendCode: "GA-123" },
        created: true,
      })
    );
    const api = new RootBotApi({
      communityId: "comm-1",
      baseUrl: "https://api.example",
      token: "tok-1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const res = await api.register("user-1", "User");
    expect(res.success).toBe(true);
    expect(res.collector.friendCode).toBe("GA-123");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.example/api/assistant/register",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          provider: "root",
          providerUserId: "user-1",
          providerUsername: "User",
        }),
      })
    );
  });

  it("calls addWant and removeWant endpoints", async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return Promise.resolve(jsonResponse({ success: true, removed: true, remainingQuantity: 0 }));
      }
      return Promise.resolve(jsonResponse({ success: true, card: { slug: "fireball" }, desiredQuantity: 2 }));
    });

    const api = new RootBotApi({
      communityId: "comm-1",
      baseUrl: "https://api.example",
      token: "tok-1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const addRes = await api.addWant("user-1", { card: "Fireball", quantity: 2 });
    expect(addRes.success).toBe(true);

    const delRes = await api.removeWant("user-1", { card: "Fireball" });
    expect(delRes.removed).toBe(true);
  });

  it("calls autocomplete endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ results: [{ name: "Fireball", value: "fireball" }] })
    );
    const api = new RootBotApi({
      communityId: "comm-1",
      baseUrl: "https://api.example",
      token: "tok-1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const res = await api.autocomplete("user-1", "card", "fire");
    expect(res.results).toHaveLength(1);
    expect(res.results[0].name).toBe("Fireball");
  });
});
