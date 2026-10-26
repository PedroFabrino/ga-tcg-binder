import { AssistantServiceBase } from "@ga/gen-server";
import { type Client } from "@rootsdk/server-app";
import { type DecksResponse, type LinkRequest, type LinkResponse, type PreferencesRequest, type PreferencesResponse, type StatusResponse } from "@ga/gen-shared";
import { RootBotApi } from "./root-bot-api";
export interface AssistantRpcServiceDeps {
    api?: RootBotApi;
    ensureRecipientChannel?: (recipientId: string, communityId?: string) => Promise<string | null>;
    removeDealAlertChannel?: (recipientId: string, communityId?: string) => Promise<void>;
    setNotificationPreference?: (providerUserId: string, enabled: boolean, mode?: "all" | "hard") => Promise<void>;
}
export declare class AssistantRpcService extends AssistantServiceBase {
    private readonly communityId?;
    private readonly deps;
    private readonly api;
    constructor(communityId?: string | undefined, deps?: AssistantRpcServiceDeps);
    getStatus(client: Client): Promise<StatusResponse>;
    linkAccount(request: LinkRequest, client: Client): Promise<LinkResponse>;
    setPreferences(request: PreferencesRequest, client: Client): Promise<PreferencesResponse>;
    getDecks(client: Client): Promise<DecksResponse>;
}
