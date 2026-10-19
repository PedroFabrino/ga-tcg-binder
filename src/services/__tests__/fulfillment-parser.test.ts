import { describe, it, expect } from "vitest";
import {
  parseMypVendasHtml,
  parseMypOrderPageHtml,
} from "../fulfillment-parser";

describe("Fulfillment HTML Parsers", () => {
  describe("parseMypVendasHtml", () => {
    it("extracts Aguard. envio orders and respects includeEmSeparacao toggle while stripping buyer PII", () => {
      const sampleVendasHtml = `
        <table class="table table-striped table-vendas">
          <thead>
            <tr>
              <th>Código</th>
              <th>Data</th>
              <th>Comprador</th>
              <th>Envio</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr data-order="654326">
              <td><a href="/pedido/654326">#654326</a></td>
              <td>17/10/2026</td>
              <td><a href="/usuario/Betinho3">Betinho3</a> (CPF: 123.456.789-00 - Rua das Flores, 123)</td>
              <td>Frete combinado com o vendedor</td>
              <td><span class="badge badge-warning">Aguard. envio</span></td>
              <td><a href="/pedido/654326">Detalhes</a></td>
            </tr>
            <tr data-order="654317">
              <td><a href="/pedido/654317">#654317</a></td>
              <td>16/10/2026</td>
              <td><a href="/usuario/Betinho3">Betinho3</a></td>
              <td>PAC</td>
              <td><span class="badge badge-warning">Aguard. envio</span></td>
              <td><a href="/pedido/654317">Detalhes</a></td>
            </tr>
            <tr data-order="654300">
              <td><a href="/pedido/654300">#654300</a></td>
              <td>15/10/2026</td>
              <td><a href="/usuario/LOOTCARDS">LOOTCARDS</a></td>
              <td>Frete Fixo com rastreio</td>
              <td><span class="badge badge-info">Em separação</span></td>
              <td><a href="/pedido/654300">Detalhes</a></td>
            </tr>
            <tr data-order="654100">
              <td><a href="/pedido/654100">#654100</a></td>
              <td>10/10/2026</td>
              <td><a href="/usuario/FinalizadoUser">FinalizadoUser</a></td>
              <td>Sedex</td>
              <td><span class="badge badge-success">Enviado</span></td>
              <td><a href="/pedido/654100">Detalhes</a></td>
            </tr>
          </tbody>
        </table>
      `;

      // 1. By default, only Aguard. envio is parsed
      const ordersAguard = parseMypVendasHtml(sampleVendasHtml);
      expect(ordersAguard).toHaveLength(2);
      expect(ordersAguard[0]).toEqual({
        orderId: "654326",
        orderDate: "17/10/2026",
        buyerNick: "Betinho3",
        shippingMethod: "Frete combinado com o vendedor",
        status: "Aguard. envio",
        orderUrl: "https://mypcards.com/pedido/654326",
      });
      expect(ordersAguard[1].orderId).toBe("654317");

      // Verify no PII leaked into parsed data
      const jsonStr = JSON.stringify(ordersAguard);
      expect(jsonStr).not.toContain("123.456.789-00");
      expect(jsonStr).not.toContain("Rua das Flores");

      // 2. With includeEmSeparacao = true, includes #654300 as well
      const ordersWithSeparacao = parseMypVendasHtml(sampleVendasHtml, {
        includeEmSeparacao: true,
      });
      expect(ordersWithSeparacao).toHaveLength(3);
      expect(ordersWithSeparacao.map((o) => o.orderId)).toEqual([
        "654326",
        "654317",
        "654300",
      ]);
    });
  });

  describe("parseMypOrderPageHtml", () => {
    it("parses /pedido/<id> extracting items, foil flag, condition and quantities while strictly ignoring buyer PII", () => {
      const samplePedidoHtml = `
        <div class="container pedido-view">
          <h1>Pedido #654326</h1>
          <div class="row">
            <div class="col-md-6 order-meta">
              <p>Data do pedido: 17/10/2026</p>
              <p>Status: <span class="badge">Aguard. envio</span></p>
              <p>Forma de envio: Frete combinado com o vendedor</p>
            </div>
            <div class="col-md-6 comprador-info">
              <h3>Comprador</h3>
              <p>Usuário: <a href="/usuario/Betinho3">Betinho3</a></p>
              <p>Nome Completo: Roberto Silva dos Santos</p>
              <p>CPF: 987.654.321-99</p>
              <p>Endereço: Av. Paulista, 1000 - Apto 42, Bela Vista, São Paulo - SP, 01310-100</p>
            </div>
          </div>

          <div class="itens-pedido">
            <h3>Itens do Pedido</h3>
            <table class="table table-bordered itens-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Qualidade</th>
                  <th>Idioma</th>
                  <th>Extras</th>
                  <th>Qtd</th>
                  <th>Valor Unitário</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <a href="/grandarchive/rdo_029/voids-cloak" class="item-link">Void's Cloak</a>
                    <span class="subtitulo text-muted">Radiant Origins - #029</span>
                  </td>
                  <td><span class="label-qualidade">NM</span></td>
                  <td>EN</td>
                  <td>-</td>
                  <td>1</td>
                  <td>R$ 7,00</td>
                  <td>R$ 7,00</td>
                </tr>
                <tr>
                  <td>
                    <a href="/grandarchive/doa_001/creative-shock" class="item-link">Creative Shock</a>
                    <span class="subtitulo text-muted">Dawn of Ashes - #001</span>
                  </td>
                  <td><span class="label-qualidade">SP</span></td>
                  <td>EN</td>
                  <td><span class="badge badge-warning">Foil</span></td>
                  <td>2</td>
                  <td>R$ 45,00</td>
                  <td>R$ 90,00</td>
                </tr>
                <tr>
                  <td>
                    <a href="/pokemon/sv1_001/bulbasaur" class="item-link">Bulbasaur</a>
                    <span class="subtitulo text-muted">Scarlet & Violet - #001</span>
                  </td>
                  <td><span class="label-qualidade">NM</span></td>
                  <td>PT</td>
                  <td>-</td>
                  <td>1</td>
                  <td>R$ 3,00</td>
                  <td>R$ 3,00</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;

      const order = parseMypOrderPageHtml(samplePedidoHtml, "654326");

      expect(order.orderId).toBe("654326");
      expect(order.orderDate).toBe("17/10/2026");
      expect(order.buyerNick).toBe("Betinho3");
      expect(order.shippingMethod).toBe("Frete combinado com o vendedor");
      expect(order.status).toBe("Aguard. envio");
      expect(order.orderUrl).toBe("https://mypcards.com/pedido/654326");

      expect(order.items).toHaveLength(3);

      // Item 1: Non-foil Grand Archive
      expect(order.items[0]).toEqual({
        rawTitle: "Void's Cloak",
        rawSubtitle: "Radiant Origins - #029",
        mypCode: "grandarchive_rdo_029",
        productUrl: "/grandarchive/rdo_029/voids-cloak",
        condition: "NM",
        language: "EN",
        isFoil: false,
        quantity: 1,
        unitPriceBrl: "R$ 7,00",
      });

      // Item 2: Foil Grand Archive with quantity 2
      expect(order.items[1]).toEqual({
        rawTitle: "Creative Shock",
        rawSubtitle: "Dawn of Ashes - #001",
        mypCode: "grandarchive_doa_001",
        productUrl: "/grandarchive/doa_001/creative-shock",
        condition: "SP",
        language: "EN",
        isFoil: true,
        quantity: 2,
        unitPriceBrl: "R$ 45,00",
      });

      // Item 3: Pokemon item
      expect(order.items[2]).toEqual({
        rawTitle: "Bulbasaur",
        rawSubtitle: "Scarlet & Violet - #001",
        mypCode: "pokemon_sv1_001",
        productUrl: "/pokemon/sv1_001/bulbasaur",
        condition: "NM",
        language: "PT",
        isFoil: false,
        quantity: 1,
        unitPriceBrl: "R$ 3,00",
      });

      // Strict check: verify buyer PII was never captured in output
      const json = JSON.stringify(order);
      expect(json).not.toContain("Roberto Silva dos Santos");
      expect(json).not.toContain("987.654.321-99");
      expect(json).not.toContain("Av. Paulista");
      expect(json).not.toContain("01310-100");
    });

    it("parses comprador-box, vendedor-box, and valores-box when present in order page HTML", () => {
      const orderHtml = `
        <div id="comprador-box" class="borda">
          <h2>Comprador</h2>
          <div class="view-field">
            <label>Nome e nick</label>
            <span class="pedido-nome-nick"><a href="/Dodoka">Brendo de Lima Ferreira (Dodoka)</a></span>
          </div>
          <div class="view-field comprador-cpfusuario">
            <label>CPF</label>
            180.031.157-52
          </div>
          <div class="view-field">
            <label>Endereço</label>
            Rua Dona Ana Neri, 721 - Ap 709
          </div>
          <div class="view-field">
            <label>Bairro</label>
            Cambuci
          </div>
          <div class="view-field">
            <label>Cidade - UF - CEP</label>
            São Paulo - SP - 01522-000
          </div>
        </div>

        <div id="vendedor-box" class="borda">
          <h2>Vendedor</h2>
          <div class="view-field">
            <label>Nome e nick</label>
            <span class="pedido-nome-nick"><a href="/Fabrino">Pedro Fabrino (Fabrino)</a></span>
          </div>
          <div class="view-field">
            <label>CPF</label>
            032.083.531-62
          </div>
          <div class="view-field">
            <label>Endereço</label>
            Rua 8, 11 - 901A
          </div>
          <div class="view-field">
            <label>Bairro</label>
            Sul (Águas Claras)
          </div>
          <div class="view-field">
            <label>Cidade - UF - CEP</label>
            Brasília - DF - 71938-180
          </div>
        </div>

        <div id="valores-box" class="sticky-container">
          <div class="carrinho-subtotal">
            <p>Subtotal <span class="label-destaque">(17 itens)</span>:</p>
            <p class="carrinho-subtotal-valor">R$ 51,50</p>
          </div>
          <div class="carrinho-subtotal">
            <p>Frete <span class="label-destaque">(Frete Fixo com rastreio)</span>:</p>
            <p class="carrinho-subtotal-valor">R$ 10,00</p>
          </div>
          <div class="carrinho-subtotal total">
            <p>Total:</p>
            <p class="carrinho-subtotal-valor">R$ 61,50</p>
          </div>
        </div>
      `;

      const order = parseMypOrderPageHtml(orderHtml, "653380");
      expect(order.buyer).toBeDefined();
      expect(order.buyer?.fullName).toBe("Brendo de Lima Ferreira");
      expect(order.buyer?.document).toBe("180.031.157-52");
      expect(order.buyer?.street).toBe("Rua Dona Ana Neri");
      expect(order.buyer?.number).toBe("721");
      expect(order.buyer?.complement).toBe("Ap 709");
      expect(order.buyer?.district).toBe("Cambuci");
      expect(order.buyer?.city).toBe("São Paulo");
      expect(order.buyer?.stateAbbr).toBe("SP");
      expect(order.buyer?.postalCode).toBe("01522000");

      expect(order.sender).toBeDefined();
      expect(order.sender?.fullName).toBe("Pedro Fabrino");
      expect(order.sender?.document).toBe("032.083.531-62");
      expect(order.sender?.street).toBe("Rua 8");
      expect(order.sender?.number).toBe("11");
      expect(order.sender?.complement).toBe("901A");
      expect(order.sender?.district).toBe("Sul (Águas Claras)");
      expect(order.sender?.city).toBe("Brasília");
      expect(order.sender?.stateAbbr).toBe("DF");
      expect(order.sender?.postalCode).toBe("71938180");

      expect(order.totals).toBeDefined();
      expect(order.totals?.subtotalCents).toBe(5150);
      expect(order.totals?.shippingCents).toBe(1000);
      expect(order.totals?.totalCents).toBe(6150);
    });

    it("parses CNPJ document in comprador-box correctly for corporate/MEI buyers", () => {
      const orderHtml = `
        <div id="comprador-box" class="borda">
          <h2>Comprador</h2>
          <div class="view-field">
            <label>Nome e nick</label>
            <span class="pedido-nome-nick">65.033.705 MARIA APARECIDA SOLDERA BIANCALANA (LOOTCARDS)</span>
          </div>
          <div class="view-field comprador-cpfusuario">
            <label>CNPJ</label>
            65.033.705/0001-99
          </div>
          <div class="view-field">
            <label>Endereço</label>
            Rua das Acácias, 100
          </div>
          <div class="view-field">
            <label>Bairro</label>
            Barão Geraldo
          </div>
          <div class="view-field">
            <label>Cidade - UF - CEP</label>
            Campinas - SP - 13084-776
          </div>
        </div>
      `;

      const order = parseMypOrderPageHtml(orderHtml, "777888");
      expect(order.buyer).toBeDefined();
      expect(order.buyer?.fullName).toBe("65.033.705 MARIA APARECIDA SOLDERA BIANCALANA");
      expect(order.buyer?.document).toBe("65.033.705/0001-99");
      expect(order.buyer?.city).toBe("Campinas");
      expect(order.buyer?.stateAbbr).toBe("SP");
      expect(order.buyer?.postalCode).toBe("13084776");
    });
  });
});
