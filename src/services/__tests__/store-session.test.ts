import { describe, expect, it, vi } from "vitest";
import {
  deriveClientHints,
  isSessionExpiredError,
  loadStoreSession,
  maskCookie,
  SessionExpiredError,
  executeStoreFetch,
} from "../store-session";

describe("store-session", () => {
  describe("SessionExpiredError", () => {
    it("creates an instance and is identified by isSessionExpiredError", () => {
      const err = new SessionExpiredError("tabletopsorocaba", "Session expired", 403);
      expect(err.name).toBe("SessionExpiredError");
      expect(err.storeId).toBe("tabletopsorocaba");
      expect(err.status).toBe(403);
      expect(err.message).toBe("Session expired");
      expect(isSessionExpiredError(err)).toBe(true);
      expect(isSessionExpiredError(new Error("Generic"))).toBe(false);
      expect(isSessionExpiredError(null)).toBe(false);
    });
  });

  describe("deriveClientHints", () => {
    it("derives Chrome 155 Windows client hints", () => {
      const ua =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36";
      const hints = deriveClientHints(ua);
      expect(hints["Sec-Ch-Ua"]).toBe(
        '"Chromium";v="155", "Google Chrome";v="155", "Not-A.Brand";v="99"'
      );
      expect(hints["Sec-Ch-Ua-Mobile"]).toBe("?0");
      expect(hints["Sec-Ch-Ua-Platform"]).toBe('"Windows"');
    });

    it("derives macOS hints when UA is macOS", () => {
      const ua =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
      const hints = deriveClientHints(ua);
      expect(hints["Sec-Ch-Ua"]).toContain('"124"');
      expect(hints["Sec-Ch-Ua-Platform"]).toBe('"macOS"');
    });

    it("falls back gracefully when version cannot be parsed", () => {
      const hints = deriveClientHints("Unknown-Agent");
      expect(hints["Sec-Ch-Ua"]).toContain('"Chromium"');
      expect(hints["Sec-Ch-Ua-Mobile"]).toBe("?0");
    });
  });

  describe("maskCookie", () => {
    it("masks long cookie strings without leaking full contents", () => {
      const cookie = "cf_clearance=1234567890abcdefghijklmnopqrstuvwxyz";
      const masked = maskCookie(cookie);
      expect(masked).not.toBe(cookie);
      expect(masked).toContain("cf_clearance=");
      expect(masked).toContain("length: 49");
      expect(masked.length).toBeLessThan(cookie.length);
    });

    it("handles empty or short cookies safely", () => {
      expect(maskCookie("")).toBe("[empty]");
      expect(maskCookie("a=b")).toBe("[set]");
    });
  });

  describe("loadStoreSession", () => {
    it("loads session from environment variables", () => {
      const mockEnv = {
        LIGA_COOKIE_TABLETOPSOROCABA: "cf_clearance=secret-val; foo=bar",
        LIGA_UA_TABLETOPSOROCABA:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/155.0.0.0",
      };

      const session = loadStoreSession("tabletopsorocaba", { env: mockEnv });
      expect(session).not.toBeNull();
      expect(session?.storeId).toBe("tabletopsorocaba");
      expect(session?.cookie).toBe("cf_clearance=secret-val; foo=bar");
      expect(session?.userAgent).toContain("Chrome/155");
      expect(session?.headers?.["Sec-Ch-Ua"]).toContain('"155"');
    });

    it("loads session from JSON file in session directory", () => {
      const mockFs = {
        existsSync: vi.fn().mockImplementation((path: string) => path.endsWith(".json")),
        readFileSync: vi.fn().mockReturnValue(
          JSON.stringify({
            cookie: "cf_clearance=file-secret",
            userAgent: "Mozilla/5.0 Chrome/150.0.0.0",
          })
        ),
      };

      const session = loadStoreSession("brandao", {
        sessionDir: "/app/secrets",
        fs: mockFs as any,
        env: {},
      });

      expect(session).not.toBeNull();
      expect(session?.cookie).toBe("cf_clearance=file-secret");
      expect(session?.userAgent).toContain("150");
    });

    it("returns null when no file or env var exists for the store", () => {
      const mockFs = {
        existsSync: vi.fn().mockReturnValue(false),
        readFileSync: vi.fn(),
      };

      const session = loadStoreSession("nonexistent", {
        sessionDir: "/app/secrets",
        fs: mockFs as any,
        env: {},
      });

      expect(session).toBeNull();
    });
  });

  describe("executeStoreFetch with session", () => {
    it("throws SessionExpiredError on HTTP 403", async () => {
      const session = {
        storeId: "tabletopsorocaba",
        cookie: "cf_clearance=test",
        userAgent: "test-ua",
      };

      const mockExecFile = vi.fn((_bin, _args, _opts, callback) => {
        // Output format with status marker
        callback(null, "<html>Forbidden</html>\n__HTTP_STATUS__:403", "");
      });

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await expect(
        executeStoreFetch("https://example.com/items", {
          session,
          execFileFn: mockExecFile as any,
        })
      ).rejects.toThrow(SessionExpiredError);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[StoreSession: tabletopsorocaba] Cloudflare session expired")
      );
      warnSpy.mockRestore();
    });

    it("throws SessionExpiredError on Cloudflare challenge body with 200 status", async () => {
      const session = {
        storeId: "tabletopsorocaba",
        cookie: "cf_clearance=test",
        userAgent: "test-ua",
      };

      const mockExecFile = vi.fn((_bin, _args, _opts, callback) => {
        callback(
          null,
          "<html><head><title>Attention Required! | Cloudflare</title></head></html>\n__HTTP_STATUS__:200",
          ""
        );
      });

      await expect(
        executeStoreFetch("https://example.com/items", {
          session,
          execFileFn: mockExecFile as any,
        })
      ).rejects.toThrow(SessionExpiredError);
    });

    it("returns body on HTTP 200 with clean content", async () => {
      const session = {
        storeId: "tabletopsorocaba",
        cookie: "cf_clearance=test",
        userAgent: "test-ua",
      };

      const mockExecFile = vi.fn((_bin, _args, _opts, callback) => {
        callback(null, '<div class="card-item">Real Content</div>\n__HTTP_STATUS__:200', "");
      });

      const result = await executeStoreFetch("https://example.com/items", {
        session,
        execFileFn: mockExecFile as any,
      });

      expect(result).toBe('<div class="card-item">Real Content</div>');
    });
  });
});
