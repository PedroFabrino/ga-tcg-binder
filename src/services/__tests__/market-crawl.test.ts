import { describe, expect, it } from "vitest";
import {
  decodeHtml,
  fetchHtml,
  parseBrlPrice,
  rescanPage,
  type CrawlAdapter,
  type CrawledListing,
} from "../market-crawl";

function listing(overrides: Partial<CrawledListing> = {}): CrawledListing {
  return {
    itemId: "ga_doa_001",
    rawName: "Fracturize",
    cardName: "Fracturize",
    setPrefix: "DOA",
    collectorNumber: "001",
    price: "R$ 12,50",
    priceBrl: 12.5,
    quantity: 3,
    isFoil: false,
    productUrl: "https://example.test/x",
    ...overrides,
  };
}

describe("market crawl engine", () => {
  it("parses BRL comma-decimal prices", () => {
    expect(parseBrlPrice("R$ 12,50")).toBe(12.5);
    expect(parseBrlPrice("R$ 1.234,56")).toBe(1234.56);
    expect(parseBrlPrice("")).toBe(0);
  });

  it("decodes entities without double-decoding amp sequences", () => {
    expect(decodeHtml("&nbsp;x")).toBe(" x");
    expect(decodeHtml("&amp;apos;")).toBe("&apos;");
    expect(decodeHtml("&#039;")).toBe("'");
  });

  it("raises the Cloudflare guard on a challenge page", async () => {
    const challenge = async () =>
      new Response("<title>Just a moment...</title>", { status: 200 });

    await expect(
      fetchHtml("https://example.test", { customFetch: challenge, cloudflareGuard: true })
    ).rejects.toThrow(/Cloudflare challenge/);

    await expect(
      fetchHtml("https://example.test", { customFetch: challenge })
    ).resolves.toContain("Just a moment");
  });

  it("rescans on error and returns the normalized listing", async () => {
    const adapter: CrawlAdapter = {
      platform: "myp",
      parsePage: () => [listing()],
      parseTotalCount: () => 1,
      pageDelayMs: 0,
      retryDelayMs: 0,
    };

    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      if (calls < 3) throw new Error("flaky");
      return "<html></html>";
    };

    const result = await rescanPage(adapter, "https://example.test", fetchImpl, 3, {
      rescanOnError: true,
    });

    expect(calls).toBe(3);
    expect(result[0]).toMatchObject({ cardName: "Fracturize", priceBrl: 12.5 });
  });
});
