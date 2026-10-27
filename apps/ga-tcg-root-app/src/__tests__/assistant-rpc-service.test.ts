import { describe, expect, it, vi } from "vitest";
import { AssistantRpcService } from "../assistant-rpc-service";
import { RootBotApiError, type RootBotApi } from "../root-bot-api";
import { type Client } from "@rootsdk/server-app";

function createMockClient(userId = "user-123", communityId = "comm-456"): Client {
  return {
    userId: userId as any,
    communityId: communityId as any,
    deviceIds: [],
  } as unknown as Client;
}

describe("AssistantRpcService", () => {
  describe("getStatus", () => {
    it("returns unlinked state when collector is not found", async () => {
      const mockApi = {
        getCollector: vi.fn().mockResolvedValue(null),
        getDealAlertChannel: vi.fn().mockResolvedValue(null),
      } as unknown as RootBotApi;

      const service = new AssistantRpcService("comm-456", { api: mockApi });
      const status = await service.getStatus(createMockClient("user-unlinked"));

      expect(status.isLinked).toBe(false);
      expect(status.collectorId).toBe("");
      expect(status.collectorName).toBe("");
      expect(status.notificationsEnabled).toBe(false);
      expect(status.dealAlertMode).toBe("all");
      expect(status.alertChannelId).toBe("");
    });

    it("returns linked state with collector profile and alert channel", async () => {
      const mockApi = {
        getCollector: vi.fn().mockResolvedValue({
          collectorId: "col-1",
          collectorName: "Astraea",
          friendCode: "AST-123",
          notificationsEnabled: true,
          dealAlertMode: "hard",
        }),
        getDealAlertChannel: vi.fn().mockResolvedValue({
          channelId: "chan-789",
          messageIds: ["msg-1"],
        }),
      } as unknown as RootBotApi;

      const service = new AssistantRpcService("comm-456", {
        api: mockApi,
        isCommunityAdmin: vi.fn().mockResolvedValue(true),
      });
      const status = await service.getStatus(createMockClient("user-linked"));

      expect(status.isLinked).toBe(true);
      expect(status.collectorId).toBe("col-1");
      expect(status.collectorName).toBe("Astraea");
      expect(status.friendCode).toBe("AST-123");
      expect(status.notificationsEnabled).toBe(true);
      expect(status.dealAlertMode).toBe("hard");
      expect(status.alertChannelId).toBe("chan-789");
      expect(status.isAdmin).toBe(true);
    });

    it("handles API rejection gracefully", async () => {
      const mockApi = {
        getCollector: vi.fn().mockRejectedValue(new Error("Network fail")),
        getDealAlertChannel: vi.fn().mockRejectedValue(new Error("Network fail")),
      } as unknown as RootBotApi;

      const service = new AssistantRpcService("comm-456", { api: mockApi });
      const status = await service.getStatus(createMockClient("user-err"));

      expect(status.isLinked).toBe(false);
      expect(status.collectorId).toBe("");
    });
  });

  describe("linkAccount", () => {
    it("rejects empty pairing code", async () => {
      const mockApi = {
        link: vi.fn(),
      } as unknown as RootBotApi;

      const service = new AssistantRpcService("comm-456", { api: mockApi });
      const result = await service.linkAccount({ code: "   " }, createMockClient());

      expect(result.success).toBe(false);
      expect(result.error).toBe("INVALID_CODE");
      expect(mockApi.link).not.toHaveBeenCalled();
    });

    it("successfully links valid code", async () => {
      const mockApi = {
        link: vi.fn().mockResolvedValue({
          collectorId: "col-1",
          collectorName: "Astraea",
          message: "Linked",
        }),
      } as unknown as RootBotApi;

      const service = new AssistantRpcService("comm-456", { api: mockApi });
      const result = await service.linkAccount({ code: "abc123" }, createMockClient("user-123"));

      expect(mockApi.link).toHaveBeenCalledWith({
        token: "ABC123",
        provider: "root",
        providerUserId: "user-123",
      });
      expect(result.success).toBe(true);
      expect(result.collectorName).toBe("Astraea");
      expect(result.error).toBe("");
    });

    it("handles typed RootBotApiError (e.g. EXPIRED_CODE)", async () => {
      const mockApi = {
        link: vi.fn().mockRejectedValue(new RootBotApiError(400, "EXPIRED_CODE", "Token expired")),
      } as unknown as RootBotApi;

      const service = new AssistantRpcService("comm-456", { api: mockApi });
      const result = await service.linkAccount({ code: "EXPIRE" }, createMockClient("user-123"));

      expect(result.success).toBe(false);
      expect(result.error).toBe("EXPIRED_CODE");
    });
  });

  describe("setPreferences", () => {
    it("enables deal alerts with hard shortages only and provisions channel", async () => {
      const setNotifyPref = vi.fn().mockResolvedValue(undefined);
      const ensureChannel = vi.fn().mockResolvedValue("root://channel/alert-chan-42");

      const service = new AssistantRpcService("comm-456", {
        setNotificationPreference: setNotifyPref,
        ensureRecipientChannel: ensureChannel,
      });

      const response = await service.setPreferences(
        { notificationsEnabled: true, dealAlertMode: "hard" },
        createMockClient("user-123", "comm-456")
      );

      expect(setNotifyPref).toHaveBeenCalledWith("user-123", true, "hard");
      expect(ensureChannel).toHaveBeenCalledWith("user-123", "comm-456");
      expect(response.success).toBe(true);
      expect(response.notificationsEnabled).toBe(true);
      expect(response.dealAlertMode).toBe("hard");
      expect(response.alertChannelId).toBe("alert-chan-42");
    });

    it("disables deal alerts and cleans up channel", async () => {
      const setNotifyPref = vi.fn().mockResolvedValue(undefined);
      const removeChannel = vi.fn().mockResolvedValue(undefined);

      const service = new AssistantRpcService("comm-456", {
        setNotificationPreference: setNotifyPref,
        removeDealAlertChannel: removeChannel,
      });

      const response = await service.setPreferences(
        { notificationsEnabled: false, dealAlertMode: "all" },
        createMockClient("user-123", "comm-456")
      );

      expect(setNotifyPref).toHaveBeenCalledWith("user-123", false, "all");
      expect(removeChannel).toHaveBeenCalledWith("user-123", "comm-456");
      expect(response.success).toBe(true);
      expect(response.notificationsEnabled).toBe(false);
      expect(response.dealAlertMode).toBe("all");
      expect(response.alertChannelId).toBe("");
    });
  });

  describe("getDecks", () => {
    it("returns formatted decks with calculated shortages", async () => {
      const mockApi = {
        getDecks: vi.fn().mockResolvedValue({
          collectorId: "col-1",
          collectorName: "Astraea",
          decks: [
            {
              id: "deck-1",
              name: "Fire Rai",
              format: "Standard",
              champion: "Rai",
              totalCards: 60,
              uniqueCards: 20,
              completionPercentage: 80,
              hardShortageCount: 3,
              sharedShortageCount: 2,
            },
          ],
        }),
        getShortages: vi.fn().mockResolvedValue({
          collectorId: "col-1",
          deckId: "deck-1",
          deckName: "Fire Rai",
          format: "Standard",
          completionPercentage: 80,
          totalHardShortages: 3,
          totalSharedShortages: 2,
          hardShortages: [
            {
              cardSlug: "fire-ball",
              cardName: "Fire Ball",
              element: "fire",
              rarity: 1,
              requiredQuantity: 4,
              missingQuantity: 3,
              sharedQuantity: 0,
              competingDecks: [],
              type: "hard",
            },
          ],
          sharedShortages: [
            {
              cardSlug: "grand-crush",
              cardName: "Grand Crush",
              element: "fire",
              rarity: 2,
              requiredQuantity: 2,
              missingQuantity: 0,
              sharedQuantity: 2,
              competingDecks: ["Earth Rai"],
              type: "shared",
            },
          ],
        }),
      } as unknown as RootBotApi;

      const service = new AssistantRpcService("comm-456", { api: mockApi });
      const response = await service.getDecks(createMockClient("user-123"));

      expect(response.decks).toHaveLength(1);
      const deck = response.decks[0];
      expect(deck.id).toBe("deck-1");
      expect(deck.name).toBe("Fire Rai");
      expect(deck.champion).toBe("Rai");
      expect(deck.hardShortagesCount).toBe(3);
      expect(deck.sharedShortagesCount).toBe(2);
      expect(deck.hardShortages).toEqual([
        { cardSlug: "fire-ball", cardName: "Fire Ball", quantity: 3 },
      ]);
      expect(deck.sharedShortages).toEqual([
        { cardSlug: "grand-crush", cardName: "Grand Crush", quantity: 2 },
      ]);
    });

    it("returns empty array when getDecks rejects", async () => {
      const mockApi = {
        getDecks: vi.fn().mockRejectedValue(new Error("Network fail")),
      } as unknown as RootBotApi;

      const service = new AssistantRpcService("comm-456", { api: mockApi });
      const response = await service.getDecks(createMockClient("user-123"));

      expect(response.decks).toEqual([]);
    });
  });

  describe("registerAccount", () => {
    it("registers user and returns collector info", async () => {
      const mockApi = {
        register: vi.fn().mockResolvedValue({
          collector: { name: "Bob", friendCode: "GA-BOB" },
          created: true,
        }),
      } as unknown as RootBotApi;

      const service = new AssistantRpcService("comm-456", { api: mockApi });
      const res = await service.registerAccount(createMockClient("user-123"));
      expect(res.success).toBe(true);
      expect(res.collectorName).toBe("Bob");
      expect(res.friendCode).toBe("GA-BOB");
    });
  });

  describe("autocomplete", () => {
    it("returns autocomplete results", async () => {
      const mockApi = {
        autocomplete: vi.fn().mockResolvedValue({
          results: [{ name: "Fireball", value: "fireball", element: "FIRE" }],
        }),
      } as unknown as RootBotApi;

      const service = new AssistantRpcService("comm-456", { api: mockApi });
      const res = await service.autocomplete(
        { type: "card", query: "fire" },
        createMockClient("user-123")
      );
      expect(res.results).toHaveLength(1);
      expect(res.results[0].name).toBe("Fireball");
    });
  });

  describe("personal wants: add, remove, get", () => {
    it("gets personal wants", async () => {
      const mockApi = {
        getPersonalWants: vi.fn().mockResolvedValue({
          personalWants: [{ cardSlug: "fireball", cardName: "Fireball", desiredQuantity: 2 }],
        }),
      } as unknown as RootBotApi;

      const service = new AssistantRpcService("comm-456", { api: mockApi });
      const res = await service.getPersonalWants(createMockClient("user-123"));
      expect(res.wants).toHaveLength(1);
      expect(res.wants[0].desiredQuantity).toBe(2);
    });

    it("adds want", async () => {
      const mockApi = {
        addWant: vi.fn().mockResolvedValue({
          card: { name: "Fireball" },
        }),
      } as unknown as RootBotApi;

      const service = new AssistantRpcService("comm-456", { api: mockApi });
      const res = await service.addWant(
        { card: "Fireball", quantity: 2, foil: false, omnidexUrl: "" },
        createMockClient("user-123")
      );
      expect(res.success).toBe(true);
    });

    it("removes want", async () => {
      const mockApi = {
        removeWant: vi.fn().mockResolvedValue({
          success: true,
          removed: true,
          remainingQuantity: 0,
          cardName: "Fireball",
        }),
      } as unknown as RootBotApi;

      const service = new AssistantRpcService("comm-456", { api: mockApi });
      const res = await service.removeWant(
        { card: "Fireball", quantity: 1 },
        createMockClient("user-123")
      );
      expect(res.success).toBe(true);
      expect(res.removed).toBe(true);
    });
  });

  describe("importDeck", () => {
    it("imports deck from url", async () => {
      const mockApi = {
        importDeck: vi.fn().mockResolvedValue({
          deck: { id: "d-1", name: "Imported" },
        }),
      } as unknown as RootBotApi;

      const service = new AssistantRpcService("comm-456", { api: mockApi });
      const res = await service.importDeck(
        { url: "https://omnidex.gg/deck/123" },
        createMockClient("user-123")
      );
      expect(res.success).toBe(true);
      expect(res.deckName).toBe("Imported");
    });
  });

  describe("updateDeck", () => {
    it("updates a deck via the api", async () => {
      const mockApi = {
        updateDeck: vi.fn().mockResolvedValue({
          success: true,
          deck: { id: "d-1", name: "Updated" },
        }),
      } as unknown as RootBotApi;

      const service = new AssistantRpcService("comm-123", { api: mockApi });
      const res = await service.updateDeck(
        { deckId: "d-1", url: "https://omnidex.gg/deck/456", text: "", name: "Updated", champion: "" },
        createMockClient("user-123")
      );
      expect(res.success).toBe(true);
      expect(res.deckName).toBe("Updated");
      expect(mockApi.updateDeck).toHaveBeenCalledWith("user-123", {
        deckId: "d-1",
        url: "https://omnidex.gg/deck/456",
        text: undefined,
        name: "Updated",
        champion: undefined,
      });
    });
  });

  describe("admin channel configuration RPCs", () => {
    const mockChannelGroups = [
      { id: "group-1", name: "General Category" },
      { id: "group-2", name: "GA Market" },
    ];

    const mockChannelsByGroup = (params: { channelGroupId: any }) => {
      if (params.channelGroupId === "group-1") {
        return Promise.resolve([
          { id: "ch-gen", name: "general", channelType: 1 }, // text
          { id: "ch-voice", name: "lounge", channelType: 2 }, // voice
        ]);
      }
      return Promise.resolve([
        { id: "ch-market", name: "market", channelType: 1 },
        { id: "ch-app", name: "assistant", channelType: 3 }, // app
      ]);
    };

    it("getAdminSettings returns empty channels and isAdmin false for non-admins", async () => {
      const service = new AssistantRpcService("comm-123", {
        isCommunityAdmin: vi.fn().mockResolvedValue(false),
      });

      const res = await service.getAdminSettings(createMockClient("regular-user"));
      expect(res.isAdmin).toBe(false);
      expect(res.broadcastChannelId).toBe("");
      expect(res.textChannels).toEqual([]);
    });

    it("getAdminSettings returns text channels across groups for admins", async () => {
      let storedBroadcastId = "ch-market";
      const mockConfig = {
        getBroadcastChannelId: vi.fn().mockImplementation(async () => storedBroadcastId),
        setBroadcastChannelId: vi.fn().mockImplementation(async (id: string) => {
          storedBroadcastId = id;
        }),
      } as any;

      const service = new AssistantRpcService("comm-123", {
        isCommunityAdmin: vi.fn().mockResolvedValue(true),
        listChannelGroups: vi.fn().mockResolvedValue(mockChannelGroups),
        listChannels: vi.fn().mockImplementation(mockChannelsByGroup),
        config: mockConfig,
      });

      const res = await service.getAdminSettings(createMockClient("admin-user"));
      expect(res.isAdmin).toBe(true);
      expect(res.broadcastChannelId).toBe("ch-market");
      expect(res.broadcastChannelName).toBe("market");
      expect(res.textChannels).toEqual([
        { id: "ch-gen", name: "general", groupName: "General Category" },
        { id: "ch-market", name: "market", groupName: "GA Market" },
      ]);
    });

    it("setBroadcastChannel rejects non-admins with FORBIDDEN", async () => {
      const service = new AssistantRpcService("comm-123", {
        isCommunityAdmin: vi.fn().mockResolvedValue(false),
      });

      const res = await service.setBroadcastChannel(
        { channelId: "ch-gen" },
        createMockClient("non-admin")
      );
      expect(res.success).toBe(false);
      expect(res.error).toBe("FORBIDDEN");
    });

    it("setBroadcastChannel rejects unknown channels with CHANNEL_NOT_FOUND", async () => {
      const service = new AssistantRpcService("comm-123", {
        isCommunityAdmin: vi.fn().mockResolvedValue(true),
        listChannelGroups: vi.fn().mockResolvedValue(mockChannelGroups),
        listChannels: vi.fn().mockImplementation(mockChannelsByGroup),
        config: {
          getBroadcastChannelId: vi.fn(),
          setBroadcastChannelId: vi.fn(),
        } as any,
      });

      const res = await service.setBroadcastChannel(
        { channelId: "ch-nonexistent" },
        createMockClient("admin-user")
      );
      expect(res.success).toBe(false);
      expect(res.error).toBe("CHANNEL_NOT_FOUND");
    });

    it("setBroadcastChannel rejects non-text channels with CHANNEL_NOT_FOUND", async () => {
      const service = new AssistantRpcService("comm-123", {
        isCommunityAdmin: vi.fn().mockResolvedValue(true),
        listChannelGroups: vi.fn().mockResolvedValue(mockChannelGroups),
        listChannels: vi.fn().mockImplementation(mockChannelsByGroup),
        config: {
          getBroadcastChannelId: vi.fn(),
          setBroadcastChannelId: vi.fn(),
        } as any,
      });

      const res = await service.setBroadcastChannel(
        { channelId: "ch-voice" },
        createMockClient("admin-user")
      );
      expect(res.success).toBe(false);
      expect(res.error).toBe("CHANNEL_NOT_FOUND");
    });

    it("setBroadcastChannel saves valid text channel and returns metadata", async () => {
      const setBroadcastChannelId = vi.fn().mockResolvedValue(undefined);
      const service = new AssistantRpcService("comm-123", {
        isCommunityAdmin: vi.fn().mockResolvedValue(true),
        listChannelGroups: vi.fn().mockResolvedValue(mockChannelGroups),
        listChannels: vi.fn().mockImplementation(mockChannelsByGroup),
        config: {
          getBroadcastChannelId: vi.fn().mockResolvedValue(undefined),
          setBroadcastChannelId,
        } as any,
      });

      const res = await service.setBroadcastChannel(
        { channelId: "ch-gen" },
        createMockClient("admin-user")
      );
      expect(res.success).toBe(true);
      expect(res.broadcastChannelId).toBe("ch-gen");
      expect(res.broadcastChannelName).toBe("general");
      expect(res.error).toBe("");
      expect(setBroadcastChannelId).toHaveBeenCalledWith("ch-gen");
    });

    it("provisionMarketChannels rejects non-admins with FORBIDDEN", async () => {
      const service = new AssistantRpcService("comm-123", {
        isCommunityAdmin: vi.fn().mockResolvedValue(false),
      });

      const res = await service.provisionMarketChannels(createMockClient("non-admin"));
      expect(res.success).toBe(false);
      expect(res.error).toBe("FORBIDDEN");
    });

    it("provisionMarketChannels calls provisionChannels and returns provisioned IDs", async () => {
      const provisionChannels = vi.fn().mockResolvedValue({
        marketChannel: "market",
        assistantChannel: "assistant",
      });
      const service = new AssistantRpcService("comm-123", {
        isCommunityAdmin: vi.fn().mockResolvedValue(true),
        provisionChannels,
        config: {
          getBroadcastChannelId: vi.fn().mockResolvedValue("ch-new-market"),
          getAssistantChannelId: vi.fn().mockResolvedValue("ch-new-assistant"),
        } as any,
      });

      const res = await service.provisionMarketChannels(createMockClient("admin-user"));
      expect(res.success).toBe(true);
      expect(res.broadcastChannelId).toBe("ch-new-market");
      expect(res.broadcastChannelName).toBe("market");
      expect(res.assistantChannelId).toBe("ch-new-assistant");
      expect(res.error).toBe("");
      expect(provisionChannels).toHaveBeenCalled();
    });
  });
});
