import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ authenticateRootBot: vi.fn() }));
const deliveryMocks = vi.hoisted(() => ({
  getUndeliveredNotifications: vi.fn(),
  markNotificationsDelivered: vi.fn(),
}));
const storeMocks = vi.hoisted(() => ({ getMarketStoreById: vi.fn() }));

vi.mock("@/services/root-bot-auth", () => authMocks);
vi.mock("@/db/repositories/notification-delivery-repository", () => deliveryMocks);
vi.mock("@/db/repositories/marketplace-repository", () => storeMocks);

import { GET } from "../route";

const notification = {
  id: "n1",
  storeId: "store-1",
  cardName: "Creative Shock",
  setPrefix: "DOA",
  collectorNumber: "001",
  isFoil: false,
  price: "R$ 10,00",
  refId: "r1",
  imageUrl: null,
  detectedAt: new Date("2026-01-01T00:00:00Z"),
  sentAt: null,
  messageId: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

describe("GET /api/root-bot/market-notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a valid install", async () => {
    authMocks.authenticateRootBot.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"));

    expect(response.status).toBe(401);
  });

  it("returns formatted chunks scoped to the community", async () => {
    authMocks.authenticateRootBot.mockResolvedValue({
      appId: "app",
      communityId: "comm-1",
    });
    deliveryMocks.getUndeliveredNotifications.mockResolvedValue([notification]);
    storeMocks.getMarketStoreById.mockResolvedValue({
      name: "MyP",
      lastFullScanAt: null,
      baseUrl: null,
    });

    const response = await GET(new Request("http://localhost"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(deliveryMocks.getUndeliveredNotifications).toHaveBeenCalledWith(
      "root:comm-1"
    );
    expect(body.chunks).toHaveLength(1);
    expect(body.chunks[0]).toMatchObject({
      storeId: "store-1",
      notificationIds: ["n1"],
    });
    expect(body.chunks[0].content).toContain("MyP");
    expect(body.chunks[0].content).toContain("updated their stock!");
  });

  it("formats chunks in pt-BR when locale=pt-BR query param is passed", async () => {
    authMocks.authenticateRootBot.mockResolvedValue({
      appId: "app",
      communityId: "comm-1",
    });
    deliveryMocks.getUndeliveredNotifications.mockResolvedValue([notification]);
    storeMocks.getMarketStoreById.mockResolvedValue({
      name: "MyP",
      lastFullScanAt: null,
      baseUrl: null,
    });

    const response = await GET(new Request("http://localhost?locale=pt-BR"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.chunks).toHaveLength(1);
    expect(body.chunks[0].content).toContain("atualizou o estoque!");
  });

  it("returns no chunks when nothing is pending", async () => {
    authMocks.authenticateRootBot.mockResolvedValue({
      appId: "app",
      communityId: "comm-1",
    });
    deliveryMocks.getUndeliveredNotifications.mockResolvedValue([]);

    const response = await GET(new Request("http://localhost"));

    await expect(response.json()).resolves.toEqual({ chunks: [] });
  });
});
