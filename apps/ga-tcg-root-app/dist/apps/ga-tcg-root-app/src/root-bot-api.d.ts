import { type AssistantCollectionResponse, type AssistantDeckShortagesResponse, type AssistantDecksResponse, type AssistantLinkRequest, type AssistantLinkResponse, type AssistantWantlistResponse, type RootBotCollectorResponse, type RootBotDealAlertDeliveredRequest, type RootBotDealAlertsResponse, type RootBotMarketDeliveredRequest, type RootBotMarketNotificationsResponse, type RootBotNotifyRequest } from "@ga/contracts";
export declare class RootBotApiError extends Error {
    readonly status: number;
    readonly code: string;
    constructor(status: number, code: string, message: string);
}
export interface RootBotApiOptions {
    communityId: string;
    baseUrl?: string;
    /** Pre-resolved token (tests / already-bootstrapped callers). */
    token?: string;
    fetchImpl?: typeof fetch;
}
/**
 * Typed client for the Root bot API. Every call carries the per-install bearer
 * token and the community id; the app scopes all data by that community.
 */
export declare class RootBotApi {
    private readonly options;
    private readonly baseUrl;
    private readonly communityId;
    private readonly fetchImpl;
    private tokenPromise;
    constructor(options: RootBotApiOptions);
    private token;
    private request;
    getMarketNotifications(): Promise<RootBotMarketNotificationsResponse>;
    markMarketNotificationsDelivered(request: RootBotMarketDeliveredRequest): Promise<void>;
    getDealAlerts(): Promise<RootBotDealAlertsResponse>;
    recordDealAlertDelivery(request: RootBotDealAlertDeliveredRequest): Promise<void>;
    recordDealAlertCleanup(recipientId: string): Promise<void>;
    getDealAlertChannel(recipientId: string): Promise<{
        channelId: string;
        messageIds: string[];
    } | null>;
    getCollector(providerUserId: string): Promise<RootBotCollectorResponse | null>;
    setNotifyPreference(request: RootBotNotifyRequest): Promise<void>;
    link(request: AssistantLinkRequest): Promise<AssistantLinkResponse>;
    getDecks(providerUserId: string): Promise<AssistantDecksResponse>;
    getShortages(providerUserId: string, deck: string): Promise<AssistantDeckShortagesResponse>;
    searchCollection(providerUserId: string, query: string): Promise<AssistantCollectionResponse>;
    getWantlist(providerUserId: string, deck?: string): Promise<AssistantWantlistResponse>;
}
