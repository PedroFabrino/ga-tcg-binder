export interface NotifyCommandDeps {
    findCollectorId: (userId: string) => Promise<string | null>;
    setNotificationPreference: (providerUserId: string, enabled: boolean, mode?: "all" | "hard") => Promise<void>;
    provisionDealAlerts: () => Promise<void>;
    removeDealAlertChannel: (recipientId: string) => Promise<void>;
    ensureRecipientChannel: (recipientId: string) => Promise<string | null>;
    configureFromChannel: (channelId: string) => Promise<string | undefined>;
    isCommunityAdmin: (userId: string) => Promise<boolean>;
}
export declare function handleNotifyCommand(argString: string, userId: string, deps: NotifyCommandDeps): Promise<string>;
export declare function handleSetupCommand(argString: string, userId: string, channelId: string | undefined, deps: NotifyCommandDeps): Promise<string>;
