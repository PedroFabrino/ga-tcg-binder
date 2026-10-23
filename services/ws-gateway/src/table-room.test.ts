import { describe, it, expect } from "vitest";
import { TableRoom } from "./table-room";
import { MockSocket, hello } from "./mock-socket";

describe("TableRoom state machine", () => {
  it("mirrors state between two seats", () => {
    const room = new TableRoom("ABC", "tokP1", "tokP2");
    const p1 = new MockSocket();
    const p2 = new MockSocket();

    room.handleRawMessage(p1, hello("ABC", "tokP1", "seat", "Alice"));
    room.handleRawMessage(p2, hello("ABC", "tokP2", "seat", "Bob"));

    const s1 = p1.lastState()!;
    const s2 = p2.lastState()!;
    expect(s1.code).toBe("ABC");
    expect(s1.seats.p1?.displayName).toBe("Alice");
    expect(s1.seats.p2?.displayName).toBe("Bob");
    expect(s2.seats.p1?.displayName).toBe("Alice");
    expect(s2.seats.p2?.displayName).toBe("Bob");
  });

  it("partitions writes: a seat updates only its own fields", () => {
    const room = new TableRoom("ABC", "tokP1", "tokP2");
    const p1 = new MockSocket();
    const p2 = new MockSocket();
    room.handleRawMessage(p1, hello("ABC", "tokP1", "seat", "Alice"));
    room.handleRawMessage(p2, hello("ABC", "tokP2", "seat", "Bob"));

    room.handleRawMessage(p1, JSON.stringify({ type: "SEAT_UPDATE", patch: { damage: 5 } }));

    const state = p2.lastState()!;
    expect(state.seats.p1?.damage).toBe(5);
    expect(state.seats.p2?.damage).toBe(0);
    expect(p1.errors()).toEqual([]);
  });

  it("rejects writes from a connection with no seat", () => {
    const room = new TableRoom("ABC", "tokP1", "tokP2");
    const capture = new MockSocket();
    room.handleRawMessage(capture, hello("ABC", "tokP1", "capture"));
    const before = capture.lastState();

    room.handleRawMessage(capture, JSON.stringify({ type: "SEAT_UPDATE", patch: { damage: 9 } }));

    expect(capture.errors()).toContain("FORBIDDEN");
    expect(capture.lastState()).toEqual(before);
  });

  it("enforces turn start and end", () => {
    const room = new TableRoom("ABC", "tokP1", "tokP2");
    const p1 = new MockSocket();
    const p2 = new MockSocket();
    room.handleRawMessage(p1, hello("ABC", "tokP1", "seat", "Alice"));
    room.handleRawMessage(p2, hello("ABC", "tokP2", "seat", "Bob"));

    room.handleRawMessage(p2, JSON.stringify({ type: "TURN_END" }));
    expect(p2.errors()).toContain("NOT_YOUR_TURN");

    room.handleRawMessage(p1, JSON.stringify({ type: "TURN_START" }));
    expect(p1.lastState()!.active).toBe("p1");

    room.handleRawMessage(p2, JSON.stringify({ type: "TURN_START" }));
    expect(p2.errors()).toContain("NOT_YOUR_TURN");
    expect(p2.lastState()!.active).toBe("p1");

    room.handleRawMessage(p2, JSON.stringify({ type: "TURN_END" }));
    expect(p2.errors()).toContain("NOT_YOUR_TURN");

    room.handleRawMessage(p1, JSON.stringify({ type: "TURN_END" }));
    expect(p1.lastState()!.active).toBeNull();
  });

  it("displaces the older connection when the same seat token reconnects", () => {
    const room = new TableRoom("ABC", "tokP1", "tokP2");
    const first = new MockSocket();
    const second = new MockSocket();
    room.handleRawMessage(first, hello("ABC", "tokP1", "seat", "Alice"));
    room.handleRawMessage(second, hello("ABC", "tokP1", "seat", "Alice v2"));

    expect(first.errors()).toContain("DISPLACED");

    room.handleRawMessage(first, JSON.stringify({ type: "SEAT_UPDATE", patch: { damage: 5 } }));
    expect(first.errors()).toContain("FORBIDDEN");

    room.handleRawMessage(second, JSON.stringify({ type: "SEAT_UPDATE", patch: { damage: 7 } }));
    expect(second.lastState()!.seats.p1?.damage).toBe(7);
    expect(second.lastState()!.seats.p1?.displayName).toBe("Alice v2");
  });

  it("refuses a third seat with an invalid token", () => {
    const room = new TableRoom("ABC", "tokP1", "tokP2");
    const p1 = new MockSocket();
    const p2 = new MockSocket();
    const intruder = new MockSocket();
    room.handleRawMessage(p1, hello("ABC", "tokP1", "seat"));
    room.handleRawMessage(p2, hello("ABC", "tokP2", "seat"));

    room.handleRawMessage(intruder, hello("ABC", "tokBogus", "seat"));
    expect(intruder.errors()).toContain("INVALID_TOKEN");
    expect(intruder.lastState()).toBeUndefined();
  });

  it("pins and clears, keeping the recent list as history", () => {
    const room = new TableRoom("ABC", "tokP1", "tokP2");
    const p1 = new MockSocket();
    const p2 = new MockSocket();
    room.handleRawMessage(p1, hello("ABC", "tokP1", "seat", "Alice"));
    room.handleRawMessage(p2, hello("ABC", "tokP2", "seat", "Bob"));

    room.handleRawMessage(p1, JSON.stringify({ type: "PIN_SET", cardSlug: "cremation-ritual" }));
    expect(p1.lastState()!.pins.p1?.cardSlug).toBe("cremation-ritual");
    expect(p1.lastState()!.recent).toHaveLength(1);

    room.handleRawMessage(p2, JSON.stringify({ type: "PIN_SET", cardSlug: "strike-buckler" }));
    expect(p2.lastState()!.recent).toHaveLength(2);
    expect(p2.lastState()!.recent[0].cardSlug).toBe("strike-buckler");

    room.handleRawMessage(p1, JSON.stringify({ type: "PIN_CLEAR" }));
    expect(p1.lastState()!.pins.p1).toBeUndefined();
    expect(p1.lastState()!.recent).toHaveLength(2);
  });

  it("relays signals between a capture device and a seat", () => {
    const room = new TableRoom("ABC", "tokP1", "tokP2");
    const p1cam = new MockSocket();
    const p2 = new MockSocket();
    room.handleRawMessage(p1cam, hello("ABC", "tokP1", "capture"));
    room.handleRawMessage(p2, hello("ABC", "tokP2", "seat"));

    room.handleRawMessage(
      p1cam,
      JSON.stringify({ type: "SIGNAL", to: { seat: "p2", role: "seat" }, data: { sdp: "offer" } })
    );

    const signal = p2.lastSignal();
    expect(signal).toBeDefined();
    expect(signal!.from.seat).toBe("p1");
    expect(signal!.from.role).toBe("capture");
    expect(signal!.data).toEqual({ sdp: "offer" });
  });

  it("rejects a client with the wrong room code", () => {
    const room = new TableRoom("ABC", "tokP1", "tokP2");
    const s = new MockSocket();
    room.handleRawMessage(s, hello("XYZ", "tokP1", "seat"));
    expect(s.errors()).toContain("WRONG_CODE");
  });
});
