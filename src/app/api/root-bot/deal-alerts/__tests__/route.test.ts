import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ authenticateRootBot: vi.fn() }));
const identityMocks = vi.hoisted(() => ({
  findIdentitiesWithNotificationsEnabled: vi.fn(),
}));
const planMocks = vi.hoisted(() => ({ planDealAlerts: vi.fn() }));

vi.mock("@/services/root-bot-auth", () => authMocks);
vi.mock("@/db/repositories/assistant-repository", () => identityMocks);
vi.mock("@/services/discord-deal-notifier", () => planMocks);

import { GET } from "../route";

describe("GET /api/root-bot/deal-alerts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a valid install", async () => {
    authMocks.authenticateRootBot.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"));

    expect(response.status).toBe(401);
  });

  it("plans for the community and keeps opted-in recipients", async () => {
    authMocks.authenticateRootBot.mockResolvedValue({
      appId: "app",
      communityId: "comm-1",
    });
    identityMocks.findIdentitiesWithNotificationsEnabled.mockResolvedValue([
      { providerUserId: "u1" },
    ]);
    planMocks.planDealAlerts.mockResolvedValue({ plans: [], cleanup: [] });

    const response = await GET(new Request("http://localhost"));

    expect(response.status).toBe(200);
    expect(planMocks.planDealAlerts).toHaveBeenCalledWith(undefined, {
      destination: "root:comm-1",
      keepRecipients: new Set(["u1"]),
    });
  });
});
