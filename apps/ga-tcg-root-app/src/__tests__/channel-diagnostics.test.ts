import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@rootsdk/server-bot", () => ({
  rootServer: { community: {} },
  ErrorCodeType: {},
}));

import {
  describeCommunityChannels,
  describeCommunityContext,
  logCommunityChannels,
  type CommunityDirectory,
} from "../channel-diagnostics";

function fakeDirectory(overrides: Partial<Record<string, unknown>> = {}): CommunityDirectory {
  const directory = {
    communities: {
      get: vi.fn().mockResolvedValue({ communityId: "comm-1", name: "Dev Community" }),
    },
    channelGroups: {
      list: vi.fn().mockResolvedValue([{ id: "grp-1", name: "Text Channels" }]),
    },
    channels: {
      list: vi.fn().mockResolvedValue([
        { id: "chan-1", name: "general", channelType: 1 },
        { id: "chan-2", name: "market", channelType: 1 },
      ]),
    },
    ...overrides,
  };
  // The test double only implements the methods the diagnostics call.
  return directory as unknown as CommunityDirectory;
}

describe("describeCommunityChannels", () => {
  it("lists the community and flags the configured channel", async () => {
    const lines = await describeCommunityChannels(fakeDirectory(), "chan-2");

    expect(lines[0]).toBe('Attached community: "Dev Community" (comm-1)');
    expect(lines).toContain('  Group "Text Channels" (grp-1)');
    expect(lines).toContain("    #general (chan-1) type=1");
    expect(lines).toContain("    #market (chan-2) type=1  <-- ROOT_BOT_MARKET_CHANNEL_ID");
    expect(lines.at(-1)).toBe("Configured channel chan-2 found in this community.");
  });

  it("reports when the configured channel is not in the community", async () => {
    const lines = await describeCommunityChannels(fakeDirectory(), "chan-missing");

    expect(lines.at(-1)).toContain("chan-missing NOT FOUND");
    expect(lines.join("\n")).not.toContain("<--");
  });

  it("lists channels for every group", async () => {
    const directory = fakeDirectory({
      channelGroups: {
        list: vi.fn().mockResolvedValue([
          { id: "grp-1", name: "A" },
          { id: "grp-2", name: "B" },
        ]),
      },
    });

    await describeCommunityChannels(directory, "x");

    expect(directory.channels.list).toHaveBeenCalledWith({ channelGroupId: "grp-1" });
    expect(directory.channels.list).toHaveBeenCalledWith({ channelGroupId: "grp-2" });
  });
});

describe("describeCommunityContext", () => {
  it("reports the attached community, matching COMMUNITY_ID, and the section", async () => {
    const lines = await describeCommunityContext(fakeDirectory(), {
      sectionId: "grp-1",
      envCommunityId: "comm-1",
    });
    const text = lines.join("\n");

    expect(text).toContain('Attached community: "Dev Community" (comm-1)');
    expect(text).toContain("COMMUNITY_ID env: comm-1");
    expect(text).not.toContain("WARNING");
    expect(text).toContain('Deal-alert section: "Text Channels" (grp-1)');
    expect(text).toContain("self-granted via the bot's own app id");
  });

  it("warns on a community mismatch and names a missing section", async () => {
    const lines = await describeCommunityContext(fakeDirectory(), {
      sectionId: "grp-missing",
      envCommunityId: "comm-other",
    });
    const text = lines.join("\n");

    expect(text).toContain("WARNING");
    expect(text).toContain("grp-missing NOT FOUND");
  });

  it("explains when the deal-alert ids are unconfigured", async () => {
    const lines = await describeCommunityContext(fakeDirectory(), {
      envCommunityId: "",
    });
    const text = lines.join("\n");

    expect(text).toContain("COMMUNITY_ID env: (unset)");
    expect(text).toContain("Deal-alert section: not configured");
    expect(text).toContain("self-granted via the bot's own app id");
  });
});

describe("logCommunityChannels", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retries after a failure and then logs the listing", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const get = vi
      .fn()
      .mockRejectedValueOnce(new Error("UNAVAILABLE"))
      .mockResolvedValue({ communityId: "comm-1", name: "Dev Community" });

    await logCommunityChannels("chan-1", 3, 0, fakeDirectory({ communities: { get } }));

    expect(warn).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).toContain("Dev Community");
  });

  it("gives up without throwing after the last attempt", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const get = vi.fn().mockRejectedValue(new Error("down"));

    await expect(
      logCommunityChannels("chan-1", 2, 0, fakeDirectory({ communities: { get } }))
    ).resolves.toBeUndefined();

    expect(get).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledTimes(1);
  });
});
