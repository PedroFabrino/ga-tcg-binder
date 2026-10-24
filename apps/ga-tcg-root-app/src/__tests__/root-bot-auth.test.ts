import { describe, expect, it, vi } from "vitest";

vi.mock("@rootsdk/server-bot", () => ({
  rootServer: { appId: "app-1", dataStore: { appData: {} } },
}));

import { getRootBotToken } from "../root-bot-auth";

function fakeStore(initial: Record<string, unknown> = {}) {
  const data = new Map<string, unknown>(Object.entries(initial));
  return {
    async get<T>(key: string) {
      return data.get(key) as T | undefined;
    },
    async set<T>({ key, value }: { key: string; value: T }) {
      data.set(key, value);
    },
  };
}

describe("getRootBotToken", () => {
  it("registers once and then reuses the cached token", async () => {
    const store = fakeStore();
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ token: "tok-1" }), { status: 200 })
    );
    const options = {
      communityId: "comm-1",
      appId: "app-1",
      apiBaseUrl: "https://api.example",
      store,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    };

    await expect(getRootBotToken(options)).resolves.toBe("tok-1");
    await expect(getRootBotToken(options)).resolves.toBe("tok-1");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("throws when the install endpoint rejects", async () => {
    const store = fakeStore();
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 403 }));

    await expect(
      getRootBotToken({
        communityId: "comm-1",
        appId: "app-1",
        apiBaseUrl: "https://api.example",
        store,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).rejects.toThrow();
  });
});
