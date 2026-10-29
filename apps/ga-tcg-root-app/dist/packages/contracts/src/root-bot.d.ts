import type { SupportedLocale } from "./i18n";
/**
 * Root bot API contracts — the HTTP boundary between the cloud-hosted Root bot
 * (a thin Root delivery agent) and the Next.js app (which owns the data plane).
 */
export interface RootBotInstallRequest {
    appId: string;
    communityId: string;
}
export interface RootBotInstallResponse {
    token: string;
    communityId: string;
}
export interface RootBotMarketNotificationChunk {
    storeId: string;
    storeName: string;
    content: string;
    notificationIds: string[];
}
export interface RootBotMarketNotificationsResponse {
    chunks: RootBotMarketNotificationChunk[];
}
export interface RootBotMarketDeliveredRequest {
    notificationIds: string[];
    messageIds: string[];
}
export interface RootBotDealAlertPlan {
    recipientId: string;
    /** Existing channel for this recipient, or null when it must be created. */
    channelId: string | null;
    previousMessageIds: string[];
    chunks: string[];
    summary: {
        title: string;
        description: string;
    };
    lastListingKeys: string[];
    locale?: SupportedLocale;
}
export interface RootBotDealAlertsResponse {
    plans: RootBotDealAlertPlan[];
    cleanup: Array<{
        recipientId: string;
        channelId: string;
        messageIds: string[];
    }>;
}
export interface RootBotDealAlertDeliveredRequest {
    recipientId: string;
    channelId: string;
    messageIds: string[];
    lastListingKeys: string[];
}
export interface RootBotDealAlertCleanupRequest {
    recipientId: string;
}
export interface RootBotCollectorResponse {
    collectorId: string;
    collectorName: string | null;
    friendCode?: string | null;
    notificationsEnabled?: boolean;
    dealAlertMode?: "all" | "hard";
    locale?: SupportedLocale;
}
export interface RootBotNotifyRequest {
    providerUserId: string;
    enabled: boolean;
    /** Deal-alert scope: "all" or "hard". Optional. */
    mode?: "all" | "hard";
    locale?: SupportedLocale;
}
