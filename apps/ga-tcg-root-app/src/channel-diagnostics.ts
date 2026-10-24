import { rootServer, type RootServer } from "@rootsdk/server-bot";
import { describeError } from "./describe-error";

export type CommunityDirectory = Pick<
  RootServer["community"],
  "communities" | "channelGroups" | "channels" | "communityRoles"
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

export interface CommunityContextOptions {
  sectionId?: string;
  botRoleId?: string;
  envCommunityId?: string;
}

/**
 * Builds a startup snapshot of the attached community and the Root deal-alert
 * configuration: the community id (compared with `COMMUNITY_ID`), whether the
 * configured channel section exists, and whether the bot role exists. This
 * makes "wrong community" and "wrong id" mix-ups self-diagnosing.
 */
export async function describeCommunityContext(
  directory: CommunityDirectory,
  options: CommunityContextOptions = {}
): Promise<string[]> {
  const community = await directory.communities.get();
  const attachedId = String(community.communityId);
  const envCommunityId = options.envCommunityId ?? process.env.COMMUNITY_ID;

  const lines = [`Attached community: "${community.name}" (${attachedId})`];

  if (envCommunityId) {
    lines.push(`COMMUNITY_ID env: ${envCommunityId}`);
    if (envCommunityId !== attachedId) {
      lines.push(
        `  WARNING: COMMUNITY_ID (${envCommunityId}) does not match the attached community (${attachedId}).`
      );
    }
  } else {
    lines.push("COMMUNITY_ID env: (unset)");
  }

  const groups = await directory.channelGroups.list();
  if (options.sectionId) {
    const group = groups.find((candidate) => String(candidate.id) === options.sectionId);
    lines.push(
      group
        ? `Deal-alert section: "${group.name}" (${options.sectionId})`
        : `Deal-alert section ${options.sectionId} NOT FOUND. Groups here: ${groups
            .map((candidate) => `${candidate.name} (${String(candidate.id)})`)
            .join(", ")}`
    );
  } else {
    lines.push(
      "Deal-alert section: not configured (set ROOT_DEAL_ALERT_CHANNEL_ID or ROOT_DEAL_ALERT_SECTION_ID)."
    );
  }

  if (options.botRoleId) {
    try {
      const roles = await directory.communityRoles.list();
      const role = roles.find((candidate) => String(candidate.id) === options.botRoleId);
      lines.push(
        role
          ? `Deal-alert bot role: "${role.name}" (${options.botRoleId})`
          : `Deal-alert bot role ${options.botRoleId} NOT FOUND in this community.`
      );
    } catch (err) {
      lines.push(
        `Deal-alert bot role ${options.botRoleId}: could not list roles (${describeError(err)}).`
      );
    }
  } else {
    lines.push(
      "Deal-alert bot role: not configured (set ROOT_DEAL_ALERT_BOT_ROLE_ID)."
    );
  }

  return lines;
}

/**
 * Logs the attached-community snapshot at startup. Retries while the devhost
 * attaches the community; never throws.
 */
export async function logCommunityContext(
  options: CommunityContextOptions = {},
  attempts = DEFAULT_ATTEMPTS,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  directory: CommunityDirectory = rootServer.community
): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const lines = await describeCommunityContext(directory, options);
      console.log(`[community-context]\n${lines.join("\n")}`);
      return;
    } catch (err) {
      console.warn(
        `[community-context] Attempt ${attempt}/${attempts} failed: ${describeError(err)}`
      );
      if (attempt < attempts) {
        await sleep(retryDelayMs);
      }
    }
  }

  console.error("[community-context] Could not read the attached community.");
}
