import { describe, it, expect, vi } from "vitest";
import {
  processRootCommand,
  type RootCommandDeps,
} from "../command-handlers";
import { AssistantApiError } from "@ga/contracts";
import type { RootBotApi } from "../root-bot-api";

describe("Root Command Handlers (processRootCommand)", () => {
  const mockUserId = "root-user-123";

  it("ignores non-command messages", async () => {
    const mockClient = {} as RootBotApi;
    const res = await processRootCommand(mockUserId, "Hello everyone!", mockClient);
    expect(res).toBeNull();
  });

  it("handles /link <code> command successfully", async () => {
    const mockClient = {
      link: vi.fn().mockResolvedValue({
        success: true,
        collectorId: "user-1",
        collectorName: "Arthur",
        message: "Linked",
      }),
    } as unknown as RootBotApi;

    const res = await processRootCommand(mockUserId, "/link ABC123", mockClient);
    expect(mockClient.link).toHaveBeenCalledWith({
      token: "ABC123",
      provider: "root",
      providerUserId: mockUserId,
    });
    expect(res).toContain("Account Linked Successfully!");
    expect(res).toContain("Arthur");
  });

  it("handles /decks command formatting markdown with badges", async () => {
    const mockClient = {
      getDecks: vi.fn().mockResolvedValue({
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
    } as unknown as RootBotApi;

    const res = await processRootCommand(mockUserId, "/decks", mockClient);
    expect(res).toContain("Arthur's Decks (2)");
    expect(res).toContain("Fire Aggro");
    expect(res).toContain("**100%** ✅");
    expect(res).toContain("Control");
    expect(res).toContain("**75%** ⚠️");
    expect(res).toContain("🔴 Hard Shortages: **3**");
  });

  it("handles /shortages <deck> splitting Hard vs Shared shortages", async () => {
    const mockClient = {
      getShortages: vi.fn().mockResolvedValue({
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
    } as unknown as RootBotApi;

    const res = await processRootCommand(mockUserId, "/shortages Control", mockClient);
    expect(res).toContain("**Shortages for Control** (50%)");
    expect(res).toContain("🔴 Hard Shortages (Compra Necessária — 1)");
    expect(res).toContain("Fracturize** x3 missing");
    expect(res).toContain("🟡 Shared Shortages (Revezamento entre Decks — 1)");
    expect(res).toContain("Dispel** x2 shared *(used in Fire Aggro)*");
  });

  it("handles IDENTITY_NOT_LINKED error gracefully", async () => {
    const mockClient = {
      getDecks: vi.fn().mockRejectedValue(
        new AssistantApiError(404, "IDENTITY_NOT_LINKED", "No linked account")
      ),
    } as unknown as RootBotApi;

    const res = await processRootCommand(mockUserId, "/decks", mockClient);
    expect(res).toContain("Grand Archive Binder Account Not Linked");
    expect(res).toContain("/link <code>");
  });

  describe("/notify", () => {
    function createDeps(collectorId: string | null = "collector-1"): RootCommandDeps {
      return {
        findCollectorId: vi.fn().mockResolvedValue(collectorId),
        setNotificationPreference: vi.fn().mockResolvedValue(undefined),
        provisionDealAlerts: vi.fn().mockResolvedValue(undefined),
        removeDealAlertChannel: vi.fn().mockResolvedValue(undefined),
        ensureRecipientChannel: vi.fn().mockResolvedValue("chan-private"),
        configureFromChannel: vi.fn().mockResolvedValue("market"),
        isCommunityAdmin: vi.fn().mockResolvedValue(true),
      } as RootCommandDeps;
    }

    it("enables deal alerts and provisions the private channel", async () => {
      const deps = createDeps();

      const res = await processRootCommand(
        mockUserId,
        "/notify on",
        {} as RootBotApi,
        deps
      );

      expect(res).toContain("Deal alerts enabled");
      expect(res).toContain("root://channel/chan-private");
      expect(deps.ensureRecipientChannel).toHaveBeenCalledWith(mockUserId);
      expect(deps.setNotificationPreference).toHaveBeenCalledWith(
        mockUserId,
        true
      );
      expect(deps.provisionDealAlerts).toHaveBeenCalledTimes(1);
    });

    it("uses the injected API client for the preference by default", async () => {
      const fakeApi = {
        getCollector: vi
          .fn()
          .mockResolvedValue({ collectorId: "collector-1", collectorName: "Ash" }),
        setNotifyPreference: vi.fn().mockResolvedValue(undefined),
      } as unknown as RootBotApi;
      const deps: RootCommandDeps = {
        ensureRecipientChannel: vi.fn().mockResolvedValue("chan-private"),
        provisionDealAlerts: vi.fn().mockResolvedValue(undefined),
      };

      const res = await processRootCommand(
        mockUserId,
        "/notify on",
        fakeApi,
        deps
      );

      expect(res).toContain("Deal alerts enabled");
      expect(fakeApi.getCollector).toHaveBeenCalledWith(mockUserId);
      expect(fakeApi.setNotifyPreference).toHaveBeenCalledWith({
        providerUserId: mockUserId,
        enabled: true,
      });
    });

    it("falls back to a deferred-channel message when creation fails", async () => {
      const deps = createDeps();
      (deps.ensureRecipientChannel as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const res = await processRootCommand(
        mockUserId,
        "/notify on",
        {} as RootBotApi,
        deps
      );

      expect(res).toContain("next marketplace sync");
    });

    it("disables deal alerts and removes the private channel", async () => {
      const deps = createDeps();

      const res = await processRootCommand(
        mockUserId,
        "/notify off",
        {} as RootBotApi,
        deps
      );

      expect(res).toContain("Deal alerts disabled");
      expect(deps.setNotificationPreference).toHaveBeenCalledWith(
        mockUserId,
        false
      );
      expect(deps.removeDealAlertChannel).toHaveBeenCalledWith(mockUserId);
    });

    it("returns usage when no action is given", async () => {
      const deps = createDeps();

      const res = await processRootCommand(
        mockUserId,
        "/notify",
        {} as RootBotApi,
        deps
      );

      expect(res).toContain("Usage:");
      expect(deps.setNotificationPreference).not.toHaveBeenCalled();
    });

    it("prompts to link when the identity is not linked", async () => {
      const deps = createDeps(null);

      const res = await processRootCommand(
        mockUserId,
        "/notify on",
        {} as RootBotApi,
        deps
      );

      expect(res).toContain("Account Not Linked");
      expect(deps.setNotificationPreference).not.toHaveBeenCalled();
    });
  });

  describe("/setup", () => {
    function createDeps(admin = true): RootCommandDeps {
      return {
        configureFromChannel: vi.fn().mockResolvedValue("market"),
        isCommunityAdmin: vi.fn().mockResolvedValue(admin),
      } as RootCommandDeps;
    }

    it("warns before changing the dump channel", async () => {
      const deps = createDeps(true);

      const res = await processRootCommand(
        mockUserId,
        "/setup",
        {} as RootBotApi,
        deps,
        "chan-market"
      );

      expect(res).toContain("Market setup");
      expect(res).toContain("/setup confirm");
      expect(deps.configureFromChannel).not.toHaveBeenCalled();
    });

    it("records the channel when an admin confirms", async () => {
      const deps = createDeps(true);

      const res = await processRootCommand(
        mockUserId,
        "/setup confirm",
        {} as RootBotApi,
        deps,
        "chan-market"
      );

      expect(res).toContain("Setup complete");
      expect(deps.configureFromChannel).toHaveBeenCalledWith("chan-market");
    });

    it("refuses when the caller is not an admin", async () => {
      const deps = createDeps(false);

      const res = await processRootCommand(
        mockUserId,
        "/setup confirm",
        {} as RootBotApi,
        deps,
        "chan-market"
      );

      expect(res).toContain("Only community admins");
      expect(deps.configureFromChannel).not.toHaveBeenCalled();
    });

    it("asks to run it inside a channel", async () => {
      const deps = createDeps(true);

      const res = await processRootCommand(
        mockUserId,
        "/setup confirm",
        {} as RootBotApi,
        deps
      );

      expect(res).toContain("inside the channel");
      expect(deps.configureFromChannel).not.toHaveBeenCalled();
    });
  });
});
