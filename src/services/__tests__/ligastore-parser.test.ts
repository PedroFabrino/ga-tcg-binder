import { describe, expect, it } from "vitest";
import {
  decodeLigaStoreSpriteClasses,
  parseLigaStoreItemDetails,
  parseLigaStoreLatestCardRefId,
  parseLigaStoreSearchPage,
  parseLigaStoreTotalCount,
} from "../ligastore-parser";
import { buildLigaStoreSearchUrl } from "../market-check";

describe("parseLigaStoreTotalCount", () => {
  it("extracts the count from the LigaStore pagination cell", () => {
    expect(
      parseLigaStoreTotalCount(`
        <table>
          <tr><td class="textoMaior">Exibindo 1 até 20 de <b>173</b></td></tr>
        </table>
      `)
    ).toBe(173);
  });

  it("extracts count from actual Brandao pagination snippet", () => {
    expect(
      parseLigaStoreTotalCount(`
        <table cellpadding='1' cellspacing='1' border='0' width='98%' class='ecomresp-tab'>
          <tr>
            <td align='left' class='textoMaior'> 1-14 de <b>14</b></td>
            <td align='right' vAlign='middle' class='textoMaior'>Páginas:</td>
            <td width='14' align='center' class='textoMaior'><a class='ecomresp-paginacao' href='#'><b>1</b></a></td>
          </tr>
        </table>
      `)
    ).toBe(14);
  });

  it("extracts count with comma thousands separator (e.g. 2,059)", () => {
    expect(
      parseLigaStoreTotalCount(`
        <td align='left' class='textoMaior'> 1-30 de <b>2,059</b></td>
      `)
    ).toBe(2059);
  });

  it("extracts count with dot thousands separator (e.g. 2.059)", () => {
    expect(
      parseLigaStoreTotalCount(`
        <td align='left' class='textoMaior'> 1-30 de <b>2.059</b></td>
      `)
    ).toBe(2059);
  });

  it("falls back to itens_total from pagination links", () => {
    expect(
      parseLigaStoreTotalCount(`
        <a href="./?view=ecom/itens&tcg=11&amp;itens_total=2059&amp;page=2">2</a>
      `)
    ).toBe(2059);
  });

  it("supports the generic de <b>count</b> fallback", () => {
    expect(parseLigaStoreTotalCount("<span>Resultados de <b>42</b></span>")).toBe(42);
  });

  it("returns zero when pagination is absent", () => {
    expect(parseLigaStoreTotalCount("<div>Nenhum produto encontrado</div>")).toBe(0);
  });
});

describe("decodeLigaStoreSpriteClasses", () => {
  it("decodes explicitly named sprite classes", () => {
    const sprites = decodeLigaStoreSpriteClasses(`
      <style>
        .num-0 { background-position: 0px 0px; }
        .num-1 { background-position: -10px 0px; }
        .num-2 { background-position: -20px 0px; }
      </style>
    `);

    expect(sprites.get("num-0")).toBe("0");
    expect(sprites.get("num-1")).toBe("1");
    expect(sprites.get("num-2")).toBe("2");
  });
});

describe("parseLigaStoreItemDetails", () => {
  it("parses realistic detail-page fields", () => {
    const result = parseLigaStoreItemDetails(`
      <div class="table-cards-body-cell quality text-center">NM</div>
      <div class="table-cards-body-cell tooltip-item text-center">
        <img src="/images/br.png" alt="Português">
      </div>
      <div class="table-cards-body-cell tooltip-item">3 unid.</div>
      <div class="table-cards-body-cell card-preco">R$ 1,50</div>
      <span class="siglaEdicao">ALC</span>
    `);

    expect(result).toEqual({
      condition: "NM",
      language: "Português",
      price: "R$ 1,50",
      priceNumeric: 1.5,
      stockQuantity: 3,
      editionCode: "ALC",
    });
  });

  it("uses quantity input max when displayed stock is unavailable", () => {
    const result = parseLigaStoreItemDetails(`
      <div class="table-cards-body-cell quality">SP</div>
      <div class="table-cards-body-cell tooltip-item text-center">English</div>
      <input type="number" name="txt_qty_8934" value="1" max="12">
      <div class="card-preco">R$ 12,00</div>
    `);

    expect(result.condition).toBe("SP");
    expect(result.language).toBe("English");
    expect(result.stockQuantity).toBe(12);
    expect(result.priceNumeric).toBe(12);
    expect(result.editionCode).toBeNull();
  });
});

