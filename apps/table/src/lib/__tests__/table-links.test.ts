import { describe, expect, it } from "vitest";
import {
  parseTableCode,
  tableCameraPath,
  tableCameraUrl,
  tableInviteUrl,
  tableSeatPath,
} from "../table-links";

describe("parseTableCode", () => {
  it("accepts a six-character code in any case and trims it", () => {
    expect(parseTableCode("abc123")).toBe("ABC123");
    expect(parseTableCode("  F5TLSV  ")).toBe("F5TLSV");
  });

  it("rejects missing, short, long, or punctuated codes", () => {
    expect(parseTableCode("")).toBeNull();
    expect(parseTableCode("ABC12")).toBeNull();
    expect(parseTableCode("ABC1234")).toBeNull();
    expect(parseTableCode("ABC-12")).toBeNull();
    expect(parseTableCode("https://table.example/t/ABC123")).toBeNull();
  });
});

describe("tableSeatPath", () => {
  it("builds a Seat path with an upper-cased code and encoded token", () => {
    expect(tableSeatPath("abc123", "p1", "p1-token")).toBe(
      "/t/ABC123?seat=p1&token=p1-token"
    );
    expect(tableSeatPath("ABC123", "p2", "a+b")).toBe(
      "/t/ABC123?seat=p2&token=a%2Bb"
    );
  });
});

describe("tableInviteUrl", () => {
  it("builds the absolute p2 invite link from the app origin", () => {
    expect(tableInviteUrl("https://table.example", "abc123", "p2-token")).toBe(
      "https://table.example/t/ABC123?seat=p2&token=p2-token"
    );
  });

  it("anchors the link at the origin root even if the origin has a path", () => {
    expect(tableInviteUrl("https://table.example/preview", "ABC123", "tok")).toBe(
      "https://table.example/t/ABC123?seat=p2&token=tok"
    );
  });
});

describe("tableCameraPath and tableCameraUrl", () => {
  it("builds the Capture Device path with the Seat token", () => {
    expect(tableCameraPath("abc123", "p1", "p1-token")).toBe(
      "/t/ABC123/cam?seat=p1&token=p1-token"
    );
    expect(tableCameraPath("ABC123", "p2", "a+b")).toBe(
      "/t/ABC123/cam?seat=p2&token=a%2Bb"
    );
  });

  it("builds the absolute QR URL from the app origin", () => {
    expect(tableCameraUrl("https://table.example", "abc123", "p1", "tok")).toBe(
      "https://table.example/t/ABC123/cam?seat=p1&token=tok"
    );
  });
});
