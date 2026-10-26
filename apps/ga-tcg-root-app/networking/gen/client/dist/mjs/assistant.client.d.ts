import { DecksResponse, LinkRequest, LinkResponse, PreferencesRequest, PreferencesResponse, StatusResponse } from "@ga/gen-shared";
export declare class AssistantServiceClient {
    get ClientServiceName(): string;
    getStatus(): Promise<StatusResponse>;
    linkAccount(request: LinkRequest): Promise<LinkResponse>;
    setPreferences(request: PreferencesRequest): Promise<PreferencesResponse>;
    getDecks(): Promise<DecksResponse>;
    private __register;
}
export declare const assistantServiceClient: AssistantServiceClient;
