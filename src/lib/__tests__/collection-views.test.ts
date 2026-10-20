import { describe, expect, it } from "vitest";
import { isCollectionViewAvailable, resolveCollectionView } from "../collection-views";

describe("collection view availability", () => {
  it("falls back to All Cards for every seller entry point without Vendor Capability", () => {
    expect(resolveCollectionView("?view=MYP_STORE", "", false)).toBe("ALL");
    expect(resolveCollectionView("?tab=myp-store", "", false)).toBe("ALL");
    expect(resolveCollectionView("?fulfillment=1", "", false)).toBe("ALL");
    expect(resolveCollectionView("", "#ga_fulfillment=abc", false)).toBe("ALL");
  });

  it("opens the MyP Store for every seller entry point with Vendor Capability", () => {
    expect(resolveCollectionView("?view=MYP_STORE", "", true)).toBe("MYP_STORE");
    expect(resolveCollectionView("?tab=myp-store", "", true)).toBe("MYP_STORE");
    expect(resolveCollectionView("?fulfillment=1", "", true)).toBe("MYP_STORE");
    expect(resolveCollectionView("", "#ga_fulfillment=abc", true)).toBe("MYP_STORE");
  });

  it("keeps collector views regardless of capability", () => {
    expect(resolveCollectionView("?view=STAPLES", "", false)).toBe("STAPLES");
    expect(resolveCollectionView("?view=bogus", "", true)).toBe("ALL");
    expect(isCollectionViewAvailable("MYP_STORE", false)).toBe(false);
    expect(isCollectionViewAvailable("LOW_POP", false)).toBe(true);
  });
});
