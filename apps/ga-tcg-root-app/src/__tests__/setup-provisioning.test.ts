import { describe, expect, it, vi } from "vitest";
import { provisionCommunityChannels } from "../setup-provisioning";
import { type RootCommunityConfig } from "../community-config";
import { ChannelType } from "@rootsdk/server-app";

function createMockConfig(initial: {
  sectionId?: string;
  broadcastId?: string;
} = {}): RootCommunityConfig {
  let sectionId = initial.sectionId;
  let broadcastId = initial.broadcastId;

  return {
    getAlertSectionId: vi.fn().mockImplementation(async () => sectionId),
    setAlertSectionId: vi.fn().mockImplementation(async (id: string) => {
      sectionId = id;
    }),
    getBroadcastChannelId: vi.fn().mockImplementation(async () => broadcastId),
    setBroadcastChannelId: vi.fn().mockImplementation(async (id: string) => {
      broadcastId = id;
    }),
    getAssistantChannelId: vi.fn().mockResolvedValue(undefined),
    setAssistantChannelId: vi.fn().mockResolvedValue(undefined),
    getBroadcastLocale: vi.fn().mockResolvedValue("en"),
    getConfiguredBroadcastLocale: vi.fn().mockResolvedValue(undefined),
    setBroadcastLocale: vi.fn().mockResolvedValue(undefined),
  };
}

describe("provisionCommunityChannels", () => {
  it("provisions group and #market channel from scratch without creating dead app channel", async () => {
    const config = createMockConfig();
    const mockRootServer = {
      appId: "app-test-id",
      community: {
        channelGroups: {
          list: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockResolvedValue({ id: "group-100" }),
        },
        channels: {
          list: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockResolvedValue({ id: "market-chan-200" }),
        },
      },
    };

    const res = await provisionCommunityChannels({
      rootServer: mockRootServer as any,
      config,
    });

    expect(res.marketChannel).toBe("market");

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

    // Verify dead ChannelType.App assistant channel is NOT created
    expect(mockRootServer.community.channels.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        name: "assistant",
        channelType: ChannelType.App,
      })
    );

    expect(config.setAlertSectionId).toHaveBeenCalledWith("group-100");
    expect(config.setBroadcastChannelId).toHaveBeenCalledWith("market-chan-200");
  });

  it("reuses existing GA Market group from channelGroups.list instead of creating a duplicate", async () => {
    const config = createMockConfig();
    const mockRootServer = {
      appId: "app-test-id",
      community: {
        channelGroups: {
          list: vi.fn().mockResolvedValue([
            { id: "existing-g1", name: "General" },
            { id: "existing-g2", name: "GA Market" },
          ]),
          create: vi.fn(),
        },
        channels: {
          list: vi.fn().mockResolvedValue([
            { id: "existing-m1", name: "market", channelType: ChannelType.Text },
          ]),
          create: vi.fn(),
        },
      },
    };

    const res = await provisionCommunityChannels({
      rootServer: mockRootServer as any,
      config,
    });

    expect(res.marketChannel).toBe("market");
    expect(mockRootServer.community.channelGroups.create).not.toHaveBeenCalled();
    expect(mockRootServer.community.channels.create).not.toHaveBeenCalled();
    expect(config.setAlertSectionId).toHaveBeenCalledWith("existing-g2");
    expect(config.setBroadcastChannelId).toHaveBeenCalledWith("existing-m1");
  });

  it("respects targetGroupId when specified", async () => {
    const config = createMockConfig();
    const mockRootServer = {
      appId: "app-test-id",
      community: {
        channelGroups: {
          list: vi.fn(),
          create: vi.fn(),
        },
        channels: {
          list: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockResolvedValue({ id: "custom-market-id" }),
        },
      },
    };

    const res = await provisionCommunityChannels({
      rootServer: mockRootServer as any,
      config,
      targetGroupId: "custom-target-group",
    });

    expect(res.marketChannel).toBe("market");
    expect(mockRootServer.community.channelGroups.create).not.toHaveBeenCalled();
    expect(config.setAlertSectionId).toHaveBeenCalledWith("custom-target-group");
    expect(mockRootServer.community.channels.create).toHaveBeenCalledWith(
      expect.objectContaining({
        channelGroupId: "custom-target-group",
        name: "market",
      })
    );
  });

  it("is idempotent: preserves existing channels without duplicate creation", async () => {
    const config = createMockConfig({
      sectionId: "existing-group",
      broadcastId: "existing-market",
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
    expect(mockRootServer.community.channelGroups.create).not.toHaveBeenCalled();
    expect(mockRootServer.community.channels.create).not.toHaveBeenCalled();
  });

  it("discards stale inaccessible alertSectionId and provisions a fresh GA Market group", async () => {
    const config = createMockConfig({
      sectionId: "ghost-deleted-group",
    });
    const mockRootServer = {
      appId: "app-test-id",
      community: {
        channelGroups: {
          get: vi.fn().mockRejectedValue(new Error("GROUP_NOT_FOUND")),
          list: vi.fn().mockResolvedValue([{ id: "grp-gen", name: "General" }]),
          create: vi.fn().mockResolvedValue({ id: "fresh-ga-market" }),
        },
        channels: {
          list: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockResolvedValue({ id: "fresh-market-chan" }),
        },
      },
    };

    const res = await provisionCommunityChannels({
      rootServer: mockRootServer as any,
      config,
    });

    expect(res.marketChannel).toBe("market");
    expect(config.setAlertSectionId).toHaveBeenCalledWith("");
    expect(mockRootServer.community.channelGroups.create).toHaveBeenCalledWith({
      name: "GA Market",
    });
    expect(config.setAlertSectionId).toHaveBeenCalledWith("fresh-ga-market");
  });

  it("discards stale broadcastChannelId and provisions a fresh market channel", async () => {
    const config = createMockConfig({
      sectionId: "valid-group",
      broadcastId: "dead-broadcast-chan",
    });
    const mockRootServer = {
      appId: "app-test-id",
      community: {
        channelGroups: {
          get: vi.fn().mockResolvedValue({ id: "valid-group", name: "GA Market" }),
        },
        channels: {
          get: vi.fn().mockRejectedValue(new Error("CHANNEL_NOT_FOUND")),
          list: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockResolvedValue({ id: "brand-new-market" }),
        },
      },
    };

    const res = await provisionCommunityChannels({
      rootServer: mockRootServer as any,
      config,
    });

    expect(res.marketChannel).toBe("market");
    expect(config.setBroadcastChannelId).toHaveBeenCalledWith("");
    expect(mockRootServer.community.channels.create).toHaveBeenCalledWith(
      expect.objectContaining({
        channelGroupId: "valid-group",
        name: "market",
      })
    );
    expect(config.setBroadcastChannelId).toHaveBeenCalledWith("brand-new-market");
  });
});
