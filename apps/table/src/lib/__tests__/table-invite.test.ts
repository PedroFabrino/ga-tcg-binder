import { describe, expect, it } from "vitest";
import {
  isTableInvite,
  readTableInvite,
  saveTableInvite,
  tableInviteStorageKey,
  type InviteStorage,
} from "../table-invite";

function fakeStorage(initial: Record<string, string> = {}): InviteStorage & {
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

describe("table invite storage", () => {
  it("round-trips the invite under an upper-cased room code", () => {
    const storage = fakeStorage();
    saveTableInvite("abc123", { p2Token: "p2", viewerToken: "view" }, storage);

    expect(tableInviteStorageKey("abc123")).toBe("gt.invite.ABC123");
    expect(storage.values["gt.invite.ABC123"]).toBe(
      '{"p2Token":"p2","viewerToken":"view"}'
    );
    expect(readTableInvite("ABC123", storage)).toEqual({
      p2Token: "p2",
      viewerToken: "view",
    });
  });

  it("ignores malformed JSON and a record with a missing token", () => {
    expect(
      readTableInvite("ABC123", fakeStorage({ "gt.invite.ABC123": "{not json" }))
    ).toBeNull();
    expect(
      readTableInvite(
        "ABC123",
        fakeStorage({ "gt.invite.ABC123": '{"p2Token":"p2"}' })
      )
    ).toBeNull();
  });

  it("does not throw when storage is unavailable or throws", () => {
    expect(readTableInvite("ABC123", null)).toBeNull();
    expect(
      readTableInvite("ABC123", {
        getItem: () => {
          throw new Error("blocked");
        },
      })
    ).toBeNull();
    expect(() =>
      saveTableInvite(
        "ABC123",
        { p2Token: "p2", viewerToken: "view" },
        {
          setItem: () => {
            throw new Error("quota");
          },
        }
      )
    ).not.toThrow();
  });
});

describe("isTableInvite", () => {
  it("requires both non-empty tokens", () => {
    expect(isTableInvite({ p2Token: "p2", viewerToken: "view" })).toBe(true);
    expect(isTableInvite({ p2Token: "", viewerToken: "view" })).toBe(false);
    expect(isTableInvite({ p2Token: "p2", viewerToken: "" })).toBe(false);
    expect(isTableInvite({ p2Token: "p2" })).toBe(false);
    expect(isTableInvite(null)).toBe(false);
    expect(isTableInvite("p2")).toBe(false);
  });
});
