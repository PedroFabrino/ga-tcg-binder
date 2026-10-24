"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const command_handlers_1 = require("../command-handlers");
const contracts_1 = require("@ga/contracts");
(0, vitest_1.describe)("Root Command Handlers (processRootCommand)", () => {
    const mockUserId = "root-user-123";
    (0, vitest_1.it)("ignores non-command messages", async () => {
        const mockClient = {};
        const res = await (0, command_handlers_1.processRootCommand)(mockUserId, "Hello everyone!", mockClient);
        (0, vitest_1.expect)(res).toBeNull();
    });
    (0, vitest_1.it)("handles /link <code> command successfully", async () => {
        const mockClient = {
            link: vitest_1.vi.fn().mockResolvedValue({
                success: true,
                collectorId: "user-1",
                collectorName: "Arthur",
                message: "Linked",
            }),
        };
        const res = await (0, command_handlers_1.processRootCommand)(mockUserId, "/link ABC123", mockClient);
        (0, vitest_1.expect)(mockClient.link).toHaveBeenCalledWith({
            token: "ABC123",
            provider: "root",
            providerUserId: mockUserId,
        });
        (0, vitest_1.expect)(res).toContain("Account Linked Successfully!");
        (0, vitest_1.expect)(res).toContain("Arthur");
    });
    (0, vitest_1.it)("handles /decks command formatting markdown with badges", async () => {
        const mockClient = {
            getDecks: vitest_1.vi.fn().mockResolvedValue({
                collectorId: "user-1",
                collectorName: "Arthur",
                decks: [
                    {
                        id: "deck-1",
                        name: "Fire Aggro",
                        format: "standard",
                        champion: "Rai",
                        totalCards: 60,
                        uniqueCards: 20,
                        completionPercentage: 100,
                        hardShortageCount: 0,
                        sharedShortageCount: 0,
                    },
                    {
                        id: "deck-2",
                        name: "Control",
                        format: "standard",
                        champion: "Merlin",
                        totalCards: 60,
                        uniqueCards: 22,
                        completionPercentage: 75,
                        hardShortageCount: 3,
                        sharedShortageCount: 1,
                    },
                ],
            }),
        };
        const res = await (0, command_handlers_1.processRootCommand)(mockUserId, "/decks", mockClient);
        (0, vitest_1.expect)(res).toContain("Arthur's Decks (2)");
        (0, vitest_1.expect)(res).toContain("Fire Aggro");
        (0, vitest_1.expect)(res).toContain("**100%** ✅");
        (0, vitest_1.expect)(res).toContain("Control");
        (0, vitest_1.expect)(res).toContain("**75%** ⚠️");
        (0, vitest_1.expect)(res).toContain("🔴 Hard Shortages: **3**");
    });
    (0, vitest_1.it)("handles /shortages <deck> splitting Hard vs Shared shortages", async () => {
        const mockClient = {
            getShortages: vitest_1.vi.fn().mockResolvedValue({
                collectorId: "user-1",
                deckId: "deck-1",
                deckName: "Control",
                format: "standard",
                completionPercentage: 50,
                hardShortages: [
                    {
                        cardSlug: "fracturize",
                        cardName: "Fracturize",
                        element: "NORM",
                        rarity: 3,
                        requiredQuantity: 4,
                        missingQuantity: 3,
                        sharedQuantity: 0,
                        competingDecks: [],
                        type: "hard",
                    },
                ],
                sharedShortages: [
                    {
                        cardSlug: "dispel",
                        cardName: "Dispel",
                        element: "NORM",
                        rarity: 1,
                        requiredQuantity: 2,
                        missingQuantity: 0,
                        sharedQuantity: 2,
                        competingDecks: ["Fire Aggro"],
                        type: "shared",
                    },
                ],
                totalHardShortages: 1,
                totalSharedShortages: 1,
            }),
        };
        const res = await (0, command_handlers_1.processRootCommand)(mockUserId, "/shortages Control", mockClient);
        (0, vitest_1.expect)(res).toContain("**Shortages for Control** (50%)");
        (0, vitest_1.expect)(res).toContain("🔴 Hard Shortages (Compra Necessária — 1)");
        (0, vitest_1.expect)(res).toContain("Fracturize** x3 missing");
        (0, vitest_1.expect)(res).toContain("🟡 Shared Shortages (Revezamento entre Decks — 1)");
        (0, vitest_1.expect)(res).toContain("Dispel** x2 shared *(used in Fire Aggro)*");
    });
    (0, vitest_1.it)("handles IDENTITY_NOT_LINKED error gracefully", async () => {
        const mockClient = {
            getDecks: vitest_1.vi.fn().mockRejectedValue(new contracts_1.AssistantApiError(404, "IDENTITY_NOT_LINKED", "No linked account")),
        };
        const res = await (0, command_handlers_1.processRootCommand)(mockUserId, "/decks", mockClient);
        (0, vitest_1.expect)(res).toContain("Grand Archive Binder Account Not Linked");
        (0, vitest_1.expect)(res).toContain("/link <code>");
    });
    (0, vitest_1.describe)("/notify", () => {
        function createDeps(collectorId = "collector-1") {
            return {
                findCollectorId: vitest_1.vi.fn().mockResolvedValue(collectorId),
                setNotificationPreference: vitest_1.vi.fn().mockResolvedValue(undefined),
                provisionDealAlerts: vitest_1.vi.fn().mockResolvedValue(undefined),
                removeDealAlertChannel: vitest_1.vi.fn().mockResolvedValue(undefined),
                ensureRecipientChannel: vitest_1.vi.fn().mockResolvedValue("chan-private"),
                configureFromChannel: vitest_1.vi.fn().mockResolvedValue(undefined),
                isCommunityAdmin: vitest_1.vi.fn().mockResolvedValue(true),
            };
        }
        (0, vitest_1.it)("enables deal alerts and provisions the private channel", async () => {
            const deps = createDeps();
            const res = await (0, command_handlers_1.processRootCommand)(mockUserId, "/notify on", {}, deps);
            (0, vitest_1.expect)(res).toContain("Deal alerts enabled");
            (0, vitest_1.expect)(res).toContain("root://channel/chan-private");
            (0, vitest_1.expect)(deps.ensureRecipientChannel).toHaveBeenCalledWith(mockUserId);
            (0, vitest_1.expect)(deps.setNotificationPreference).toHaveBeenCalledWith(mockUserId, true);
            (0, vitest_1.expect)(deps.provisionDealAlerts).toHaveBeenCalledTimes(1);
        });
        (0, vitest_1.it)("uses the injected API client for the preference by default", async () => {
            const fakeApi = {
                getCollector: vitest_1.vi
                    .fn()
                    .mockResolvedValue({ collectorId: "collector-1", collectorName: "Ash" }),
                setNotifyPreference: vitest_1.vi.fn().mockResolvedValue(undefined),
            };
            const deps = {
                ensureRecipientChannel: vitest_1.vi.fn().mockResolvedValue("chan-private"),
                provisionDealAlerts: vitest_1.vi.fn().mockResolvedValue(undefined),
            };
            const res = await (0, command_handlers_1.processRootCommand)(mockUserId, "/notify on", fakeApi, deps);
            (0, vitest_1.expect)(res).toContain("Deal alerts enabled");
            (0, vitest_1.expect)(fakeApi.getCollector).toHaveBeenCalledWith(mockUserId);
            (0, vitest_1.expect)(fakeApi.setNotifyPreference).toHaveBeenCalledWith({
                providerUserId: mockUserId,
                enabled: true,
            });
        });
        (0, vitest_1.it)("falls back to a deferred-channel message when creation fails", async () => {
            const deps = createDeps();
            deps.ensureRecipientChannel.mockResolvedValue(null);
            const res = await (0, command_handlers_1.processRootCommand)(mockUserId, "/notify on", {}, deps);
            (0, vitest_1.expect)(res).toContain("next marketplace sync");
        });
        (0, vitest_1.it)("disables deal alerts and removes the private channel", async () => {
            const deps = createDeps();
            const res = await (0, command_handlers_1.processRootCommand)(mockUserId, "/notify off", {}, deps);
            (0, vitest_1.expect)(res).toContain("Deal alerts disabled");
            (0, vitest_1.expect)(deps.setNotificationPreference).toHaveBeenCalledWith(mockUserId, false);
            (0, vitest_1.expect)(deps.removeDealAlertChannel).toHaveBeenCalledWith(mockUserId);
        });
        (0, vitest_1.it)("returns usage when no action is given", async () => {
            const deps = createDeps();
            const res = await (0, command_handlers_1.processRootCommand)(mockUserId, "/notify", {}, deps);
            (0, vitest_1.expect)(res).toContain("Usage:");
            (0, vitest_1.expect)(deps.setNotificationPreference).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("prompts to link when the identity is not linked", async () => {
            const deps = createDeps(null);
            const res = await (0, command_handlers_1.processRootCommand)(mockUserId, "/notify on", {}, deps);
            (0, vitest_1.expect)(res).toContain("Account Not Linked");
            (0, vitest_1.expect)(deps.setNotificationPreference).not.toHaveBeenCalled();
        });
    });
    (0, vitest_1.describe)("/setup", () => {
        function createDeps(admin = true) {
            return {
                configureFromChannel: vitest_1.vi.fn().mockResolvedValue(undefined),
                isCommunityAdmin: vitest_1.vi.fn().mockResolvedValue(admin),
            };
        }
        (0, vitest_1.it)("warns before changing the dump channel", async () => {
            const deps = createDeps(true);
            const res = await (0, command_handlers_1.processRootCommand)(mockUserId, "/setup", {}, deps, "chan-market");
            (0, vitest_1.expect)(res).toContain("become the market dump");
            (0, vitest_1.expect)(res).toContain("/setup confirm");
            (0, vitest_1.expect)(deps.configureFromChannel).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("records the channel when an admin confirms", async () => {
            const deps = createDeps(true);
            const res = await (0, command_handlers_1.processRootCommand)(mockUserId, "/setup confirm", {}, deps, "chan-market");
            (0, vitest_1.expect)(res).toContain("Setup complete");
            (0, vitest_1.expect)(deps.configureFromChannel).toHaveBeenCalledWith("chan-market");
        });
        (0, vitest_1.it)("refuses when the caller is not an admin", async () => {
            const deps = createDeps(false);
            const res = await (0, command_handlers_1.processRootCommand)(mockUserId, "/setup confirm", {}, deps, "chan-market");
            (0, vitest_1.expect)(res).toContain("Only community admins");
            (0, vitest_1.expect)(deps.configureFromChannel).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("asks to run it inside a channel", async () => {
            const deps = createDeps(true);
            const res = await (0, command_handlers_1.processRootCommand)(mockUserId, "/setup confirm", {}, deps);
            (0, vitest_1.expect)(res).toContain("inside the channel");
            (0, vitest_1.expect)(deps.configureFromChannel).not.toHaveBeenCalled();
        });
    });
});
