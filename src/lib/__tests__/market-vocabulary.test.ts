import { afterEach, describe, expect, it, vi } from "vitest";
import { readDealAlertDestinations } from "../market-vocabulary";

describe("readDealAlertDestinations", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to both destinations when unset", () => {
    expect(readDealAlertDestinations({})).toEqual([
      "discord-dm",
      "root-alert",
    ]);
  });

  it("parses a comma-separated list and trims whitespace", () => {
    expect(
      readDealAlertDestinations({ DEAL_ALERT_DM_DESTINATION: "root-alert" })
    ).toEqual(["root-alert"]);

    expect(
      readDealAlertDestinations({
        DEAL_ALERT_DM_DESTINATION: " discord-dm , root-alert ",
      })
    ).toEqual(["discord-dm", "root-alert"]);
  });

  it("warns and falls back to Discord when only unknown values are given", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(
      readDealAlertDestinations({ DEAL_ALERT_DM_DESTINATION: "bogus" })
    ).toEqual(["discord-dm"]);
    expect(warn).toHaveBeenCalled();
  });

  it("keeps known destinations while warning about unknown ones", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(
      readDealAlertDestinations({
        DEAL_ALERT_DM_DESTINATION: "root-alert,bogus",
      })
    ).toEqual(["root-alert"]);
    expect(warn).toHaveBeenCalled();
  });
});
