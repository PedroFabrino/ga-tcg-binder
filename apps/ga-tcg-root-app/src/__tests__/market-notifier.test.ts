import { describe, expect, it } from "vitest";

import {
  formatMarketNotificationChunks,
  formatMarketNotificationDate,
  formatMarketNotificationMessage,
} from "../../../../src/services/market-notification-message";
import { MESSAGE_MAX_LENGTH } from "../../../../src/lib/market-vocabulary";
import type { MarketNotification } from "../../../../src/db/schema";

describe("formatMarketNotificationMessage", () => {
  const baseNotification: MarketNotification = {
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

  it("formats date and time in Brazil standard time (America/Sao_Paulo)", () => {
    // 2026-10-21 21:45 UTC is 18:45 in America/Sao_Paulo (UTC-3)
    const utcDate = new Date("2026-10-21T21:45:00.000Z");
    expect(formatMarketNotificationDate(utcDate)).toBe("21/10/2026 18:45");
  });

  it("returns empty string when notifications list is empty", () => {
    expect(formatMarketNotificationMessage([], "Brandao Card Game")).toBe("");
  });

  it("formats single non-foil card with collector number and hyperlink correctly", () => {
    const fixedDate = new Date("2026-10-21T21:45:00.000Z");
    const expectedDateStr = formatMarketNotificationDate(fixedDate);
    const result = formatMarketNotificationMessage(
      [baseNotification],
      "Brandao Card Game",
      fixedDate,
      "https://brandaocardgame.com.br"
    );

    expect(result).toBe(
      `**[Brandao Card Game](<https://brandaocardgame.com.br>)** updated their stock!\n` +
      `New cards since ${expectedDateStr}:\n` +
      `• [Flame-Rune Swordsman](<https://example.com/card.jpg>) — FTC 136 — R$ 15,00`
    );
  });

  it("falls back to plain text when imageUrl and storeUrl are not provided", () => {
    const fixedDate = new Date("2026-10-21T21:45:00.000Z");
    const expectedDateStr = formatMarketNotificationDate(fixedDate);
    const noUrlNotification: MarketNotification = {
      ...baseNotification,
      imageUrl: null,
    };
    const result = formatMarketNotificationMessage(
      [noUrlNotification],
      "Brandao Card Game",
      fixedDate
    );

    expect(result).toBe(
      `**Brandao Card Game** updated their stock!\n` +
      `New cards since ${expectedDateStr}:\n` +
      `• Flame-Rune Swordsman — FTC 136 — R$ 15,00`
    );
  });

  it("includes (Foil) when isFoil is true", () => {
    const foilNotification: MarketNotification = {
      ...baseNotification,
      id: "notif-foil",
      isFoil: true,
      price: "R$ 45,00",
    };

    const result = formatMarketNotificationMessage(
      [foilNotification],
      "Brandao Card Game",
      "21/10/2026"
    );

    expect(result).toContain("• [Flame-Rune Swordsman](<https://example.com/card.jpg>) — FTC 136 (Foil) — R$ 45,00");
  });

  it("formats multiple cards in detectedAt order as a bullet list", () => {
    const card1: MarketNotification = {
      ...baseNotification,
      id: "c1",
      cardName: "Card A",
      detectedAt: new Date("2026-10-21T01:00:00Z"),
    };
    const card2: MarketNotification = {
      ...baseNotification,
      id: "c2",
      cardName: "Card B",
      detectedAt: new Date("2026-10-21T02:00:00Z"),
    };

    const result = formatMarketNotificationMessage(
      [card2, card1], // intentionally reversed order
      "Test Store",
      "21/10/2026"
    );

    const lines = result.split("\n");
    expect(lines[0]).toBe("**Test Store** updated their stock!");
    expect(lines[1]).toBe("New cards since 21/10/2026:");
    expect(lines[2]).toContain("• [Card A](<https://example.com/card.jpg>)");
    expect(lines[3]).toContain("• [Card B](<https://example.com/card.jpg>)");
  });

  it("handles notification without collector number gracefully", () => {
    const noCollector: MarketNotification = {
      ...baseNotification,
      collectorNumber: "",
    };

    const result = formatMarketNotificationMessage(
      [noCollector],
      "Brandao Card Game",
      "21/10/2026"
    );

    expect(result).toContain("• [Flame-Rune Swordsman](<https://example.com/card.jpg>) — FTC — R$ 15,00");
  });
});

describe("formatMarketNotificationChunks", () => {
  const baseNotification: MarketNotification = {
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

  it("returns empty array for empty notifications", () => {
    expect(formatMarketNotificationChunks([], "Brandao Card Game")).toEqual([]);
  });

  it("returns a single chunk when under the max length, tracking notification ids", () => {
    const fixedDate = new Date("2026-10-21T21:45:00.000Z");
    const expectedDateStr = formatMarketNotificationDate(fixedDate);
    const chunks = formatMarketNotificationChunks(
      [baseNotification],
      "Brandao Card Game",
      fixedDate,
      undefined,
      "https://brandaocardgame.com.br"
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0].notificationIds).toEqual(["notif-1"]);
    expect(chunks[0].content).toBe(
      `**[Brandao Card Game](<https://brandaocardgame.com.br>)** updated their stock!\n` +
      `New cards since ${expectedDateStr}:\n` +
      `• [Flame-Rune Swordsman](<https://example.com/card.jpg>) — FTC 136 — R$ 15,00`
    );
  });

  it("splits large batches into chunks without exceeding MESSAGE_MAX_LENGTH", () => {
    // Generate 100 notifications (~5,000 characters)
    const notifications: MarketNotification[] = Array.from({ length: 100 }, (_, i) => ({
      ...baseNotification,
      id: `notif-${i}`,
      cardName: `Test Card Name ${i}`,
      detectedAt: new Date(Date.now() + i * 1000),
    }));

    const chunks = formatMarketNotificationChunks(
      notifications,
      "Lootcards",
      new Date("2026-10-21")
    );

    expect(chunks.length).toBeGreaterThan(1);

    // Verify all chunks respect character limit
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(MESSAGE_MAX_LENGTH);
    }

    // Verify every single notification is accounted for across chunks exactly once
    const allIds = chunks.flatMap((c) => c.notificationIds);
    expect(allIds).toHaveLength(100);
    expect(new Set(allIds).size).toBe(100);

    // First chunk has store header
    expect(chunks[0].content).toContain("**Lootcards** updated their stock!");
    // Subsequent chunks start directly with card lines (hyperlinked)
    expect(chunks[1].content).toMatch(/^• \[Test Card Name/);
  });
});
