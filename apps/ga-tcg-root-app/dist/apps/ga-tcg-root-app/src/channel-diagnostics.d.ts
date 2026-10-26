import { type RootServer } from "@rootsdk/server-app";
export type CommunityDirectory = Pick<RootServer["community"], "communities" | "channelGroups">;
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
export declare function describeCommunityContext(directory: CommunityDirectory, options?: CommunityContextOptions): Promise<string[]>;
/**
 * Logs the attached-community snapshot at startup. Retries while the devhost
 * attaches the community; never throws.
 */
export declare function logCommunityContext(options?: CommunityContextOptions, attempts?: number, retryDelayMs?: number, directory?: CommunityDirectory): Promise<void>;
