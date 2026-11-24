import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  runMigrations: vi.fn(),
  ensureDefaultUserAndSeed: vi.fn(),
  getEnabledMarketStores: vi.fn(),
  getMarketStoreById: vi.fn(),
  getGlobalMarketReport: vi.fn(),
  syncGlobalMarketplace: vi.fn(),
  syncLigaStore: vi.fn(),
  syncLootcards: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/db", () => ({ db: { __mockDb: true } }));
vi.mock("@/db/init", () => ({ runMigrations: mocks.runMigrations }));
vi.mock("@/services/seed", () => ({
  DEFAULT_USER_ID: "default-user",
  ensureDefaultUserAndSeed: mocks.ensureDefaultUserAndSeed,
}));
vi.mock("@/db/repositories/marketplace-repository", () => ({
  getEnabledMarketStores: mocks.getEnabledMarketStores,
  getMarketStoreById: mocks.getMarketStoreById,
}));
vi.mock("@/services/marketplace", () => ({
  getGlobalMarketReport: mocks.getGlobalMarketReport,
}));
vi.mock("@/services/myp-sync", () => ({
  syncGlobalMarketplace: mocks.syncGlobalMarketplace,
}));
vi.mock("@/services/ligastore-sync", () => ({
  syncLigaStore: mocks.syncLigaStore,
}));
vi.mock("@/services/lootcards-sync", () => ({
  syncLootcards: mocks.syncLootcards,
}));

import { POST } from "../route";

function makePostRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/marketplace/market", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/marketplace/market", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.runMigrations.mockResolvedValue(undefined);
    mocks.ensureDefaultUserAndSeed.mockResolvedValue(undefined);
    mocks.getGlobalMarketReport.mockResolvedValue({ summary: {}, cards: [] });
  });

  it("dispatches syncLigaStore when storeId=lastplace is requested", async () => {
    mocks.getMarketStoreById.mockResolvedValue({
      id: "lastplace",
      platform: "liga_store",
      name: "Last Place TCG",
      baseUrl: "https://www.lastplacetcg.com.br",
      tcgId: "21",
      enabled: true,
    });
    mocks.syncLigaStore.mockResolvedValue({
      totalSynced: 4,
      matchedCount: 4,
      unmatchedCount: 0,
      enrichedCount: 0,
      storeName: "Last Place TCG",
    });

    const response = await POST(makePostRequest({ storeId: "lastplace" }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.getMarketStoreById).toHaveBeenCalledWith("lastplace", { __mockDb: true });
    expect(mocks.syncLigaStore).toHaveBeenCalledWith({
      storeId: "lastplace",
      database: { __mockDb: true },
    });
    expect(json.success).toBe(true);
    expect(json.stats).toEqual({
      totalSynced: 4,
      matchedCount: 4,
      unmatchedCount: 0,
    });
  });

  it("syncs all enabled stores across platforms including lastplace when storeId is omitted", async () => {
    mocks.getEnabledMarketStores.mockResolvedValue([
      { id: "myp", platform: "myp", name: "MyP Cards" },
      { id: "brandao", platform: "liga_store", name: "Brandão Card Game" },
      { id: "tabletopsorocaba", platform: "liga_store", name: "TabletopSorocaba" },
      { id: "lastplace", platform: "liga_store", name: "Last Place TCG" },
      { id: "lootcards", platform: "lootcards", name: "Lootcards" },
    ]);
    mocks.syncGlobalMarketplace.mockResolvedValue({
      totalSynced: 10,
      matchedCount: 9,
      unmatchedCount: 1,
    });
    mocks.syncLigaStore.mockImplementation(async ({ storeId }: { storeId: string }) => ({
      totalSynced: storeId === "lastplace" ? 4 : 2,
      matchedCount: storeId === "lastplace" ? 4 : 1,
      unmatchedCount: storeId === "lastplace" ? 0 : 1,
      enrichedCount: 0,
      storeName: storeId,
    }));
    mocks.syncLootcards.mockResolvedValue({
      totalSynced: 5,
      matchedCount: 5,
      unmatchedCount: 0,
      enrichedCount: 0,
    });

    const response = await POST(makePostRequest({}));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.syncLigaStore).toHaveBeenCalledTimes(3);
    expect(mocks.syncLigaStore).toHaveBeenCalledWith({
      storeId: "lastplace",
      database: { __mockDb: true },
    });
    expect(json.stats).toEqual({
      totalSynced: 23,
      matchedCount: 20,
      unmatchedCount: 3,
    });
  });

  it("returns 404 when an unknown storeId is requested", async () => {
    mocks.getMarketStoreById.mockResolvedValue(undefined);

    const response = await POST(makePostRequest({ storeId: "does-not-exist" }));
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toContain("does-not-exist");
    expect(mocks.syncLigaStore).not.toHaveBeenCalled();
    expect(mocks.syncLootcards).not.toHaveBeenCalled();
    expect(mocks.syncGlobalMarketplace).not.toHaveBeenCalled();
  });
});
