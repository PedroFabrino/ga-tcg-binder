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
    let sectionId = await config.getAlertSectionId();
    if (!sectionId) {
        const created = await api.createChannelGroup(SECTION_NAME);
        await config.setAlertSectionId(created.id);
        sectionId = created.id;
    }
    // Ensure the bot can create per-user channels in this section, whether it is
    // the `/setup` channel's group or the auto-created fallback group.
    try {
        await api.grantBotFullControl(sectionId);
    }
    catch (err) {
        console.warn("[deal-alert] Could not self-grant full control on the alert section:", err instanceof Error ? err.message : err);
    }
    return sectionId;
}
