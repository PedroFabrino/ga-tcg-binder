/**
 * Shared Assistant domain models, contracts, and typed API client
 * for Grand Archive TCG Collector Assistants (Discord & Root).
 */
export type AssistantProvider = "discord" | "root";
export interface AssistantLinkRequest {
    token: string;
    provider: AssistantProvider;
    providerUserId: string;
    providerUsername?: string | null;
}
export interface AssistantLinkResponse {
    success: boolean;
    collectorId: string;
    collectorName?: string | null;
    message: string;
}
export interface AssistantDeckSummary {
    id: string;
    name: string;
    format: string;
    champion: string | null;
    totalCards: number;
    uniqueCards: number;
    completionPercentage: number;
    hardShortageCount: number;
    sharedShortageCount: number;
    webUrl?: string;
}
export interface AssistantDecksResponse {
    collectorId: string;
    collectorName?: string | null;
    decks: AssistantDeckSummary[];
}
export interface AssistantShortageItem {
    cardSlug: string;
    cardName: string;
    element: string;
    rarity: number | null;
    requiredQuantity: number;
    missingQuantity: number;
    sharedQuantity: number;
    competingDecks: string[];
    type: "hard" | "shared";
    zone?: string;
    imageUrl?: string | null;
}
export interface AssistantDeckShortagesResponse {
    collectorId: string;
    deckId: string;
    deckName: string;
    format: string;
    completionPercentage: number;
    hardShortages: AssistantShortageItem[];
    sharedShortages: AssistantShortageItem[];
    totalHardShortages: number;
    totalSharedShortages: number;
    webUrl?: string;
}
export interface AssistantCollectionPrinting {
    editionId: string;
    cardSlug: string;
    setPrefix: string;
    setName: string;
    collectorNumber: string;
    rarity: number;
    imageUrl: string;
    foil: boolean;
    quantity: number;
    isDedicated: boolean;
    dedicatedCount: number;
    idleCount: number;
}
export interface AssistantCollectionCard {
    cardSlug: string;
    cardName: string;
    element: string;
    class: string;
    type: string;
    totalOwned: number;
    dedicatedTotal: number;
    idleTotal: number;
    printings: AssistantCollectionPrinting[];
}
export interface AssistantCollectionResponse {
    collectorId: string;
    query: string;
    cards: AssistantCollectionCard[];
}
export interface AssistantDeckWantlistGroup {
    deckId: string;
    deckName: string;
    format: string;
    hardShortages: AssistantShortageItem[];
    sharedShortages: AssistantShortageItem[];
    totalShortages: number;
}
export interface AssistantWantlistResponse {
    collectorId: string;
    collectorName?: string | null;
    decks: AssistantDeckWantlistGroup[];
    totalDecks: number;
    grandTotalHard: number;
    grandTotalShared: number;
}
export declare class AssistantApiError extends Error {
    readonly statusCode: number;
    readonly code: string;
    constructor(statusCode: number, code: string, message: string);
}
export interface AssistantClientConfig {
    baseUrl: string;
    assistantToken?: string;
}
export declare class AssistantClient {
    private readonly baseUrl;
    private readonly assistantToken?;
    constructor(config: AssistantClientConfig);
    private request;
    link(req: AssistantLinkRequest): Promise<AssistantLinkResponse>;
    getDecks(provider: AssistantProvider, providerUserId: string): Promise<AssistantDecksResponse>;
    getShortages(provider: AssistantProvider, providerUserId: string, deckIdOrName: string): Promise<AssistantDeckShortagesResponse>;
    searchCollection(provider: AssistantProvider, providerUserId: string, query: string): Promise<AssistantCollectionResponse>;
    getWantlist(provider: AssistantProvider, providerUserId: string, deckIdOrName?: string): Promise<AssistantWantlistResponse>;
}
