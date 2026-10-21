import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  getEnabledMarketStores: vi.fn(),
  updateStoreCount: vi.fn(),
  updateStoreLatestCardRefId: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  auth: vi.fn(),
}));

const parserMocks = vi.hoisted(() => ({
  parseLigaStoreTotalCount: vi.fn(),
  parseLigaStoreLatestCardRefId: vi.fn(),
}));

vi.mock("@/db/repositories/marketplace-repository", () => repositoryMocks);
vi.mock("@/auth", () => authMocks);
vi.mock("@/services/ligastore-parser", () => parserMocks);

import { GET } from "../route";

describe("GET /api/cron/check-market-stores", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();

    process.env = {
      ...originalEnv,
      CRON_SECRET: "test-cron-secret",
    };

    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_PAT;
    delete process.env.GITHUB_REPOSITORY;

    authMocks.auth.mockResolvedValue(null);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it("returns 401 when neither cron secret nor admin session is present", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/check-market-stores")
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized",
    });
    expect(repositoryMocks.getEnabledMarketStores).not.toHaveBeenCalled();
  });

  it("fetches enabled store counts and updates the database when counts changed", async () => {
    repositoryMocks.getEnabledMarketStores.mockResolvedValue([
      {
        id: "liga-store-1",
        platform: "liga_store",
        baseUrl: "https://ligastore.example",
        tcgId: "21",
        lastCount: 20,
      },
      {
        id: "myp-store-1",
        platform: "myp",
        baseUrl: null,
        tcgId: null,
        lastCount: 100,
      },
    ]);

    parserMocks.parseLigaStoreTotalCount.mockReturnValue(25);
    parserMocks.parseLigaStoreLatestCardRefId.mockReturnValue("latest-ref-1");

    const fetchMock = vi.fn<typeof fetch>();
    fetchMock
      .mockResolvedValueOnce(
        new Response("<html>Liga Store Count</html>", { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response("<html>Liga Store Latest</html>", { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(
          '<div class="summary"><strong>125</strong> itens</div>',
          { status: 200 }
        )
      );

    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("http://localhost/api/cron/check-market-stores", {
        headers: {
          authorization: "Bearer test-cron-secret",
        },
      })
    );

    expect(response.status).toBe(200);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(
        "https://ligastore.example/?view=ecom/itens&page=1&tcg=21"
      ),
      expect.any(Object)
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("txt_order=12"),
      expect.any(Object)
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://mypcards.com/grandarchive?ProdutoSearch%5BexibirSomenteVenda%5D=1",
      expect.any(Object)
    );

    expect(repositoryMocks.updateStoreCount).toHaveBeenCalledTimes(2);
    expect(repositoryMocks.updateStoreCount).toHaveBeenCalledWith(
      "liga-store-1",
      25,
      expect.any(Date),
      undefined
    );
    expect(repositoryMocks.updateStoreCount).toHaveBeenCalledWith(
      "myp-store-1",
      125,
      expect.any(Date),
      undefined
    );

    const body = await response.json();

    expect(body.changes).toHaveLength(2);
    expect(body.changes.map((change: { storeId: string }) => change.storeId)).toEqual(
      ["liga-store-1", "myp-store-1"]
    );
  });

  it("dispatches the market-sync workflow when a count changed", async () => {
    process.env.GITHUB_TOKEN = "github-token";
    process.env.GITHUB_REPOSITORY = "owner/ga-tcg-binder";

    repositoryMocks.getEnabledMarketStores.mockResolvedValue([
      {
        id: "liga-store-1",
        platform: "liga_store",
        baseUrl: "https://ligastore.example",
        tcgId: "21",
        lastCount: 10,
      },
    ]);

    parserMocks.parseLigaStoreTotalCount.mockReturnValue(12);

    const fetchMock = vi.fn<typeof fetch>();
    fetchMock
      .mockResolvedValueOnce(new Response("<html>store</html>", { status: 200 }))
      .mockResolvedValueOnce(new Response("<html>latest</html>", { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("http://localhost/api/cron/check-market-stores", {
        headers: {
          authorization: "Bearer test-cron-secret",
        },
      })
    );

    expect(response.status).toBe(200);
    expect(repositoryMocks.updateStoreCount).toHaveBeenCalledWith(
      "liga-store-1",
      12,
      expect.any(Date),
      undefined
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.github.com/repos/owner/ga-tcg-binder/actions/workflows/market-sync.yml/dispatches",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer github-token",
        }),
        body: JSON.stringify({
          ref: "main",
          inputs: {
            store_id: "liga-store-1",
          },
        }),
      })
    );

    const body = await response.json();

    expect(body.changes[0]).toMatchObject({
      storeId: "liga-store-1",
      observedCount: 12,
      changed: true,
      dispatched: true,
    });
  });

  it("does not dispatch the workflow when the count is unchanged", async () => {
    process.env.GITHUB_TOKEN = "github-token";
    process.env.GITHUB_REPOSITORY = "owner/ga-tcg-binder";

    repositoryMocks.getEnabledMarketStores.mockResolvedValue([
      {
        id: "myp-store-1",
        platform: "myp",
        baseUrl: null,
        tcgId: null,
        lastCount: 125,
      },
    ]);

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        '<div class="summary"><strong>125</strong> itens</div>',
        { status: 200 }
      )
    );

    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("http://localhost/api/cron/check-market-stores", {
        headers: {
          authorization: "Bearer test-cron-secret",
        },
      })
    );

    expect(response.status).toBe(200);
    expect(repositoryMocks.updateStoreCount).not.toHaveBeenCalled();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://mypcards.com/grandarchive?ProdutoSearch%5BexibirSomenteVenda%5D=1",
      expect.any(Object)
    );

    const body = await response.json();

    expect(body.changes).toEqual([]);
    expect(body.stores[0]).toMatchObject({
      storeId: "myp-store-1",
      observedCount: 125,
      changed: false,
      dispatched: false,
    });
  });
});
