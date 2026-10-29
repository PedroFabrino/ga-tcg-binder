import { AssistantServiceBase } from "@ga/gen-server";
import { type Client } from "@rootsdk/server-app";
import { type AddWantRpcRequest, type AddWantRpcResponse, type AdminSettingsResponse, type AutocompleteRpcRequest, type AutocompleteRpcResponse, type DecksResponse, type ImportDeckRpcRequest, type ImportDeckRpcResponse, type LinkRequest, type LinkResponse, type PersonalWantsRpcResponse, type PreferencesRequest, type PreferencesResponse, type ProvisionMarketChannelsRequest, type ProvisionMarketChannelsResponse, type RegisterResponse, type RemoveWantRpcRequest, type RemoveWantRpcResponse, type SetBroadcastChannelRequest, type SetBroadcastChannelResponse, type StatusResponse, type UpdateDeckRpcRequest, type UpdateDeckRpcResponse } from "@ga/gen-shared";
import { RootBotApi } from "./root-bot-api";
import { type AdminRpcHelperDeps } from "./admin-rpc-helpers";
export interface AssistantRpcServiceDeps extends AdminRpcHelperDeps {
    api?: RootBotApi;
    ensureRecipientChannel?: (recipientId: string, communityId?: string) => Promise<string | null>;
    removeDealAlertChannel?: (recipientId: string, communityId?: string) => Promise<void>;
    setNotificationPreference?: (providerUserId: string, enabled: boolean, mode?: "all" | "hard") => Promise<void>;
}
export declare class AssistantRpcService extends AssistantServiceBase {
    private readonly communityId?;
    private readonly deps;
    private readonly defaultApi?;
    constructor(communityId?: string | undefined, deps?: AssistantRpcServiceDeps);
    private getApi;
    private getConfig;
    getStatus(client: Client): Promise<StatusResponse>;
    linkAccount(request: LinkRequest, client: Client): Promise<LinkResponse>;
    registerAccount(client: Client): Promise<RegisterResponse>;
    setPreferences(request: PreferencesRequest, client: Client): Promise<PreferencesResponse>;
    getDecks(client: Client): Promise<DecksResponse>;
    autocomplete(request: AutocompleteRpcRequest, client: Client): Promise<AutocompleteRpcResponse>;
    getPersonalWants(client: Client): Promise<PersonalWantsRpcResponse>;
    addWant(request: AddWantRpcRequest, client: Client): Promise<AddWantRpcResponse>;
    removeWant(request: RemoveWantRpcRequest, client: Client): Promise<RemoveWantRpcResponse>;
    importDeck(request: ImportDeckRpcRequest, client: Client): Promise<ImportDeckRpcResponse>;
    updateDeck(request: UpdateDeckRpcRequest, client: Client): Promise<UpdateDeckRpcResponse>;
    getAdminSettings(client: Client): Promise<AdminSettingsResponse>;
    setBroadcastChannel(request: SetBroadcastChannelRequest, client: Client): Promise<SetBroadcastChannelResponse>;
    provisionMarketChannels(request: ProvisionMarketChannelsRequest, client: Client): Promise<ProvisionMarketChannelsResponse>;
}
