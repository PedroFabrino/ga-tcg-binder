import { describe, expect, it, vi } from "vitest";
import { discoverMypProductPrintings } from "../watchlist-remote";

function catalogHtml(): string {
  return [
    '<div class="card">',
    '<div class="card-name"><h3>Fracturize</h3></div>',
    '<span class="card-edicao">ALC</span>',
    '<span class="quantidade-num">0</span>',
    '<span class="card-preco">R$ 6,00</span>',
    '<a class="card-img-link" href="/grandarchive/produto/fracturize-alc"><img src="/x.jpg"></a>',
    '<span title="NM - Near Mint">NM</span>',
    '<div data-ga-item-id="grandarchive_alc_042"></div>',
    "</div>",
  ].join("");
}

describe("discoverMypProductPrintings (unfiltered 0-stock discovery)", () => {
  it("queries the unfiltered catalog and resolves mypItemId and mypProductUrl", async () => {
    const fetchFn = vi.fn(async (_input: RequestInfo | URL) => new Response(catalogHtml(), { status: 200 }));

    const items = await discoverMypProductPrintings("Fracturize", fetchFn);

    expect(items).toHaveLength(1);
    expect(items[0].cleanName).toBe("Fracturize");
    expect(items[0].setPrefix).toBe("ALC");
    expect(items[0].mypItemId).toBe("grandarchive_alc_042");
    expect(items[0].mypProductUrl).toBe(
      "https://mypcards.com/grandarchive/produto/fracturize-alc"
    );
    expect(items[0].isFoil).toBe(false);
  });

  it("uses the unfiltered search URL (no exibirSomenteVenda filter)", async () => {
    const fetchFn = vi.fn(async (_input: RequestInfo | URL) => new Response(catalogHtml(), { status: 200 }));

    await discoverMypProductPrintings("Fracturize", fetchFn);

    const url = String(fetchFn.mock.calls[0][0]);
    expect(url).toContain("ProdutoSearch%5Bnome%5D=Fracturize");
    expect(url).not.toContain("exibirSomenteVenda");
  });

  it("returns an empty list when the catalog request fails", async () => {
    const fetchFn = vi.fn(async (_input: RequestInfo | URL) => new Response("error", { status: 503 }));
    await expect(discoverMypProductPrintings("Fracturize", fetchFn)).resolves.toEqual([]);
  });
});
