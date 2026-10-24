"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const index_1 = require("./index");
(0, vitest_1.describe)("webrtc contracts", () => {
    (0, vitest_1.it)("validates SignalPayload", () => {
        (0, vitest_1.expect)((0, index_1.isSignalPayload)({ kind: "offer", sdp: "v=0\r\n" })).toBe(true);
        (0, vitest_1.expect)((0, index_1.isSignalPayload)({ kind: "answer", sdp: "v=0\r\n" })).toBe(true);
        (0, vitest_1.expect)((0, index_1.isSignalPayload)({ kind: "ice", candidate: "candidate:1 1 udp 1 0.0.0.0 1 typ host" })).toBe(true);
        (0, vitest_1.expect)((0, index_1.isSignalPayload)({ kind: "offer" })).toBe(false);
        (0, vitest_1.expect)((0, index_1.isSignalPayload)({ kind: "ice" })).toBe(false);
        (0, vitest_1.expect)((0, index_1.isSignalPayload)({ kind: "answer", sdp: 42 })).toBe(false);
        (0, vitest_1.expect)((0, index_1.isSignalPayload)({ kind: "bogus", sdp: "x" })).toBe(false);
        (0, vitest_1.expect)((0, index_1.isSignalPayload)(null)).toBe(false);
        (0, vitest_1.expect)((0, index_1.isSignalPayload)({})).toBe(false);
    });
    (0, vitest_1.it)("exposes the typed interfaces used by the Feed manager", () => {
        const servers = [{ urls: "stun:stun.l.google.com:19302" }];
        const response = { iceServers: servers, ttlSeconds: 3600 };
        const signaling = {
            send: (_p) => { },
            onSignal: (_h) => () => { },
        };
        (0, vitest_1.expect)(response.iceServers).toHaveLength(1);
        (0, vitest_1.expect)(signaling).toBeDefined();
    });
    (0, vitest_1.it)("validates the GET /turn body", () => {
        (0, vitest_1.expect)((0, index_1.isIceServersResponse)({
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                {
                    urls: ["turn:turn.example.com:3478?transport=udp"],
                    username: "user",
                    credential: "secret",
                },
            ],
            ttlSeconds: 3600,
        })).toBe(true);
        (0, vitest_1.expect)((0, index_1.isIceServersResponse)({ iceServers: [], ttlSeconds: 86400 })).toBe(true);
        (0, vitest_1.expect)((0, index_1.isIceServersResponse)({ iceServers: [], ttlSeconds: "3600" })).toBe(false);
        (0, vitest_1.expect)((0, index_1.isIceServersResponse)({ iceServers: [], ttlSeconds: -1 })).toBe(false);
        (0, vitest_1.expect)((0, index_1.isIceServersResponse)({ iceServers: [{ urls: [] }], ttlSeconds: 1 })).toBe(false);
        (0, vitest_1.expect)((0, index_1.isIceServersResponse)({ iceServers: [{ urls: 42 }], ttlSeconds: 1 })).toBe(false);
        (0, vitest_1.expect)((0, index_1.isIceServersResponse)({ iceServers: [{ urls: "stun:x", username: 42 }], ttlSeconds: 1 })).toBe(false);
        (0, vitest_1.expect)((0, index_1.isIceServersResponse)({ iceServers: [] })).toBe(false);
        (0, vitest_1.expect)((0, index_1.isIceServersResponse)(null)).toBe(false);
    });
});
