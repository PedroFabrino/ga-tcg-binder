import { type RootServer } from "@rootsdk/server-bot";
export type CommunityDirectory = Pick<RootServer["community"], "communities" | "channelGroups" | "channels">;
/**
 * Builds a human-readable listing of the community the bot is attached to:
 * its name and ID, every channel group and channel, and whether the
 * configured notification channel exists in it.
 */
export declare function describeCommunityChannels(directory: CommunityDirectory, configuredChannelId: string): Promise<string[]>;
/**
 * Logs the community/channel listing at startup. The devhost attaches the
 * community shortly after the bot starts, so early calls can fail; retry a
 * few times before giving up. Never throws.
 */
export declare function logCommunityChannels(configuredChannelId: string, attempts?: number, retryDelayMs?: number, directory?: CommunityDirectory): Promise<void>;
