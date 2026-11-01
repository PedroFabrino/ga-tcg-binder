import { describe, expect, it } from "vitest";
import {
  prepareReorderPayload,
  computeMoveWithinSection,
  computeMoveToOtherSection,
  type DeckItem,
} from "../use-deck-ordering";

describe("use-deck-ordering logic and transitions", () => {
  const sampleDecks: DeckItem[] = [
    { id: "c1", section: "competitive", priority: 0 },
    { id: "c2", section: "competitive", priority: 1 },
    { id: "f1", section: "4fun", priority: 0 },
    { id: "f2", section: "4fun", priority: 1 },
    { id: "f3", section: "4fun", priority: 2 },
  ];

  describe("prepareReorderPayload", () => {
    it("numbers priorities sequentially starting at 0 within each section", () => {
      const items = prepareReorderPayload(sampleDecks);
      expect(items).toEqual([
        { id: "c1", section: "competitive", priority: 0 },
        { id: "c2", section: "competitive", priority: 1 },
        { id: "f1", section: "4fun", priority: 0 },
        { id: "f2", section: "4fun", priority: 1 },
        { id: "f3", section: "4fun", priority: 2 },
      ]);
    });
  });

  describe("computeMoveWithinSection", () => {
    it("moves a deck up within competitive section", () => {
      const result = computeMoveWithinSection(sampleDecks, "c2", "up");
      expect(result).not.toBeNull();
      const ids = result!.map((d) => d.id);
      expect(ids).toEqual(["c2", "c1", "f1", "f2", "f3"]);
    });

    it("moves a deck down within competitive section", () => {
      const result = computeMoveWithinSection(sampleDecks, "c1", "down");
      expect(result).not.toBeNull();
      const ids = result!.map((d) => d.id);
      expect(ids).toEqual(["c2", "c1", "f1", "f2", "f3"]);
    });

    it("moves a deck up within 4fun section", () => {
      const result = computeMoveWithinSection(sampleDecks, "f2", "up");
      expect(result).not.toBeNull();
      const ids = result!.map((d) => d.id);
      expect(ids).toEqual(["c1", "c2", "f2", "f1", "f3"]);
    });

    it("moves a deck down within 4fun section", () => {
      const result = computeMoveWithinSection(sampleDecks, "f2", "down");
      expect(result).not.toBeNull();
      const ids = result!.map((d) => d.id);
      expect(ids).toEqual(["c1", "c2", "f1", "f3", "f2"]);
    });

    it("returns null when moving topmost item up", () => {
      const result = computeMoveWithinSection(sampleDecks, "c1", "up");
      expect(result).toBeNull();
    });

    it("returns null when moving bottommost item down", () => {
      const result = computeMoveWithinSection(sampleDecks, "f3", "down");
      expect(result).toBeNull();
    });

    it("returns null for non-existent deck ID", () => {
      const result = computeMoveWithinSection(sampleDecks, "unknown-id", "up");
      expect(result).toBeNull();
    });
  });

  describe("computeMoveToOtherSection", () => {
    it("moves competitive deck to bottom of 4fun section", () => {
      const result = computeMoveToOtherSection(sampleDecks, "c1");
      expect(result).not.toBeNull();
      const moved = result!.find((d) => d.id === "c1");
      expect(moved?.section).toBe("4fun");

      const funDecks = result!.filter((d) => d.section === "4fun");
      expect(funDecks.map((d) => d.id)).toEqual(["f1", "f2", "f3", "c1"]);
    });

    it("moves 4fun deck to bottom of competitive section", () => {
      const result = computeMoveToOtherSection(sampleDecks, "f2");
      expect(result).not.toBeNull();
      const moved = result!.find((d) => d.id === "f2");
      expect(moved?.section).toBe("competitive");

      const compDecks = result!.filter((d) => d.section === "competitive");
      expect(compDecks.map((d) => d.id)).toEqual(["c1", "c2", "f2"]);
    });

    it("returns null for non-existent deck ID", () => {
      const result = computeMoveToOtherSection(sampleDecks, "unknown-id");
      expect(result).toBeNull();
    });
  });
});