describe("parseLigaStoreSearchPage", () => {
  it("parses search result cards, prices, foil state, URLs, and stock", () => {
    const result = parseLigaStoreSearchPage(`
      <style>
        .num-0 { background-position: 0px 0px; }
        .num-1 { background-position: -10px 0px; }
        .num-5 { background-position: -50px 0px; }
      </style>

      <td class="textoMaior">Exibindo 1 até 2 de <b>2</b></td>

      <div class="card-item">
        <a href="?view=ecom/item&refid=M1B_twbhyV_d0_1_XlLN0RUYxUQ">
          Flame-Rune Swordsman (#136)
        </a>
        <img data-src="https://images.example/flame-rune.jpg" alt="Flame-Rune Swordsman">
        <img src="/images/foil.png" alt="FOIL">
        <div class="card-preco">R$ 1,50</div>
        <div class="estoque">3 unid.</div>
      </div>

      <div class="card-item">
        <a href="?view=ecom/item&refid=second_ref">
          Frostbind (028) (#28b)
        </a>
        <img src="https://images.example/frostbind.jpg" alt="Frostbind">
        <div class="card-preco">R$ 12,00</div>
        <input type="number" name="txt_qty_44" max="7">
      </div>
    `);

    expect(result.totalCount).toBe(2);
    expect(result.items).toHaveLength(2);

    expect(result.items[0]).toMatchObject({
      rawTitle: "Flame-Rune Swordsman (#136)",
      cardName: "Flame-Rune Swordsman",
      collectorNumber: "136",
      isFoil: true,
      refId: "M1B_twbhyV_d0_1_XlLN0RUYxUQ",
      imageUrl: "https://images.example/flame-rune.jpg",
      price: "R$ 1,50",
      priceNumeric: 1.5,
      quantity: 3,
    });

    expect(result.items[1]).toMatchObject({
      rawTitle: "Frostbind (028) (#28b)",
      cardName: "Frostbind",
      collectorNumber: "28b",
      isFoil: false,
      refId: "second_ref",
      imageUrl: "https://images.example/frostbind.jpg",
      price: "R$ 12,00",
      priceNumeric: 12,
      quantity: 7,
    });
  });

  it("normalizes collector numbers from title text", () => {
    const result = parseLigaStoreSearchPage(`
      <div class="card-item">
        <a href="?view=ecom/item&refid=test-ref">Flame-Rune Swordsman (#136)</a>
      </div>
      <div class="card-item">
        <a href="?view=ecom/item&refid=test-ref-2">Frostbind (028) (#28b)</a>
      </div>
      <div class="card-item">
        <a href="?view=ecom/item&refid=test-ref-3">Level One (#1)</a>
      </div>
    `);

    expect(result.items.map((item) => [item.cardName, item.collectorNumber])).toEqual([
      ["Flame-Rune Swordsman", "136"],
      ["Frostbind", "28b"],
      ["Level One", "1"],
    ]);
  });

  it("uses the title anchor instead of image thumbnail anchor for rawTitle", () => {
    const result = parseLigaStoreSearchPage(`
      <div class="card-item">
        <div class="card-img">
          <a href="./?view=ecom/item&id=123&refid=thumbnail">
            <img src="/images/shanks.jpg" alt="Shanks image" />
          </a>
        </div>
        <div class="title">
          <a href="./?view=ecom/item&id=123&refid=product">
            Shanks (022) (Manga) (#OP17-022-MA)
          </a>
        </div>
      </div>
    `);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].rawTitle).toBe("Shanks (022) (Manga) (#OP17-022-MA)");
    expect(result.items[0].collectorNumber).toBe("OP17-022-MA");
  });
});

describe("parseLigaStoreLatestCardRefId", () => {
  it("extracts refId from a valid LigaStore search results HTML snippet", () => {
    const html = `
      <div class="card-item">
        <div class="title">
          <a href="?view=ecom/item&refid=M1B_twbhyV_d0_1_XlLN0RUYxUQ">Flame-Rune Swordsman (#136)</a>
        </div>
      </div>
    `;
    expect(parseLigaStoreLatestCardRefId(html)).toBe("M1B_twbhyV_d0_1_XlLN0RUYxUQ");
  });

  it("extracts refId from the first item when multiple items are present", () => {
    const html = `
      <div class="card-item">
        <a href="?view=ecom/item&refid=first_item_ref">First Item</a>
      </div>
      <div class="card-item">
        <a href="?view=ecom/item&refid=second_item_ref">Second Item</a>
      </div>
    `;
    expect(parseLigaStoreLatestCardRefId(html)).toBe("first_item_ref");
  });

  it("returns null for empty results page or string", () => {
    expect(parseLigaStoreLatestCardRefId("")).toBeNull();
    expect(parseLigaStoreLatestCardRefId("   ")).toBeNull();
  });

  it("returns null for malformed HTML with no refid", () => {
    expect(
      parseLigaStoreLatestCardRefId("<html><body><div>No items found</div></body></html>")
    ).toBeNull();
  });

  it("returns null for page with no product items", () => {
    const html = `
      <table class="ecomresp-tab">
        <tr><td class="textoMaior">Nenhum produto encontrado</td></tr>
      </table>
    `;
    expect(parseLigaStoreLatestCardRefId(html)).toBeNull();
  });
});

describe("buildLigaStoreSearchUrl", () => {
  const store = {
    id: "brandao",
    platform: "liga_store",
    baseUrl: "https://www.brandaocardgame.com.br",
    tcgId: "21",
    lastCount: 100,
    lastLatestCardRefId: null,
  };

  it("produces a URL with txt_order=12 and ultimas=1 when sort is latest", () => {
    const url = buildLigaStoreSearchUrl(store, "latest");
    expect(url).not.toBeNull();
    expect(url).toContain("txt_order=12");
    expect(url).toContain("ultimas=1");
    expect(url).toContain("id=207836");
  });

  it("produces a URL with txt_order=6 when sort is count", () => {
    const url = buildLigaStoreSearchUrl(store, "count");
    expect(url).not.toBeNull();
    expect(url).toContain("txt_order=6");
    expect(url).not.toContain("txt_order=12");
  });

  it("defaults to count (txt_order=6) when sort argument is omitted", () => {
    const url = buildLigaStoreSearchUrl(store);
    expect(url).not.toBeNull();
    expect(url).toContain("txt_order=6");
    expect(url).not.toContain("txt_order=12");
  });

  it("returns null if baseUrl is empty", () => {
    expect(buildLigaStoreSearchUrl({ ...store, baseUrl: "" })).toBeNull();
  });
});
