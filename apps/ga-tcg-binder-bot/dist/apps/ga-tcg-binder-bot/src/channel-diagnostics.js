"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.describeCommunityChannels = describeCommunityChannels;
exports.logCommunityChannels = logCommunityChannels;
const server_bot_1 = require("@rootsdk/server-bot");
const describe_error_1 = require("./describe-error");
const DEFAULT_ATTEMPTS = 4;
const DEFAULT_RETRY_DELAY_MS = 5000;
/**
 * Builds a human-readable listing of the community the bot is attached to:
 * its name and ID, every channel group and channel, and whether the
 * configured notification channel exists in it.
 */
async function describeCommunityChannels(directory, configuredChannelId) {
    const community = await directory.communities.get();
    const lines = [
        `Attached community: "${community.name}" (${String(community.communityId)})`,
    ];
    let found = false;
    const groups = await directory.channelGroups.list();
    for (const group of groups) {
        lines.push(`  Group "${group.name}" (${String(group.id)})`);
        const channels = await directory.channels.list({ channelGroupId: group.id });
        for (const channel of channels) {
            const isConfigured = String(channel.id) === configuredChannelId;
            found ||= isConfigured;
            lines.push(`    #${channel.name} (${String(channel.id)}) type=${channel.channelType}${isConfigured ? "  <-- ROOT_BOT_MARKET_CHANNEL_ID" : ""}`);
        }
    }
    lines.push(found
        ? `Configured channel ${configuredChannelId} found in this community.`
        : `Configured channel ${configuredChannelId} NOT FOUND in this community — use one of the channel IDs above.`);
    return lines;
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Logs the community/channel listing at startup. The devhost attaches the
 * community shortly after the bot starts, so early calls can fail; retry a
 * few times before giving up. Never throws.
 */
async function logCommunityChannels(configuredChannelId, attempts = DEFAULT_ATTEMPTS, retryDelayMs = DEFAULT_RETRY_DELAY_MS, directory = server_bot_1.rootServer.community) {
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const lines = await describeCommunityChannels(directory, configuredChannelId);
            console.log(`[channel-diagnostics]\n${lines.join("\n")}`);
            return;
        }
        catch (err) {
            console.warn(`[channel-diagnostics] Attempt ${attempt}/${attempts} failed: ${(0, describe_error_1.describeError)(err)}`);
            if (attempt < attempts) {
                await sleep(retryDelayMs);
            }
        }
    }
    console.error("[channel-diagnostics] Could not list the community's channels.");
}
