"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureAlertSection = ensureAlertSection;
/**
 * Returns the configured channel group (section) that holds per-user deal-alert
 * channels, or `undefined` if `/setup` has not configured one yet. The bot no
 * longer auto-creates a fallback group — that produced a duplicate group next
 * to the one `/setup` creates.
 */
async function ensureAlertSection(config) {
    return config.getAlertSectionId();
}
