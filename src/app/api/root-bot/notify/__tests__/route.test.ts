import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ authenticateRootBot: vi.fn() }));
const identityMocks = vi.hoisted(() => ({ findCollectorByIdentity: vi.fn() }));
const preferenceMocks = vi.hoisted(() => ({
  setWantlistNotificationPreference: vi.fn(),
}));
const communityMocks = vi.hoisted(() => ({
  linkRootCommunityIdentity: vi.fn(),
}));

vi.mock("@/services/root-bot-auth", () => authMocks);
vi.mock("@/db/repositories/assistant-repository", () => identityMocks);
vi.mock("@/db/repositories/personal-wants-repository", () => preferenceMocks);
vi.mock("@/db/repositories/root-community-identity-repository", () => communityMocks);

import { POST } from "../route";

function request(body: unknown): Request {
  return new Request("http://localhost/api/root-bot/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/root-bot/notify", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a valid install", async () => {
    authMocks.authenticateRootBot.mockResolvedValue(null);

    const response = await POST(
      request({ providerUserId: "u1", enabled: true })
    );

    expect(response.status).toBe(401);
    expect(preferenceMocks.setWantlistNotificationPreference).not.toHaveBeenCalled();
  });

  it("sets the preference for the linked collector", async () => {
    authMocks.authenticateRootBot.mockResolvedValue({
      appId: "app",
      communityId: "comm-1",
    });
    identityMocks.findCollectorByIdentity.mockResolvedValue({
      collector: { id: "collector-1" },
    });

    const response = await POST(
      request({ providerUserId: "u1", enabled: true })
    );

    expect(response.status).toBe(200);
    expect(
      preferenceMocks.setWantlistNotificationPreference
    ).toHaveBeenCalledWith("collector-1", "root", true);
  });

  it("returns 404 when the identity is not linked", async () => {
    authMocks.authenticateRootBot.mockResolvedValue({
      appId: "app",
      communityId: "comm-1",
    });
    identityMocks.findCollectorByIdentity.mockResolvedValue(undefined);

    const response = await POST(
      request({ providerUserId: "u1", enabled: true })
    );

    expect(response.status).toBe(404);
    expect(preferenceMocks.setWantlistNotificationPreference).not.toHaveBeenCalled();
  });
});
