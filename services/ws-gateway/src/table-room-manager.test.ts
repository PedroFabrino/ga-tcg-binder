import { describe, it, expect } from "vitest";
import { TableRoomManager } from "./table-room-manager";
import { MockSocket, hello } from "./mock-socket";

describe("TableRoomManager", () => {
  it("creates and registers a table with typable code and distinct tokens", () => {
    const manager = new TableRoomManager();
    const creds = manager.createTable();

    expect(creds.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(new Set([creds.p1Token, creds.p2Token, creds.viewerToken]).size).toBe(3);
    expect(manager.getTableCount()).toBe(1);
  });

  it("routes TABLE_HELLO to the matching room", () => {
    const manager = new TableRoomManager();
    const creds = manager.createTable();
    const p1 = new MockSocket();

    manager.handleRawMessage(p1, hello(creds.code, creds.p1Token, "seat", "Alice"));

    expect(p1.lastState()?.code).toBe(creds.code);
    expect(p1.lastState()?.seats.p1?.displayName).toBe("Alice");
    expect(p1.errors()).toEqual([]);
  });

  it("normalises a hand-typed lowercase code", () => {
    const manager = new TableRoomManager();
    const creds = manager.createTable();
    const p1 = new MockSocket();

    manager.handleRawMessage(p1, hello(creds.code.toLowerCase(), creds.p1Token, "seat", "Alice"));

    expect(p1.lastState()?.code).toBe(creds.code);
    expect(p1.errors()).toEqual([]);
  });

  it("rejects a first message that is not TABLE_HELLO", () => {
    const manager = new TableRoomManager();
    const socket = new MockSocket();

    manager.handleRawMessage(socket, JSON.stringify({ type: "TURN_START" }));

    expect(socket.errors()).toContain("BAD_REQUEST");
    expect(socket.lastState()).toBeUndefined();
  });

  it("rejects a code that has no table", () => {
    const manager = new TableRoomManager();
    const socket = new MockSocket();

    manager.handleRawMessage(socket, hello("ZZZZZZ", "tok", "seat"));

    expect(socket.errors()).toContain("NO_SUCH_TABLE");
  });

  it("rejects a malformed first message", () => {
    const manager = new TableRoomManager();
    const socket = new MockSocket();

    manager.handleRawMessage(socket, "not json");

    expect(socket.errors()).toContain("BAD_REQUEST");
  });

  it("mirrors state between two seats of the same table", () => {
    const manager = new TableRoomManager();
    const creds = manager.createTable();
    const p1 = new MockSocket();
    const p2 = new MockSocket();

    manager.handleRawMessage(p1, hello(creds.code, creds.p1Token, "seat", "Alice"));
    manager.handleRawMessage(p2, hello(creds.code, creds.p2Token, "seat", "Bob"));
    manager.handleRawMessage(p1, JSON.stringify({ type: "SEAT_UPDATE", patch: { damage: 3 } }));

    expect(p2.lastState()?.seats.p1?.damage).toBe(3);
  });

  it("isolates two tables from each other", () => {
    const manager = new TableRoomManager();
    const tableA = manager.createTable();
    const tableB = manager.createTable();
    const a = new MockSocket();
    const b = new MockSocket();

    manager.handleRawMessage(a, hello(tableA.code, tableA.p1Token, "seat", "Alice"));
    manager.handleRawMessage(b, hello(tableB.code, tableB.p1Token, "seat", "Cara"));
    manager.handleRawMessage(a, JSON.stringify({ type: "SEAT_UPDATE", patch: { damage: 6 } }));

    expect(a.lastState()?.seats.p1?.damage).toBe(6);
    expect(b.lastState()?.seats.p1?.damage).toBe(0);
  });

  it("forwards disconnect to the room and unbinds the socket", () => {
    const manager = new TableRoomManager();
    const creds = manager.createTable();
    const p1 = new MockSocket();
    const p2 = new MockSocket();
    manager.handleRawMessage(p1, hello(creds.code, creds.p1Token, "seat", "Alice"));
    manager.handleRawMessage(p2, hello(creds.code, creds.p2Token, "seat", "Bob"));

    manager.handleDisconnect(p1);

    expect(p2.lastState()?.log.filter((e) => e.kind === "disconnect")).toHaveLength(1);

    // Proof of unbinding: a non-HELLO now re-enters the binder and is rejected.
    // A still-bound socket would instead be forwarded to the room (FORBIDDEN).
    manager.handleRawMessage(p1, JSON.stringify({ type: "TURN_START" }));
    expect(p1.errors()).toContain("BAD_REQUEST");

    // A second disconnect is a no-op, not a second log entry.
    manager.handleDisconnect(p1);
    expect(p2.lastState()?.log.filter((e) => e.kind === "disconnect")).toHaveLength(1);
  });

  it("keeps a socket bound after a bad token so the room can reject it", () => {
    const manager = new TableRoomManager();
    const creds = manager.createTable();
    const socket = new MockSocket();

    manager.handleRawMessage(socket, hello(creds.code, "not-a-real-token", "seat"));

    expect(socket.errors()).toContain("INVALID_TOKEN");
    expect(manager.getTableCount()).toBe(1);
  });
});
