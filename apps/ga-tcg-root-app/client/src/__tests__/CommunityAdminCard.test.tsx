import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CommunityAdminCard } from "../components/CommunityAdminCard";
import type { IAssistantRpcClient } from "../types";

function createMockRpcClient(overrides: Partial<IAssistantRpcClient> = {}): IAssistantRpcClient {
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
    setBroadcastChannel: vi.fn().mockResolvedValue({
      success: true,
      broadcastChannelId: "ch-gen",
      broadcastChannelName: "general",
      error: "",
    }),
    provisionMarketChannels: vi.fn().mockResolvedValue({
      success: true,
      broadcastChannelId: "ch-new-market",
      broadcastChannelName: "market",
      assistantChannelId: "ch-new-assistant",
      error: "",
    }),
    ...overrides,
  };
}

describe("CommunityAdminCard", () => {
  it("renders nothing when isAdmin is false", () => {
    const mockClient = createMockRpcClient();
    const html = renderToStaticMarkup(
      <CommunityAdminCard isAdmin={false} client={mockClient} />
    );

    expect(html).toBe("");
    expect(mockClient.getAdminSettings).not.toHaveBeenCalled();
  });

  it("renders admin card structure when isAdmin is true", () => {
    const mockClient = createMockRpcClient();
    const html = renderToStaticMarkup(
      <CommunityAdminCard isAdmin={true} client={mockClient} />
    );

    expect(html).toContain("Community Market Channel");
    expect(html).toContain("Admin Only");
    expect(html).toContain("Configure where automated market updates and store deal dumps are broadcast in this community");
    expect(html).toContain("Loading channel settings...");
  });

  it("calls setBroadcastChannel when saving selected channel", async () => {
    const mockClient = createMockRpcClient();
    const res = await mockClient.setBroadcastChannel({ channelId: "ch-gen" });

    expect(res.success).toBe(true);
    expect(res.broadcastChannelName).toBe("general");
    expect(mockClient.setBroadcastChannel).toHaveBeenCalledWith({ channelId: "ch-gen" });
  });

  it("calls provisionMarketChannels when provision action is invoked", async () => {
    const mockClient = createMockRpcClient();
    const res = await mockClient.provisionMarketChannels();

    expect(res.success).toBe(true);
    expect(res.broadcastChannelId).toBe("ch-new-market");
    expect(res.assistantChannelId).toBe("ch-new-assistant");
    expect(mockClient.provisionMarketChannels).toHaveBeenCalled();
  });
});
