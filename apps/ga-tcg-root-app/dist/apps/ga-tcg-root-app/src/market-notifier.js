"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMarketNotificationPoll = runMarketNotificationPoll;
exports.startMarketNotifier = startMarketNotifier;
const server_bot_1 = require("@rootsdk/server-bot");
const community_config_1 = require("./community-config");
const root_bot_api_1 = require("./root-bot-api");
const root_bot_scheduler_1 = require("./root-bot-scheduler");
const diagnostics_1 = require("./diagnostics");
/**
 * One market-notification poll: pull pending chunks from the API, post them to
 * the `/setup` channel, and report each delivered chunk. A thrown post leaves
 * the remainder for the next poll; a successful post without a message id is
 * still recorded so it is not re-sent.
 */
async function runMarketNotificationPoll(deps) {
    const broadcastChannelId = await deps.config.getBroadcastChannelId();
    if (!broadcastChannelId) {
        deps.warn?.("No broadcast channel configured — run /setup in the target channel. Market notifications paused.");
        return;
    }
    const { chunks } = await deps.api.getMarketNotifications();
    for (const chunk of chunks) {
        const messageId = await deps.postMessage(broadcastChannelId, chunk.content);
        if (!messageId) {
            deps.warn?.("Posted a market chunk but received no message id; recording delivery to avoid duplicates.");
        }
        await deps.api.markMarketNotificationsDelivered({
            notificationIds: chunk.notificationIds,
            messageIds: messageId ? [messageId] : [],
        });
    }
}
/**
 * Starts the market-notification poller. It runs one poll immediately, then
 * schedules subsequent polls on Root's job scheduler (with a local watchdog).
 * The broadcast channel comes from per-community config (`/setup`); all data
 * comes from the API, so the bot holds no database or Discord secrets.
 */
async function startMarketNotifier(options = {}) {
    const communityId = options.communityId ?? process.env.COMMUNITY_ID ?? "";
    const api = options.api ?? new root_bot_api_1.RootBotApi({ communityId });
    const config = options.config ?? (0, community_config_1.createCommunityConfig)(server_bot_1.rootServer.dataStore.appData);
    const postMessage = options.postMessage ??
        (async (channelId, content) => {
            const message = await server_bot_1.rootServer.community.channelMessages.create({
                channelId: channelId,
                content,
            });
            return message?.id ? String(message.id) : null;
        });
    const intervalMs = options.intervalMs ??
        Number.parseInt(process.env.ROOT_BOT_POLL_INTERVAL_MS ?? "30000", 10);
    const run = async () => {
        try {
            await runMarketNotificationPoll({ api, config, postMessage });
        }
        catch (err) {
            await (0, diagnostics_1.reportDiagnostic)({
                stage: "market-poll-failed",
                communityId,
                message: err,
                level: server_bot_1.CommunityAppLogType.Error,
            });
        }
    };
    await run();
    await (0, root_bot_scheduler_1.scheduleRootBotPolling)({
        scheduler: options.scheduler ?? server_bot_1.rootServer.jobScheduler,
        resourceId: "ga-market-notifications",
        tag: "market-notifications",
        intervalMs,
        run,
        onError: (err) => {
            void (0, diagnostics_1.reportDiagnostic)({
                stage: "market-scheduler-failed",
                communityId,
                message: err,
                level: server_bot_1.CommunityAppLogType.Error,
            });
        },
    });
}
