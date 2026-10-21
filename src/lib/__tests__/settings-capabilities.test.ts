import { describe, expect, it } from "vitest";
import {
  readShippingCapability,
  readVendorCapability,
  readMypUsername,
} from "../settings-capabilities";

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

describe("readVendorCapability", () => {
  it("reads the vendor flag from nested user object", () => {
    expect(readVendorCapability({ user: { hasVendorCapability: true } })).toBe(true);
    expect(readVendorCapability({ user: { hasVendorCapability: false } })).toBe(false);
    expect(readVendorCapability({ user: null })).toBe(false);
    expect(readVendorCapability(null)).toBe(false);
  });
});

describe("readMypUsername", () => {
  it("extracts and trims mypUsername from nested user object", () => {
    expect(readMypUsername({ user: { mypUsername: "Fabrino" } })).toBe("Fabrino");
    expect(readMypUsername({ user: { mypUsername: "  Fabrino  " } })).toBe("Fabrino");
  });

  it("returns null when empty, whitespace, or missing", () => {
    expect(readMypUsername({ user: { mypUsername: "" } })).toBeNull();
    expect(readMypUsername({ user: { mypUsername: "   " } })).toBeNull();
    expect(readMypUsername({ user: { mypUsername: null } })).toBeNull();
    expect(readMypUsername({ user: {} })).toBeNull();
    expect(readMypUsername(null)).toBeNull();
  });
});
