import { describe, expect, it } from "vitest";

import {
  formatMarketNotificationChunks,
  formatMarketNotificationMessage,
  ROOT_MESSAGE_MAX_LENGTH,
} from "../../../../src/services/market-notification-formatter";
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

  it("returns empty string when notifications list is empty", () => {
    expect(formatMarketNotificationMessage([], "Brandao Card Game")).toBe("");
  });

  it("formats single non-foil card with collector number correctly", () => {
    const fixedDate = new Date(2026, 9, 21); // 21/10/2026 in local time
    const expectedDateStr = fixedDate.toLocaleDateString("pt-BR");
    const result = formatMarketNotificationMessage(
      [baseNotification],
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

    expect(result).toContain("• Flame-Rune Swordsman — FTC 136 (Foil) — R$ 45,00");
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
    expect(lines[2]).toContain("• Card A");
    expect(lines[3]).toContain("• Card B");
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

    expect(result).toContain("• Flame-Rune Swordsman — FTC — R$ 15,00");
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
    const fixedDate = new Date(2026, 9, 21);
    const expectedDateStr = fixedDate.toLocaleDateString("pt-BR");
    const chunks = formatMarketNotificationChunks(
      [baseNotification],
      "Brandao Card Game",
      fixedDate
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0].notificationIds).toEqual(["notif-1"]);
    expect(chunks[0].content).toBe(
      `**Brandao Card Game** updated their stock!\n` +
      `New cards since ${expectedDateStr}:\n` +
      `• Flame-Rune Swordsman — FTC 136 — R$ 15,00`
    );
  });

  it("splits large batches into chunks without exceeding ROOT_MESSAGE_MAX_LENGTH", () => {
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
      expect(chunk.content.length).toBeLessThanOrEqual(ROOT_MESSAGE_MAX_LENGTH);
    }

    // Verify every single notification is accounted for across chunks exactly once
    const allIds = chunks.flatMap((c) => c.notificationIds);
    expect(allIds).toHaveLength(100);
    expect(new Set(allIds).size).toBe(100);

    // First chunk has store header
    expect(chunks[0].content).toContain("**Lootcards** updated their stock!");
    // Subsequent chunks start directly with card lines
    expect(chunks[1].content).toMatch(/^• Test Card Name/);
  });
});
