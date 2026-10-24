import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ isAssistantAuthorized: vi.fn() }));
const repoMocks = vi.hoisted(() => ({ revokeRootBotInstall: vi.fn() }));

vi.mock("@/services/assistant-auth", () => authMocks);
vi.mock("@/db/repositories/root-bot-install-repository", () => repoMocks);

import { POST } from "../route";

function request(body: unknown): Request {
  return new Request("http://localhost/api/root-bot/install/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/root-bot/install/revoke", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects requests without operator credentials", async () => {
    authMocks.isAssistantAuthorized.mockResolvedValue(false);

    const response = await POST(request({ appId: "app", communityId: "c1" }));

    expect(response.status).toBe(401);
    expect(repoMocks.revokeRootBotInstall).not.toHaveBeenCalled();
  });

  it("revokes the install for the operator", async () => {
    authMocks.isAssistantAuthorized.mockResolvedValue(true);

    const response = await POST(request({ appId: "app", communityId: "c1" }));

    expect(response.status).toBe(200);
    expect(repoMocks.revokeRootBotInstall).toHaveBeenCalledWith("app", "c1");
  });

  it("returns 400 for missing fields", async () => {
    authMocks.isAssistantAuthorized.mockResolvedValue(true);

    const response = await POST(request({ appId: "app" }));

    expect(response.status).toBe(400);
    expect(repoMocks.revokeRootBotInstall).not.toHaveBeenCalled();
  });
});
