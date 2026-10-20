import { describe, expect, it } from "vitest";
import { readShippingCapability } from "../settings-capabilities";

describe("readShippingCapability", () => {
  it("reads the flag from the nested user object returned by /api/settings", () => {
    expect(readShippingCapability({ user: { hasShippingCapability: true } })).toBe(true);
  });

  it("returns false when the flag is false, missing, or the user is null", () => {
    expect(readShippingCapability({ user: { hasShippingCapability: false } })).toBe(false);
    expect(readShippingCapability({ user: {} })).toBe(false);
    expect(readShippingCapability({ user: null })).toBe(false);
    expect(readShippingCapability(null)).toBe(false);
  });

  it("does not read a top-level flag (legacy wrong shape)", () => {
    expect(readShippingCapability({ hasShippingCapability: true })).toBe(false);
  });
});
