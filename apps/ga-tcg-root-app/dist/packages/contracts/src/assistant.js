"use strict";
/**
 * Shared Assistant domain models, contracts, and typed API client
 * for Grand Archive TCG Collector Assistants (Discord & Root).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssistantClient = exports.AssistantApiError = void 0;
// ---------------------------------------------------------------------------
// Typed Assistant Client
// ---------------------------------------------------------------------------
class AssistantApiError extends Error {
    statusCode;
    code;
    constructor(statusCode, code, message) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = "AssistantApiError";
    }
}
exports.AssistantApiError = AssistantApiError;
class AssistantClient {
    baseUrl;
    assistantToken;
    constructor(config) {
        this.baseUrl = config.baseUrl.replace(/\/+$/, "");
        this.assistantToken = config.assistantToken;
    }
    async request(path, options = {}) {
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
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const code = data?.error || `HTTP_${res.status}`;
            const message = data?.message || `Assistant API request failed with status ${res.status}`;
            throw new AssistantApiError(res.status, code, message);
        }
        return data;
    }
    async link(req) {
        return this.request("/api/assistant/link", {
            method: "POST",
            body: JSON.stringify(req),
        });
    }
    async getDecks(provider, providerUserId) {
        const params = new URLSearchParams({ provider, providerUserId });
        return this.request(`/api/assistant/decks?${params.toString()}`);
    }
    async getShortages(provider, providerUserId, deckIdOrName) {
        const params = new URLSearchParams({
            provider,
            providerUserId,
            deck: deckIdOrName,
        });
        return this.request(`/api/assistant/shortages?${params.toString()}`);
    }
    async searchCollection(provider, providerUserId, query) {
        const params = new URLSearchParams({
            provider,
            providerUserId,
            query,
        });
        return this.request(`/api/assistant/collection?${params.toString()}`);
    }
    async getWantlist(provider, providerUserId, deckIdOrName) {
        const params = new URLSearchParams({ provider, providerUserId });
        if (deckIdOrName) {
            params.set("deck", deckIdOrName);
        }
        return this.request(`/api/assistant/wantlist?${params.toString()}`);
    }
}
exports.AssistantClient = AssistantClient;
