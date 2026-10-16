import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { FEATURES } from "./features";

describe("Web FEATURES", () => {
  const originalEnv = process.env.NEXT_PUBLIC_FEATURE_SCANNER;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_FEATURE_SCANNER;
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_FEATURE_SCANNER = originalEnv;
  });

  it("defaults scanner feature to false when env is unset", () => {
    expect(FEATURES.scanner).toBe(false);
  });

  it("returns true when NEXT_PUBLIC_FEATURE_SCANNER is 'true'", () => {
    process.env.NEXT_PUBLIC_FEATURE_SCANNER = "true";
    expect(FEATURES.scanner).toBe(true);
  });

  it("returns false when NEXT_PUBLIC_FEATURE_SCANNER is 'false' or empty", () => {
    process.env.NEXT_PUBLIC_FEATURE_SCANNER = "false";
    expect(FEATURES.scanner).toBe(false);
    process.env.NEXT_PUBLIC_FEATURE_SCANNER = "";
    expect(FEATURES.scanner).toBe(false);
  });
});
