import type { RootCommunityConfig } from "./community-config";
import type { RootDealAlertApi } from "./root-deal-alert-transport";
/**
 * Returns the channel group (section) that holds per-user deal-alert channels,
 * creating and persisting it on first use. The id lives in the per-community
 * config, so the section is created once and reused across runs.
 */
export declare function ensureAlertSection(api: Pick<RootDealAlertApi, "createChannelGroup" | "grantBotFullControl">, config: Pick<RootCommunityConfig, "getAlertSectionId" | "setAlertSectionId">): Promise<string>;
