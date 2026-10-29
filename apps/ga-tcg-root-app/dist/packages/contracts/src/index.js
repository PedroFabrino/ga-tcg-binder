"use strict";
/**
 * @ga/contracts
 * Shared domain models, camera vision types, and WebSocket protocol definitions
 * for Grand Archive TCG Collector & Companion Scanner.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_FEATURE_FLAGS = exports.DEFAULT_QUALITY_GATE = exports.CARD_ASPECT = exports.CARD_H = exports.CARD_W = void 0;
exports.isWsClientMessage = isWsClientMessage;
exports.isWsServerMessage = isWsServerMessage;
exports.parseFeatureFlag = parseFeatureFlag;
exports.CARD_W = 630;
exports.CARD_H = 880;
exports.CARD_ASPECT = 2.5 / 3.5;
exports.DEFAULT_QUALITY_GATE = {
    minCoverage: 0.6,
    maxCornerDeltaPx: 8,
    minSharpness: 70,
    maxGlareRatio: 0.12,
    glareLuminance: 250,
    requiredFrames: 3,
};
// ---------------------------------------------------------------------------
// Type Guards
// ---------------------------------------------------------------------------
function isWsClientMessage(data) {
    if (typeof data !== "object" || data === null)
        return false;
    const msg = data;
    return (typeof msg.type === "string" &&
        typeof msg.sessionId === "string" &&
        [
            "SESSION_JOIN",
            "SESSION_PING",
            "SCAN_IDENTIFY_REQUEST",
            "SCAN_FRAME_PROCESS_REQUEST",
            "CARD_PREVIEW",
            "CARD_COMMITTED",
            "CARD_UPDATE_FINISH",
            "SESSION_DISCONNECT",
        ].includes(msg.type));
}
function isWsServerMessage(data) {
    if (typeof data !== "object" || data === null)
        return false;
    const msg = data;
    return (typeof msg.type === "string" &&
        [
            "SESSION_STATUS",
            "SESSION_PONG",
            "SCAN_IDENTIFY_RESPONSE",
            "CARD_BROADCAST",
            "CARD_FINISH_UPDATED",
            "ERROR",
        ].includes(msg.type));
}
exports.DEFAULT_FEATURE_FLAGS = {
    scanner: false,
};
/**
 * Safely parse a boolean feature flag from environment variables or strings.
 * Defaults to `false` unless explicitly truthy ("true", "1", "yes", "on").
 */
function parseFeatureFlag(val, defaultValue = false) {
    if (typeof val === "boolean")
        return val;
    if (typeof val === "string") {
        const lower = val.trim().toLowerCase();
        if (lower === "true" || lower === "1" || lower === "yes" || lower === "on")
            return true;
        if (lower === "false" || lower === "0" || lower === "no" || lower === "off")
            return false;
    }
    return defaultValue;
}
// ---------------------------------------------------------------------------
// Internationalization (i18n)
// ---------------------------------------------------------------------------
__exportStar(require("./i18n"), exports);
__exportStar(require("./i18n-root-app"), exports);
// ---------------------------------------------------------------------------
// Fulfillment Contracts
// ---------------------------------------------------------------------------
__exportStar(require("./fulfillment"), exports);
// ---------------------------------------------------------------------------
// Assistant Contracts & Client
// ---------------------------------------------------------------------------
__exportStar(require("./assistant"), exports);
// ---------------------------------------------------------------------------
// Featured Sets Contracts
// ---------------------------------------------------------------------------
__exportStar(require("./sets"), exports);
// ---------------------------------------------------------------------------
// GrandTable Tabletop Contracts
// ---------------------------------------------------------------------------
__exportStar(require("./table"), exports);
// ---------------------------------------------------------------------------
// GrandTable WebRTC Contracts
// ---------------------------------------------------------------------------
__exportStar(require("./webrtc"), exports);
// ---------------------------------------------------------------------------
// Root bot API Contracts
// ---------------------------------------------------------------------------
__exportStar(require("./root-bot"), exports);
// ---------------------------------------------------------------------------
// Deck Advisor Contracts
// ---------------------------------------------------------------------------
__exportStar(require("./deck-advisor"), exports);
