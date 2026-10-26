import { RootBotApi } from "./root-bot-api";
export interface RootCommandDeps {
    findCollectorId?: (userId: string) => Promise<string | null>;
    setNotificationPreference?: (providerUserId: string, enabled: boolean, mode?: "all" | "hard") => Promise<void>;
    provisionDealAlerts?: () => Promise<void>;
    removeDealAlertChannel?: (recipientId: string) => Promise<void>;
    ensureRecipientChannel?: (recipientId: string) => Promise<string | null>;
    configureFromChannel?: (channelId: string) => Promise<string | undefined>;
    isCommunityAdmin?: (userId: string) => Promise<boolean>;
}
export declare function getRootBotApi(communityId?: string): RootBotApi;
export declare function processRootCommand(userId: string, messageContent: string, client?: RootBotApi, deps?: RootCommandDeps, channelId?: string, communityId?: string): Promise<string | null>;
export declare function registerRootCommandHandlers(communityId?: string): void;
