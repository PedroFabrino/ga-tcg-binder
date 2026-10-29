"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WELCOME_MESSAGE = void 0;
exports.getWelcomeMessage = getWelcomeMessage;
exports.runDealAlertPoll = runDealAlertPoll;
exports.startDealAlertNotifier = startDealAlertNotifier;
exports.provisionRootDealAlerts = provisionRootDealAlerts;
exports.ensureRootRecipientChannel = ensureRootRecipientChannel;
exports.removeRootDealAlertChannel = removeRootDealAlertChannel;
const server_app_1 = require("@rootsdk/server-app");
const community_config_1 = require("./community-config");
const root_bot_api_1 = require("./root-bot-api");
const root_bot_scheduler_1 = require("./root-bot-scheduler");
const root_deal_alert_section_1 = require("./root-deal-alert-section");
const root_deal_alert_transport_1 = require("./root-deal-alert-transport");
const diagnostics_1 = require("./diagnostics");
function getWelcomeMessage(locale = "en") {
    if (locale === "pt-BR") {
        return "🔔 **Alertas de ofertas ativados.** Vou manter este canal atualizado com cartas da sua lista de desejos e cartas necessárias para seus decks que estiverem à venda.";
    }
    return "🔔 **Deal alerts are on.** I'll keep this channel updated with cards from your wantlist and deck shortages that are for sale.";
}
exports.WELCOME_MESSAGE = getWelcomeMessage("en");
/**
 * One deal-alert poll: ask the API for changed lists + cleanup, deliver to Root
 * channels/notifications, and report the results back. No matching or database
 * work happens in the bot.
 */
async function runDealAlertPoll(deps) {
    const { plans, cleanup } = await deps.api.getDealAlerts();
    const sectionId = await deps.ensureSection();
    if (!sectionId) {
        return;
    }
    const transport = deps.createTransport(sectionId);
    for (const item of cleanup) {
        for (const id of item.messageIds) {
            try {
                await transport.delete({ channelId: item.channelId, messageId: id });
            }
            catch (err) {
                console.warn(`[deal-alert-notifier] Could not delete cleanup message ${id} in channel ${item.channelId}:`, err instanceof Error ? err.message : err);
            }
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
                    try {
                        await transport.delete(partial);
                    }
                    catch (err) {
                        console.warn(`[deal-alert-notifier] Could not roll back partial message ${partial.messageId}:`, err instanceof Error ? err.message : err);
                    }
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
        const deliveredChannelId = sentRefs[0].channelId;
        await deps.api.recordDealAlertDelivery({
            recipientId: plan.recipientId,
            channelId: deliveredChannelId,
            messageIds: sentRefs.map((ref) => ref.messageId),
            lastListingKeys: plan.lastListingKeys,
        });
        if (plan.channelId && plan.channelId === deliveredChannelId) {
            for (const oldId of plan.previousMessageIds) {
                try {
                    await transport.delete({ channelId: plan.channelId, messageId: oldId });
                }
                catch (err) {
                    console.warn(`[deal-alert-notifier] Could not delete previous message ${oldId} in channel ${plan.channelId}:`, err instanceof Error ? err.message : err);
                }
            }
        }
        if (transport.notify) {
            try {
                await transport.notify(plan.recipientId, plan.summary);
            }
            catch (err) {
                console.warn(`[deal-alert-notifier] Could not send notification summary for ${plan.recipientId}:`, err instanceof Error ? err.message : err);
            }
        }
    }
}
async function startDealAlertNotifier(options = {}) {
    const communityId = options.communityId ?? process.env.COMMUNITY_ID ?? "";
    const api = options.api ?? new root_bot_api_1.RootBotApi({ communityId });
    const config = options.config ?? (0, community_config_1.createCommunityConfig)(server_app_1.rootServer.dataStore.appData);
    const rootApi = options.rootApi ?? (0, root_deal_alert_transport_1.createRootServerDealAlertApi)();
    const ensureSection = () => (0, root_deal_alert_section_1.ensureAlertSection)(config);
    const createTransport = options.createTransport ??
        ((sectionId) => (0, root_deal_alert_transport_1.createRootDealAlertTransport)({ channelGroupId: sectionId, api: rootApi }));
    const intervalMs = options.intervalMs ??
        Number.parseInt(process.env.ROOT_DEAL_ALERT_INTERVAL_MS ?? "300000", 10);
    const run = async () => {
        try {
            await runDealAlertPoll({ api, ensureSection, createTransport });
        }
        catch (err) {
            await (0, diagnostics_1.reportDiagnostic)({
                stage: "deal-alert-poll-failed",
                communityId,
                message: err,
                level: server_app_1.CommunityAppLogType.Error,
            });
        }
    };
    // Run once immediately; authenticate and deliver without waiting for the
    // first scheduled job.
    await run();
    await (0, root_bot_scheduler_1.scheduleRootBotPolling)({
        scheduler: options.scheduler ?? server_app_1.rootServer.jobScheduler,
        resourceId: "ga-deal-alerts",
        tag: "deal-alerts",
        intervalMs,
        run,
        onError: (err) => {
            void (0, diagnostics_1.reportDiagnostic)({
                stage: "deal-alert-scheduler-failed",
                communityId,
                message: err,
                level: server_app_1.CommunityAppLogType.Error,
            });
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
    const config = options.config ?? (0, community_config_1.createCommunityConfig)(server_app_1.rootServer.dataStore.appData);
    const rootApi = options.rootApi ?? (0, root_deal_alert_transport_1.createRootServerDealAlertApi)();
    await runDealAlertPoll({
        api,
        ensureSection: () => (0, root_deal_alert_section_1.ensureAlertSection)(config),
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
    const rootApi = options.rootApi ?? (0, root_deal_alert_transport_1.createRootServerDealAlertApi)();
    const existing = await api.getDealAlertChannel(recipientId);
    if (existing) {
        try {
            // Reuse only if the channel still exists; reinstalls delete the channel
            // but leave the API-side state behind, which would otherwise point at a
            // dead channel and make the opt-in look successful without a channel.
            await rootApi.getChannel(existing.channelId);
            return existing.channelId;
        }
        catch {
            // Channel gone — fall through and create a fresh one.
        }
    }
    const config = options.config ?? (0, community_config_1.createCommunityConfig)(server_app_1.rootServer.dataStore.appData);
    const sectionId = await (0, root_deal_alert_section_1.ensureAlertSection)(config);
    if (!sectionId) {
        throw new Error("No market group configured — provision market channels in the Assistant App GUI first.");
    }
    const transport = (0, root_deal_alert_transport_1.createRootDealAlertTransport)({
        channelGroupId: sectionId,
        api: rootApi,
    });
    let locale = options.locale;
    if (!locale) {
        try {
            const collector = await api.getCollector(recipientId);
            if (collector?.locale) {
                locale = collector.locale;
            }
        }
        catch {
            // Ignore collector lookup failure, fallback to "en"
        }
    }
    const welcomeText = getWelcomeMessage(locale);
    const ref = await transport.send(recipientId, welcomeText);
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
        try {
            await rootApi.deleteMessage({ channelId: existing.channelId, id });
        }
        catch (err) {
            console.warn(`[deal-alert-notifier] Could not delete message ${id} in channel ${existing.channelId}:`, err instanceof Error ? err.message : err);
        }
    }
    try {
        await rootApi.deleteChannel(existing.channelId);
    }
    catch (err) {
        console.warn(`[deal-alert-notifier] Could not delete channel ${existing.channelId}:`, err instanceof Error ? err.message : err);
    }
    await api.recordDealAlertCleanup(recipientId);
}
