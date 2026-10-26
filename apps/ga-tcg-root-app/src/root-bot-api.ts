import {
  type AssistantAddWantResponse,
  type AssistantAutocompleteResponse,
  type AssistantCollectionResponse,
  type AssistantDeckShortagesResponse,
  type AssistantDecksResponse,
  type AssistantImportDeckResponse,
  type AssistantLinkRequest,
  type AssistantLinkResponse,
  type AssistantPersonalWantItem,
  type AssistantPortfolioResponse,
  type AssistantRegisterResponse,
  type AssistantRemoveWantResponse,
  type AssistantWantlistResponse,
  type RootBotCollectorResponse,
  type RootBotDealAlertDeliveredRequest,
  type RootBotDealAlertsResponse,
  type RootBotMarketDeliveredRequest,
  type RootBotMarketNotificationsResponse,
  type RootBotNotifyRequest,
} from "@ga/contracts";
import { getRootBotToken } from "./root-bot-auth";
import { ROOT_BOT_API_BASE_URL } from "./root-bot-config";

export class RootBotApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "RootBotApiError";
  }
}

export interface RootBotApiOptions {
  communityId: string;
  baseUrl?: string;
  /** Pre-resolved token (tests / already-bootstrapped callers). */
  token?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Typed client for the Root bot API. Every call carries the per-install bearer
 * token and the community id; the app scopes all data by that community.
 */
export class RootBotApi {
  private readonly baseUrl: string;
  private readonly communityId: string;
  private readonly fetchImpl: typeof fetch;
  private tokenPromise: Promise<string> | null = null;

  constructor(private readonly options: RootBotApiOptions) {
    this.baseUrl = (options.baseUrl ?? ROOT_BOT_API_BASE_URL).replace(/\/+$/, "");
    this.communityId = options.communityId;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async token(): Promise<string> {
    if (this.options.token) {
      return this.options.token;
    }
    if (!this.tokenPromise) {
      this.tokenPromise = getRootBotToken({
        communityId: this.communityId,
        apiBaseUrl: this.baseUrl,
        fetchImpl: this.fetchImpl,
      }).catch((err) => {
        // Allow a later call to retry the install instead of caching a failure.
        this.tokenPromise = null;
        throw err;
      });
    }
    return this.tokenPromise;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.token();
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("x-root-community-id", this.communityId);
    if (init.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });
    const data = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!response.ok) {
      throw new RootBotApiError(
        response.status,
        typeof data.error === "string" ? data.error : `HTTP_${response.status}`,
        typeof data.message === "string"
          ? data.message
          : `Root bot API request failed (${response.status})`
      );
    }

    return data as T;
  }

  async getMarketNotifications(): Promise<RootBotMarketNotificationsResponse> {
    return this.request("/api/root-bot/market-notifications");
  }

