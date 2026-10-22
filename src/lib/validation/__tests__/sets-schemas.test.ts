import { describe, it, expect } from "vitest";
import { parseSetHideBody, parseSetChecklistQuery } from "../sets-schemas";

describe("parseSetHideBody", () => {
  it("accepts a valid { groupUuid, isHidden } object", () => {
    const result = parseSetHideBody({ groupUuid: "grp-doa", isHidden: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ groupUuid: "grp-doa", isHidden: true });
    }
  });

  it("trims leading/trailing whitespace from groupUuid", () => {
    const result = parseSetHideBody({ groupUuid: "  grp-doa  ", isHidden: false });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.groupUuid).toBe("grp-doa");
    }
  });

  it("rejects a non-object body", () => {
    expect(parseSetHideBody("nope").success).toBe(false);
    expect(parseSetHideBody(null).success).toBe(false);
    expect(parseSetHideBody([1, 2]).success).toBe(false);
  });

  it("rejects a missing or empty groupUuid", () => {
    expect(parseSetHideBody({ isHidden: true }).success).toBe(false);
    expect(parseSetHideBody({ groupUuid: "", isHidden: true }).success).toBe(false);
    expect(parseSetHideBody({ groupUuid: 42, isHidden: true }).success).toBe(false);
  });

  it("rejects a non-boolean isHidden", () => {
    expect(parseSetHideBody({ groupUuid: "grp-doa" }).success).toBe(false);
    expect(parseSetHideBody({ groupUuid: "grp-doa", isHidden: "yes" }).success).toBe(false);
    expect(parseSetHideBody({ groupUuid: "grp-doa", isHidden: 1 }).success).toBe(false);
  });
});

describe("parseSetChecklistQuery", () => {
  it("returns safe defaults for an empty query", () => {
    const filters = parseSetChecklistQuery(new URLSearchParams());
    expect(filters).toEqual({
      prefix: null,
      status: "all",
      element: null,
      rarity: null,
      search: null,
    });
  });

  it("forwards known values", () => {
    const filters = parseSetChecklistQuery(
      new URLSearchParams("prefix=DOA 1st&status=shortages&element=FIRE&rarity=3&search=slash"),
    );
    expect(filters).toEqual({
      prefix: "DOA 1st",
      status: "shortages",
      element: "FIRE",
      rarity: 3,
      search: "slash",
    });
  });

  it("coerces rarity strings to integers", () => {
    expect(parseSetChecklistQuery(new URLSearchParams("rarity=3.9")).rarity).toBe(3);
    expect(parseSetChecklistQuery(new URLSearchParams("rarity=07")).rarity).toBe(7);
  });

  it("ignores non-numeric rarity values", () => {
    expect(parseSetChecklistQuery(new URLSearchParams("rarity=banana")).rarity).toBeNull();
  });

  it("ignores unknown status values, falling back to 'all'", () => {
    expect(parseSetChecklistQuery(new URLSearchParams("status=bogus")).status).toBe("all");
    for (const status of ["all", "shortages", "owned", "unowned"]) {
      expect(parseSetChecklistQuery(new URLSearchParams(`status=${status}`)).status).toBe(status);
    }
  });

  it("normalizes empty strings to null", () => {
    const filters = parseSetChecklistQuery(
      new URLSearchParams("prefix=&element= &search="),
    );
    expect(filters.prefix).toBeNull();
    expect(filters.element).toBeNull();
    expect(filters.search).toBeNull();
  });
});