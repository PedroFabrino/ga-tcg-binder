import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as registerPost } from "../register/route";
import { GET as autocompleteGet } from "../autocomplete/route";
import { POST as decksPost } from "../decks/route";
import { POST as wantlistPost, DELETE as wantlistDelete } from "../wantlist/route";
import * as assistantAuth from "@/services/assistant-auth";
import * as assistantWantsService from "@/services/assistant-wants-service";

vi.mock("@/services/assistant-auth");
vi.mock("@/services/assistant-wants-service");
vi.mock("@/services/root-bot-auth", () => ({
  authenticateRootBot: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/services/root-bot-service", () => ({
  noteRootCommunityMember: vi.fn(),
}));

describe("Assistant Wants & Parity API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assistantAuth.isAssistantAuthorized).mockResolvedValue(true);
    vi.mocked(assistantAuth.resolveAssistantCaller).mockResolvedValue({
      context: {
        collectorId: "col-123",
        collectorName: "TestCollector",
        provider: "root",
        providerUserId: "user-456",
      },
    });
  });

  describe("POST /api/assistant/register", () => {
    it("registers user successfully", async () => {
      vi.mocked(assistantWantsService.registerAssistantUser).mockResolvedValue({
        collector: { id: "col-123", name: "User", friendCode: "GA-123" } as any,
        created: true,
      });

      const req = new Request("http://localhost/api/assistant/register", {
        method: "POST",
        body: JSON.stringify({
          provider: "root",
          providerUserId: "user-456",
          providerUsername: "User",
        }),
      });

      const res = await registerPost(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.collector.friendCode).toBe("GA-123");
    });
  });

  describe("GET /api/assistant/autocomplete", () => {
    it("returns autocomplete choices", async () => {
      vi.mocked(assistantWantsService.getAutocompleteChoices).mockResolvedValue([
        { name: "Fireball", value: "fireball", element: "FIRE", type: "ACTION" },
      ]);

      const req = new Request(
        "http://localhost/api/assistant/autocomplete?provider=root&providerUserId=user-456&type=card&query=fire"
      );

      const res = await autocompleteGet(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.results).toHaveLength(1);
      expect(data.results[0].name).toBe("Fireball");
    });
  });

  describe("POST /api/assistant/decks", () => {
    it("imports deck from url", async () => {
      vi.mocked(assistantWantsService.importAssistantDeckFromSource).mockResolvedValue({
        id: "deck-1",
        name: "Imported Deck",
      });

      const req = new Request("http://localhost/api/assistant/decks", {
        method: "POST",
        body: JSON.stringify({
          provider: "root",
          providerUserId: "user-456",
          url: "https://omnidex.gg/deck/123",
        }),
      });

      const res = await decksPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.deck.id).toBe("deck-1");
    });
  });

  describe("POST & DELETE /api/assistant/wantlist", () => {
    it("adds want card", async () => {
      vi.mocked(assistantWantsService.addWantToAssistant).mockResolvedValue({
        card: { slug: "fireball", name: "Fireball" },
        desiredQuantity: 1,
      });

      const req = new Request("http://localhost/api/assistant/wantlist", {
        method: "POST",
        body: JSON.stringify({
          provider: "root",
          providerUserId: "user-456",
          card: "Fireball",
        }),
      });

      const res = await wantlistPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.card.name).toBe("Fireball");
    });

    it("deletes want card", async () => {
      vi.mocked(assistantWantsService.removeWantFromAssistant).mockResolvedValue({
        success: true,
        removed: true,
        remainingQuantity: 0,
        cardName: "Fireball",
      });

      const req = new Request("http://localhost/api/assistant/wantlist", {
        method: "DELETE",
        body: JSON.stringify({
          provider: "root",
          providerUserId: "user-456",
          card: "Fireball",
        }),
      });

      const res = await wantlistDelete(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.removed).toBe(true);
    });
  });
});
