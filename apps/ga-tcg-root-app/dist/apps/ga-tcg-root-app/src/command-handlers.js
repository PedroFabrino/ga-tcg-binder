"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRootBotApi = getRootBotApi;
exports.processRootCommand = processRootCommand;
exports.registerRootCommandHandlers = registerRootCommandHandlers;
const server_app_1 = require("@rootsdk/server-app");
const deal_alert_notifier_1 = require("./deal-alert-notifier");
const community_config_1 = require("./community-config");
const setup_provisioning_1 = require("./setup-provisioning");
const root_bot_api_1 = require("./root-bot-api");
const diagnostics_1 = require("./diagnostics");
const command_auth_1 = require("./commands/command-auth");
const command_decks_1 = require("./commands/command-decks");
const command_shortages_1 = require("./commands/command-shortages");
const command_collection_1 = require("./commands/command-collection");
const command_wantlist_1 = require("./commands/command-wantlist");
const command_notify_1 = require("./commands/command-notify");
const command_help_1 = require("./commands/command-help");
function isAssistantApiError(err) {
    if (typeof err !== "object" || err === null)
        return false;
    const record = err;
    return (typeof record.code === "string" &&
        (typeof record.status === "number" || typeof record.statusCode === "number"));
}
function defaultRootCommandDeps(communityId, client) {
    const api = client ?? getRootBotApi(communityId);
    const recipientOptions = { communityId, api };
    return {
        async findCollectorId(userId) {
            try {
                const resolved = await api.getCollector(userId);
                return resolved?.collectorId ?? null;
            }
            catch (err) {
                if (err instanceof root_bot_api_1.RootBotApiError && err.status === 404) {
                    return null;
                }
                throw err;
            }
        },
        async setNotificationPreference(providerUserId, enabled, mode) {
            await api.setNotifyPreference({
                providerUserId,
                enabled,
                ...(mode !== undefined ? { mode } : {}),
            });
        },
        async provisionDealAlerts() {
            await (0, deal_alert_notifier_1.provisionRootDealAlerts)(recipientOptions);
        },
        async removeDealAlertChannel(recipientId) {
            await (0, deal_alert_notifier_1.removeRootDealAlertChannel)(recipientId, recipientOptions);
        },
        async ensureRecipientChannel(recipientId) {
            return (0, deal_alert_notifier_1.ensureRootRecipientChannel)(recipientId, recipientOptions);
        },
        async configureFromChannel(_channelId) {
            const config = (0, community_config_1.createCommunityConfig)(server_app_1.rootServer.dataStore.appData);
            const res = await (0, setup_provisioning_1.provisionCommunityChannels)({ rootServer: server_app_1.rootServer, config });
            return res.marketChannel;
        },
        async isCommunityAdmin(userId) {
            const community = await server_app_1.rootServer.community.communities.get();
            if (String(community.ownerUserId) === userId) {
                return true;
            }
            const [member, roles] = await Promise.all([
                server_app_1.rootServer.community.communityMembers.get({
                    userId: userId,
                }),
                server_app_1.rootServer.community.communityRoles.list(),
            ]);
            const roleIds = new Set(member.communityRoleIds.map((id) => String(id)));
            roleIds.add(String(server_app_1.WellKnownRootGuids.CommunityRoles.EveryoneRole));
            return roles.some((role) => roleIds.has(String(role.id)) &&
                (role.communityPermission.communityManageApps ||
                    role.communityPermission.communityFullControl));
        },
    };
}
function getRootBotApi(communityId) {
    return new root_bot_api_1.RootBotApi({
        communityId: communityId ?? process.env.COMMUNITY_ID ?? "",
    });
}
async function processRootCommand(userId, messageContent, client = getRootBotApi(), deps = {}, channelId, communityId) {
    const resolvedDeps = {
        ...defaultRootCommandDeps(communityId, client),
        ...deps,
    };
    const trimmed = messageContent.trim();
    if (!trimmed.startsWith("/"))
        return null;
    const [command, ...args] = trimmed.slice(1).split(/\s+/);
    const argString = args.join(" ").trim();
    const cmd = command.toLowerCase();
    try {
        if (cmd === "help")
            return (0, command_help_1.handleHelpCommand)();
        if (cmd === "link")
            return await (0, command_auth_1.handleLinkCommand)(argString, userId, client);
        if (cmd === "register")
            return await (0, command_auth_1.handleRegisterCommand)(userId, client);
        if (cmd === "decks")
            return await (0, command_decks_1.handleDecksCommand)(argString, userId, client);
        if (cmd === "shortages")
            return await (0, command_shortages_1.handleShortagesCommand)(argString, userId, client);
        if (cmd === "collection")
            return await (0, command_collection_1.handleCollectionCommand)(argString, userId, client);
        if (cmd === "wantlist")
            return await (0, command_wantlist_1.handleWantlistCommand)(argString, userId, client);
        if (cmd === "notify")
            return await (0, command_notify_1.handleNotifyCommand)(argString, userId, resolvedDeps);
        if (cmd === "setup")
            return await (0, command_notify_1.handleSetupCommand)(argString, userId, channelId, resolvedDeps);
        return null;
    }
    catch (err) {
        await (0, diagnostics_1.reportDiagnostic)({
            stage: "command-error",
            message: err,
            level: server_app_1.CommunityAppLogType.Error,
        });
        if (isAssistantApiError(err)) {
            if (err.code === "IDENTITY_NOT_LINKED") {
                return ("⚠️ **Grand Archive Binder Account Not Linked**\n" +
                    "Get started in seconds:\n" +
                    "• Run `/register` to create a new binder account instantly\n" +
                    "• Or run `/link <code>` using a pairing code from GA Binder web app.");
            }
            if (err.code === "DECK_NOT_FOUND") {
                return `⚠️ **Deck Not Found**\nCould not find a deck matching "${argString}". Run \`/decks\` to see all your active decks.`;
            }
            return `⚠️ **Assistant Error:** ${err.message}`;
        }
        const message = err instanceof Error ? err.message : "Unknown error";
        return `⚠️ **Error executing command:** ${message}`;
    }
}
function registerRootCommandHandlers(communityId) {
    server_app_1.rootServer.community.channelMessages.on("channelMessage.created", async (evt) => {
        if (evt.messageType === server_app_1.MessageType.System)
            return;
        if (!evt.messageContent || !evt.messageContent.startsWith("/"))
            return;
        const reply = await processRootCommand(evt.userId, evt.messageContent, getRootBotApi(communityId), undefined, String(evt.channelId), communityId);
        if (!reply)
            return;
        try {
            await server_app_1.rootServer.community.channelMessages.create({
                channelId: evt.channelId,
                content: reply,
            });
        }
        catch (err) {
            console.error("Failed to send Root message reply:", err);
        }
    });
}
