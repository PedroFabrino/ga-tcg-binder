import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ authenticateRootBot: vi.fn() }));
const deliveryMocks = vi.hoisted(() => ({
  markNotificationsDelivered: vi.fn(),
}));

vi.mock("@/services/root-bot-auth", () => authMocks);
vi.mock("@/db/repositories/notification-delivery-repository", () => deliveryMocks);

import { POST } from "../route";

function request(body: unknown): Request {
  return new Request("http://localhost/api/root-bot/market-notifications/delivered", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/root-bot/market-notifications/delivered", () => {
  beforeEach(() => vi.clearAllMocks());

  it("records delivery for the community", async () => {
    authMocks.authenticateRootBot.mockResolvedValue({
      appId: "app",
      communityId: "comm-1",
    });

    const response = await POST(
      request({ notificationIds: ["n1", "n2"], messageIds: ["m1"] })
    );

    expect(response.status).toBe(200);
    expect(deliveryMocks.markNotificationsDelivered).toHaveBeenCalledWith(
      ["n1", "n2"],
      "root:comm-1",
      "m1"
    );
  });

  it("returns 401 without a valid install", async () => {
    authMocks.authenticateRootBot.mockResolvedValue(null);

    const response = await POST(request({ notificationIds: [], messageIds: [] }));

    expect(response.status).toBe(401);
    expect(deliveryMocks.markNotificationsDelivered).not.toHaveBeenCalled();
  });
});
