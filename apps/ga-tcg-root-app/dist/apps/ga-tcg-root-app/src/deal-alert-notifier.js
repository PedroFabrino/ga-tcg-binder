"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDealAlertPoll = runDealAlertPoll;
exports.startDealAlertNotifier = startDealAlertNotifier;
exports.provisionRootDealAlerts = provisionRootDealAlerts;
exports.ensureRootRecipientChannel = ensureRootRecipientChannel;
exports.removeRootDealAlertChannel = removeRootDealAlertChannel;
const server_bot_1 = require("@rootsdk/server-bot");
const community_config_1 = require("./community-config");
const root_bot_api_1 = require("./root-bot-api");
const root_bot_scheduler_1 = require("./root-bot-scheduler");
const root_deal_alert_section_1 = require("./root-deal-alert-section");
const root_deal_alert_transport_1 = require("./root-deal-alert-transport");
const describe_error_1 = require("./describe-error");
const WELCOME_MESSAGE = "🔔 **Deal alerts are on.** I'll keep this channel updated with cards from your wantlist and deck shortages that are for sale.";
/**
 * One deal-alert poll: ask the API for changed lists + cleanup, deliver to Root
 * channels/notifications, and report the results back. No matching or database
 * work happens in the bot.
 */
async function runDealAlertPoll(deps) {
    const { plans, cleanup } = await deps.api.getDealAlerts();
    const sectionId = await deps.ensureSection();
    const transport = deps.createTransport(sectionId);
    for (const item of cleanup) {
        for (const id of item.messageIds) {
            await transport.delete({ channelId: item.channelId, messageId: id });
        }
        await deps.api.recordDealAlertCleanup(item.recipientId);
    }
    for (const plan of plans) {
        const sentRefs = [];
        let channelId = plan.channelId ?? undefined;
        for (const chunk of plan.chunks) {
            const ref = await transport.send(plan.recipientId, chunk, channelId);
            if (!ref) {
                for (const partial of sentRefs) {
                    await transport.delete(partial);
                }
                sentRefs.length = 0;
                break;
            }
            sentRefs.push(ref);
            channelId = ref.channelId;
        }
        if (sentRefs.length !== plan.chunks.length) {
            continue;
        }
        if (plan.channelId) {
            for (const oldId of plan.previousMessageIds) {
                await transport.delete({ channelId: plan.channelId, messageId: oldId });
            }
        }
        if (transport.notify) {
            await transport.notify(plan.recipientId, plan.summary);
        }
        await deps.api.recordDealAlertDelivery({
            recipientId: plan.recipientId,
            channelId: sentRefs[0].channelId,
            messageIds: sentRefs.map((ref) => ref.messageId),
            lastListingKeys: plan.lastListingKeys,
        });
    }
}
async function startDealAlertNotifier(options = {}) {
    const communityId = options.communityId ?? process.env.COMMUNITY_ID ?? "";
    const api = options.api ?? new root_bot_api_1.RootBotApi({ communityId });
    const config = options.config ?? (0, community_config_1.createCommunityConfig)(server_bot_1.rootServer.dataStore.appData);
    const rootApi = options.rootApi ?? (0, root_deal_alert_transport_1.createRootServerDealAlertApi)();
    const ensureSection = () => (0, root_deal_alert_section_1.ensureAlertSection)(rootApi, config);
    const createTransport = options.createTransport ??
        ((sectionId) => (0, root_deal_alert_transport_1.createRootDealAlertTransport)({ channelGroupId: sectionId, api: rootApi }));
    await (0, root_bot_scheduler_1.scheduleRootBotPolling)({
        scheduler: options.scheduler ?? server_bot_1.rootServer.jobScheduler,
        resourceId: "ga-deal-alerts",
        tag: "deal-alerts",
        intervalMs: options.intervalMs ??
            Number.parseInt(process.env.ROOT_DEAL_ALERT_INTERVAL_MS ?? "300000", 10),
        run: async () => {
            try {
                await runDealAlertPoll({ api, ensureSection, createTransport });
            }
            catch (err) {
                console.error(`[deal-alert-notifier] Poll error: ${(0, describe_error_1.describeError)(err)}`);
            }
        },
    });
}
/**
 * Runs one deal-alert delivery immediately (used after opt-in so the list is
 * populated without waiting for the next scheduled poll).
 */
async function provisionRootDealAlerts(options = {}) {
    const communityId = options.communityId ?? process.env.COMMUNITY_ID ?? "";
    const api = options.api ?? new root_bot_api_1.RootBotApi({ communityId });
    const config = options.config ?? (0, community_config_1.createCommunityConfig)(server_bot_1.rootServer.dataStore.appData);
    const rootApi = options.rootApi ?? (0, root_deal_alert_transport_1.createRootServerDealAlertApi)();
    await runDealAlertPoll({
        api,
        ensureSection: () => (0, root_deal_alert_section_1.ensureAlertSection)(rootApi, config),
        createTransport: (sectionId) => (0, root_deal_alert_transport_1.createRootDealAlertTransport)({ channelGroupId: sectionId, api: rootApi }),
    });
}
/**
 * Ensures the recipient has a private deal-alert channel and posts a welcome
 * message in it. Channel existence is tracked by the API.
 */
async function ensureRootRecipientChannel(recipientId, options = {}) {
    const communityId = options.communityId ?? process.env.COMMUNITY_ID ?? "";
    const api = options.api ?? new root_bot_api_1.RootBotApi({ communityId });
    const existing = await api.getDealAlertChannel(recipientId);
    if (existing) {
        return existing.channelId;
    }
    const rootApi = options.rootApi ?? (0, root_deal_alert_transport_1.createRootServerDealAlertApi)();
    const config = options.config ?? (0, community_config_1.createCommunityConfig)(server_bot_1.rootServer.dataStore.appData);
    const sectionId = await (0, root_deal_alert_section_1.ensureAlertSection)(rootApi, config);
    const transport = (0, root_deal_alert_transport_1.createRootDealAlertTransport)({
        channelGroupId: sectionId,
        api: rootApi,
    });
    const ref = await transport.send(recipientId, WELCOME_MESSAGE);
    if (!ref) {
        throw new Error("Could not create the deal-alert channel.");
    }
    await api.recordDealAlertDelivery({
        recipientId,
        channelId: ref.channelId,
        messageIds: [ref.messageId],
        lastListingKeys: [],
    });
    return ref.channelId;
}
/**
 * Removes a recipient's private deal-alert channel and clears its state.
 */
async function removeRootDealAlertChannel(recipientId, options = {}) {
    const communityId = options.communityId ?? process.env.COMMUNITY_ID ?? "";
    const api = options.api ?? new root_bot_api_1.RootBotApi({ communityId });
    const existing = await api.getDealAlertChannel(recipientId);
    if (!existing) {
        return;
    }
    const rootApi = options.rootApi ?? (0, root_deal_alert_transport_1.createRootServerDealAlertApi)();
    for (const id of existing.messageIds) {
        await rootApi.deleteMessage({ channelId: existing.channelId, id });
    }
    try {
        await rootApi.deleteChannel(existing.channelId);
    }
    catch (err) {
        console.warn(`[deal-alert-notifier] Could not delete channel ${existing.channelId}:`, err instanceof Error ? err.message : err);
    }
    await api.recordDealAlertCleanup(recipientId);
}
