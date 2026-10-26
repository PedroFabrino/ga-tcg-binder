import { DecksResponse, LinkRequest, LinkResponse, PreferencesRequest, PreferencesResponse, StatusResponse } from "@ga/gen-shared";
import { Client, RootServerService } from "@rootsdk/server-app";
export declare abstract class AssistantServiceBase implements RootServerService {
    abstract getStatus(client: Client): Promise<StatusResponse>;
    abstract linkAccount(request: LinkRequest, client: Client): Promise<LinkResponse>;
    abstract setPreferences(request: PreferencesRequest, client: Client): Promise<PreferencesResponse>;
    abstract getDecks(client: Client): Promise<DecksResponse>;
    private __register;
    get ServerServiceName(): string;
}
