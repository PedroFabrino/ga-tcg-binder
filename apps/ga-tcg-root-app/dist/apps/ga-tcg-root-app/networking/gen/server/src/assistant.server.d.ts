import { AddWantRpcRequest, AddWantRpcResponse, AutocompleteRpcRequest, AutocompleteRpcResponse, DecksResponse, ImportDeckRpcRequest, ImportDeckRpcResponse, LinkRequest, LinkResponse, PersonalWantsRpcResponse, PreferencesRequest, PreferencesResponse, RegisterResponse, RemoveWantRpcRequest, RemoveWantRpcResponse, StatusResponse, UpdateDeckRpcRequest, UpdateDeckRpcResponse } from "@ga/gen-shared";
import { Client, RootServerService } from "@rootsdk/server-app";
export declare abstract class AssistantServiceBase implements RootServerService {
    abstract getStatus(client: Client): Promise<StatusResponse>;
    abstract linkAccount(request: LinkRequest, client: Client): Promise<LinkResponse>;
    abstract registerAccount(client: Client): Promise<RegisterResponse>;
    abstract setPreferences(request: PreferencesRequest, client: Client): Promise<PreferencesResponse>;
    abstract getDecks(client: Client): Promise<DecksResponse>;
    abstract autocomplete(request: AutocompleteRpcRequest, client: Client): Promise<AutocompleteRpcResponse>;
    abstract getPersonalWants(client: Client): Promise<PersonalWantsRpcResponse>;
    abstract addWant(request: AddWantRpcRequest, client: Client): Promise<AddWantRpcResponse>;
    abstract removeWant(request: RemoveWantRpcRequest, client: Client): Promise<RemoveWantRpcResponse>;
    abstract importDeck(request: ImportDeckRpcRequest, client: Client): Promise<ImportDeckRpcResponse>;
    abstract updateDeck(request: UpdateDeckRpcRequest, client: Client): Promise<UpdateDeckRpcResponse>;
    private __register;
    get ServerServiceName(): string;
}