  async markMarketNotificationsDelivered(
    request: RootBotMarketDeliveredRequest
  ): Promise<void> {
    await this.request("/api/root-bot/market-notifications/delivered", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async getDealAlerts(): Promise<RootBotDealAlertsResponse> {
    return this.request("/api/root-bot/deal-alerts");
  }

  async recordDealAlertDelivery(
    request: RootBotDealAlertDeliveredRequest
  ): Promise<void> {
    await this.request("/api/root-bot/deal-alerts/delivered", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async recordDealAlertCleanup(recipientId: string): Promise<void> {
    await this.request("/api/root-bot/deal-alerts/cleanup", {
      method: "POST",
      body: JSON.stringify({ recipientId }),
    });
  }

  async getDealAlertChannel(
    recipientId: string
  ): Promise<{ channelId: string; messageIds: string[] } | null> {
    const params = new URLSearchParams({ recipientId });
    return this.request(
      `/api/root-bot/deal-alerts/channel?${params.toString()}`
    );
  }

  async getCollector(
    providerUserId: string
  ): Promise<RootBotCollectorResponse | null> {
    const params = new URLSearchParams({ provider: "root", providerUserId });
    return this.request(`/api/root-bot/collector?${params.toString()}`);
  }

  async setNotifyPreference(request: RootBotNotifyRequest): Promise<void> {
    await this.request("/api/root-bot/notify", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async register(
    providerUserId: string,
    providerUsername?: string
  ): Promise<AssistantRegisterResponse> {
    return this.request("/api/assistant/register", {
      method: "POST",
      body: JSON.stringify({
        provider: "root",
        providerUserId,
        providerUsername,
      }),
    });
  }

  async link(request: AssistantLinkRequest): Promise<AssistantLinkResponse> {
    return this.request("/api/assistant/link", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async getDecks(providerUserId: string): Promise<AssistantDecksResponse> {
    const params = new URLSearchParams({ provider: "root", providerUserId });
    return this.request(`/api/assistant/decks?${params.toString()}`);
  }

  async importDeck(
    providerUserId: string,
    req: { url?: string; text?: string; name?: string; champion?: string; format?: string }
  ): Promise<AssistantImportDeckResponse> {
    return this.request("/api/assistant/decks", {
      method: "POST",
      body: JSON.stringify({
        provider: "root",
        providerUserId,
        ...req,
      }),
    });
  }

  async updateDeck(
    providerUserId: string,
    req: { deckId: string; url?: string; text?: string; name?: string; champion?: string; format?: string }
  ): Promise<AssistantImportDeckResponse> {
    return this.request("/api/assistant/decks", {
      method: "PUT",
      body: JSON.stringify({
        provider: "root",
        providerUserId,
        ...req,
      }),
    });
  }

  async getShortages(
    providerUserId: string,
    deck: string
  ): Promise<AssistantDeckShortagesResponse> {
    const params = new URLSearchParams({ provider: "root", providerUserId, deck });
    return this.request(`/api/assistant/shortages?${params.toString()}`);
  }

  async searchCollection(
    providerUserId: string,
    query: string
  ): Promise<AssistantCollectionResponse> {
    const params = new URLSearchParams({ provider: "root", providerUserId, query });
    return this.request(`/api/assistant/collection?${params.toString()}`);
  }

  async getPortfolio(providerUserId: string): Promise<AssistantPortfolioResponse> {
    const params = new URLSearchParams({ provider: "root", providerUserId });
    return this.request(`/api/assistant/collection?${params.toString()}`);
  }

  async getWantlist(
    providerUserId: string,
    deck?: string
  ): Promise<AssistantWantlistResponse> {
    const params = new URLSearchParams({ provider: "root", providerUserId });
    if (deck) {
      params.set("deck", deck);
    }
    return this.request(`/api/assistant/wantlist?${params.toString()}`);
  }

  async getPersonalWants(
    providerUserId: string
  ): Promise<{ personalWants: AssistantPersonalWantItem[] }> {
    const params = new URLSearchParams({
      provider: "root",
      providerUserId,
      personalOnly: "true",
    });
    return this.request(`/api/assistant/wantlist?${params.toString()}`);
  }

  async addWant(
    providerUserId: string,
    req: { card?: string; quantity?: number; foil?: boolean; omnidexUrl?: string; omnidexText?: string }
  ): Promise<AssistantAddWantResponse> {
    return this.request("/api/assistant/wantlist", {
      method: "POST",
      body: JSON.stringify({
        provider: "root",
        providerUserId,
        ...req,
      }),
    });
  }

  async removeWant(
    providerUserId: string,
    req: { card: string; quantity?: number }
  ): Promise<AssistantRemoveWantResponse> {
    return this.request("/api/assistant/wantlist", {
      method: "DELETE",
      body: JSON.stringify({
        provider: "root",
        providerUserId,
        ...req,
      }),
    });
  }

  async autocomplete(
    providerUserId: string,
    type: "card" | "wants" | "deck",
    query: string
  ): Promise<AssistantAutocompleteResponse> {
    const params = new URLSearchParams({
      provider: "root",
      providerUserId,
      type,
      query,
    });
    return this.request(`/api/assistant/autocomplete?${params.toString()}`);
  }
}
