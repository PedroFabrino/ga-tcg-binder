import { describe, expect, it } from "vitest";
import type { TableState } from "@ga/contracts";
import {
  applyServerMessage,
  initialTableClientState,
  tableClientActionFromMessage,
  tableClientReducer,
  type TableClientState,
} from "../table-reducer";

function makeTable(overrides: Partial<TableState> = {}): TableState {
  return {
    code: "ABC123",
    seats: {
      p1: { displayName: "Alice", championSlug: null, damage: 0, memory: 0, hand: 0 },
      p2: { displayName: "Bob", championSlug: null, damage: 0, memory: 0, hand: 0 },
    },
    active: null,
    pins: {},
    recent: [],
    ripples: [],
    log: [],
    ...overrides,
  };
}

function withSnapshot(table: TableState): TableClientState {
  return { ...initialTableClientState, table };
}

describe("tableClientReducer", () => {
  it("applies an optimistic Seat patch without mutating the snapshot", () => {
    const snapshot = makeTable();
    const before = structuredClone(snapshot);
    const state = withSnapshot(snapshot);

    const next = tableClientReducer(state, {
      type: "PATCH",
      seat: "p1",
      patch: { damage: 3, memory: 2, hand: 5 },
    });

    expect(next.table?.seats.p1).toMatchObject({ damage: 3, memory: 2, hand: 5 });
    expect(next.table?.seats.p2).toEqual(state.table?.seats.p2);
    expect(next).not.toBe(state);
    expect(next.table).not.toBe(snapshot);
    expect(snapshot).toEqual(before);
  });

  it("replaces the table on a snapshot", () => {
    const first = makeTable({ active: "p1" });
    const second = makeTable({
      active: null,
      log: [{ at: 1, seat: "p1", kind: "turn", detail: "end" }],
    });

    const next = tableClientReducer(withSnapshot(first), { type: "SNAPSHOT", state: second });

    expect(next.table).toBe(second);
    expect(next.table?.active).toBeNull();
    expect(next.table?.log).toHaveLength(1);
  });

  it("mirrors turn, pin, ripple, and log transitions from a snapshot", () => {
    const pin = { seat: "p1" as const, cardSlug: "card-1", at: 10 };
    const ripple = { seat: "p2" as const, x: 0.25, y: 0.5, at: 11 };
    const log = [
      { at: 10, seat: "p1" as const, kind: "pin", detail: "card-1" },
      { at: 11, seat: "p2" as const, kind: "turn", detail: "start" },
    ];

    const next = tableClientReducer(withSnapshot(makeTable()), {
      type: "SNAPSHOT",
      state: makeTable({
        active: "p2",
        pins: { p1: pin },
        recent: [pin],
        ripples: [ripple],
        log,
      }),
    });

    expect(next.table?.active).toBe("p2");
    expect(next.table?.pins.p1).toEqual(pin);
    expect(next.table?.recent).toEqual([pin]);
    expect(next.table?.ripples).toEqual([ripple]);
    expect(next.table?.log).toEqual(log);
  });

  it("keeps presence, the last signal, and the current error alongside the table", () => {
    const participants = [{ seat: "p1" as const, role: "seat" as const, displayName: "Alice" }];

    const withPresence = tableClientReducer(initialTableClientState, {
      type: "PRESENCE",
      participants,
    });
    const withSignal = tableClientReducer(withPresence, {
      type: "SIGNAL",
      from: { seat: "p2", role: "capture" },
      data: { kind: "offer", sdp: "v=0" },
    });
    const withError = tableClientReducer(withSignal, {
      type: "ERROR",
      code: "DISPLACED",
      message: "This seat was opened in another tab",
    });

    expect(withError.participants).toEqual(participants);
    expect(withError.signal).toEqual({
      from: { seat: "p2", role: "capture" },
      data: { kind: "offer", sdp: "v=0" },
    });
    expect(withError.error).toEqual({
      code: "DISPLACED",
      message: "This seat was opened in another tab",
    });
  });

  it("keeps a takeover notice until it is cleared", () => {
    const alerted = tableClientReducer(withSnapshot(makeTable()), {
      type: "ERROR",
      code: "DISPLACED",
      message: "This seat was opened in another tab",
    });

    const afterSnapshot = tableClientReducer(alerted, {
      type: "SNAPSHOT",
      state: makeTable({ active: "p1" }),
    });

    expect(afterSnapshot.error?.code).toBe("DISPLACED");
    expect(tableClientReducer(afterSnapshot, { type: "CLEAR_ERROR" }).error).toBeNull();
    expect(tableClientReducer(initialTableClientState, { type: "CLEAR_ERROR" })).toBe(
      initialTableClientState
    );
  });

  it("resets the whole view on RESET", () => {
    const state = tableClientReducer(withSnapshot(makeTable()), {
      type: "PRESENCE",
      participants: [],
    });

    expect(tableClientReducer(state, { type: "RESET" })).toEqual(initialTableClientState);
  });

  it("ignores a patch before the first snapshot or for an unknown Seat", () => {
    expect(
      tableClientReducer(initialTableClientState, {
        type: "PATCH",
        seat: "p1",
        patch: { damage: 1 },
      })
    ).toBe(initialTableClientState);

    const oneSeat = makeTable({
      seats: {
        p1: { displayName: "Alice", championSlug: null, damage: 0, memory: 0, hand: 0 },
      },
    });
    const state = withSnapshot(oneSeat);
    expect(
      tableClientReducer(state, { type: "PATCH", seat: "p2", patch: { damage: 2 } })
    ).toBe(state);
  });
});

describe("server message adapter", () => {
  it("maps every server message to a reducer action", () => {
    const snapshot = makeTable();

    expect(tableClientActionFromMessage({ type: "TABLE_STATE", state: snapshot })).toEqual({
      type: "SNAPSHOT",
      state: snapshot,
    });
    expect(tableClientActionFromMessage({ type: "PRESENCE", participants: [] })).toEqual({
      type: "PRESENCE",
      participants: [],
    });
    expect(
      tableClientActionFromMessage({
        type: "SIGNAL",
        from: { seat: "p1", role: "seat" },
        data: 1,
      })
    ).toEqual({ type: "SIGNAL", from: { seat: "p1", role: "seat" }, data: 1 });
    expect(
      tableClientActionFromMessage({
        type: "TABLE_ERROR",
        code: "BAD_REQUEST",
        message: "Payload must be valid JSON",
      })
    ).toEqual({ type: "ERROR", code: "BAD_REQUEST", message: "Payload must be valid JSON" });
  });

  it("applies a server message in one pure step", () => {
    const snapshot = makeTable({ active: "p2" });

    const next = applyServerMessage(withSnapshot(makeTable()), {
      type: "TABLE_STATE",
      state: snapshot,
    });

    expect(next.table).toBe(snapshot);
    expect(next.table?.active).toBe("p2");
  });
});
