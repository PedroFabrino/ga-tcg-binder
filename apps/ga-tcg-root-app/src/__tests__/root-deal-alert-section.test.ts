import { describe, expect, it, vi } from "vitest";
import { ensureAlertSection } from "../root-deal-alert-section";

function fakeApi() {
  return { createChannelGroup: vi.fn().mockResolvedValue({ id: "grp-new" }) };
}

function fakeConfig(existing?: string) {
  let value = existing;
  return {
    getAlertSectionId: vi.fn(async () => value),
    setAlertSectionId: vi.fn(async (id: string) => {
      value = id;
    }),
  };
}

describe("ensureAlertSection", () => {
  it("creates and stores the section when missing", async () => {
    const api = fakeApi();
    const config = fakeConfig();

    await expect(ensureAlertSection(api, config)).resolves.toBe("grp-new");
    expect(api.createChannelGroup).toHaveBeenCalledWith("GA Alerts");
    expect(config.setAlertSectionId).toHaveBeenCalledWith("grp-new");
  });

  it("reuses the stored section without creating a duplicate", async () => {
    const api = fakeApi();
    const config = fakeConfig("grp-existing");

    await expect(ensureAlertSection(api, config)).resolves.toBe("grp-existing");
    expect(api.createChannelGroup).not.toHaveBeenCalled();
  });
});
