import type {
  AddWantRpcRequest,
  AddWantRpcResponse,
  AdminSettingsResponse,
  AutocompleteChoiceItem,
  AutocompleteRpcRequest,
  AutocompleteRpcResponse,
  CommunityChannelGroupOption,
  CommunityChannelOption,
  DeckSummary,
  DecksResponse,
  ImportDeckRpcRequest,
  ImportDeckRpcResponse,
  LinkRequest,
  LinkResponse,
  PersonalWantRpcItem,
  PersonalWantsRpcResponse,
  PreferencesRequest,
  PreferencesResponse,
  ProvisionMarketChannelsRequest,
  ProvisionMarketChannelsResponse,
  RegisterResponse,
  RemoveWantRpcRequest,
  RemoveWantRpcResponse,
  SetBroadcastChannelRequest,
  SetBroadcastChannelResponse,
  StatusResponse,
  UpdateDeckRpcRequest,
  UpdateDeckRpcResponse,
} from "@ga/gen-shared";

export type {
  AddWantRpcRequest,
  AddWantRpcResponse,
  AdminSettingsResponse,
  AutocompleteChoiceItem,
  AutocompleteRpcRequest,
  AutocompleteRpcResponse,
  CommunityChannelGroupOption,
  CommunityChannelOption,
  DeckSummary,
  DecksResponse,
  ImportDeckRpcRequest,
  ImportDeckRpcResponse,
  LinkRequest,
  LinkResponse,
  PersonalWantRpcItem,
  PersonalWantsRpcResponse,
  PreferencesRequest,
  PreferencesResponse,
  ProvisionMarketChannelsRequest,
  ProvisionMarketChannelsResponse,
  RegisterResponse,
  RemoveWantRpcRequest,
  RemoveWantRpcResponse,
  SetBroadcastChannelRequest,
  SetBroadcastChannelResponse,
  StatusResponse,
  UpdateDeckRpcRequest,
  UpdateDeckRpcResponse,
};

export type AdminFeedback = {
  type: "success" | "error";
  text: string;
};

export interface IAssistantRpcClient {
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
  provisionMarketChannels(request?: ProvisionMarketChannelsRequest): Promise<ProvisionMarketChannelsResponse>;
}
