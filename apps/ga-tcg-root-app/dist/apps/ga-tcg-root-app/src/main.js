"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_bot_1 = require("@rootsdk/server-bot");
const market_notifier_1 = require("./market-notifier");
const deal_alert_notifier_1 = require("./deal-alert-notifier");
const command_handlers_1 = require("./command-handlers");
const community_config_1 = require("./community-config");
const channel_diagnostics_1 = require("./channel-diagnostics");
async function onStarting(state) {
    console.log(`[root] Starting bot in community ${state.communityId}`);
    let sectionId;
    let broadcastChannelId;
    try {
        const config = (0, community_config_1.createCommunityConfig)(server_bot_1.rootServer.dataStore.appData);
        [sectionId, broadcastChannelId] = await Promise.all([
            config.getAlertSectionId(),
            config.getBroadcastChannelId(),
        ]);
    }
    catch (err) {
        console.warn("[root] Could not read community config yet:", err instanceof Error ? err.message : err);
    }
    void (0, channel_diagnostics_1.logCommunityContext)({ sectionId, broadcastChannelId });
    await (0, market_notifier_1.startMarketNotifier)({ communityId: state.communityId });
    await (0, deal_alert_notifier_1.startDealAlertNotifier)({ communityId: state.communityId });
    (0, command_handlers_1.registerRootCommandHandlers)(state.communityId);
}
(async () => {
    await server_bot_1.rootServer.lifecycle.start(onStarting);
})();
