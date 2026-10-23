import { describe, expect, it } from "vitest";
import { reconnectDelayMs } from "../use-table-socket";

describe("table socket reconnect backoff", () => {
  it("backs off exponentially and caps at 15s", () => {
    expect(reconnectDelayMs(0)).toBe(1_000);
    expect(reconnectDelayMs(1)).toBe(2_000);
    expect(reconnectDelayMs(2)).toBe(4_000);
    expect(reconnectDelayMs(3)).toBe(8_000);
    expect(reconnectDelayMs(4)).toBe(15_000);
    expect(reconnectDelayMs(20)).toBe(15_000);
  });
});
