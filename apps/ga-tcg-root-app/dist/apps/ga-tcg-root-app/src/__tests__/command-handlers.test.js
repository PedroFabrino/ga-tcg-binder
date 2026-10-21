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
});
