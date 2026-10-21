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
            get: vitest_1.vi.fn().mockResolvedValue({ communityId: "comm-1", name: "Dev Community" }),
        },
        channelGroups: {
            list: vitest_1.vi.fn().mockResolvedValue([{ id: "grp-1", name: "Text Channels" }]),
        },
        channels: {
            list: vitest_1.vi.fn().mockResolvedValue([
                { id: "chan-1", name: "general", channelType: 1 },
                { id: "chan-2", name: "market", channelType: 1 },
            ]),
        },
        ...overrides,
    };
    // The test double only implements the methods the diagnostics call.
    return directory;
}
(0, vitest_1.describe)("describeCommunityChannels", () => {
    (0, vitest_1.it)("lists the community and flags the configured channel", async () => {
        const lines = await (0, channel_diagnostics_1.describeCommunityChannels)(fakeDirectory(), "chan-2");
        (0, vitest_1.expect)(lines[0]).toBe('Attached community: "Dev Community" (comm-1)');
        (0, vitest_1.expect)(lines).toContain('  Group "Text Channels" (grp-1)');
        (0, vitest_1.expect)(lines).toContain("    #general (chan-1) type=1");
        (0, vitest_1.expect)(lines).toContain("    #market (chan-2) type=1  <-- ROOT_BOT_MARKET_CHANNEL_ID");
        (0, vitest_1.expect)(lines.at(-1)).toBe("Configured channel chan-2 found in this community.");
    });
    (0, vitest_1.it)("reports when the configured channel is not in the community", async () => {
        const lines = await (0, channel_diagnostics_1.describeCommunityChannels)(fakeDirectory(), "chan-missing");
        (0, vitest_1.expect)(lines.at(-1)).toContain("chan-missing NOT FOUND");
        (0, vitest_1.expect)(lines.join("\n")).not.toContain("<--");
    });
    (0, vitest_1.it)("lists channels for every group", async () => {
        const directory = fakeDirectory({
            channelGroups: {
                list: vitest_1.vi.fn().mockResolvedValue([
                    { id: "grp-1", name: "A" },
                    { id: "grp-2", name: "B" },
                ]),
            },
        });
        await (0, channel_diagnostics_1.describeCommunityChannels)(directory, "x");
        (0, vitest_1.expect)(directory.channels.list).toHaveBeenCalledWith({ channelGroupId: "grp-1" });
        (0, vitest_1.expect)(directory.channels.list).toHaveBeenCalledWith({ channelGroupId: "grp-2" });
    });
});
(0, vitest_1.describe)("logCommunityChannels", () => {
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.it)("retries after a failure and then logs the listing", async () => {
        const log = vitest_1.vi.spyOn(console, "log").mockImplementation(() => { });
        const warn = vitest_1.vi.spyOn(console, "warn").mockImplementation(() => { });
        const get = vitest_1.vi
            .fn()
            .mockRejectedValueOnce(new Error("UNAVAILABLE"))
            .mockResolvedValue({ communityId: "comm-1", name: "Dev Community" });
        await (0, channel_diagnostics_1.logCommunityChannels)("chan-1", 3, 0, fakeDirectory({ communities: { get } }));
        (0, vitest_1.expect)(warn).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(log).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(String(log.mock.calls[0][0])).toContain("Dev Community");
    });
    (0, vitest_1.it)("gives up without throwing after the last attempt", async () => {
        vitest_1.vi.spyOn(console, "warn").mockImplementation(() => { });
        const error = vitest_1.vi.spyOn(console, "error").mockImplementation(() => { });
        const get = vitest_1.vi.fn().mockRejectedValue(new Error("down"));
        await (0, vitest_1.expect)((0, channel_diagnostics_1.logCommunityChannels)("chan-1", 2, 0, fakeDirectory({ communities: { get } }))).resolves.toBeUndefined();
        (0, vitest_1.expect)(get).toHaveBeenCalledTimes(2);
        (0, vitest_1.expect)(error).toHaveBeenCalledTimes(1);
    });
});
