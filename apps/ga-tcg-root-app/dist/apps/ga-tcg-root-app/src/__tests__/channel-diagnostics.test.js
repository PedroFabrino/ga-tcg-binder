"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
vitest_1.vi.mock("@rootsdk/server-bot", () => ({
    rootServer: { community: {} },
    ErrorCodeType: {},
}));
const channel_diagnostics_1 = require("../channel-diagnostics");
function fakeDirectory(overrides = {}) {
    const directory = {
        communities: {
            get: vitest_1.vi.fn().mockResolvedValue({
                communityId: "comm-1",
                name: "Dev Community",
            }),
        },
        channelGroups: {
            list: vitest_1.vi.fn().mockResolvedValue([{ id: "grp-1", name: "Text Channels" }]),
        },
        ...overrides,
    };
    return directory;
}
(0, vitest_1.describe)("describeCommunityContext", () => {
    (0, vitest_1.it)("reports the attached community, matching COMMUNITY_ID, and the configured channels", async () => {
        const lines = await (0, channel_diagnostics_1.describeCommunityContext)(fakeDirectory(), {
            sectionId: "grp-1",
            broadcastChannelId: "chan-2",
            envCommunityId: "comm-1",
        });
        const text = lines.join("\n");
        (0, vitest_1.expect)(text).toContain('Attached community: "Dev Community" (comm-1)');
        (0, vitest_1.expect)(text).toContain("COMMUNITY_ID env: comm-1");
        (0, vitest_1.expect)(text).not.toContain("WARNING");
        (0, vitest_1.expect)(text).toContain('Deal-alert section: "Text Channels" (grp-1)');
        (0, vitest_1.expect)(text).toContain("Market broadcast channel: chan-2");
        (0, vitest_1.expect)(text).toContain("self-granted via the bot's own app id");
    });
    (0, vitest_1.it)("warns on a community mismatch and names a missing section", async () => {
        const lines = await (0, channel_diagnostics_1.describeCommunityContext)(fakeDirectory(), {
            sectionId: "grp-missing",
            envCommunityId: "comm-other",
        });
        const text = lines.join("\n");
        (0, vitest_1.expect)(text).toContain("WARNING");
        (0, vitest_1.expect)(text).toContain("grp-missing NOT FOUND");
    });
    (0, vitest_1.it)("explains when nothing is configured yet", async () => {
        const lines = await (0, channel_diagnostics_1.describeCommunityContext)(fakeDirectory(), {
            envCommunityId: "",
        });
        const text = lines.join("\n");
        (0, vitest_1.expect)(text).toContain("COMMUNITY_ID env: (unset)");
        (0, vitest_1.expect)(text).toContain("Deal-alert section: not configured");
        (0, vitest_1.expect)(text).toContain("Market broadcast channel: not configured");
        (0, vitest_1.expect)(text).toContain("self-granted via the bot's own app id");
    });
});
