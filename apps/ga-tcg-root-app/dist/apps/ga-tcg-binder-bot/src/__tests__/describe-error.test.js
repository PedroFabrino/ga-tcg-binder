"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
vitest_1.vi.mock("@rootsdk/server-bot", () => ({
    ErrorCodeType: { 11: "Policy", Policy: 11, 2: "NotFound", NotFound: 2 },
}));
const describe_error_1 = require("../describe-error");
(0, vitest_1.describe)("describeError", () => {
    (0, vitest_1.it)("decodes a Root API error code and its ids", () => {
        const err = Object.assign(new Error("error"), {
            name: "RootApiException",
            errorCode: 11,
            whereId: "channel-1",
        });
        (0, vitest_1.expect)((0, describe_error_1.describeError)(err)).toBe("RootApiException: error | errorCode=Policy(11) whereId=channel-1");
    });
    (0, vitest_1.it)("falls back to Unknown for unmapped Root error codes", () => {
        const err = Object.assign(new Error("error"), { errorCode: 999 });
        (0, vitest_1.expect)((0, describe_error_1.describeError)(err)).toContain("errorCode=Unknown(999)");
    });
    (0, vitest_1.it)("walks the cause chain to expose network error codes", () => {
        const root = Object.assign(new Error("Connect Timeout Error"), {
            code: "UND_ERR_CONNECT_TIMEOUT",
        });
        const err = new TypeError("fetch failed", { cause: root });
        (0, vitest_1.expect)((0, describe_error_1.describeError)(err)).toBe("TypeError: fetch failed <- caused by: Error: Connect Timeout Error | code=UND_ERR_CONNECT_TIMEOUT");
    });
    (0, vitest_1.it)("includes the RPC service, method and metadata of an RpcError", () => {
        const err = Object.assign(new Error("error"), {
            name: "RpcError",
            code: "UNAVAILABLE",
            serviceName: "root.CommunityChannelMessageGrpcService",
            methodName: "Create",
            meta: { "grpc-message": "backend down" },
        });
        (0, vitest_1.expect)((0, describe_error_1.describeError)(err)).toBe('RpcError: error | code=UNAVAILABLE | rpc=root.CommunityChannelMessageGrpcService/Create | meta={"grpc-message":"backend down"}');
    });
    (0, vitest_1.it)("omits empty RpcError metadata", () => {
        const err = Object.assign(new Error("error"), { code: "UNAVAILABLE", meta: {} });
        (0, vitest_1.expect)((0, describe_error_1.describeError)(err)).not.toContain("meta=");
    });
    (0, vitest_1.it)("stops at the maximum cause depth", () => {
        let err = new Error("level-0");
        for (let i = 1; i < 10; i++) {
            err = new Error(`level-${i}`, { cause: err });
        }
        (0, vitest_1.expect)((0, describe_error_1.describeError)(err).split(" <- caused by: ")).toHaveLength(5);
    });
    (0, vitest_1.it)("describes non-Error values", () => {
        (0, vitest_1.expect)((0, describe_error_1.describeError)("boom")).toBe("boom");
        (0, vitest_1.expect)((0, describe_error_1.describeError)({ errorCode: 2 })).toBe("errorCode=NotFound(2)");
        (0, vitest_1.expect)((0, describe_error_1.describeError)({ foo: 1 })).toBe('{"foo":1}');
    });
});
