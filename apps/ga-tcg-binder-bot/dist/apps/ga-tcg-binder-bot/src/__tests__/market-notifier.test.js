"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const market_notification_formatter_1 = require("../../../../src/services/market-notification-formatter");
(0, vitest_1.describe)("formatMarketNotificationMessage", () => {
    const baseNotification = {
        id: "notif-1",
        storeId: "brandao",
        cardName: "Flame-Rune Swordsman",
        setPrefix: "FTC",
        collectorNumber: "136",
        isFoil: false,
        price: "R$ 15,00",
        refId: "ref_136",
        imageUrl: "https://example.com/card.jpg",
        detectedAt: new Date("2026-10-21T02:00:00Z"),
        sentAt: null,
        messageId: null,
        createdAt: new Date("2026-10-21T02:00:00Z"),
    };
    (0, vitest_1.it)("returns empty string when notifications list is empty", () => {
        (0, vitest_1.expect)((0, market_notification_formatter_1.formatMarketNotificationMessage)([], "Brandao Card Game")).toBe("");
    });
    (0, vitest_1.it)("formats single non-foil card with collector number correctly", () => {
        const fixedDate = new Date(2026, 9, 21); // 21/10/2026 in local time
        const expectedDateStr = fixedDate.toLocaleDateString("pt-BR");
        const result = (0, market_notification_formatter_1.formatMarketNotificationMessage)([baseNotification], "Brandao Card Game", fixedDate);
        (0, vitest_1.expect)(result).toBe(`**Brandao Card Game** updated their stock!\n` +
            `New cards since ${expectedDateStr}:\n` +
            `• Flame-Rune Swordsman — FTC 136 — R$ 15,00`);
    });
    (0, vitest_1.it)("includes (Foil) when isFoil is true", () => {
        const foilNotification = {
            ...baseNotification,
            id: "notif-foil",
            isFoil: true,
            price: "R$ 45,00",
        };
        const result = (0, market_notification_formatter_1.formatMarketNotificationMessage)([foilNotification], "Brandao Card Game", "21/10/2026");
        (0, vitest_1.expect)(result).toContain("• Flame-Rune Swordsman — FTC 136 (Foil) — R$ 45,00");
    });
    (0, vitest_1.it)("formats multiple cards in detectedAt order as a bullet list", () => {
        const card1 = {
            ...baseNotification,
            id: "c1",
            cardName: "Card A",
            detectedAt: new Date("2026-10-21T01:00:00Z"),
        };
        const card2 = {
            ...baseNotification,
            id: "c2",
            cardName: "Card B",
            detectedAt: new Date("2026-10-21T02:00:00Z"),
        };
        const result = (0, market_notification_formatter_1.formatMarketNotificationMessage)([card2, card1], // intentionally reversed order
        "Test Store", "21/10/2026");
        const lines = result.split("\n");
        (0, vitest_1.expect)(lines[0]).toBe("**Test Store** updated their stock!");
        (0, vitest_1.expect)(lines[1]).toBe("New cards since 21/10/2026:");
        (0, vitest_1.expect)(lines[2]).toContain("• Card A");
        (0, vitest_1.expect)(lines[3]).toContain("• Card B");
    });
    (0, vitest_1.it)("handles notification without collector number gracefully", () => {
        const noCollector = {
            ...baseNotification,
            collectorNumber: "",
        };
        const result = (0, market_notification_formatter_1.formatMarketNotificationMessage)([noCollector], "Brandao Card Game", "21/10/2026");
        (0, vitest_1.expect)(result).toContain("• Flame-Rune Swordsman — FTC — R$ 15,00");
    });
});
