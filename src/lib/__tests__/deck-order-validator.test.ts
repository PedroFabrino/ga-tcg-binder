import { describe, expect, it } from "vitest";
import { parseReorderRequest } from "../deck-order-validator";

describe("parseReorderRequest", () => {
  it("rejects non-object or empty bodies", () => {
    expect(parseReorderRequest(null)).toEqual({
      success: false,
      error: "Request body must be a JSON object",
    });
    expect(parseReorderRequest([])).toEqual({
      success: false,
      error: "Request body must be a JSON object",
    });
    expect(parseReorderRequest({ items: [] })).toEqual({
      success: false,
      error: "Field 'items' must not be empty",
    });
  });

  it("rejects items with invalid types or missing fields", () => {
    expect(parseReorderRequest({ items: ["not-an-object"] })).toEqual({
      success: false,
      error: "Item at index 0 must be an object",
    });
    expect(parseReorderRequest({ items: [{ id: "" }] })).toEqual({
      success: false,
      error: "Item at index 0 must have a non-empty string 'id'",
    });
    expect(parseReorderRequest({ items: [{ id: "d1", section: "invalid" }] })).toEqual({
      success: false,
      error: "Item 'd1' has invalid section 'invalid'. Must be 'competitive' or '4fun'",
    });
    expect(parseReorderRequest({ items: [{ id: "d1", section: "competitive", priority: -1 }] })).toEqual({
      success: false,
      error: "Item 'd1' must have a non-negative integer position",
    });
  });

  it("rejects duplicate deck IDs in items", () => {
    expect(
      parseReorderRequest({
        items: [
          { id: "d1", section: "competitive", priority: 0 },
          { id: "d1", section: "4fun", priority: 1 },
        ],
      })
    ).toEqual({
      success: false,
      error: "Duplicate deck id 'd1' found in items",
    });
  });

  it("accepts valid payload with position or priority", () => {
    const res = parseReorderRequest({
      items: [
        { id: "d1", section: "competitive", priority: 0 },
        { id: "d2", section: "4fun", position: 1 },
      ],
    });

    expect(res).toEqual({
      success: true,
      data: {
        items: [
          { id: "d1", section: "competitive", position: 0 },
          { id: "d2", section: "4fun", position: 1 },
        ],
      },
    });
  });
});
