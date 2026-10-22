import { describe, expect, it } from "vitest";
import { buildCollectionUpdateRequest } from "../stepper-utils";

describe("buildCollectionUpdateRequest", () => {
  it("increments quantity by +1", () => {
    expect(buildCollectionUpdateRequest("ed-001", 2, 1)).toEqual({
      editionId: "ed-001",
      foil: false,
      quantity: 3,
    });
  });

  it("decrements quantity by -1", () => {
    expect(buildCollectionUpdateRequest("ed-001", 2, -1)).toEqual({
      editionId: "ed-001",
      foil: false,
      quantity: 1,
    });
  });

  it("clamps at 0 when decrementing below zero", () => {
    expect(buildCollectionUpdateRequest("ed-001", 0, -1)).toBeNull();
  });

  it("allows decrement from 1 to 0", () => {
    expect(buildCollectionUpdateRequest("ed-001", 1, -1)).toEqual({
      editionId: "ed-001",
      foil: false,
      quantity: 0,
    });
  });

  it("returns null when no preferredEditionId", () => {
    expect(buildCollectionUpdateRequest(null, 2, 1)).toBeNull();
    expect(buildCollectionUpdateRequest(null, 0, -1)).toBeNull();
  });

  it("increments from 0 to 1", () => {
    expect(buildCollectionUpdateRequest("ed-001", 0, 1)).toEqual({
      editionId: "ed-001",
      foil: false,
      quantity: 1,
    });
  });

  it("large increments work", () => {
    expect(buildCollectionUpdateRequest("ed-001", 5, 3)).toEqual({
      editionId: "ed-001",
      foil: false,
      quantity: 8,
    });
  });
});