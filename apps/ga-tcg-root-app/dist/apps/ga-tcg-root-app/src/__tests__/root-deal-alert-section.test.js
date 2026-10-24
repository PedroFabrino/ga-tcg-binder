"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const root_deal_alert_section_1 = require("../root-deal-alert-section");
function fakeApi() {
    return { createChannelGroup: vitest_1.vi.fn().mockResolvedValue({ id: "grp-new" }) };
}
function fakeConfig(existing) {
    let value = existing;
    return {
        getAlertSectionId: vitest_1.vi.fn(async () => value),
        setAlertSectionId: vitest_1.vi.fn(async (id) => {
            value = id;
        }),
    };
}
(0, vitest_1.describe)("ensureAlertSection", () => {
    (0, vitest_1.it)("creates and stores the section when missing", async () => {
        const api = fakeApi();
        const config = fakeConfig();
        await (0, vitest_1.expect)((0, root_deal_alert_section_1.ensureAlertSection)(api, config)).resolves.toBe("grp-new");
        (0, vitest_1.expect)(api.createChannelGroup).toHaveBeenCalledWith("GA Alerts");
        (0, vitest_1.expect)(config.setAlertSectionId).toHaveBeenCalledWith("grp-new");
    });
    (0, vitest_1.it)("reuses the stored section without creating a duplicate", async () => {
        const api = fakeApi();
        const config = fakeConfig("grp-existing");
        await (0, vitest_1.expect)((0, root_deal_alert_section_1.ensureAlertSection)(api, config)).resolves.toBe("grp-existing");
        (0, vitest_1.expect)(api.createChannelGroup).not.toHaveBeenCalled();
    });
});
