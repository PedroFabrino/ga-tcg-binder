import { describe, it, expect } from "vitest";
import { formatFulfillmentTextReport } from "../fulfillment-helpers";
import { FulfillmentReport } from "@ga/contracts";

describe("Userscript Fulfillment Helpers", () => {
  it("formats a clean clipboard-ready text report with element pick list and buyer packs", () => {
    const mockReport: FulfillmentReport = {
      generatedAt: 1234567890,
      totalGrandArchiveOrders: 2,
      totalGrandArchiveCopies: 3,
      pickListByElement: {
        Norm: [
          {
            itemKey: "norm_item",
            cardSlug: "voids-cloak",
            cardName: "Void's Cloak",
            element: "Norm",
            setPrefix: "RDO",
            collectorNumber: "029",
            rarity: 1,
            imageUrl: null,
            condition: "NM",
            isFoil: false,
            totalQuantity: 1,
            orderReferences: [{ orderId: "654326", buyerNick: "Betinho3", quantity: 1 }],
          },
        ],
        Water: [
          {
            itemKey: "water_item",
            cardSlug: "creative-shock",
            cardName: "Creative Shock",
            element: "Water",
            setPrefix: "DOA",
            collectorNumber: "001",
            rarity: 2,
            imageUrl: null,
            condition: "NM",
            isFoil: true,
            totalQuantity: 2,
            orderReferences: [{ orderId: "654317", buyerNick: "Betinho3", quantity: 2 }],
          },
        ],
      },
      buyerPacks: [
        {
          buyerNick: "Betinho3",
          totalOrders: 2,
          totalItems: 3,
          shippingMethods: ["Frete combinado com o vendedor", "PAC"],
          primaryShippingMethod: "PAC",
          orders: [
            {
              orderId: "654317",
              orderDate: "16/10/2026",
              shippingMethod: "PAC",
              status: "Aguard. envio",
              orderUrl: "https://mypcards.com/pedido/654317",
              items: [
                {
                  itemKey: "water_item",
                  isGrandArchive: true,
                  cardSlug: "creative-shock",
                  cardName: "Creative Shock",
                  element: "Water",
                  setPrefix: "DOA",
                  collectorNumber: "001",
                  rarity: 2,
                  imageUrl: null,
                  condition: "NM",
                  isFoil: true,
                  quantity: 2,
                  unitPriceBrl: "R$ 40,00",
                  mypCode: "grandarchive_doa_001",
                },
              ],
            },
            {
              orderId: "654326",
              orderDate: "17/10/2026",
              shippingMethod: "Frete combinado com o vendedor",
              status: "Aguard. envio",
              orderUrl: "https://mypcards.com/pedido/654326",
              items: [
                {
                  itemKey: "norm_item",
                  isGrandArchive: true,
                  cardSlug: "voids-cloak",
                  cardName: "Void's Cloak",
                  element: "Norm",
                  setPrefix: "RDO",
                  collectorNumber: "029",
                  rarity: 1,
                  imageUrl: null,
                  condition: "NM",
                  isFoil: false,
                  quantity: 1,
                  unitPriceBrl: "R$ 7,00",
                  mypCode: "grandarchive_rdo_029",
                },
              ],
            },
          ],
        },
      ],
      nonGrandArchiveOrders: [
        {
          orderId: "654999",
          orderDate: "14/10/2026",
          buyerNick: "PokeCollector",
          orderUrl: "https://mypcards.com/pedido/654999",
          detectedTcg: "pokemon",
          itemCount: 1,
        },
      ],
    };

    const text = formatFulfillmentTextReport(mockReport);
    expect(text).toContain("=== GRAND ARCHIVE TCG - PICK LIST (POR ELEMENTO) ===");
    expect(text).toContain("[NORM] (1 cartas):");
    expect(text).toContain("Void's Cloak [RDO #029 · NM] x1 (Pedidos: #654326 (x1))");
    expect(text).toContain("[WATER] (2 cartas):");
    expect(text).toContain("Creative Shock [DOA #001 · NM] [FOIL] x2");
    expect(text).toContain("=== PEDIDOS DE OUTROS TCGS ===");
    expect(text).toContain("Pedido #654999 (PokeCollector) - POKEMON (1 itens)");
    expect(text).toContain("=== BUYER PACKS (POR COMPRADOR E PEDIDO) ===");
    expect(text).toContain("👤 Betinho3 — 2 pedido(s) · Envio: PAC [ENVIAR JUNTOS]");
    expect(text).toContain("Pedido #654317 (PAC):");
    expect(text).toContain("Pedido #654326 (Frete combinado com o vendedor):");
  });
});
