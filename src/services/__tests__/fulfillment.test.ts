import { describe, it, expect } from "vitest";
import { createTestDb } from "@/db/test-utils";
import { cards, cardEditions } from "@/db/schema";
import { buildFulfillmentReport } from "../fulfillment";
import { RawMypFulfillmentOrderInput } from "@ga/contracts";

describe("Fulfillment Service Boundary", () => {
  it("resolves catalog printings, sums identical finishes, isolates non-GA orders and groups buyer packs", async () => {
    const { db } = await createTestDb();

    // 1. Seed catalog
    await db.insert(cards).values([
      {
        slug: "voids-cloak",
        name: "Void's Cloak",
        element: "NORM",
        class: "ASSASSIN",
        type: "ITEM",
        subtypes: "[]",
        effect: null,
      },
      {
        slug: "creative-shock",
        name: "Creative Shock",
        element: "WATER",
        class: "MAGE",
        type: "ACTION",
        subtypes: "[]",
        effect: null,
      },
      {
        slug: "flame-burst",
        name: "Flame Burst",
        element: "FIRE",
        class: "MAGE",
        type: "ACTION",
        subtypes: "[]",
        effect: null,
      },
    ]);

    await db.insert(cardEditions).values([
      {
        id: "ed-void",
        cardSlug: "voids-cloak",
        setPrefix: "RDO",
        setName: "Radiant Origins",
        collectorNumber: "029",
        rarity: 1,
        imageUrl: "https://api.gatcg.com/cards/images/rdo_029.jpg",
      },
      {
        id: "ed-shock-doa",
        cardSlug: "creative-shock",
        setPrefix: "DOA",
        setName: "Dawn of Ashes",
        collectorNumber: "001",
        rarity: 2,
        imageUrl: "https://api.gatcg.com/cards/images/doa_001.jpg",
      },
      {
        id: "ed-shock-alc",
        cardSlug: "creative-shock",
        setPrefix: "ALC",
        setName: "Abyssal Caves",
        collectorNumber: "042",
        rarity: 2,
        imageUrl: "https://api.gatcg.com/cards/images/alc_042.jpg",
      },
      {
        id: "ed-flame",
        cardSlug: "flame-burst",
        setPrefix: "DOA",
        setName: "Dawn of Ashes",
        collectorNumber: "010",
        rarity: 1,
        imageUrl: "https://api.gatcg.com/cards/images/doa_010.jpg",
      },
    ]);

    // 2. Define test orders
    const testOrders: RawMypFulfillmentOrderInput[] = [
      {
        orderId: "654326",
        orderDate: "17/10/2026",
        buyerNick: "Betinho3",
        shippingMethod: "Frete combinado com o vendedor",
        status: "Aguard. envio",
        orderUrl: "https://mypcards.com/pedido/654326",
        items: [
          {
            rawTitle: "Void's Cloak",
            rawSubtitle: "Radiant Origins - #029",
            mypCode: "grandarchive_rdo_029",
            condition: "NM",
            language: "EN",
            isFoil: false,
            quantity: 1,
            unitPriceBrl: "R$ 7,00",
          },
          {
            rawTitle: "Creative Shock",
            rawSubtitle: "Dawn of Ashes - #001",
            mypCode: "grandarchive_doa_001",
            condition: "NM",
            language: "EN",
            isFoil: false,
            quantity: 2,
            unitPriceBrl: "R$ 15,00",
          },
        ],
      },
      {
        orderId: "654317",
        orderDate: "16/10/2026",
        buyerNick: "Betinho3",
        shippingMethod: "PAC",
        status: "Aguard. envio",
        orderUrl: "https://mypcards.com/pedido/654317",
        items: [
          {
            rawTitle: "Creative Shock",
            rawSubtitle: "Dawn of Ashes - #001",
            mypCode: "grandarchive_doa_001",
            condition: "NM",
            language: "EN",
            isFoil: false,
            quantity: 1,
            unitPriceBrl: "R$ 15,00",
          },
          {
            rawTitle: "Creative Shock",
            rawSubtitle: "Abyssal Caves - #042",
            mypCode: "grandarchive_alc_042",
            condition: "NM",
            language: "EN",
            isFoil: true,
            quantity: 1,
            unitPriceBrl: "R$ 40,00",
          },
        ],
      },
      {
        orderId: "654300",
        orderDate: "15/10/2026",
        buyerNick: "LOOTCARDS",
        shippingMethod: "Frete Fixo com rastreio",
        status: "Em separação",
        orderUrl: "https://mypcards.com/pedido/654300",
        items: [
          {
            rawTitle: "Flame Burst",
            rawSubtitle: "Dawn of Ashes - #010",
            mypCode: "grandarchive_doa_010",
            condition: "SP",
            language: "EN",
            isFoil: false,
            quantity: 3,
            unitPriceBrl: "R$ 5,00",
          },
          {
            rawTitle: "Unrecognized Grand Archive Promo",
            mypCode: "grandarchive_p24_999",
            condition: "NM",
            language: "EN",
            isFoil: false,
            quantity: 1,
            unitPriceBrl: "R$ 20,00",
          },
        ],
      },
      {
        orderId: "654999",
        orderDate: "14/10/2026",
        buyerNick: "PokemonPlayer",
        shippingMethod: "PAC",
        status: "Aguard. envio",
        orderUrl: "https://mypcards.com/pedido/654999",
        items: [
          {
            rawTitle: "Bulbasaur",
            mypCode: "pokemon_sv1_001",
            condition: "NM",
            language: "PT",
            isFoil: false,
            quantity: 2,
            unitPriceBrl: "R$ 3,00",
          },
        ],
      },
    ];

    // 3. Execute fulfillment report generation
    const report = await buildFulfillmentReport(testOrders, db);

    // 4. Verify totals and non-GA detection
    expect(report.totalGrandArchiveOrders).toBe(3);
    expect(report.totalGrandArchiveCopies).toBe(9); // 1 + 2 + 1 + 1 + 3 + 1
    expect(report.nonGrandArchiveOrders).toHaveLength(1);
    expect(report.nonGrandArchiveOrders[0]).toEqual({
      orderId: "654999",
      orderDate: "14/10/2026",
      buyerNick: "PokemonPlayer",
      orderUrl: "https://mypcards.com/pedido/654999",
      detectedTcg: "pokemon",
      itemCount: 1,
    });

    // 5. Verify Pick List by Element
    // Norm
    const normEntries = report.pickListByElement["Norm"];
    expect(normEntries).toHaveLength(1);
    expect(normEntries[0].cardName).toBe("Void's Cloak");
    expect(normEntries[0].setPrefix).toBe("RDO");
    expect(normEntries[0].collectorNumber).toBe("029");
    expect(normEntries[0].totalQuantity).toBe(1);
    expect(normEntries[0].orderReferences).toEqual([
      { orderId: "654326", buyerNick: "Betinho3", quantity: 1 },
    ]);

    // Water: Creative Shock DOA non-foil (qty 3) and ALC foil (qty 1)
    const waterEntries = report.pickListByElement["Water"];
    expect(waterEntries).toHaveLength(2);

    const doaNonFoil = waterEntries.find(
      (e) => e.setPrefix === "DOA" && !e.isFoil
    );
    expect(doaNonFoil).toBeDefined();
    expect(doaNonFoil!.totalQuantity).toBe(3); // Summed 2 from #654326 and 1 from #654317!
    expect(doaNonFoil!.orderReferences).toEqual([
      { orderId: "654326", buyerNick: "Betinho3", quantity: 2 },
      { orderId: "654317", buyerNick: "Betinho3", quantity: 1 },
    ]);

    const alcFoil = waterEntries.find((e) => e.setPrefix === "ALC" && e.isFoil);
    expect(alcFoil).toBeDefined();
    expect(alcFoil!.totalQuantity).toBe(1);
    expect(alcFoil!.isFoil).toBe(true);

    // Fire
    const fireEntries = report.pickListByElement["Fire"];
    expect(fireEntries).toHaveLength(1);
    expect(fireEntries[0].cardName).toBe("Flame Burst");
    expect(fireEntries[0].condition).toBe("SP");
    expect(fireEntries[0].totalQuantity).toBe(3);

    // UNMATCHED bucket
    const unmatchedEntries = report.pickListByElement["UNMATCHED"];
    expect(unmatchedEntries).toHaveLength(1);
    expect(unmatchedEntries[0].cardName).toBe("Unrecognized Grand Archive Promo");
    expect(unmatchedEntries[0].totalQuantity).toBe(1);

    // 6. Verify Buyer Packs
    expect(report.buyerPacks).toHaveLength(2); // Betinho3 and LOOTCARDS

    // Betinho3 should be first (2 orders)
    const betinhoGroup = report.buyerPacks.find((b) => b.buyerNick === "Betinho3");
    expect(betinhoGroup).toBeDefined();
    expect(betinhoGroup!.totalOrders).toBe(2);
    expect(betinhoGroup!.totalItems).toBe(5); // 1 Void + 2 Shock + 1 Shock + 1 Shock Foil
    expect(betinhoGroup!.primaryShippingMethod).toBe("PAC"); // Prioritized PAC over Frete combinado!
    expect(betinhoGroup!.orders).toHaveLength(2);
    expect(betinhoGroup!.orders.map((o) => o.orderId).sort()).toEqual([
      "654317",
      "654326",
    ]);

    // LOOTCARDS
    const lootGroup = report.buyerPacks.find((b) => b.buyerNick === "LOOTCARDS");
    expect(lootGroup).toBeDefined();
    expect(lootGroup!.totalOrders).toBe(1);
    expect(lootGroup!.primaryShippingMethod).toBe("Frete Fixo com rastreio");
  });

  it("handles mixed Grand Archive and non-GA orders by including GA items in pick list and flagging in nonGrandArchiveOrders", async () => {
    const { db } = await createTestDb();

    await db.insert(cards).values([
      {
        slug: "voids-cloak",
        name: "Void's Cloak",
        element: "NORM",
        class: "ASSASSIN",
        type: "ITEM",
        subtypes: "[]",
        effect: null,
      },
    ]);

    await db.insert(cardEditions).values([
      {
        id: "ed-void",
        cardSlug: "voids-cloak",
        setPrefix: "RDO",
        setName: "Radiant Origins",
        collectorNumber: "029",
        rarity: 1,
        imageUrl: "https://api.gatcg.com/cards/images/rdo_029.jpg",
      },
    ]);

    const mixedOrders: RawMypFulfillmentOrderInput[] = [
      {
        orderId: "777001",
        orderDate: "18/10/2026",
        buyerNick: "MixedCollector",
        shippingMethod: "PAC",
        status: "Aguard. envio",
        orderUrl: "https://mypcards.com/pedido/777001",
        items: [
          {
            rawTitle: "Void's Cloak",
            mypCode: "grandarchive_rdo_029",
            condition: "NM",
            language: "EN",
            isFoil: false,
            quantity: 2,
            unitPriceBrl: "R$ 10,00",
          },
          {
            rawTitle: "Charizard ex",
            mypCode: "pokemon_sv3_125",
            condition: "NM",
            language: "EN",
            isFoil: true,
            quantity: 1,
            unitPriceBrl: "R$ 150,00",
          },
        ],
      },
    ];

    const fixedTime = 1770000000000;
    const report = await buildFulfillmentReport(mixedOrders, db, fixedTime);

    expect(report.generatedAt).toBe(1770000000);
    expect(report.totalGrandArchiveOrders).toBe(1);
    expect(report.totalGrandArchiveCopies).toBe(2);

    // GA items are in the pick list
    expect(report.pickListByElement["Norm"]).toHaveLength(1);
    expect(report.pickListByElement["Norm"][0].totalQuantity).toBe(2);

    // Non-GA items are flagged in nonGrandArchiveOrders notice
    expect(report.nonGrandArchiveOrders).toHaveLength(1);
    expect(report.nonGrandArchiveOrders[0]).toEqual({
      orderId: "777001",
      orderDate: "18/10/2026",
      buyerNick: "MixedCollector",
      orderUrl: "https://mypcards.com/pedido/777001",
      detectedTcg: "pokemon",
      itemCount: 1,
    });

    // Buyer pack has the GA items
    expect(report.buyerPacks).toHaveLength(1);
    expect(report.buyerPacks[0].orders[0].items).toHaveLength(1);
    expect(report.buyerPacks[0].orders[0].items[0].cardName).toBe("Void's Cloak");
  });
});
