import { describe, expect, it } from "vitest";
import {
  isSeatSession,
  parseSeatSession,
  readSeatSession,
  readStoredSeatSession,
  saveSeatSession,
  tableStorageKey,
  type SeatStorage,
} from "../table-session";

function params(entries: Record<string, string>): { get(name: string): string | null } {
  return { get: (name) => entries[name] ?? null };
}

function fakeStorage(initial: Record<string, string> = {}): SeatStorage & {
  values: Record<string, string>;
} {
  const values = { ...initial };
  return {
    values,
    getItem: (key) => values[key] ?? null,
    setItem: (key, value) => {
      values[key] = value;
    },
  };
}

describe("parseSeatSession", () => {
  it("reads a complete Seat session from the URL", () => {
    expect(parseSeatSession(params({ seat: "p1", token: "abc" }))).toEqual({
      seat: "p1",
      token: "abc",
    });
    expect(parseSeatSession(params({ seat: "p2", token: "def" }))).toEqual({
      seat: "p2",
      token: "def",
    });
  });

  it("rejects a missing token or an unknown Seat", () => {
    expect(parseSeatSession(params({ seat: "p1" }))).toBeNull();
    expect(parseSeatSession(params({ token: "abc" }))).toBeNull();
    expect(parseSeatSession(params({ seat: "p3", token: "abc" }))).toBeNull();
    expect(parseSeatSession(params({ seat: "p1", token: "" }))).toBeNull();
  });
});

describe("Seat storage", () => {
  it("round-trips a session under an upper-cased room code", () => {
    const storage = fakeStorage();
    saveSeatSession("abc123", { seat: "p2", token: "tok" }, storage);

    expect(tableStorageKey("abc123")).toBe("gt.table.ABC123");
    expect(storage.values["gt.table.ABC123"]).toBe('{"seat":"p2","token":"tok"}');
    expect(readStoredSeatSession("ABC123", storage)).toEqual({ seat: "p2", token: "tok" });
  });

  it("ignores malformed JSON and an invalid stored shape", () => {
    const malformed = fakeStorage({ "gt.table.ABC123": "{not json" });
    expect(readStoredSeatSession("ABC123", malformed)).toBeNull();

    const invalid = fakeStorage({ "gt.table.ABC123": '{"seat":"p3","token":"tok"}' });
    expect(readStoredSeatSession("ABC123", invalid)).toBeNull();
  });

  it("does not throw when storage is unavailable or throws", () => {
    expect(readStoredSeatSession("ABC123", null)).toBeNull();
    expect(
      readStoredSeatSession("ABC123", {
        getItem: () => {
          throw new Error("blocked");
        },
      })
    ).toBeNull();
  });
});

describe("readSeatSession", () => {
  const stored = fakeStorage({
    "gt.table.ABC123": '{"seat":"p1","token":"p1-token"}',
  });

  it("prefers a complete URL session over storage", () => {
    expect(
      readSeatSession("ABC123", params({ seat: "p2", token: "p2-token" }), stored)
    ).toEqual({ seat: "p2", token: "p2-token" });
  });

  it("uses storage when the URL has no session", () => {
    expect(readSeatSession("ABC123", params({}), stored)).toEqual({
      seat: "p1",
      token: "p1-token",
    });
  });

  it("allows a URL Seat without a token only when it names the stored Seat", () => {
    expect(readSeatSession("ABC123", params({ seat: "p1" }), stored)).toEqual({
      seat: "p1",
      token: "p1-token",
    });
    expect(readSeatSession("ABC123", params({ seat: "p2" }), stored)).toBeNull();
  });

  it("allows a URL token without a Seat only when it matches the stored token", () => {
    expect(readSeatSession("ABC123", params({ token: "p1-token" }), stored)).toEqual({
      seat: "p1",
      token: "p1-token",
    });
    expect(readSeatSession("ABC123", params({ token: "other" }), stored)).toBeNull();
  });

  it("returns null without a URL session or storage", () => {
    expect(readSeatSession("ABC123", params({}), null)).toBeNull();
  });
});

describe("isSeatSession", () => {
  it("accepts only the two Seats with a non-empty token", () => {
    expect(isSeatSession({ seat: "p1", token: "x" })).toBe(true);
    expect(isSeatSession({ seat: "p2", token: "x" })).toBe(true);
    expect(isSeatSession({ seat: "p3", token: "x" })).toBe(false);
    expect(isSeatSession({ seat: "p1", token: "" })).toBe(false);
    expect(isSeatSession(null)).toBe(false);
    expect(isSeatSession("p1")).toBe(false);
  });
});
