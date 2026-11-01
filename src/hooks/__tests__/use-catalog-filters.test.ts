import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getCatalogFiltersSnapshot,
  setCatalogFilters,
  resetCatalogFiltersForTesting,
  subscribeCatalogFilters,
  DEFAULT_CATALOG_FILTERS,
} from "../use-catalog-filters";

describe("Catalog Filter Store", () => {
  beforeEach(() => {
    resetCatalogFiltersForTesting();
  });

  it("initializes with default filters", () => {
    expect(getCatalogFiltersSnapshot()).toEqual(DEFAULT_CATALOG_FILTERS);
  });

  it("persists filter modifications across navigations", () => {
    setCatalogFilters({
      query: "Fireball",
      element: "FIRE",
      staplesOnly: true,
      selectedKeywords: ["Fast", "Attack"],
    });

    const snapshot = getCatalogFiltersSnapshot();
    expect(snapshot.query).toBe("Fireball");
    expect(snapshot.element).toBe("FIRE");
    expect(snapshot.staplesOnly).toBe(true);
    expect(snapshot.selectedKeywords).toEqual(["Fast", "Attack"]);
  });

  it("notifies subscribers when filters change", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCatalogFilters(listener);

    setCatalogFilters({ cardClass: "WARRIOR" });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getCatalogFiltersSnapshot().cardClass).toBe("WARRIOR");

    unsubscribe();
    setCatalogFilters({ cardClass: "MAGE" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("resets all filters using the reset seam", () => {
    setCatalogFilters({ element: "WATER", cardClass: "MAGE", setPrefix: "DOA" });
    expect(getCatalogFiltersSnapshot().element).toBe("WATER");

    resetCatalogFiltersForTesting();
    expect(getCatalogFiltersSnapshot().element).toBeNull();
    expect(getCatalogFiltersSnapshot().cardClass).toBeNull();
    expect(getCatalogFiltersSnapshot().setPrefix).toBeNull();
  });
});
