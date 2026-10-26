import type { DeckSummary, AutocompleteChoiceItem, PersonalWantRpcItem } from "@ga/gen-shared";
import type { RootBotApi } from "./root-bot-api";
export declare function buildDeckSummariesWithShortages(api: RootBotApi, userId: string, rawDecks: Array<{
    id: string;
    name: string;
    champion?: string | null;
    format: string;
    totalCards: number;
    hardShortageCount: number;
    sharedShortageCount: number;
}>): Promise<DeckSummary[]>;
export declare function updateDealAlertPreferencesHelper(api: RootBotApi, userId: string, communityId: string, notificationsEnabled: boolean, mode: "all" | "hard", overrides?: {
    setNotificationPreference?: (userId: string, enabled: boolean, mode?: "all" | "hard") => Promise<void>;
    ensureRecipientChannel?: (userId: string, communityId?: string) => Promise<string | null>;
    removeDealAlertChannel?: (userId: string, communityId?: string) => Promise<void>;
}): Promise<{
    alertChannelId: string;
}>;
export declare function mapAutocompleteChoice(r: {
    name: string;
    value: string;
    element?: string | null;
    type?: string | null;
    quantity?: number;
    foil?: boolean | number | null;
}): AutocompleteChoiceItem;
export declare function mapPersonalWant(w: {
    cardSlug: string;
    cardName: string;
    element?: string | null;
    type?: string | null;
    desiredQuantity: number;
    foil?: boolean | number | null;
}): PersonalWantRpcItem;
