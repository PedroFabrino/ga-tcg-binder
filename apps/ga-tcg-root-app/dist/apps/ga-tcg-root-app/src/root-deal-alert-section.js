"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureAlertSection = ensureAlertSection;
const SECTION_NAME = "GA Alerts";
/**
 * Returns the channel group (section) that holds per-user deal-alert channels,
 * creating and persisting it on first use. The id lives in the per-community
 * config, so the section is created once and reused across runs.
 */
async function ensureAlertSection(api, config) {
    const existing = await config.getAlertSectionId();
    if (existing) {
        return existing;
    }
    const created = await api.createChannelGroup(SECTION_NAME);
    await config.setAlertSectionId(created.id);
    return created.id;
}
