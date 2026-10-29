import { AssistantServiceBase } from "@ga/gen-server";
import { rootServer, type Client } from "@rootsdk/server-app";
import {
  type AddWantRpcRequest,
  type AddWantRpcResponse,
  type AdminSettingsResponse,
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
  type ProvisionMarketChannelsResponse,
  type RegisterResponse,
  type RemoveWantRpcRequest,
  type RemoveWantRpcResponse,
  type SetBroadcastChannelRequest,
  type SetBroadcastChannelResponse,
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
  createUnlinkedStatus,
  mapSuggestion,
  linkAccountHelper,
  registerAccountHelper,
} from "./assistant-rpc-helpers";
import {
  createCommunityConfig,
  type RootCommunityConfig,
} from "./community-config";
import { checkIsCommunityAdmin } from "./community-admin";
import {
  getAdminSettingsHelper,
  setBroadcastChannelHelper,
  provisionMarketChannelsHelper,
  type AdminRpcHelperDeps,
} from "./admin-rpc-helpers";

export interface AssistantRpcServiceDeps extends AdminRpcHelperDeps {
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

  private getConfig(): RootCommunityConfig {
    return this.deps.config ?? createCommunityConfig(rootServer.dataStore.appData);
  }

  async getStatus(client: Client): Promise<StatusResponse> {
    const userId = String(client.userId);
    const api = this.getApi(client);
    const isAdmin = await (this.deps.isCommunityAdmin ?? checkIsCommunityAdmin)(userId);
    try {
      const [collector, channel] = await Promise.all([
        api.getCollector(userId),
        api.getDealAlertChannel(userId).catch(() => null),
      ]);

      if (!collector) {
        const broadcastLocale = (await this.getConfig().getBroadcastLocale().catch(() => "en")) || "en";
        return createUnlinkedStatus(isAdmin, broadcastLocale);
      }

      return {
        isLinked: true,
        collectorId: collector.collectorId,
        collectorName: collector.collectorName ?? "",
        friendCode: collector.friendCode ?? "",
        notificationsEnabled: Boolean(collector.notificationsEnabled),
        dealAlertMode: collector.dealAlertMode ?? "all",
        alertChannelId: channel?.channelId ?? "",
        isAdmin,
        locale: collector.locale || "en",
      };
    } catch {
      const broadcastLocale = (await this.getConfig().getBroadcastLocale().catch(() => "en")) || "en";
      return createUnlinkedStatus(isAdmin, broadcastLocale);
    }
  }

  async linkAccount(
    request: LinkRequest,
    client: Client
  ): Promise<LinkResponse> {
    return linkAccountHelper(this.getApi(client), String(client.userId), request.code);
  }

  async registerAccount(client: Client): Promise<RegisterResponse> {
    return registerAccountHelper(this.getApi(client), String(client.userId));
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
    const locale = request.locale === "pt-BR" ? "pt-BR" : (request.locale === "en" ? "en" : undefined);

    try {
      const { alertChannelId } = await updateDealAlertPreferencesHelper(
        api,
        userId,
        communityId,
        request.notificationsEnabled,
        mode,
        this.deps,
        locale
      );

      return {
        success: true,
        notificationsEnabled: request.notificationsEnabled,
        dealAlertMode: mode,
        alertChannelId,
        locale: locale || "",
        error: "",
      };
    } catch (err: unknown) {
      return {
        success: false,
        notificationsEnabled: false,
        dealAlertMode: "all",
        alertChannelId: "",
        locale: "",
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
        suggestions: (res.suggestions || []).map(mapSuggestion),
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
        suggestions: (res.suggestions || []).map(mapSuggestion),
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

  async getAdminSettings(client: Client): Promise<AdminSettingsResponse> {
    return getAdminSettingsHelper(
      String(client.userId),
      this.getConfig(),
      this.deps
    );
  }

  async setBroadcastChannel(
    request: SetBroadcastChannelRequest,
    client: Client
  ): Promise<SetBroadcastChannelResponse> {
    return setBroadcastChannelHelper(
      String(client.userId),
      request,
      this.getConfig(),
      this.deps
    );
  }

  async provisionMarketChannels(
    client: Client
  ): Promise<ProvisionMarketChannelsResponse> {
    return provisionMarketChannelsHelper(
      String(client.userId),
      this.getConfig(),
      this.deps
    );
  }
}
