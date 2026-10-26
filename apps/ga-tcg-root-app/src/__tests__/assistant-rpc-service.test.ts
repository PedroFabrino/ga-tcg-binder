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

      const service = new AssistantRpcService("comm-456", { api: mockApi });
      const status = await service.getStatus(createMockClient("user-linked"));

      expect(status.isLinked).toBe(true);
      expect(status.collectorId).toBe("col-1");
      expect(status.collectorName).toBe("Astraea");
      expect(status.friendCode).toBe("AST-123");
      expect(status.notificationsEnabled).toBe(true);
      expect(status.dealAlertMode).toBe("hard");
      expect(status.alertChannelId).toBe("chan-789");
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
});
