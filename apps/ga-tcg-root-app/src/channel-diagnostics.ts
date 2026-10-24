import { rootServer, type RootServer } from "@rootsdk/server-bot";
import { describeError } from "./describe-error";

export type CommunityDirectory = Pick<
  RootServer["community"],
  "communities" | "channelGroups"
>;

const DEFAULT_ATTEMPTS = 4;
const DEFAULT_RETRY_DELAY_MS = 5000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface CommunityContextOptions {
  sectionId?: string;
  broadcastChannelId?: string;
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
      "Deal-alert section: not configured (created automatically on first use)."
    );
  }

  lines.push(
    options.broadcastChannelId
      ? `Market broadcast channel: ${options.broadcastChannelId}`
      : "Market broadcast channel: not configured (run /setup in the target channel)."
  );

  lines.push(
    "Deal-alert access: self-granted via the bot's own app id (no bot role needed)."
  );

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
