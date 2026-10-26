import { AddWantRpcRequest, AddWantRpcResponse, AutocompleteRpcRequest, AutocompleteRpcResponse, DecksResponse, ImportDeckRpcRequest, ImportDeckRpcResponse, LinkRequest, LinkResponse, PersonalWantsRpcResponse, PreferencesRequest, PreferencesResponse, RegisterResponse, RemoveWantRpcRequest, RemoveWantRpcResponse, StatusResponse } from "@ga/gen-shared";
export declare class AssistantServiceClient {
    get ClientServiceName(): string;
    getStatus(): Promise<StatusResponse>;
    linkAccount(request: LinkRequest): Promise<LinkResponse>;
    registerAccount(): Promise<RegisterResponse>;
    setPreferences(request: PreferencesRequest): Promise<PreferencesResponse>;
    getDecks(): Promise<DecksResponse>;
    autocomplete(request: AutocompleteRpcRequest): Promise<AutocompleteRpcResponse>;
    getPersonalWants(): Promise<PersonalWantsRpcResponse>;
    addWant(request: AddWantRpcRequest): Promise<AddWantRpcResponse>;
    removeWant(request: RemoveWantRpcRequest): Promise<RemoveWantRpcResponse>;
    importDeck(request: ImportDeckRpcRequest): Promise<ImportDeckRpcResponse>;
    private __register;
}
export declare const assistantServiceClient: AssistantServiceClient;
