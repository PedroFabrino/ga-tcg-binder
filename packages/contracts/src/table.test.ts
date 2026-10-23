import { describe, it, expect } from "vitest";
import {
  isSeatId,
  isTableRole,
  isSeatState,
  isSeatStatePatch,
  isPin,
  isTableClientMessage,
  isTableServerMessage,
  type SeatState,
  type Pin,
  type TableClientMessage,
} from "./index";

const seatState: SeatState = {
  displayName: "Alice",
  championSlug: "lorraine-wandering-warrior",
  damage: 11,
  memory: 3,
  hand: 4,
};

const pin: Pin = { seat: "p1", cardSlug: "cremation-ritual", at: 1000 };

describe("table contracts", () => {
  it("recognises seat ids and table roles", () => {
    expect(isSeatId("p1")).toBe(true);
    expect(isSeatId("p2")).toBe(true);
    expect(isSeatId("p3")).toBe(false);
    expect(isSeatId(null)).toBe(false);

    expect(isTableRole("seat")).toBe(true);
    expect(isTableRole("capture")).toBe(true);
    expect(isTableRole("viewer")).toBe(true);
    expect(isTableRole("admin")).toBe(false);
  });

  it("validates SeatState", () => {
    expect(isSeatState(seatState)).toBe(true);
    expect(isSeatState({ ...seatState, championSlug: null })).toBe(true);
    expect(isSeatState({ ...seatState, damage: "11" })).toBe(false);
    expect(isSeatState({})).toBe(false);
    expect(isSeatState(null)).toBe(false);
  });

  it("validates SeatState patches and rejects unknown keys", () => {
    expect(isSeatStatePatch({ damage: 11 })).toBe(true);
    expect(isSeatStatePatch({ displayName: "Bob", hand: 5 })).toBe(true);
    expect(isSeatStatePatch({})).toBe(true);
    expect(isSeatStatePatch({ bogus: 1 })).toBe(false);
    expect(isSeatStatePatch({ damage: "high" })).toBe(false);
    expect(isSeatStatePatch(null)).toBe(false);
  });

  it("validates Pin", () => {
    expect(isPin(pin)).toBe(true);
    expect(isPin({ ...pin, printingSlug: "doa-1st" })).toBe(true);
    expect(isPin({ ...pin, seat: "p3" })).toBe(false);
    expect(isPin({ ...pin, at: "soon" })).toBe(false);
  });

  it("validates TableClientMessage", () => {
    const hello: TableClientMessage = { type: "TABLE_HELLO", code: "C", token: "t", role: "seat" };
    expect(isTableClientMessage(hello)).toBe(true);
    expect(isTableClientMessage({ type: "SEAT_UPDATE", patch: { damage: 1 } })).toBe(true);
    expect(isTableClientMessage({ type: "TURN_START" })).toBe(true);
    expect(isTableClientMessage({ type: "TURN_END" })).toBe(true);
    expect(isTableClientMessage({ type: "PIN_SET", cardSlug: "x" })).toBe(true);
    expect(isTableClientMessage({ type: "PIN_CLEAR" })).toBe(true);
    expect(isTableClientMessage({ type: "RIPPLE", x: 0.5, y: 0.5 })).toBe(true);
    expect(isTableClientMessage({ type: "SIGNAL", to: { seat: "p2", role: "capture" }, data: {} })).toBe(true);

    expect(isTableClientMessage({ type: "SEAT_UPDATE", patch: { bogus: 1 } })).toBe(false);
    expect(isTableClientMessage({ type: "RIPPLE", x: 0.5 })).toBe(false);
    expect(isTableClientMessage({ type: "NOPE" })).toBe(false);
    expect(isTableClientMessage(null)).toBe(false);
  });

  it("validates TableServerMessage", () => {
    expect(isTableServerMessage({ type: "TABLE_STATE", state: {} })).toBe(true);
    expect(isTableServerMessage({ type: "SIGNAL", from: { seat: "p1", role: "capture" }, data: {} })).toBe(true);
    expect(isTableServerMessage({ type: "PRESENCE", participants: [] })).toBe(true);
    expect(isTableServerMessage({ type: "TABLE_ERROR", code: "x", message: "y" })).toBe(true);

    expect(isTableServerMessage({ type: "TABLE_STATE" })).toBe(false);
    expect(isTableServerMessage({ type: "PRESENCE", participants: "nope" })).toBe(false);
    expect(isTableServerMessage({ type: "NOPE" })).toBe(false);
  });

  it("does not accept a server SIGNAL as a client message, or vice versa", () => {
    expect(isTableClientMessage({ type: "SIGNAL", from: { seat: "p1", role: "capture" }, data: {} })).toBe(false);
    expect(isTableServerMessage({ type: "SIGNAL", to: { seat: "p1", role: "capture" }, data: {} })).toBe(false);
  });
});
