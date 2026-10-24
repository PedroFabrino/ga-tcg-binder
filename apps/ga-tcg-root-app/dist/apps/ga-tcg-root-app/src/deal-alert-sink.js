"use strict";
/**
 * Root-side copies of the delivery seam types. The cloud bot must not import
 * from the web app (`src/`), so the shapes it needs live here.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMessageIds = parseMessageIds;
/** Parses a stored comma-separated (or legacy JSON) message-id list. */
function parseMessageIds(raw) {
    if (!raw)
        return [];
    const trimmed = raw.trim();
    if (trimmed.startsWith("[")) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return parsed.filter((id) => typeof id === "string" && id.length > 0);
            }
        }
        catch {
            console.warn("[deal-alert-sink] Could not parse message ids as JSON; falling back to comma separation.");
        }
    }
    return trimmed
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
}
