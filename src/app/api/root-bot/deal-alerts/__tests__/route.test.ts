import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ authenticateRootBot: vi.fn() }));
const identityMocks = vi.hoisted(() => ({
  findIdentitiesWithNotificationsEnabled: vi.fn(),
}));
const communityMocks = vi.hoisted(() => ({
  listRootCommunityIdentities: vi.fn(),
}));
const planMocks = vi.hoisted(() => ({ planDealAlerts: vi.fn() }));

vi.mock("@/services/root-bot-auth", () => authMocks);
vi.mock("@/db/repositories/assistant-repository", () => identityMocks);
vi.mock("@/db/repositories/root-community-identity-repository", () => communityMocks);
vi.mock("@/services/deal-alert-planner", () => planMocks);

import { GET } from "../route";

describe("GET /api/root-bot/deal-alerts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a valid install", async () => {
    authMocks.authenticateRootBot.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"));

    expect(response.status).toBe(401);
  });

  it("plans only for members of the authenticated community", async () => {
    authMocks.authenticateRootBot.mockResolvedValue({
      appId: "app",
      communityId: "comm-1",
    });
    communityMocks.listRootCommunityIdentities.mockResolvedValue(["u1"]);
    identityMocks.findIdentitiesWithNotificationsEnabled.mockResolvedValue([
      { providerUserId: "u1" },
      { providerUserId: "u2" },
    ]);
    planMocks.planDealAlerts.mockResolvedValue({ plans: [], cleanup: [] });

    const response = await GET(new Request("http://localhost"));

    expect(response.status).toBe(200);
    expect(communityMocks.listRootCommunityIdentities).toHaveBeenCalledWith(
      "comm-1"
    );
    expect(planMocks.planDealAlerts).toHaveBeenCalledWith(undefined, {
      destination: "root:comm-1",
      keepRecipients: new Set(["u1"]),
      recipientIds: new Set(["u1"]),
    });
  });

  it("plans nothing when the community has no recorded members", async () => {
    authMocks.authenticateRootBot.mockResolvedValue({
      appId: "app",
      communityId: "comm-1",
    });
    communityMocks.listRootCommunityIdentities.mockResolvedValue([]);
    planMocks.planDealAlerts.mockResolvedValue({ plans: [], cleanup: [] });

    const response = await GET(new Request("http://localhost"));

    expect(response.status).toBe(200);
    expect(identityMocks.findIdentitiesWithNotificationsEnabled).not.toHaveBeenCalled();
    expect(planMocks.planDealAlerts).toHaveBeenCalledWith(undefined, {
      destination: "root:comm-1",
      keepRecipients: new Set(),
      recipientIds: new Set(),
    });
  });
});
