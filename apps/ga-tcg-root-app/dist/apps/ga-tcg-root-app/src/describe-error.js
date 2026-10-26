"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.describeError = describeError;
const server_app_1 = require("@rootsdk/server-app");
const MAX_CAUSE_DEPTH = 5;
const ROOT_ID_FIELDS = ["id", "whoId", "whatId", "whereId", "parentId"];
function describeRootFields(err) {
    if (typeof err.errorCode !== "number") {
        return null;
    }
    const name = server_app_1.ErrorCodeType[err.errorCode] ?? "Unknown";
    const ids = ROOT_ID_FIELDS.filter((field) => err[field] != null).map((field) => `${field}=${String(err[field])}`);
    return ids.length > 0
        ? `errorCode=${name}(${err.errorCode}) ${ids.join(" ")}`
        : `errorCode=${name}(${err.errorCode})`;
}
function describeMeta(meta) {
    if (typeof meta !== "object" || meta === null || Object.keys(meta).length === 0) {
        return null;
    }
    return JSON.stringify(meta);
}
function describeOne(err) {
    if (err instanceof Error) {
        const record = err;
        const parts = [`${err.name}: ${err.message}`];
        const rootFields = describeRootFields(record);
        if (rootFields) {
            parts.push(rootFields);
        }
        if (typeof record.code === "string") {
            parts.push(`code=${record.code}`);
        }
        if (typeof record.serviceName === "string" && typeof record.methodName === "string") {
            parts.push(`rpc=${record.serviceName}/${record.methodName}`);
        }
        const meta = describeMeta(record.meta);
        if (meta) {
            parts.push(`meta=${meta}`);
        }
        return parts.join(" | ");
    }
    if (typeof err === "object" && err !== null) {
        const rootFields = describeRootFields(err);
        return rootFields ?? JSON.stringify(err);
    }
    return String(err);
}
/**
 * Renders an error and its `cause` chain on a single log line, exposing the
 * Root `errorCode` (RootApiException) and Node error codes such as
 * `UND_ERR_CONNECT_TIMEOUT` that `err.message` alone hides.
 */
function describeError(err) {
    const chain = [];
    let current = err;
    for (let depth = 0; depth < MAX_CAUSE_DEPTH && current != null; depth++) {
        chain.push(describeOne(current));
        current = current instanceof Error ? current.cause : undefined;
    }
    return chain.join(" <- caused by: ");
}
