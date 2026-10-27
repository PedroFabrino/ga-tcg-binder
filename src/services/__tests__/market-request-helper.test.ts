import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchWithRetry,
  getStoreFetchConfig,
  isCloudflareChallenge,
  resetStoreFetchConfigs,
  setStoreFetchConfig,
  solveWithFlareSolverr,
} from "../market-request-helper";

describe("market-request-helper", () => {
  beforeEach(() => {
    resetStoreFetchConfigs();
    vi.restoreAllMocks();
    delete process.env.FLARESOLVERR_URL;
  });

  describe("isCloudflareChallenge", () => {
    it("detects standard Cloudflare challenge indicators", () => {
      expect(isCloudflareChallenge("<title>Just a moment...</title>")).toBe(true);
      expect(isCloudflareChallenge('<script src="https://challenges.cloudflare.com/turnstile"></script>')).toBe(true);
      expect(isCloudflareChallenge('<div id="challenge-running">Checking your browser</div>')).toBe(true);
      expect(isCloudflareChallenge("<h1>Attention Required! | Cloudflare</h1>")).toBe(true);
      expect(isCloudflareChallenge('<form id="challenge-form">')).toBe(true);
    });

    it("returns false for regular storefront HTML", () => {
      expect(isCloudflareChallenge('<div class="card-item">Flame Swordsman</div>')).toBe(false);
      expect(isCloudflareChallenge("")).toBe(false);
    });
  });

  describe("store fetch configuration registry", () => {
    it("returns safe defaults when no custom configuration is set", () => {
      const config = getStoreFetchConfig("brandao");
      expect(config.solveCloudflare).toBe(true);
      expect(config.maxRetries).toBe(3);
      expect(config.retryDelayMs).toBe(3000);
    });

    it("allows toggling Cloudflare solving and custom retries per store", () => {
      setStoreFetchConfig("TabletopSorocaba", {
        solveCloudflare: false,
        maxRetries: 5,
        retryDelayMs: 1500,
      });

      const config = getStoreFetchConfig("tabletopsorocaba");
      expect(config.solveCloudflare).toBe(false);
      expect(config.maxRetries).toBe(5);
      expect(config.retryDelayMs).toBe(1500);

      // Other stores retain default configuration
      const brandaoConfig = getStoreFetchConfig("brandao");
      expect(brandaoConfig.solveCloudflare).toBe(true);
      expect(brandaoConfig.maxRetries).toBe(3);
    });

    it("resets configurations cleanly with resetStoreFetchConfigs", () => {
      setStoreFetchConfig("myp", { solveCloudflare: false });
      resetStoreFetchConfigs();
      expect(getStoreFetchConfig("myp").solveCloudflare).toBe(true);
    });
  });

  describe("solveWithFlareSolverr", () => {
    it("returns null when FLARESOLVERR_URL is not configured", async () => {
      const result = await solveWithFlareSolverr("https://example.com");
      expect(result).toBeNull();
    });

    it("posts to FlareSolverr and extracts solved HTML on success", async () => {
      process.env.FLARESOLVERR_URL = "http://localhost:8191";

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "ok",
          solution: {
            response: "<html><body>Real Store Content</body></html>",
          },
        }),
      });

      const result = await solveWithFlareSolverr("https://example.com/items", {
        customFetch: mockFetch as unknown as typeof fetch,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8191/v1",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            cmd: "request.get",
            url: "https://example.com/items",
            maxTimeout: 60000,
          }),
        })
      );
      expect(result).toBe("<html><body>Real Store Content</body></html>");
    });

    it("returns null and warns when FlareSolverr returns non-ok response", async () => {
      process.env.FLARESOLVERR_URL = "http://localhost:8191";

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await solveWithFlareSolverr("https://example.com/items", {
        customFetch: mockFetch as unknown as typeof fetch,
      });

      expect(result).toBeNull();
    });
  });

  describe("fetchWithRetry", () => {
    it("returns response immediately on successful first attempt", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => "<div>Store Catalog</div>",
      });

      const html = await fetchWithRetry("https://example.com", {
        customFetch: mockFetch as unknown as typeof fetch,
      });

      expect(html).toBe("<div>Store Catalog</div>");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("retries on transient failure and returns on subsequent success", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => "<div>Success on Retry</div>",
        });

      const html = await fetchWithRetry("https://example.com", {
        storeId: "teststore",
        maxRetries: 3,
        retryDelayMs: 1,
        customFetch: mockFetch as unknown as typeof fetch,
      });

      expect(html).toBe("<div>Success on Retry</div>");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("uses FlareSolverr when Cloudflare challenge is encountered and solveCloudflare is enabled", async () => {
      process.env.FLARESOLVERR_URL = "http://localhost:8191";

      const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
        const urlStr = String(input);
        if (urlStr.includes("8191")) {
          return {
            ok: true,
            json: async () => ({
              status: "ok",
              solution: {
                response: "<div>Solved By FlareSolverr</div>",
              },
            }),
          };
        }
        return {
          ok: true,
          text: async () => "<title>Just a moment...</title>",
        };
      });

      const html = await fetchWithRetry("https://store.example/products", {
        storeId: "brandao",
        solveCloudflare: true,
        customFetch: mockFetch as unknown as typeof fetch,
      });

      expect(html).toBe("<div>Solved By FlareSolverr</div>");
    });

    it("skips FlareSolverr when solveCloudflare is toggled off for the store", async () => {
      process.env.FLARESOLVERR_URL = "http://localhost:8191";

      setStoreFetchConfig("tabletopsorocaba", { solveCloudflare: false });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => "<title>Just a moment...</title>",
      });

      await expect(
        fetchWithRetry("https://store.example/products", {
          storeId: "tabletopsorocaba",
          maxRetries: 2,
          retryDelayMs: 1,
          customFetch: mockFetch as unknown as typeof fetch,
        })
      ).rejects.toThrow(/Failed to fetch/);

      // FlareSolverr should not have been called
      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringContaining("8191"),
        expect.anything()
      );
    });

    it("throws descriptive error after exhausting max retries", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Socket connection closed"));

      await expect(
        fetchWithRetry("https://example.com", {
          maxRetries: 2,
          retryDelayMs: 1,
          customFetch: mockFetch as unknown as typeof fetch,
        })
      ).rejects.toThrow(/Failed to fetch https:\/\/example\.com after 2 attempt\(s\)/);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("aborts immediately with SessionExpiredError when session-backed store fetch fails with 403", async () => {
      process.env.LIGA_COOKIE_TABLETOPSOROCABA = "cf_clearance=expired";
      process.env.LIGA_UA_TABLETOPSOROCABA = "Chrome/155";

      const storeSessionModule = await import("../store-session");
      const executeSpy = vi
        .spyOn(storeSessionModule, "executeStoreFetch")
        .mockRejectedValue(
          new storeSessionModule.SessionExpiredError("tabletopsorocaba", "Expired", 403)
        );

      await expect(
        fetchWithRetry("https://example.com/items", {
          storeId: "tabletopsorocaba",
        })
      ).rejects.toThrow(storeSessionModule.SessionExpiredError);

      executeSpy.mockRestore();
      delete process.env.LIGA_COOKIE_TABLETOPSOROCABA;
      delete process.env.LIGA_UA_TABLETOPSOROCABA;
    });
  });
});
