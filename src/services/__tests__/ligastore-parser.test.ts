import { describe, expect, it } from "vitest";
import {
  decodeLigaStoreSpriteClasses,
  parseLigaStoreItemDetails,
  parseLigaStoreSearchPage,
  parseLigaStoreTotalCount,
} from "../ligastore-parser";

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
});
