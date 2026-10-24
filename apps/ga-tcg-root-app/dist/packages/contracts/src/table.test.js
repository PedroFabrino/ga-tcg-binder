"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const index_1 = require("./index");
const seatState = {
    displayName: "Alice",
    championSlug: "lorraine-wandering-warrior",
    damage: 11,
    memory: 3,
    hand: 4,
};
const pin = { seat: "p1", cardSlug: "cremation-ritual", at: 1000 };
(0, vitest_1.describe)("table contracts", () => {
    (0, vitest_1.it)("recognises seat ids and table roles", () => {
        (0, vitest_1.expect)((0, index_1.isSeatId)("p1")).toBe(true);
        (0, vitest_1.expect)((0, index_1.isSeatId)("p2")).toBe(true);
        (0, vitest_1.expect)((0, index_1.isSeatId)("p3")).toBe(false);
        (0, vitest_1.expect)((0, index_1.isSeatId)(null)).toBe(false);
        (0, vitest_1.expect)((0, index_1.isTableRole)("seat")).toBe(true);
        (0, vitest_1.expect)((0, index_1.isTableRole)("capture")).toBe(true);
        (0, vitest_1.expect)((0, index_1.isTableRole)("viewer")).toBe(true);
        (0, vitest_1.expect)((0, index_1.isTableRole)("admin")).toBe(false);
    });
    (0, vitest_1.it)("validates SeatState", () => {
        (0, vitest_1.expect)((0, index_1.isSeatState)(seatState)).toBe(true);
        (0, vitest_1.expect)((0, index_1.isSeatState)({ ...seatState, championSlug: null })).toBe(true);
        (0, vitest_1.expect)((0, index_1.isSeatState)({ ...seatState, damage: "11" })).toBe(false);
        (0, vitest_1.expect)((0, index_1.isSeatState)({})).toBe(false);
        (0, vitest_1.expect)((0, index_1.isSeatState)(null)).toBe(false);
    });
    (0, vitest_1.it)("validates SeatState patches and rejects unknown keys", () => {
        (0, vitest_1.expect)((0, index_1.isSeatStatePatch)({ damage: 11 })).toBe(true);
        (0, vitest_1.expect)((0, index_1.isSeatStatePatch)({ displayName: "Bob", hand: 5 })).toBe(true);
        (0, vitest_1.expect)((0, index_1.isSeatStatePatch)({})).toBe(true);
        (0, vitest_1.expect)((0, index_1.isSeatStatePatch)({ bogus: 1 })).toBe(false);
        (0, vitest_1.expect)((0, index_1.isSeatStatePatch)({ damage: "high" })).toBe(false);
        (0, vitest_1.expect)((0, index_1.isSeatStatePatch)({ damage: -1 })).toBe(false);
        (0, vitest_1.expect)((0, index_1.isSeatStatePatch)({ memory: 1.5 })).toBe(false);
        (0, vitest_1.expect)((0, index_1.isSeatStatePatch)({ hand: Number.NaN })).toBe(false);
        (0, vitest_1.expect)((0, index_1.isSeatStatePatch)({ hand: Number.POSITIVE_INFINITY })).toBe(false);
        (0, vitest_1.expect)((0, index_1.isSeatStatePatch)({ damage: 0, memory: 3, hand: 7 })).toBe(true);
        (0, vitest_1.expect)((0, index_1.isSeatStatePatch)(null)).toBe(false);
    });
    (0, vitest_1.it)("validates Pin", () => {
        (0, vitest_1.expect)((0, index_1.isPin)(pin)).toBe(true);
        (0, vitest_1.expect)((0, index_1.isPin)({ ...pin, printingSlug: "doa-1st" })).toBe(true);
        (0, vitest_1.expect)((0, index_1.isPin)({ ...pin, seat: "p3" })).toBe(false);
        (0, vitest_1.expect)((0, index_1.isPin)({ ...pin, at: "soon" })).toBe(false);
    });
    (0, vitest_1.it)("validates TableClientMessage", () => {
        const hello = { type: "TABLE_HELLO", code: "C", token: "t", role: "seat" };
        (0, vitest_1.expect)((0, index_1.isTableClientMessage)(hello)).toBe(true);
        (0, vitest_1.expect)((0, index_1.isTableClientMessage)({ type: "SEAT_UPDATE", patch: { damage: 1 } })).toBe(true);
        (0, vitest_1.expect)((0, index_1.isTableClientMessage)({ type: "TURN_START" })).toBe(true);
        (0, vitest_1.expect)((0, index_1.isTableClientMessage)({ type: "TURN_END" })).toBe(true);
        (0, vitest_1.expect)((0, index_1.isTableClientMessage)({ type: "PIN_SET", cardSlug: "x" })).toBe(true);
        (0, vitest_1.expect)((0, index_1.isTableClientMessage)({ type: "PIN_SET", cardSlug: "x", printingSlug: "x-doa" })).toBe(true);
        (0, vitest_1.expect)((0, index_1.isTableClientMessage)({ type: "PIN_CLEAR" })).toBe(true);
        (0, vitest_1.expect)((0, index_1.isTableClientMessage)({ type: "RIPPLE", x: 0.5, y: 0.5 })).toBe(true);
        (0, vitest_1.expect)((0, index_1.isTableClientMessage)({ type: "SIGNAL", to: { seat: "p2", role: "capture" }, data: {} })).toBe(true);
        (0, vitest_1.expect)((0, index_1.isTableClientMessage)({ type: "SEAT_UPDATE", patch: { bogus: 1 } })).toBe(false);
        (0, vitest_1.expect)((0, index_1.isTableClientMessage)({ type: "PIN_SET", cardSlug: "" })).toBe(false);
        (0, vitest_1.expect)((0, index_1.isTableClientMessage)({ type: "PIN_SET", cardSlug: "x", printingSlug: "" })).toBe(false);
        (0, vitest_1.expect)((0, index_1.isTableClientMessage)({ type: "RIPPLE", x: 0.5 })).toBe(false);
        (0, vitest_1.expect)((0, index_1.isTableClientMessage)({ type: "RIPPLE", x: 1.5, y: 0.5 })).toBe(false);
        (0, vitest_1.expect)((0, index_1.isTableClientMessage)({ type: "RIPPLE", x: Number.NaN, y: 0.5 })).toBe(false);
        (0, vitest_1.expect)((0, index_1.isTableClientMessage)({ type: "NOPE" })).toBe(false);
        (0, vitest_1.expect)((0, index_1.isTableClientMessage)(null)).toBe(false);
    });
    (0, vitest_1.it)("validates TableServerMessage", () => {
        (0, vitest_1.expect)((0, index_1.isTableServerMessage)({ type: "TABLE_STATE", state: {} })).toBe(true);
        (0, vitest_1.expect)((0, index_1.isTableServerMessage)({ type: "SIGNAL", from: { seat: "p1", role: "capture" }, data: {} })).toBe(true);
        (0, vitest_1.expect)((0, index_1.isTableServerMessage)({ type: "PRESENCE", participants: [] })).toBe(true);
        (0, vitest_1.expect)((0, index_1.isTableServerMessage)({ type: "TABLE_ERROR", code: "x", message: "y" })).toBe(true);
        (0, vitest_1.expect)((0, index_1.isTableServerMessage)({ type: "TABLE_STATE" })).toBe(false);
        (0, vitest_1.expect)((0, index_1.isTableServerMessage)({ type: "PRESENCE", participants: "nope" })).toBe(false);
        (0, vitest_1.expect)((0, index_1.isTableServerMessage)({ type: "NOPE" })).toBe(false);
    });
    (0, vitest_1.it)("validates TableCredentials", () => {
        const creds = {
            code: "ABC234",
            p1Token: "a1",
            p2Token: "b2",
            viewerToken: "c3",
        };
        (0, vitest_1.expect)((0, index_1.isTableCredentials)(creds)).toBe(true);
        (0, vitest_1.expect)((0, index_1.isTableCredentials)({ ...creds, viewerToken: undefined })).toBe(false);
        (0, vitest_1.expect)((0, index_1.isTableCredentials)({ ...creds, code: 7 })).toBe(false);
        (0, vitest_1.expect)((0, index_1.isTableCredentials)(null)).toBe(false);
    });
    (0, vitest_1.it)("does not accept a server SIGNAL as a client message, or vice versa", () => {
        (0, vitest_1.expect)((0, index_1.isTableClientMessage)({ type: "SIGNAL", from: { seat: "p1", role: "capture" }, data: {} })).toBe(false);
        (0, vitest_1.expect)((0, index_1.isTableServerMessage)({ type: "SIGNAL", to: { seat: "p1", role: "capture" }, data: {} })).toBe(false);
    });
});
