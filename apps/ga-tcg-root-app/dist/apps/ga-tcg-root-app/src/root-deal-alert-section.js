"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureAlertSection = ensureAlertSection;
/**
 * Returns the configured channel group (section) that holds per-user deal-alert
 * channels, or `undefined` if the market channels have not been provisioned yet. The app no
 * longer auto-creates a fallback group — that produced a duplicate group next
 * to the one provisioned in the Assistant App GUI.
 */
async function ensureAlertSection(config) {
    return config.getAlertSectionId();
}
