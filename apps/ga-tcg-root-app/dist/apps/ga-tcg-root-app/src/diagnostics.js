"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportDiagnostic = reportDiagnostic;
const server_bot_1 = require("@rootsdk/server-bot");
const describe_error_1 = require("./describe-error");
const root_bot_config_1 = require("./root-bot-config");
const DEFAULT_APP_ID = "ADH-6fbvigmppj1_qgZSmw";
/**
 * Records a startup/poll event in three places, best-effort: stdout, Root's
 * community log, and the web app's `root_bot_diagnostics` table. Root's pod log
 * shipper is unreliable, so the HTTP sink is the dependable one. Never throws
 * and never blocks startup on the SDK.
 */
async function reportDiagnostic(event) {
    const communityId = event.communityId ?? process.env.COMMUNITY_ID ?? "";
    const detail = event.message == null ? "" : (0, describe_error_1.describeError)(event.message);
    const line = `[root] ${event.stage}${detail ? `: ${detail}` : ""}`;
    console.log(line);
    try {
        void server_bot_1.rootServer.dataStore.logs.community
            .create({
            communityAppLogType: event.level ?? server_bot_1.CommunityAppLogType.Info,
            message: line.slice(0, 2000),
        })
            .catch(() => {
            // Community log unavailable; the HTTP sink below is what matters.
        });
    }
    catch {
        // SDK not attached yet.
    }
    try {
        await fetch(`${root_bot_config_1.ROOT_BOT_API_BASE_URL}/api/root-bot/diagnostic`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                appId: process.env.APP_ID ?? DEFAULT_APP_ID,
                communityId,
                stage: event.stage,
                message: detail,
            }),
            signal: AbortSignal.timeout(8000),
        });
    }
    catch {
        // Diagnostics must never take the bot down.
    }
}
