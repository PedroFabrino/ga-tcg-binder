import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ issueRootBotToken: vi.fn() }));

vi.mock("@/services/root-bot-auth", () => authMocks);

import { POST } from "../route";

function installRequest(body: unknown): Request {
  return new Request("http://localhost/api/root-bot/install", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/root-bot/install", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("issues a token for an allowed install", async () => {
    authMocks.issueRootBotToken.mockResolvedValue({
      token: "tok-1",
      appId: "app-1",
      communityId: "comm-1",
    });

    const response = await POST(
      installRequest({ appId: "app-1", communityId: "comm-1" })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      token: "tok-1",
      communityId: "comm-1",
    });
  });

  it("returns 400 when fields are missing", async () => {
    const response = await POST(installRequest({ appId: "app-1" }));

    expect(response.status).toBe(400);
    expect(authMocks.issueRootBotToken).not.toHaveBeenCalled();
  });

  it("returns 403 when the install is rejected", async () => {
    authMocks.issueRootBotToken.mockResolvedValue(null);

    const response = await POST(
      installRequest({ appId: "other", communityId: "comm-1" })
    );

    expect(response.status).toBe(403);
  });
});
