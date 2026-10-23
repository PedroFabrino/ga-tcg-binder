import { describe, expect, it } from "vitest";
import { resetCardCachesForTest } from "../use-card-catalog";

describe("card catalog module caches", () => {
  it("can be reset between cases", () => {
    expect(() => resetCardCachesForTest()).not.toThrow();
    expect(() => resetCardCachesForTest()).not.toThrow();
  });
});
