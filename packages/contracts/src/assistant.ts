/**
 * Shared Assistant domain models, contracts, and typed API client
 * for Grand Archive TCG Collector Assistants (Discord & Root).
 */

export type AssistantProvider = "discord" | "root";

// ---------------------------------------------------------------------------
// Identity & Pairing Contracts
// ---------------------------------------------------------------------------

export interface AssistantLinkRequest {
  token: string;
  provider: AssistantProvider;
  providerUserId: string;
  providerUsername?: string | null;
}

export interface AssistantLinkResponse {
  success: boolean;
  collectorId: string;
  collectorName?: string | null;
  message: string;
}

// ---------------------------------------------------------------------------
// Deck Summary Contracts
// ---------------------------------------------------------------------------

export interface AssistantDeckSummary {
  id: string;
  name: string;
  format: string;
  champion: string | null;
  totalCards: number;
  uniqueCards: number;
  completionPercentage: number;
  hardShortageCount: number;
  sharedShortageCount: number;
  webUrl?: string;
}

export interface AssistantDecksResponse {
  collectorId: string;
  collectorName?: string | null;
  decks: AssistantDeckSummary[];
}

// ---------------------------------------------------------------------------
// Shortage Item Contracts
// ---------------------------------------------------------------------------

export interface AssistantShortageItem {
  cardSlug: string;
  cardName: string;
  element: string;
  rarity: number | null;
  requiredQuantity: number;
  missingQuantity: number;
  sharedQuantity: number;
  competingDecks: string[];
  type: "hard" | "shared";
  zone?: string;
  imageUrl?: string | null;
}

export interface AssistantDeckShortagesResponse {
  collectorId: string;
  deckId: string;
  deckName: string;
  format: string;
  completionPercentage: number;
  hardShortages: AssistantShortageItem[];
  sharedShortages: AssistantShortageItem[];
  totalHardShortages: number;
  totalSharedShortages: number;
  webUrl?: string;
}

// ---------------------------------------------------------------------------
// Collection Search Contracts
// ---------------------------------------------------------------------------

export interface AssistantCollectionPrinting {
  editionId: string;
  cardSlug: string;
  setPrefix: string;
  setName: string;
  collectorNumber: string;
  rarity: number;
  imageUrl: string;
  foil: boolean;
  quantity: number;
  isDedicated: boolean;
  dedicatedCount: number;
  idleCount: number;
}

export interface AssistantCollectionCard {
  cardSlug: string;
  cardName: string;
  element: string;
  class: string;
  type: string;
  totalOwned: number;
  dedicatedTotal: number;
  idleTotal: number;
  printings: AssistantCollectionPrinting[];
}

export interface AssistantCollectionResponse {
  collectorId: string;
  query: string;
  cards: AssistantCollectionCard[];
}

// ---------------------------------------------------------------------------
// Collection Portfolio Summary Contracts
// ---------------------------------------------------------------------------

export interface AssistantPortfolioElementCount {
  element: string;
  count: number;
}

export interface AssistantPortfolioSummary {
  collectorId: string;
  collectorName: string | null;
  friendCode: string;
  totalCards: number;
  uniqueCards: number;
  foilCards: number;
  normalCards: number;
  dedicatedCards: number;
  idleCards: number;
  elements: AssistantPortfolioElementCount[];
  profileUrl: string;
}

export interface AssistantPortfolioResponse {
  collectorId: string;
  portfolio: AssistantPortfolioSummary;
}

// ---------------------------------------------------------------------------
// Personal Wants Contracts
// ---------------------------------------------------------------------------

export interface AssistantPersonalWantItem {
  id: string;
  collectorId: string;
  cardSlug: string;
  cardName: string;
  element: string;
  type: string;
  class: string | null;
  editionId: string | null;
  setPrefix: string | null;
  setName: string | null;
  collectorNumber: string | null;
  imageUrl: string | null;
  desiredQuantity: number;
  foil: boolean | null;
  targetMaxPrice: number | null;
  source: string;
}

export interface AssistantAggregateWantlistResponse {
  collectorId: string;
  collectorName?: string | null;
  decks: AssistantDeckWantlistGroup[];
  personalWants: AssistantPersonalWantItem[];
  totalDecks: number;
  totalPersonalWants: number;
  grandTotalHard: number;
  grandTotalShared: number;
  grandTotalPersonal: number;
}

// ---------------------------------------------------------------------------
// Deck-Partitioned Wantlist Contracts
// ---------------------------------------------------------------------------

export interface AssistantDeckWantlistGroup {
  deckId: string;
  deckName: string;
  format: string;
  hardShortages: AssistantShortageItem[];
  sharedShortages: AssistantShortageItem[];
  totalShortages: number;
}

export interface AssistantWantlistResponse {
  collectorId: string;
  collectorName?: string | null;
  decks: AssistantDeckWantlistGroup[];
  totalDecks: number;
  grandTotalHard: number;
  grandTotalShared: number;
}

// ---------------------------------------------------------------------------
// Typed Assistant Client
// ---------------------------------------------------------------------------

export class AssistantApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "AssistantApiError";
  }
}

export interface AssistantClientConfig {
  baseUrl: string;
  assistantToken?: string;
}

export class AssistantClient {
  private readonly baseUrl: string;
  private readonly assistantToken?: string;

  constructor(config: AssistantClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.assistantToken = config.assistantToken;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    if (this.assistantToken) {
      headers.set("x-assistant-token", this.assistantToken);
    }

    const res = await fetch(url, {
      ...options,
      headers,
    });

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (!res.ok) {
      const code = typeof data.error === "string" ? data.error : `HTTP_${res.status}`;
      const message =
        typeof data.message === "string"
          ? data.message
          : `Assistant API request failed with status ${res.status}`;
      throw new AssistantApiError(res.status, code, message);
    }

    // JSON boundary: the caller owns the response shape.
    return data as unknown as T;
  }

  async link(req: AssistantLinkRequest): Promise<AssistantLinkResponse> {
    return this.request<AssistantLinkResponse>("/api/assistant/link", {
      method: "POST",
      body: JSON.stringify(req),
    });
  }

  async getDecks(provider: AssistantProvider, providerUserId: string): Promise<AssistantDecksResponse> {
    const params = new URLSearchParams({ provider, providerUserId });
    return this.request<AssistantDecksResponse>(`/api/assistant/decks?${params.toString()}`);
  }

  async getShortages(
    provider: AssistantProvider,
    providerUserId: string,
    deckIdOrName: string
  ): Promise<AssistantDeckShortagesResponse> {
    const params = new URLSearchParams({
      provider,
      providerUserId,
      deck: deckIdOrName,
    });
    return this.request<AssistantDeckShortagesResponse>(`/api/assistant/shortages?${params.toString()}`);
  }

  async searchCollection(
    provider: AssistantProvider,
    providerUserId: string,
    query: string
  ): Promise<AssistantCollectionResponse> {
    const params = new URLSearchParams({
      provider,
      providerUserId,
      query,
    });
    return this.request<AssistantCollectionResponse>(`/api/assistant/collection?${params.toString()}`);
  }

  async getWantlist(
    provider: AssistantProvider,
    providerUserId: string,
    deckIdOrName?: string
  ): Promise<AssistantWantlistResponse> {
    const params = new URLSearchParams({ provider, providerUserId });
    if (deckIdOrName) {
      params.set("deck", deckIdOrName);
    }
    return this.request<AssistantWantlistResponse>(`/api/assistant/wantlist?${params.toString()}`);
  }
}
