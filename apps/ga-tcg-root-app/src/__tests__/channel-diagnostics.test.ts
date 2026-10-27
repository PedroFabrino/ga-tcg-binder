import { describe, expect, it, vi } from "vitest";

vi.mock("@rootsdk/server-app", () => ({
  rootServer: { community: {} },
  ErrorCodeType: {},
}));

import {
  describeCommunityContext,
  type CommunityDirectory,
} from "../channel-diagnostics";

function fakeDirectory(
  overrides: Partial<Record<string, unknown>> = {}
): CommunityDirectory {
  const directory = {
    communities: {
      get: vi.fn().mockResolvedValue({
        communityId: "comm-1",
        name: "Dev Community",
      }),
    },
    channelGroups: {
      list: vi.fn().mockResolvedValue([{ id: "grp-1", name: "Text Channels" }]),
    },
    ...overrides,
  };
  return directory as unknown as CommunityDirectory;
}

describe("describeCommunityContext", () => {
  it("reports the attached community, matching COMMUNITY_ID, and the configured channels", async () => {
    const lines = await describeCommunityContext(fakeDirectory(), {
      sectionId: "grp-1",
      broadcastChannelId: "chan-2",
      envCommunityId: "comm-1",
    });
    const text = lines.join("\n");

    expect(text).toContain('Attached community: "Dev Community" (comm-1)');
    expect(text).toContain("COMMUNITY_ID env: comm-1");
    expect(text).not.toContain("WARNING");
    expect(text).toContain('Deal-alert section: "Text Channels" (grp-1)');
    expect(text).toContain("Market broadcast channel: chan-2");
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

  it("explains when nothing is configured yet", async () => {
    const lines = await describeCommunityContext(fakeDirectory(), {
      envCommunityId: "",
    });
    const text = lines.join("\n");

    expect(text).toContain("COMMUNITY_ID env: (unset)");
    expect(text).toContain(
      "Deal-alert section: not configured (provision market channels in the Assistant App GUI)."
    );
    expect(text).toContain("Market broadcast channel: not configured");
    expect(text).toContain("self-granted via the bot's own app id");
  });
});
