import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ authenticateRootBot: vi.fn() }));
const repoMocks = vi.hoisted(() => ({ findCollectorByIdentity: vi.fn() }));

vi.mock("@/services/root-bot-auth", () => authMocks);
vi.mock("@/db/repositories/assistant-repository", () => repoMocks);

import { GET } from "../route";

function request(query: string): Request {
  return new Request(`http://localhost/api/root-bot/collector?${query}`);
}

describe("GET /api/root-bot/collector", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a valid install", async () => {
    authMocks.authenticateRootBot.mockResolvedValue(null);

    const response = await GET(request("provider=root&providerUserId=u1"));

    expect(response.status).toBe(401);
  });

  it("returns the linked collector", async () => {
    authMocks.authenticateRootBot.mockResolvedValue({
      appId: "app",
      communityId: "comm-1",
    });
    repoMocks.findCollectorByIdentity.mockResolvedValue({
      collector: { id: "collector-1", name: "Ash" },
    });

    const response = await GET(request("provider=root&providerUserId=u1"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      collectorId: "collector-1",
      collectorName: "Ash",
    });
  });

  it("returns null when the identity is not linked", async () => {
    authMocks.authenticateRootBot.mockResolvedValue({
      appId: "app",
      communityId: "comm-1",
    });
    repoMocks.findCollectorByIdentity.mockResolvedValue(undefined);

    const response = await GET(request("provider=root&providerUserId=u1"));

    await expect(response.json()).resolves.toBeNull();
  });
});
