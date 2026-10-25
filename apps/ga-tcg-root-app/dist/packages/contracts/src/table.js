"use strict";
/**
 * GrandTable tabletop contracts.
 *
 * The single source of truth for every shape that crosses a Table boundary:
 * seat state, pins, ripples, the action log, and the room message union.
 * These are the "fence" the room state machine (server) and the state reducer
 * (client) both build against, so neither can drift from the other.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RIPPLE_TTL_MS = void 0;
exports.isSeatId = isSeatId;
exports.isTableRole = isTableRole;
exports.isSeatState = isSeatState;
exports.isSeatStatePatch = isSeatStatePatch;
exports.isPin = isPin;
exports.isSignalTarget = isSignalTarget;
exports.isTableClientMessage = isTableClientMessage;
exports.isTableCredentials = isTableCredentials;
exports.isTableServerMessage = isTableServerMessage;
/** How long a pointer marker stays on the Table. It is never persisted. */
exports.RIPPLE_TTL_MS = 4_000;
// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------
function isSeatId(value) {
    return value === "p1" || value === "p2";
}
function isTableRole(value) {
    return value === "seat" || value === "capture" || value === "viewer";
}
/** A HUD counter: a finite, non-negative integer (MVP_SPEC §6.3). */
function isCounter(value) {
    return (typeof value === "number" &&
        Number.isFinite(value) &&
        Number.isInteger(value) &&
        value >= 0);
}
function isSeatState(value) {
    if (typeof value !== "object" || value === null)
        return false;
    const s = value;
    return (typeof s.displayName === "string" &&
        (typeof s.championSlug === "string" || s.championSlug === null) &&
        isCounter(s.damage) &&
        isCounter(s.memory) &&
        isCounter(s.hand));
}
/** A partial SeatState with no unknown keys and correctly typed values. */
function isSeatStatePatch(value) {
    if (typeof value !== "object" || value === null)
        return false;
    const p = value;
    const allowed = new Set(["displayName", "championSlug", "damage", "memory", "hand"]);
    for (const key of Object.keys(p)) {
        if (!allowed.has(key))
            return false;
    }
    if ("displayName" in p && typeof p.displayName !== "string")
        return false;
    if ("championSlug" in p && typeof p.championSlug !== "string" && p.championSlug !== null)
        return false;
    for (const key of ["damage", "memory", "hand"]) {
        if (key in p && !isCounter(p[key]))
            return false;
    }
    return true;
}
function isPin(value) {
    if (typeof value !== "object" || value === null)
        return false;
    const p = value;
    return (isSeatId(p.seat) &&
        typeof p.cardSlug === "string" &&
        (p.printingSlug === undefined || typeof p.printingSlug === "string") &&
        typeof p.at === "number");
}
function isSignalTarget(value) {
    if (typeof value !== "object" || value === null)
        return false;
    const t = value;
    return isSeatId(t.seat) && isTableRole(t.role);
}
function isTableClientMessage(value) {
    if (typeof value !== "object" || value === null)
        return false;
    const m = value;
    switch (m.type) {
        case "TABLE_HELLO":
            return typeof m.code === "string" && typeof m.token === "string" && isTableRole(m.role);
        case "SEAT_UPDATE":
            return isSeatStatePatch(m.patch);
        case "TURN_START":
        case "TURN_END":
        case "PIN_CLEAR":
            return true;
        case "PIN_SET":
            return (typeof m.cardSlug === "string" &&
                m.cardSlug.length > 0 &&
                (m.printingSlug === undefined ||
                    (typeof m.printingSlug === "string" && m.printingSlug.length > 0)));
        case "RIPPLE":
            return (typeof m.x === "number" &&
                typeof m.y === "number" &&
                Number.isFinite(m.x) &&
                Number.isFinite(m.y) &&
                m.x >= 0 &&
                m.x <= 1 &&
                m.y >= 0 &&
                m.y <= 1);
        case "SIGNAL":
            return isSignalTarget(m.to);
        default:
            return false;
    }
}
function isTableCredentials(value) {
    if (typeof value !== "object" || value === null)
        return false;
    const c = value;
    return (typeof c.code === "string" &&
        typeof c.p1Token === "string" &&
        typeof c.p2Token === "string" &&
        typeof c.viewerToken === "string");
}
function isTableServerMessage(value) {
    if (typeof value !== "object" || value === null)
        return false;
    const m = value;
    switch (m.type) {
        case "TABLE_STATE":
            return typeof m.state === "object" && m.state !== null;
        case "SIGNAL":
            return isSignalTarget(m.from);
        case "PRESENCE":
            return Array.isArray(m.participants);
        case "TABLE_ERROR":
            return typeof m.code === "string" && typeof m.message === "string";
        default:
            return false;
    }
}
