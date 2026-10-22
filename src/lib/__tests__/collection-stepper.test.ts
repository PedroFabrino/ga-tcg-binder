import { describe, expect, it } from "vitest";
import { buildCollectionUpdateRequest } from "../collection-stepper";

describe("buildCollectionUpdateRequest", () => {
  it("returns delta +1 (not absolute count)", () => {
    // going from 2 to 3 → body should be { quantity: 1 }
    expect(buildCollectionUpdateRequest("ed-001", 2, 1)).toEqual({
      editionId: "ed-001",
      foil: false,
      quantity: 1,
    });
  });

  it("returns delta -1 (not absolute count)", () => {
    // going from 2 to 1 → body should be { quantity: -1 }
    expect(buildCollectionUpdateRequest("ed-001", 2, -1)).toEqual({
      editionId: "ed-001",
      foil: false,
      quantity: -1,
    });
  });

  it("returns null when decrementing below 0 ownedNormal", () => {
    expect(buildCollectionUpdateRequest("ed-001", 0, -1)).toBeNull();
  });

  it("allows decrement from 1 to 0", () => {
    expect(buildCollectionUpdateRequest("ed-001", 1, -1)).toEqual({
      editionId: "ed-001",
      foil: false,
      quantity: -1,
    });
  });

  it("returns null when no preferredEditionId", () => {
    expect(buildCollectionUpdateRequest(null, 2, 1)).toBeNull();
    expect(buildCollectionUpdateRequest(null, 0, -1)).toBeNull();
  });

  it("returns delta for increment from 0", () => {
    expect(buildCollectionUpdateRequest("ed-001", 0, 1)).toEqual({
      editionId: "ed-001",
      foil: false,
      quantity: 1,
    });
  });

  it("returns null for zero delta", () => {
    expect(buildCollectionUpdateRequest("ed-001", 5, 0)).toBeNull();
  });

  it("large positive delta preserved as-is", () => {
    expect(buildCollectionUpdateRequest("ed-001", 5, 3)).toEqual({
      editionId: "ed-001",
      foil: false,
      quantity: 3,
    });
  });
});