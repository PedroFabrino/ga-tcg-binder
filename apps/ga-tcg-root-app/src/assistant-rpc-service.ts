import { AssistantServiceBase } from "@ga/gen-server";
import { type Client } from "@rootsdk/server-app";
import {
  type AddWantRpcRequest,
  type AddWantRpcResponse,
  type AutocompleteRpcRequest,
  type AutocompleteRpcResponse,
  type DecksResponse,
  type ImportDeckRpcRequest,
  type ImportDeckRpcResponse,
  type LinkRequest,
  type LinkResponse,
  type PersonalWantsRpcResponse,
  type PreferencesRequest,
  type PreferencesResponse,
  type RegisterResponse,
  type RemoveWantRpcRequest,
  type RemoveWantRpcResponse,
  type StatusResponse,
  type UpdateDeckRpcRequest,
  type UpdateDeckRpcResponse,
} from "@ga/gen-shared";
import { RootBotApi, RootBotApiError } from "./root-bot-api";
import {
  buildDeckSummariesWithShortages,
  updateDealAlertPreferencesHelper,
  mapAutocompleteChoice,
  mapPersonalWant,
} from "./assistant-rpc-helpers";

export interface AssistantRpcServiceDeps {
  api?: RootBotApi;
  ensureRecipientChannel?: (
    recipientId: string,
    communityId?: string
  ) => Promise<string | null>;
  removeDealAlertChannel?: (
    recipientId: string,
    communityId?: string
  ) => Promise<void>;
  setNotificationPreference?: (
    providerUserId: string,
    enabled: boolean,
    mode?: "all" | "hard"
  ) => Promise<void>;
}

export class AssistantRpcService extends AssistantServiceBase {
  private readonly defaultApi?: RootBotApi;

  constructor(
    private readonly communityId?: string,
    private readonly deps: AssistantRpcServiceDeps = {}
  ) {
    super();
    if (deps.api) {
      this.defaultApi = deps.api;
    } else if (communityId || process.env.COMMUNITY_ID) {
      this.defaultApi = new RootBotApi({
        communityId: communityId ?? process.env.COMMUNITY_ID ?? "",
      });
    }
  }

  private getApi(client: Client): RootBotApi {
    if (this.deps.api) {
      return this.deps.api;
    }
    const resolvedCommunityId = client.communityId
      ? String(client.communityId)
      : (this.communityId ?? process.env.COMMUNITY_ID ?? "");
    if (
      this.defaultApi &&
      (!client.communityId || String(client.communityId) === this.communityId)
    ) {
      return this.defaultApi;
    }
    return new RootBotApi({ communityId: resolvedCommunityId });
  }

  async getStatus(client: Client): Promise<StatusResponse> {
    const userId = String(client.userId);
    const api = this.getApi(client);
    try {
      const [collector, channel] = await Promise.all([
        api.getCollector(userId),
        api.getDealAlertChannel(userId).catch(() => null),
      ]);

      if (!collector) {
        return {
          isLinked: false,
          collectorId: "",
          collectorName: "",
          friendCode: "",
          notificationsEnabled: false,
          dealAlertMode: "all",
          alertChannelId: "",
        };
      }

      return {
        isLinked: true,
        collectorId: collector.collectorId,
        collectorName: collector.collectorName ?? "",
        friendCode: collector.friendCode ?? "",
        notificationsEnabled: Boolean(collector.notificationsEnabled),
        dealAlertMode: collector.dealAlertMode ?? "all",
        alertChannelId: channel?.channelId ?? "",
      };
    } catch {
      return {
        isLinked: false,
        collectorId: "",
        collectorName: "",
        friendCode: "",
        notificationsEnabled: false,
        dealAlertMode: "all",
        alertChannelId: "",
      };
    }
  }

  async linkAccount(
    request: LinkRequest,
    client: Client
  ): Promise<LinkResponse> {
    const userId = String(client.userId);
    const api = this.getApi(client);
    const code = (request.code || "").trim().toUpperCase();

    if (!code) {
      return {
        success: false,
        collectorName: "",
        error: "INVALID_CODE",
      };
    }

    try {
      const res = await api.link({
        token: code,
        provider: "root",
        providerUserId: userId,
      });

      return {
        success: true,
        collectorName: res.collectorName ?? "",
        error: "",
      };
    } catch (err: unknown) {
      if (err instanceof RootBotApiError) {
        return {
          success: false,
          collectorName: "",
          error: err.code || err.message,
        };
      }
      return {
        success: false,
        collectorName: "",
        error: err instanceof Error ? err.message : "LINK_FAILED",
      };
    }
  }

  async registerAccount(client: Client): Promise<RegisterResponse> {
    const userId = String(client.userId);
    const api = this.getApi(client);
    try {
      const res = await api.register(userId);
      return {
        success: true,
        collectorName: res.collector.name ?? "",
        friendCode: res.collector.friendCode ?? "",
        error: "",
      };
    } catch (err: unknown) {
      return {
        success: false,
        collectorName: "",
        friendCode: "",
        error: err instanceof Error ? err.message : "REGISTER_FAILED",
      };
    }
  }

