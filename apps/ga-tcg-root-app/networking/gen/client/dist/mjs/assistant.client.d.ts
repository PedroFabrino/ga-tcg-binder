import { AddWantRpcRequest, AddWantRpcResponse, AdminSettingsResponse, AutocompleteRpcRequest, AutocompleteRpcResponse, DecksResponse, ImportDeckRpcRequest, ImportDeckRpcResponse, LinkRequest, LinkResponse, PersonalWantsRpcResponse, PreferencesRequest, PreferencesResponse, ProvisionMarketChannelsResponse, RegisterResponse, RemoveWantRpcRequest, RemoveWantRpcResponse, SetBroadcastChannelRequest, SetBroadcastChannelResponse, StatusResponse, UpdateDeckRpcRequest, UpdateDeckRpcResponse } from "@ga/gen-shared";
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
    updateDeck(request: UpdateDeckRpcRequest): Promise<UpdateDeckRpcResponse>;
    getAdminSettings(): Promise<AdminSettingsResponse>;
    setBroadcastChannel(request: SetBroadcastChannelRequest): Promise<SetBroadcastChannelResponse>;
    provisionMarketChannels(): Promise<ProvisionMarketChannelsResponse>;
    private __register;
}
export declare const assistantServiceClient: AssistantServiceClient;
