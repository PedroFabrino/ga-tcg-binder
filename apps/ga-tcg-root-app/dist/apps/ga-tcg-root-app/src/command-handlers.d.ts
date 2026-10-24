import { RootBotApi } from "./root-bot-api";
/**
 * Injectable side effects for the Root commands. Defaults use the shared
 * database; tests pass fakes so the command logic stays pure.
 */
export interface RootCommandDeps {
    findCollectorId?: (userId: string) => Promise<string | null>;
    setNotificationPreference?: (providerUserId: string, enabled: boolean) => Promise<void>;
    provisionDealAlerts?: () => Promise<void>;
    removeDealAlertChannel?: (recipientId: string) => Promise<void>;
    ensureRecipientChannel?: (recipientId: string) => Promise<string | null>;
    configureFromChannel?: (channelId: string) => Promise<void>;
    isCommunityAdmin?: (userId: string) => Promise<boolean>;
}
export declare function getRootBotApi(communityId?: string): RootBotApi;
/**
 * Parses and executes a Root slash command from incoming channel messages.
 * Returns the markdown reply string, or null if message is not a recognized command.
 */
export declare function processRootCommand(userId: string, messageContent: string, client?: RootBotApi, deps?: RootCommandDeps, channelId?: string, communityId?: string): Promise<string | null>;
/**
 * Subscribes to Root channel messages and executes assistant commands.
 */
export declare function registerRootCommandHandlers(communityId?: string): void;
