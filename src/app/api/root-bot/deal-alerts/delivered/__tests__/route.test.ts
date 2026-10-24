import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ authenticateRootBot: vi.fn() }));
const repoMocks = vi.hoisted(() => ({ upsertDealAlertMessage: vi.fn() }));

vi.mock("@/services/root-bot-auth", () => authMocks);
vi.mock("@/db/repositories/deal-alert-repository", () => repoMocks);

import { POST } from "../route";

function request(body: unknown): Request {
  return new Request("http://localhost/api/root-bot/deal-alerts/delivered", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/root-bot/deal-alerts/delivered", () => {
  beforeEach(() => vi.clearAllMocks());

  it("records delivery under the community state key", async () => {
    authMocks.authenticateRootBot.mockResolvedValue({
      appId: "app",
      communityId: "comm-1",
    });

    const response = await POST(
      request({
        recipientId: "u1",
        channelId: "chan-1",
        messageIds: ["m1", "m2"],
        lastListingKeys: ["k1"],
      })
    );

    expect(response.status).toBe(200);
    expect(repoMocks.upsertDealAlertMessage).toHaveBeenCalledWith({
      destination: "root:comm-1",
      recipientId: "u1",
      channelId: "chan-1",
      messageId: "m1,m2",
      lastListingKeys: JSON.stringify(["k1"]),
      updatedAt: expect.any(Date),
    });
  });

  it("returns 401 without a valid install", async () => {
    authMocks.authenticateRootBot.mockResolvedValue(null);

    const response = await POST(request({}));

    expect(response.status).toBe(401);
    expect(repoMocks.upsertDealAlertMessage).not.toHaveBeenCalled();
  });
});
