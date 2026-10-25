import { describe, expect, it } from "vitest";
import { ensureAlertSection } from "../root-deal-alert-section";

function fakeConfig(existing?: string) {
  return {
    getAlertSectionId: async () => existing,
    setAlertSectionId: async () => {},
  };
}

describe("ensureAlertSection", () => {
  it("returns the configured section", async () => {
    await expect(ensureAlertSection(fakeConfig("grp-1"))).resolves.toBe("grp-1");
  });

  it("returns undefined when no section is configured", async () => {
    await expect(ensureAlertSection(fakeConfig())).resolves.toBeUndefined();
  });
});
