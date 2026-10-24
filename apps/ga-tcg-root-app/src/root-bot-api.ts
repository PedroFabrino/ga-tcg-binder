import {
  type AssistantCollectionResponse,
  type AssistantDeckShortagesResponse,
  type AssistantDecksResponse,
  type AssistantLinkRequest,
  type AssistantLinkResponse,
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

  async getCollector(providerUserId: string): Promise<RootBotCollectorResponse> {
    const params = new URLSearchParams({ provider: "root", providerUserId });
    return this.request(`/api/root-bot/collector?${params.toString()}`);
  }

  async setNotifyPreference(request: RootBotNotifyRequest): Promise<void> {
    await this.request("/api/root-bot/notify", {
      method: "POST",
      body: JSON.stringify(request),
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
}
