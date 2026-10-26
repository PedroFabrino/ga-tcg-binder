import type {
  DeckSummary,
  DecksResponse,
  LinkRequest,
  LinkResponse,
  PreferencesRequest,
  PreferencesResponse,
  StatusResponse,
} from "@ga/gen-shared";

export type {
  DeckSummary,
  DecksResponse,
  LinkRequest,
  LinkResponse,
  PreferencesRequest,
  PreferencesResponse,
  StatusResponse,
};

export interface IAssistantRpcClient {
  getStatus(): Promise<StatusResponse>;
  linkAccount(request: LinkRequest): Promise<LinkResponse>;
  setPreferences(request: PreferencesRequest): Promise<PreferencesResponse>;
  getDecks(): Promise<DecksResponse>;
}
