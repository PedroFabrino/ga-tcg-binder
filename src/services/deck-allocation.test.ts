import { describe, it, expect } from "vitest";
import { allocateCardDemand } from "./deck-allocation";

describe("deck-allocation engine (ADR 0030/0031)", () => {
  it("preserves exact legacy math when no competitive decks exist", () => {
    // 3 casual decks needing 2, 3, 1 copies. Total demand = 6. Peak = 3. Owned = 2.
    const demands = [
      { deckId: "f1", section: "4fun" as const, priority: 0, demand: 2 },
      { deckId: "f2", section: "4fun" as const, priority: 1, demand: 3 },
      { deckId: "f3", section: "4fun" as const, priority: 2, demand: 1 },
    ];

    const result = allocateCardDemand(2, demands);

    expect(result.peakMissing).toBe(1); // 3 peak - 2 owned = 1
    expect(result.concurrentMissing).toBe(4); // 6 total - 2 owned = 4
    expect(result.competitiveReserved).toBe(0);
    expect(result.leftover4Fun).toBe(2);

    // Hard shortage attributed to topmost deck with peak demand (f2)
    const f2Alloc = result.deckAllocations.find((d) => d.deckId === "f2")!;
    expect(f2Alloc.hardMissing).toBe(1);

    // Total missing across all allocations matches concurrentMissing
    const totalAllocatedMissing = result.deckAllocations.reduce(
      (sum, d) => sum + d.hardMissing + d.sharedMissing,
      0
    );
    expect(totalAllocatedMissing).toBe(4);
  });

  it("handles '2 owned shared between 3 decks' scenario with zero hard purchase required", () => {
    // 3 4Fun decks, each needing 1 copy. Total demand = 3. Peak = 1. Owned = 2.
    const demands = [
      { deckId: "d1", section: "4fun" as const, priority: 0, demand: 1 },
      { deckId: "d2", section: "4fun" as const, priority: 1, demand: 1 },
      { deckId: "d3", section: "4fun" as const, priority: 2, demand: 1 },
    ];

    const result = allocateCardDemand(2, demands);

    expect(result.peakMissing).toBe(0); // Can sleeve any single deck without buying!
    expect(result.concurrentMissing).toBe(1); // 3 demand - 2 owned = 1 rotation shortage

    const d1Alloc = result.deckAllocations.find((d) => d.deckId === "d1")!;
    const d2Alloc = result.deckAllocations.find((d) => d.deckId === "d2")!;
    const d3Alloc = result.deckAllocations.find((d) => d.deckId === "d3")!;

    expect(d1Alloc.hardMissing).toBe(0);
    expect(d1Alloc.sharedMissing).toBe(0);

    expect(d2Alloc.hardMissing).toBe(0);
    expect(d2Alloc.sharedMissing).toBe(0);

    // 3rd deck absorbs the rotation deficit
    expect(d3Alloc.hardMissing).toBe(0);
    expect(d3Alloc.sharedMissing).toBe(1);
  });

  it("gives strict exclusive pre-emption to competitive decks by priority", () => {
    // Owned: 3 copies.
    // Comp 1 (prio 0): demand 2 -> gets 2, hardMissing = 0
    // Comp 2 (prio 1): demand 2 -> gets 1, hardMissing = 1
    // 4Fun 1 (prio 0): demand 2 -> gets 0 leftover, hardMissing = 2
    const demands = [
      { deckId: "c2", section: "competitive" as const, priority: 1, demand: 2 },
      { deckId: "c1", section: "competitive" as const, priority: 0, demand: 2 },
      { deckId: "f1", section: "4fun" as const, priority: 0, demand: 2 },
    ];

    const result = allocateCardDemand(3, demands);

    expect(result.leftover4Fun).toBe(0);
    expect(result.peakMissing).toBe(3); // 1 (Comp 2) + 2 (Fun 1)
    expect(result.concurrentMissing).toBe(3); // 6 total - 3 owned = 3

    const c1 = result.deckAllocations.find((d) => d.deckId === "c1")!;
    const c2 = result.deckAllocations.find((d) => d.deckId === "c2")!;
    const f1 = result.deckAllocations.find((d) => d.deckId === "f1")!;

    expect(c1.allocated).toBe(2);
    expect(c1.hardMissing).toBe(0);
    expect(c1.sharedMissing).toBe(0);

    expect(c2.allocated).toBe(1);
    expect(c2.hardMissing).toBe(1);
    expect(c2.sharedMissing).toBe(0);

    expect(f1.allocated).toBe(0);
    expect(f1.hardMissing).toBe(2);
    expect(f1.sharedMissing).toBe(0);
  });

  it("attributes hard shortage to highest-demand 4Fun deck first", () => {
    // Leftover after competitive: 1 copy.
    // Fun 1 (prio 0): demand 1
    // Fun 2 (prio 1): demand 3
    // Peak 4Fun demand is 3. Total 4Fun demand is 4.
    // 4Fun hard shortage = 3 - 1 = 2 copies.
    // Attributed to Fun 2 (the highest demand deck).
    const demands = [
      { deckId: "f1", section: "4fun" as const, priority: 0, demand: 1 },
      { deckId: "f2", section: "4fun" as const, priority: 1, demand: 3 },
    ];

    const result = allocateCardDemand(1, demands);

    expect(result.peakMissing).toBe(2); // 3 - 1 = 2
    expect(result.concurrentMissing).toBe(3); // 4 - 1 = 3

    const f1 = result.deckAllocations.find((d) => d.deckId === "f1")!;
    const f2 = result.deckAllocations.find((d) => d.deckId === "f2")!;

    expect(f2.hardMissing).toBe(2);
    expect(f1.hardMissing).toBe(0);
  });
});
