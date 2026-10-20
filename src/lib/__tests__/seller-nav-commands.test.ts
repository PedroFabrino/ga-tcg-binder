import { describe, expect, it } from "vitest";
import { getSellerNavCommands } from "../seller-nav-commands";

describe("seller navigation commands", () => {
  it("offers no seller commands without Vendor Capability", () => {
    expect(getSellerNavCommands(false)).toEqual([]);
  });

  it("offers the personal MyP Store with Vendor Capability", () => {
    expect(getSellerNavCommands(true).map((command) => command.label)).toContain("MyP Store (Personal)");
  });
});
