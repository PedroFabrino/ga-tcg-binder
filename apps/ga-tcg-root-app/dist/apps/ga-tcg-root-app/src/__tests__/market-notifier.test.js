"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const market_notification_message_1 = require("../../../../src/services/market-notification-message");
const market_vocabulary_1 = require("../../../../src/lib/market-vocabulary");
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
    (0, vitest_1.it)("formats date and time in Brazil standard time (America/Sao_Paulo)", () => {
        // 2026-10-21 21:45 UTC is 18:45 in America/Sao_Paulo (UTC-3)
        const utcDate = new Date("2026-10-21T21:45:00.000Z");
        (0, vitest_1.expect)((0, market_notification_message_1.formatMarketNotificationDate)(utcDate)).toBe("21/10/2026 18:45");
    });
    (0, vitest_1.it)("returns empty string when notifications list is empty", () => {
        (0, vitest_1.expect)((0, market_notification_message_1.formatMarketNotificationMessage)([], "Brandao Card Game")).toBe("");
    });
    (0, vitest_1.it)("formats single non-foil card with collector number and hyperlink correctly", () => {
        const fixedDate = new Date("2026-10-21T21:45:00.000Z");
        const expectedDateStr = (0, market_notification_message_1.formatMarketNotificationDate)(fixedDate);
        const result = (0, market_notification_message_1.formatMarketNotificationMessage)([baseNotification], "Brandao Card Game", fixedDate, "https://brandaocardgame.com.br");
        (0, vitest_1.expect)(result).toBe(`**[Brandao Card Game](<https://brandaocardgame.com.br>)** updated their stock!\n` +
            `New cards since ${expectedDateStr}:\n` +
            `• [Flame-Rune Swordsman](<https://example.com/card.jpg>) — FTC 136 — R$ 15,00`);
    });
    (0, vitest_1.it)("falls back to plain text when imageUrl and storeUrl are not provided", () => {
        const fixedDate = new Date("2026-10-21T21:45:00.000Z");
        const expectedDateStr = (0, market_notification_message_1.formatMarketNotificationDate)(fixedDate);
        const noUrlNotification = {
            ...baseNotification,
            imageUrl: null,
        };
        const result = (0, market_notification_message_1.formatMarketNotificationMessage)([noUrlNotification], "Brandao Card Game", fixedDate);
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
        const result = (0, market_notification_message_1.formatMarketNotificationMessage)([foilNotification], "Brandao Card Game", "21/10/2026");
        (0, vitest_1.expect)(result).toContain("• [Flame-Rune Swordsman](<https://example.com/card.jpg>) — FTC 136 (Foil) — R$ 45,00");
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
        const result = (0, market_notification_message_1.formatMarketNotificationMessage)([card2, card1], // intentionally reversed order
        "Test Store", "21/10/2026");
        const lines = result.split("\n");
        (0, vitest_1.expect)(lines[0]).toBe("**Test Store** updated their stock!");
        (0, vitest_1.expect)(lines[1]).toBe("New cards since 21/10/2026:");
        (0, vitest_1.expect)(lines[2]).toContain("• [Card A](<https://example.com/card.jpg>)");
        (0, vitest_1.expect)(lines[3]).toContain("• [Card B](<https://example.com/card.jpg>)");
    });
    (0, vitest_1.it)("handles notification without collector number gracefully", () => {
        const noCollector = {
            ...baseNotification,
            collectorNumber: "",
        };
        const result = (0, market_notification_message_1.formatMarketNotificationMessage)([noCollector], "Brandao Card Game", "21/10/2026");
        (0, vitest_1.expect)(result).toContain("• [Flame-Rune Swordsman](<https://example.com/card.jpg>) — FTC — R$ 15,00");
    });
});
(0, vitest_1.describe)("formatMarketNotificationChunks", () => {
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
    (0, vitest_1.it)("returns empty array for empty notifications", () => {
        (0, vitest_1.expect)((0, market_notification_message_1.formatMarketNotificationChunks)([], "Brandao Card Game")).toEqual([]);
    });
    (0, vitest_1.it)("returns a single chunk when under the max length, tracking notification ids", () => {
        const fixedDate = new Date("2026-10-21T21:45:00.000Z");
        const expectedDateStr = (0, market_notification_message_1.formatMarketNotificationDate)(fixedDate);
        const chunks = (0, market_notification_message_1.formatMarketNotificationChunks)([baseNotification], "Brandao Card Game", fixedDate, undefined, "https://brandaocardgame.com.br");
        (0, vitest_1.expect)(chunks).toHaveLength(1);
        (0, vitest_1.expect)(chunks[0].notificationIds).toEqual(["notif-1"]);
        (0, vitest_1.expect)(chunks[0].content).toBe(`**[Brandao Card Game](<https://brandaocardgame.com.br>)** updated their stock!\n` +
            `New cards since ${expectedDateStr}:\n` +
            `• [Flame-Rune Swordsman](<https://example.com/card.jpg>) — FTC 136 — R$ 15,00`);
    });
    (0, vitest_1.it)("splits large batches into chunks without exceeding MESSAGE_MAX_LENGTH", () => {
        // Generate 100 notifications (~5,000 characters)
        const notifications = Array.from({ length: 100 }, (_, i) => ({
            ...baseNotification,
            id: `notif-${i}`,
            cardName: `Test Card Name ${i}`,
            detectedAt: new Date(Date.now() + i * 1000),
        }));
        const chunks = (0, market_notification_message_1.formatMarketNotificationChunks)(notifications, "Lootcards", new Date("2026-10-21"));
        (0, vitest_1.expect)(chunks.length).toBeGreaterThan(1);
        // Verify all chunks respect character limit
        for (const chunk of chunks) {
            (0, vitest_1.expect)(chunk.content.length).toBeLessThanOrEqual(market_vocabulary_1.MESSAGE_MAX_LENGTH);
        }
        // Verify every single notification is accounted for across chunks exactly once
        const allIds = chunks.flatMap((c) => c.notificationIds);
        (0, vitest_1.expect)(allIds).toHaveLength(100);
        (0, vitest_1.expect)(new Set(allIds).size).toBe(100);
        // First chunk has store header
        (0, vitest_1.expect)(chunks[0].content).toContain("**Lootcards** updated their stock!");
        // Subsequent chunks start directly with card lines (hyperlinked)
        (0, vitest_1.expect)(chunks[1].content).toMatch(/^• \[Test Card Name/);
    });
});
