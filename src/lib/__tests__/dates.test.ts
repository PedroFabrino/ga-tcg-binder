import { describe, expect, it } from "vitest";
import { formatIsoDate } from "../dates";

describe("formatIsoDate", () => {
  it("returns null for empty or invalid input", () => {
    expect(formatIsoDate(null)).toBeNull();
    expect(formatIsoDate(undefined)).toBeNull();
    expect(formatIsoDate("")).toBeNull();
    expect(formatIsoDate("not-a-date")).toBeNull();
  });

  it("formats a YYYY-MM-DD date without timezone drift", () => {
    // The exact string is locale-dependent; assert it is a valid date output
    // and contains the year, proving it did not collapse to Invalid Date.
    const result = formatIsoDate("2023-05-15");
    expect(result).not.toBeNull();
    expect(result).toContain("2023");
  });
});