  async setPreferences(
    request: PreferencesRequest,
    client: Client
  ): Promise<PreferencesResponse> {
    const userId = String(client.userId);
    const communityId = client.communityId
      ? String(client.communityId)
      : (this.communityId ?? process.env.COMMUNITY_ID ?? "");
    const api = this.getApi(client);
    const mode = request.dealAlertMode === "hard" ? "hard" : "all";

    try {
      const { alertChannelId } = await updateDealAlertPreferencesHelper(
        api,
        userId,
        communityId,
        request.notificationsEnabled,
        mode,
        this.deps
      );

      return {
        success: true,
        notificationsEnabled: request.notificationsEnabled,
        dealAlertMode: mode,
        alertChannelId,
        error: "",
      };
    } catch (err: unknown) {
      return {
        success: false,
        notificationsEnabled: false,
        dealAlertMode: "all",
        alertChannelId: "",
        error: err instanceof Error ? err.message : "SET_PREFERENCES_FAILED",
      };
    }
  }

  async getDecks(client: Client): Promise<DecksResponse> {
    const userId = String(client.userId);
    const api = this.getApi(client);
    try {
      const res = await api.getDecks(userId);
      const decks = await buildDeckSummariesWithShortages(
        api,
        userId,
        res.decks || []
      );
      return { decks };
    } catch {
      return { decks: [] };
    }
  }

  async autocomplete(
    request: AutocompleteRpcRequest,
    client: Client
  ): Promise<AutocompleteRpcResponse> {
    const userId = String(client.userId);
    const api = this.getApi(client);
    try {
      const type =
        request.type === "wants" || request.type === "deck" ? request.type : "card";
      const res = await api.autocomplete(userId, type, request.query || "");
      return { results: (res.results || []).map(mapAutocompleteChoice) };
    } catch {
      return { results: [] };
    }
  }

  async getPersonalWants(client: Client): Promise<PersonalWantsRpcResponse> {
    const userId = String(client.userId);
    const api = this.getApi(client);
    try {
      const res = await api.getPersonalWants(userId);
      return { wants: (res.personalWants || []).map(mapPersonalWant) };
    } catch {
      return { wants: [] };
    }
  }

  async addWant(
    request: AddWantRpcRequest,
    client: Client
  ): Promise<AddWantRpcResponse> {
    const userId = String(client.userId);
    const api = this.getApi(client);
    try {
      const res = await api.addWant(userId, {
        card: request.card,
        quantity: request.quantity,
        foil: request.foil,
        omnidexUrl: request.omnidexUrl || undefined,
        omnidexText: request.omnidexText || undefined,
      });
      return {
        success: true,
        message: res.card ? `Added ${res.card.name}` : "Imported Omnidex shortages",
        error: "",
        suggestions: (res.suggestions || []).map((s) => ({
          name: s.name,
          value: s.slug,
          element: "",
          type: "",
          quantity: 0,
          foil: false,
        })),
      };
    } catch (err: unknown) {
      return {
        success: false,
        message: "",
        error: err instanceof Error ? err.message : "ADD_WANT_FAILED",
        suggestions: [],
      };
    }
  }

  async removeWant(
    request: RemoveWantRpcRequest,
    client: Client
  ): Promise<RemoveWantRpcResponse> {
    const userId = String(client.userId);
    const api = this.getApi(client);
    try {
      const res = await api.removeWant(userId, {
        card: request.card,
        quantity: request.quantity,
      });
      return {
        success: res.success,
        removed: res.removed,
        remainingQuantity: res.remainingQuantity,
        cardName: res.cardName,
        error: "",
        suggestions: (res.suggestions || []).map((s) => ({
          name: s.name,
          value: s.slug,
          element: "",
          type: "",
          quantity: s.quantity,
          foil: false,
        })),
      };
    } catch (err: unknown) {
      return {
        success: false,
        removed: false,
        remainingQuantity: 0,
        cardName: request.card,
        error: err instanceof Error ? err.message : "REMOVE_WANT_FAILED",
        suggestions: [],
      };
    }
  }

  async importDeck(
    request: ImportDeckRpcRequest,
    client: Client
  ): Promise<ImportDeckRpcResponse> {
    const userId = String(client.userId);
    const api = this.getApi(client);
    try {
      const res = await api.importDeck(userId, {
        url: request.url || undefined,
        text: request.text || undefined,
      });
      return {
        success: true,
        deckName: res.deck.name,
        error: "",
      };
    } catch (err: unknown) {
      return {
        success: false,
        deckName: "",
        error: err instanceof Error ? err.message : "IMPORT_DECK_FAILED",
      };
    }
  }

  async updateDeck(
    request: UpdateDeckRpcRequest,
    client: Client
  ): Promise<UpdateDeckRpcResponse> {
    const userId = String(client.userId);
    const api = this.getApi(client);
    try {
      const res = await api.updateDeck(userId, {
        deckId: request.deckId,
        url: request.url || undefined,
        text: request.text || undefined,
        name: request.name || undefined,
        champion: request.champion || undefined,
      });
      return {
        success: true,
        deckName: res.deck.name,
        error: "",
      };
    } catch (err: unknown) {
      return {
        success: false,
        deckName: "",
        error: err instanceof Error ? err.message : "UPDATE_DECK_FAILED",
      };
    }
  }
}
