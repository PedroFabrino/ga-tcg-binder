"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleNotifyCommand = handleNotifyCommand;
exports.handleSetupCommand = handleSetupCommand;
const server_app_1 = require("@rootsdk/server-app");
const diagnostics_1 = require("../diagnostics");
async function handleNotifyCommand(argString, userId, deps) {
    const parts = argString.toLowerCase().split(/\s+/).filter(Boolean);
    let action = parts[0];
    let modeArg = parts[1];
    if (action === "all" || action === "hard") {
        modeArg = action;
        action = "on";
    }
    if (action !== "on" && action !== "off") {
        return ("⚠️ **Usage:** `/notify on [all|hard]`, `/notify all|hard`, or `/notify off`\n" +
            "• `/notify on all`: Alert on all shortages (hard + shared) and general wantlist\n" +
            "• `/notify on hard`: Alert only on hard shortages and general wantlist\n" +
            "• `/notify off`: Turn off private deal alerts");
    }
    let mode;
    if (action === "on") {
        if (modeArg === "hard")
            mode = "hard";
        else if (modeArg === "all")
            mode = "all";
        else if (modeArg === undefined)
            mode = undefined;
        else {
            return ("⚠️ **Usage:** `/notify on [all|hard]`\n" +
                "Unknown mode. Use `all` (everything) or `hard` (hard shortages + wantlist).");
        }
    }
    const collectorId = await deps.findCollectorId(userId);
    if (!collectorId) {
        return ("⚠️ **Grand Archive Binder Account Not Linked**\n" +
            "Link or register your account first:\n" +
            "• Run `/register` to create a new binder account instantly\n" +
            "• Or run `/link <code>` using your pairing code from GA Binder web app.");
    }
    if (action === "on") {
        await deps.setNotificationPreference(userId, true, ...(mode !== undefined ? [mode] : []));
        let alertsChannelId = null;
        try {
            alertsChannelId = await deps.ensureRecipientChannel(userId);
        }
        catch (err) {
            await (0, diagnostics_1.reportDiagnostic)({
                stage: "notify-create-channel-failed",
                message: err,
                level: server_app_1.CommunityAppLogType.Error,
            });
        }
        try {
            await deps.provisionDealAlerts();
        }
        catch (err) {
            await (0, diagnostics_1.reportDiagnostic)({
                stage: "notify-provision-failed",
                message: err,
                level: server_app_1.CommunityAppLogType.Error,
            });
        }
        const scope = mode === "hard" ? " (hard shortages + wantlist)" : "";
        return alertsChannelId
            ? `🔔 **Deal alerts enabled${scope}.** Your alerts will arrive in [your private channel](root://channel/${alertsChannelId}).`
            : `🔔 **Deal alerts enabled${scope}.** Your private channel will be created on the next marketplace sync.`;
    }
    await deps.setNotificationPreference(userId, false);
    await deps.removeDealAlertChannel(userId);
    return "🔕 **Deal alerts disabled.**\nYour private deal-alert channel has been removed.";
}
async function handleSetupCommand(argString, userId, channelId, deps) {
    if (!(await deps.isCommunityAdmin(userId))) {
        return "⚠️ Only community admins (Manage Apps) or the owner can run `/setup`.";
    }
    if (!channelId) {
        return "⚠️ Run `/setup` inside the channel you want market updates posted to.";
    }
    if (argString.toLowerCase() !== "confirm") {
        return ("⚠️ **Market setup.** I'll create a dedicated **GA Market** group with a **#market** channel for store updates, and per-user alert channels will live there too.\n" +
            "Run `/setup confirm` to apply it.");
    }
    const marketChannelName = await deps.configureFromChannel(channelId);
    return `✅ **Setup complete.** I created the **GA Market** group with a **#${marketChannelName}** channel for market updates, and per-user alert channels will be created there.`;
}
