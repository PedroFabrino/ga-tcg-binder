import { describe, expect, it, vi } from "vitest";

vi.mock("@rootsdk/server-bot", () => ({
  ErrorCodeType: { 11: "Policy", Policy: 11, 2: "NotFound", NotFound: 2 },
}));

import { describeError } from "../describe-error";

describe("describeError", () => {
  it("decodes a Root API error code and its ids", () => {
    const err = Object.assign(new Error("error"), {
      name: "RootApiException",
      errorCode: 11,
      whereId: "channel-1",
    });

    expect(describeError(err)).toBe(
      "RootApiException: error | errorCode=Policy(11) whereId=channel-1"
    );
  });

  it("falls back to Unknown for unmapped Root error codes", () => {
    const err = Object.assign(new Error("error"), { errorCode: 999 });

    expect(describeError(err)).toContain("errorCode=Unknown(999)");
  });

  it("walks the cause chain to expose network error codes", () => {
    const root = Object.assign(new Error("Connect Timeout Error"), {
      code: "UND_ERR_CONNECT_TIMEOUT",
    });
    const err = new TypeError("fetch failed", { cause: root });

    expect(describeError(err)).toBe(
      "TypeError: fetch failed <- caused by: Error: Connect Timeout Error | code=UND_ERR_CONNECT_TIMEOUT"
    );
  });

  it("includes the RPC service, method and metadata of an RpcError", () => {
    const err = Object.assign(new Error("error"), {
      name: "RpcError",
      code: "UNAVAILABLE",
      serviceName: "root.CommunityChannelMessageGrpcService",
      methodName: "Create",
      meta: { "grpc-message": "backend down" },
    });

    expect(describeError(err)).toBe(
      'RpcError: error | code=UNAVAILABLE | rpc=root.CommunityChannelMessageGrpcService/Create | meta={"grpc-message":"backend down"}'
    );
  });

  it("omits empty RpcError metadata", () => {
    const err = Object.assign(new Error("error"), { code: "UNAVAILABLE", meta: {} });

    expect(describeError(err)).not.toContain("meta=");
  });

  it("stops at the maximum cause depth", () => {
    let err: Error = new Error("level-0");
    for (let i = 1; i < 10; i++) {
      err = new Error(`level-${i}`, { cause: err });
    }

    expect(describeError(err).split(" <- caused by: ")).toHaveLength(5);
  });

  it("describes non-Error values", () => {
    expect(describeError("boom")).toBe("boom");
    expect(describeError({ errorCode: 2 })).toBe("errorCode=NotFound(2)");
    expect(describeError({ foo: 1 })).toBe('{"foo":1}');
  });
});
