"use strict";
/**
 * WebRTC signaling and ICE server contracts for the GrandTable Feed.
 *
 * These are the typed shapes the browser-side Feed manager and the server's
 * GET /turn endpoint both build against, so the signaling payload and the ICE
 * server list cannot drift between client and server.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isIceServersResponse = isIceServersResponse;
exports.isSignalPayload = isSignalPayload;
function isIceServerConfig(value) {
    if (typeof value !== "object" || value === null)
        return false;
    const server = value;
    const urls = server.urls;
    const validUrls = typeof urls === "string" ||
        (Array.isArray(urls) && urls.length > 0 && urls.every((url) => typeof url === "string"));
    if (!validUrls)
        return false;
    if ("username" in server && typeof server.username !== "string")
        return false;
    if ("credential" in server && typeof server.credential !== "string")
        return false;
    return true;
}
/** Validate the GET /turn body before an ICE server list reaches RTCPeerConnection. */
function isIceServersResponse(value) {
    if (typeof value !== "object" || value === null)
        return false;
    const response = value;
    return (Array.isArray(response.iceServers) &&
        response.iceServers.every(isIceServerConfig) &&
        typeof response.ttlSeconds === "number" &&
        Number.isFinite(response.ttlSeconds) &&
        response.ttlSeconds >= 0);
}
function isSignalPayload(value) {
    if (typeof value !== "object" || value === null)
        return false;
    const p = value;
    if (p.kind === "offer" || p.kind === "answer") {
        return typeof p.sdp === "string";
    }
    if (p.kind === "ice") {
        return typeof p.candidate === "string";
    }
    return false;
}
