import { describe, expect, it, vi } from "vitest";
import { provisionCommunityChannels } from "../setup-provisioning";
import { type RootCommunityConfig } from "../community-config";
import { ChannelType } from "@rootsdk/server-bot";

function createMockConfig(initial: {
  sectionId?: string;
  broadcastId?: string;
  assistantId?: string;
} = {}): RootCommunityConfig {
  let sectionId = initial.sectionId;
  let broadcastId = initial.broadcastId;
  let assistantId = initial.assistantId;

  return {
    getAlertSectionId: vi.fn().mockImplementation(async () => sectionId),
    setAlertSectionId: vi.fn().mockImplementation(async (id: string) => {
      sectionId = id;
    }),
    getBroadcastChannelId: vi.fn().mockImplementation(async () => broadcastId),
    setBroadcastChannelId: vi.fn().mockImplementation(async (id: string) => {
      broadcastId = id;
    }),
    getAssistantChannelId: vi.fn().mockImplementation(async () => assistantId),
    setAssistantChannelId: vi.fn().mockImplementation(async (id: string) => {
      assistantId = id;
    }),
  };
}

describe("provisionCommunityChannels", () => {
  it("provisions group, #market, and #assistant channels from scratch", async () => {
    const config = createMockConfig();
    const mockRootServer = {
      appId: "app-test-id",
      community: {
        channelGroups: {
          create: vi.fn().mockResolvedValue({ id: "group-100" }),
        },
        channels: {
          create: vi
            .fn()
            .mockResolvedValueOnce({ id: "market-chan-200" })
            .mockResolvedValueOnce({ id: "assistant-chan-300" }),
        },
      },
    };

    const res = await provisionCommunityChannels({
      rootServer: mockRootServer as any,
      config,
    });

    expect(res.marketChannel).toBe("market");
    expect(res.assistantChannel).toBe("assistant");

    expect(mockRootServer.community.channelGroups.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "GA Market" })
    );

    expect(mockRootServer.community.channels.create).toHaveBeenCalledWith(
      expect.objectContaining({
        channelGroupId: "group-100",
        name: "market",
        channelType: ChannelType.Text,
      })
    );

    expect(mockRootServer.community.channels.create).toHaveBeenCalledWith(
      expect.objectContaining({
        channelGroupId: "group-100",
        name: "assistant",
        channelType: ChannelType.App,
      })
    );

    expect(config.setAlertSectionId).toHaveBeenCalledWith("group-100");
    expect(config.setBroadcastChannelId).toHaveBeenCalledWith("market-chan-200");
    expect(config.setAssistantChannelId).toHaveBeenCalledWith("assistant-chan-300");
  });

  it("is idempotent: preserves existing channels without duplicate creation", async () => {
    const config = createMockConfig({
      sectionId: "existing-group",
      broadcastId: "existing-market",
      assistantId: "existing-assistant",
    });
    const mockRootServer = {
      appId: "app-test-id",
      community: {
        channelGroups: {
          create: vi.fn(),
        },
        channels: {
          create: vi.fn(),
        },
      },
    };

    const res = await provisionCommunityChannels({
      rootServer: mockRootServer as any,
      config,
    });

    expect(res.marketChannel).toBe("market");
    expect(res.assistantChannel).toBe("assistant");
    expect(mockRootServer.community.channelGroups.create).not.toHaveBeenCalled();
    expect(mockRootServer.community.channels.create).not.toHaveBeenCalled();
  });

  it("provisions only missing assistant channel when group and market exist", async () => {
    const config = createMockConfig({
      sectionId: "existing-group",
      broadcastId: "existing-market",
      assistantId: undefined,
    });
    const mockRootServer = {
      appId: "app-test-id",
      community: {
        channelGroups: {
          create: vi.fn(),
        },
        channels: {
          create: vi.fn().mockResolvedValue({ id: "new-assistant" }),
        },
      },
    };

    const res = await provisionCommunityChannels({
      rootServer: mockRootServer as any,
      config,
    });

    expect(res.marketChannel).toBe("market");
    expect(res.assistantChannel).toBe("assistant");
    expect(mockRootServer.community.channelGroups.create).not.toHaveBeenCalled();
    expect(mockRootServer.community.channels.create).toHaveBeenCalledTimes(1);
    expect(mockRootServer.community.channels.create).toHaveBeenCalledWith(
      expect.objectContaining({
        channelGroupId: "existing-group",
        name: "assistant",
        channelType: ChannelType.App,
      })
    );
    expect(config.setAssistantChannelId).toHaveBeenCalledWith("new-assistant");
  });
});
