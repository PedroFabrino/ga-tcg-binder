"use strict";
/**
 * Shared vocabulary for notifications and marketplaces.
 *
 * One name per concept, used across notification delivery, market sync, and
 * the pipeline. `root-alert` is the Root deal-alert destination (a private
 * per-user channel plus an in-app notification ping); Root has no DM API.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MESSAGE_MAX_LENGTH = exports.MARKETPLACE_PLATFORMS = exports.ROOT_ALERT_DESTINATION = exports.DISCORD_DM_DESTINATION = exports.DISCORD_DESTINATION = exports.ROOT_DESTINATION = void 0;
exports.readDealAlertDestinations = readDealAlertDestinations;
exports.ROOT_DESTINATION = "root";
exports.DISCORD_DESTINATION = "discord";
exports.DISCORD_DM_DESTINATION = "discord-dm";
exports.ROOT_ALERT_DESTINATION = "root-alert";
const KNOWN_DESTINATIONS = [
    exports.ROOT_DESTINATION,
    exports.DISCORD_DESTINATION,
    exports.DISCORD_DM_DESTINATION,
    exports.ROOT_ALERT_DESTINATION,
];
/**
 * Reads the comma-separated `DEAL_ALERT_DM_DESTINATION` setting (for example
 * `discord-dm,root-alert`). Defaults to both destinations; each delivery
 * process still requires its own credentials (Discord webhook/bot token for
 * Discord, `ROOT_DEAL_ALERT_SECTION_ID` for Root) before it actually sends.
 */
function readDealAlertDestinations(env = process.env) {
    const raw = env.DEAL_ALERT_DM_DESTINATION ??
        `${exports.DISCORD_DM_DESTINATION},${exports.ROOT_ALERT_DESTINATION}`;
    const values = raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    const parsed = values.filter((value) => KNOWN_DESTINATIONS.includes(value));
    const unknown = values.filter((value) => !KNOWN_DESTINATIONS.includes(value));
    if (unknown.length > 0) {
        console.warn(`[deal-alerts] Ignoring unknown DEAL_ALERT_DM_DESTINATION values: ${unknown.join(", ")}`);
    }
    return parsed.length > 0 ? parsed : [exports.DISCORD_DM_DESTINATION];
}
exports.MARKETPLACE_PLATFORMS = [
    "myp",
    "liga_store",
    "lootcards",
];
/** One character budget shared by every notification destination. */
exports.MESSAGE_MAX_LENGTH = 2000;
