import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CommunityAdminCard } from "../components/CommunityAdminCard";
import type { IAssistantRpcClient, AdminSettingsResponse } from "../types";

function createMockRpcClient(): IAssistantRpcClient {
  return {
    getStatus: vi.fn(),
    linkAccount: vi.fn(),
    registerAccount: vi.fn(),
    setPreferences: vi.fn(),
    getDecks: vi.fn(),
    autocomplete: vi.fn(),
    getPersonalWants: vi.fn(),
    addWant: vi.fn(),
    removeWant: vi.fn(),
    importDeck: vi.fn(),
    updateDeck: vi.fn(),
    getAdminSettings: vi.fn().mockResolvedValue({
      isAdmin: true,
      broadcastChannelId: "ch-market-1",
      broadcastChannelName: "market",
      textChannels: [
        { id: "ch-gen", name: "general", groupName: "General" },
        { id: "ch-market-1", name: "market", groupName: "GA Market" },
      ],
    }),
    setBroadcastChannel: vi.fn(),
    provisionMarketChannels: vi.fn(),
  };
}

describe("CommunityAdminCard", () => {
  it("renders nothing when isAdmin is false", () => {
    const mockClient = createMockRpcClient();
    const html = renderToStaticMarkup(
      <CommunityAdminCard isAdmin={false} client={mockClient} />
    );

    expect(html).toBe("");
  });

  it("renders loading state when initialSettings is omitted", () => {
    const mockClient = createMockRpcClient();
    const html = renderToStaticMarkup(
      <CommunityAdminCard isAdmin={true} client={mockClient} />
    );

    expect(html).toContain("Community Market Channel");
    expect(html).toContain("Admin Only");
    expect(html).toContain("Loading channel settings...");
  });

  it("renders configured channel and options when initialSettings is provided", () => {
    const mockClient = createMockRpcClient();
    const settings: AdminSettingsResponse = {
      isAdmin: true,
      broadcastChannelId: "ch-market-1",
      broadcastChannelName: "market",
      textChannels: [
        { id: "ch-gen", name: "general", groupName: "General" },
        { id: "ch-market-1", name: "market", groupName: "GA Market" },
      ],
      channelGroups: [
        { id: "grp-1", name: "General" },
        { id: "grp-2", name: "GA Market" },
      ],
      alertSectionId: "grp-2",
      alertSectionName: "GA Market",
    };

    const html = renderToStaticMarkup(
      <CommunityAdminCard
        isAdmin={true}
        client={mockClient}
        initialSettings={settings}
      />
    );

    expect(html).toContain("Active Broadcast Channel");
    expect(html).toContain("market");
    expect(html).toContain("Deal Alerts Channel Group");
    expect(html).toContain("GA Market");
    expect(html).toContain("#general (General)");
    expect(html).toContain("#market (GA Market)");
    expect(html).toContain("Save Settings");
    expect(html).toContain("Provision Default Channels");
    expect(html).toContain("Broadcast Language");
    expect(html).toContain("English");
    expect(html).toContain("Português (Brasil)");
  });

  it("renders localized broadcast language options when locale is pt-BR", () => {
    const mockClient = createMockRpcClient();
    const settings: AdminSettingsResponse = {
      isAdmin: true,
      broadcastChannelId: "ch-market-1",
      broadcastChannelName: "market",
      broadcastLocale: "pt-BR",
      textChannels: [
        { id: "ch-market-1", name: "market", groupName: "GA Market" },
      ],
    };

    const html = renderToStaticMarkup(
      <CommunityAdminCard
        isAdmin={true}
        client={mockClient}
        initialSettings={settings}
        locale="pt-BR"
      />
    );

    expect(html).toContain("Idioma de Transmissão");
    expect(html).toContain("Inglês");
    expect(html).toContain("Português (Brasil)");
  });

  it("renders unconfigured warning when broadcastChannelId is empty", () => {
    const mockClient = createMockRpcClient();
    const settings: AdminSettingsResponse = {
      isAdmin: true,
      broadcastChannelId: "",
      broadcastChannelName: "",
      textChannels: [{ id: "ch-gen", name: "general", groupName: "General" }],
    };

    const html = renderToStaticMarkup(
      <CommunityAdminCard
        isAdmin={true}
        client={mockClient}
        initialSettings={settings}
      />
    );

    expect(html).toContain(
      "No channel configured — market notifications are paused"
    );
  });

  it("renders empty channels message when no text channels exist", () => {
    const mockClient = createMockRpcClient();
    const settings: AdminSettingsResponse = {
      isAdmin: true,
      broadcastChannelId: "",
      broadcastChannelName: "",
      textChannels: [],
    };

    const html = renderToStaticMarkup(
      <CommunityAdminCard
        isAdmin={true}
        client={mockClient}
        initialSettings={settings}
      />
    );

    expect(html).toContain("No text channels found");
  });

  it("renders success feedback banner", () => {
    const mockClient = createMockRpcClient();
    const settings: AdminSettingsResponse = {
      isAdmin: true,
      broadcastChannelId: "ch-gen",
      broadcastChannelName: "general",
      textChannels: [{ id: "ch-gen", name: "general" }],
    };

    const html = renderToStaticMarkup(
      <CommunityAdminCard
        isAdmin={true}
        client={mockClient}
        initialSettings={settings}
        initialFeedback={{
          type: "success",
          text: "Market broadcast channel set to #general",
        }}
      />
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("Market broadcast channel set to #general");
    expect(html).toContain("bg-emerald-500/10");
  });

  it("renders error feedback banner", () => {
    const mockClient = createMockRpcClient();
    const settings: AdminSettingsResponse = {
      isAdmin: true,
      broadcastChannelId: "",
      broadcastChannelName: "",
      textChannels: [],
    };

    const html = renderToStaticMarkup(
      <CommunityAdminCard
        isAdmin={true}
        client={mockClient}
        initialSettings={settings}
        initialFeedback={{
          type: "error",
          text: "Failed to update broadcast channel",
        }}
      />
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("Failed to update broadcast channel");
    expect(html).toContain("bg-rose-500/10");
  });

  it("supports pt-BR localized text", () => {
    const mockClient = createMockRpcClient();
    const settings: AdminSettingsResponse = {
      isAdmin: true,
      broadcastChannelId: "ch-market-1",
      broadcastChannelName: "market",
      textChannels: [{ id: "ch-market-1", name: "market" }],
    };

    const html = renderToStaticMarkup(
      <CommunityAdminCard
        isAdmin={true}
        client={mockClient}
        locale="pt-BR"
        initialSettings={settings}
      />
    );

    expect(html).toContain("Canal de Mercado da Comunidade");
    expect(html).toContain("Apenas Administradores");
    expect(html).toContain("Canal de Transmissão Ativo");
    expect(html).toContain("Salvar Configurações");
    expect(html).toContain("Provisionar Canais Padrão");
  });

  it("renders inline refresh button in header", () => {
    const mockClient = createMockRpcClient();
    const settings: AdminSettingsResponse = {
      isAdmin: true,
      broadcastChannelId: "ch-market-1",
      broadcastChannelName: "market",
      textChannels: [{ id: "ch-market-1", name: "market" }],
    };

    const html = renderToStaticMarkup(
      <CommunityAdminCard
        isAdmin={true}
        client={mockClient}
        initialSettings={settings}
      />
    );

    expect(html).toContain('aria-label="Refresh"');
  });
});
