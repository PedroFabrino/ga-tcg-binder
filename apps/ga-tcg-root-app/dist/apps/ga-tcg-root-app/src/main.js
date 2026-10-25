"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_bot_1 = require("@rootsdk/server-bot");
const market_notifier_1 = require("./market-notifier");
const deal_alert_notifier_1 = require("./deal-alert-notifier");
const command_handlers_1 = require("./command-handlers");
const community_config_1 = require("./community-config");
const channel_diagnostics_1 = require("./channel-diagnostics");
const root_bot_auth_1 = require("./root-bot-auth");
const diagnostics_1 = require("./diagnostics");
// First beacon, before the SDK lifecycle. If this row never appears, the
// process is not running or cannot reach the API at all.
void (0, diagnostics_1.reportDiagnostic)({
    stage: "boot",
    message: `process started; COMMUNITY_ID=${process.env.COMMUNITY_ID ?? "(unset)"} APP_ID=${process.env.APP_ID ?? "(unset)"}`,
});
async function onStarting(state) {
    const communityId = String(state.communityId ?? process.env.COMMUNITY_ID ?? "");
    await (0, diagnostics_1.reportDiagnostic)({
        stage: "starting",
        communityId,
        message: `community ${communityId || "(empty)"}`,
    });
    // Authenticate immediately so startup is observable and polling has a token,
    // instead of waiting for the first scheduled job.
    try {
        await (0, root_bot_auth_1.getRootBotToken)({ communityId });
        await (0, diagnostics_1.reportDiagnostic)({ stage: "install-ok", communityId });
    }
    catch (err) {
        await (0, diagnostics_1.reportDiagnostic)({
            stage: "install-failed",
            communityId,
            message: err,
            level: server_bot_1.CommunityAppLogType.Error,
        });
    }
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
        await (0, diagnostics_1.reportDiagnostic)({
            stage: "config-read-failed",
            communityId,
            message: err,
            level: server_bot_1.CommunityAppLogType.Warn,
        });
    }
    void (0, channel_diagnostics_1.logCommunityContext)({ sectionId, broadcastChannelId });
    try {
        await (0, market_notifier_1.startMarketNotifier)({ communityId });
        await (0, diagnostics_1.reportDiagnostic)({ stage: "market-notifier-started", communityId });
    }
    catch (err) {
        await (0, diagnostics_1.reportDiagnostic)({
            stage: "market-notifier-failed",
            communityId,
            message: err,
            level: server_bot_1.CommunityAppLogType.Error,
        });
    }
    try {
        await (0, deal_alert_notifier_1.startDealAlertNotifier)({ communityId });
        await (0, diagnostics_1.reportDiagnostic)({ stage: "deal-alert-notifier-started", communityId });
    }
    catch (err) {
        await (0, diagnostics_1.reportDiagnostic)({
            stage: "deal-alert-notifier-failed",
            communityId,
            message: err,
            level: server_bot_1.CommunityAppLogType.Error,
        });
    }
    try {
        (0, command_handlers_1.registerRootCommandHandlers)(communityId);
        await (0, diagnostics_1.reportDiagnostic)({ stage: "commands-registered", communityId });
    }
    catch (err) {
        await (0, diagnostics_1.reportDiagnostic)({
            stage: "commands-failed",
            communityId,
            message: err,
            level: server_bot_1.CommunityAppLogType.Error,
        });
    }
    await (0, diagnostics_1.reportDiagnostic)({ stage: "startup-complete", communityId });
}
(async () => {
    try {
        await server_bot_1.rootServer.lifecycle.start(onStarting);
    }
    catch (err) {
        await (0, diagnostics_1.reportDiagnostic)({
            stage: "lifecycle-failed",
            message: err,
            level: server_bot_1.CommunityAppLogType.Fatal,
        });
        process.exitCode = 1;
    }
})();
