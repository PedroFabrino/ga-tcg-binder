import { rootServer, type RootServer } from "@rootsdk/server-bot";
import { describeError } from "./describe-error";

export type CommunityDirectory = Pick<
  RootServer["community"],
  "communities" | "channelGroups" | "channels"
>;

const DEFAULT_ATTEMPTS = 4;
const DEFAULT_RETRY_DELAY_MS = 5000;

/**
 * Builds a human-readable listing of the community the bot is attached to:
 * its name and ID, every channel group and channel, and whether the
 * configured notification channel exists in it.
 */
export async function describeCommunityChannels(
  directory: CommunityDirectory,
  configuredChannelId: string
): Promise<string[]> {
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
      lines.push(
        `    #${channel.name} (${String(channel.id)}) type=${channel.channelType}${isConfigured ? "  <-- ROOT_BOT_MARKET_CHANNEL_ID" : ""}`
      );
    }
  }

  lines.push(
    found
      ? `Configured channel ${configuredChannelId} found in this community.`
      : `Configured channel ${configuredChannelId} NOT FOUND in this community — use one of the channel IDs above.`
  );

  return lines;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Logs the community/channel listing at startup. The devhost attaches the
 * community shortly after the bot starts, so early calls can fail; retry a
 * few times before giving up. Never throws.
 */
export async function logCommunityChannels(
  configuredChannelId: string,
  attempts = DEFAULT_ATTEMPTS,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  directory: CommunityDirectory = rootServer.community
): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const lines = await describeCommunityChannels(directory, configuredChannelId);
      console.log(`[channel-diagnostics]\n${lines.join("\n")}`);
      return;
    } catch (err) {
      console.warn(
        `[channel-diagnostics] Attempt ${attempt}/${attempts} failed: ${describeError(err)}`
      );
      if (attempt < attempts) {
        await sleep(retryDelayMs);
      }
    }
  }

  console.error("[channel-diagnostics] Could not list the community's channels.");
}
