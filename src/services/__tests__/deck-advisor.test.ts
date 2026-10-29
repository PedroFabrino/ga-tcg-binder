import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../db/test-utils";
import { users, decks, cards } from "../../db/schema";
import {
  isUserAdvisorAllowlisted,
  detectSubtypeLegalityBypasses,
  assembleDeckAdvisorContext,
} from "../deck-advisor-context";
import { runDeckAdvisorChat } from "../deck-advisor";

describe("Deck Advisor Service (Ticket 1)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("Account Allowlist Gating", () => {
    it("rejects unauthorized users when allowlist is set", () => {
      process.env.ADVISOR_ALLOWED_EMAILS = "alex@ga.com, master@ga.com";
      process.env.ADVISOR_ALLOWED_USER_IDS = "user_alex";

      expect(isUserAdvisorAllowlisted({ id: "user_sarah", email: "sarah@ga.com" })).toBe(false);
      expect(isUserAdvisorAllowlisted({ id: null, email: null })).toBe(false);
    });

    it("permits allowlisted email or user id (case-insensitive)", () => {
      process.env.ADVISOR_ALLOWED_EMAILS = "Alex@ga.com";
      process.env.ADVISOR_ALLOWED_USER_IDS = "user_master";

      expect(isUserAdvisorAllowlisted({ email: "alex@ga.com" })).toBe(true);
      expect(isUserAdvisorAllowlisted({ email: "ALEX@GA.COM" })).toBe(true);
      expect(isUserAdvisorAllowlisted({ id: "user_master" })).toBe(true);
    });
  });

  describe("Subtype Legality Bypasses", () => {
    it("detects 'Ignore the elemental requirements of Distortion cards you play' from The Looking Glass", () => {
      const deckCards = [
        {
          name: "The Looking Glass",
          effect:
            "Divine Relic\n\nOmnishroud\n\nIf this card is in your starting material deck, you may begin the game with it on the field.\n\nIgnore the elemental requirements of Distortion cards you play.",
        },
        {
          name: "Fire Slash",
          effect: "Deal 3 damage.",
        },
      ];

      const bypasses = detectSubtypeLegalityBypasses(deckCards);
      expect(bypasses).toHaveLength(1);
      expect(bypasses[0]).toEqual({
        subtype: "DISTORTION",
        unlockedByCard: "The Looking Glass",
      });
    });
  });

  describe("Candidate Pool Assembly & Cross-Element Tech Inclusion", () => {
    it("includes Astra Distortion card (Palvor Sword) in Fire/Crux deck when The Looking Glass is in deck", () => {
      const deckData = {
        deck: {
          id: "deck_merlin",
          name: "Fire Crux Merlin",
          champion: "Merlin, Kingsmaker",
          format: "standard",
          userId: "user_alex",
          isPublic: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        deckCards: [
          {
            id: "dc_1",
            deckId: "deck_merlin",
            cardSlug: "merlin-kingsmaker",
            zone: "material",
            quantity: 1,
            assignedEditionId: null,
            name: "Merlin, Kingsmaker",
            element: "FIRE",
            class: "MAGE",
            type: "CHAMPION",
            subtypes: JSON.stringify(["MAGE"]),
            effect: "",
            costReserve: null,
            costMemory: 0,
            speed: false,
          },
          {
            id: "dc_2",
            deckId: "deck_merlin",
            cardSlug: "the-looking-glass",
            zone: "material",
            quantity: 1,
            assignedEditionId: null,
            name: "The Looking Glass",
            element: "NORM",
            class: "CLERIC",
            type: "ITEM",
            subtypes: JSON.stringify(["CLERIC", "DISTORTION", "ARTIFACT"]),
            effect: "Ignore the elemental requirements of Distortion cards you play.",
            costReserve: null,
            costMemory: 0,
            speed: false,
          },
        ],
      };

      const userData = {
        inventory: [
          // 1. Legal Fire card (Normal Element)
          {
            id: "ci_1",
            cardSlug: "flame-burst",
            editionId: "ed_1",
            foil: false,
            quantity: 4,
            isDedicated: false,
            name: "Flame Burst",
            element: "FIRE",
            class: "MAGE",
            type: "ATTACK",
            subtypes: JSON.stringify(["MAGE", "FIRE"]),
            effect: "Deal 4 damage.",
            costReserve: 2,
            costMemory: null,
            speed: false,
          },
          // 2. Off-element Astra Distortion card (Palvor Sword)
          {
            id: "ci_2",
            cardSlug: "palvor-sword",
            editionId: "ed_2",
            foil: true,
            quantity: 2,
            isDedicated: false,
            name: "Palvor Sword",
            element: "ASTRA",
            class: "GUARDIAN",
            type: "ITEM",
            subtypes: JSON.stringify(["GUARDIAN", "DISTORTION", "SWORD"]),
            effect: "Banish all cards in graveyard.",
            costReserve: 3,
            costMemory: null,
            speed: false,
          },
          // 3. Unrelated off-element Water card (should NOT be in candidate pool)
          {
            id: "ci_3",
            cardSlug: "frost-nova",
            editionId: "ed_3",
            foil: false,
            quantity: 2,
            isDedicated: false,
            name: "Frost Nova",
            element: "WATER",
            class: "MAGE",
            type: "ATTACK",
            subtypes: JSON.stringify(["MAGE"]),
            effect: "Freeze target.",
            costReserve: 2,
            costMemory: null,
            speed: false,
          },
        ],
        storeListings: [],
        otherDeckCardUsages: [],
      };

      const metaBenchmarks = {
        archetypes: [
          {
            id: "meta-merlin",
            name: "Merlin Fire",
            tier: "Tier 1",
            champion: "Merlin, Kingsmaker",
            element: "FIRE",
            shareRate: "12%",
            winRate: "54%",
            decklist: "",
          },
        ],
        staples: [],
      };

      const ctx = assembleDeckAdvisorContext({
        deckData,
        userData,
        metaBenchmarks,
      });

      expect(ctx.unlockedElements).toContain("FIRE");
      expect(ctx.unlockedElements).toContain("NORM");
      expect(ctx.bypassedSubtypes).toHaveLength(1);
      expect(ctx.bypassedSubtypes[0].subtype).toBe("DISTORTION");

      const palvor = ctx.candidatePool.find((c) => c.cardSlug === "palvor-sword");
      expect(palvor).toBeDefined();
      expect(palvor?.unlockedViaReason).toBe("The Looking Glass");
      expect(palvor?.classBonusActive).toBe(false); // GUARDIAN in MAGE deck

      const flame = ctx.candidatePool.find((c) => c.cardSlug === "flame-burst");
      expect(flame).toBeDefined();
      expect(flame?.classBonusActive).toBe(true); // MAGE in MAGE deck

      const frost = ctx.candidatePool.find((c) => c.cardSlug === "frost-nova");
      expect(frost).toBeUndefined(); // Water not unlocked
    });
  });

  describe("Gemini Chat Execution & OmniRoute 429 Fallback", () => {
    let testDb: any;

    beforeEach(async () => {
      const res = await createTestDb();
      testDb = res.db;

      // Seed test user and deck
      await testDb.insert(users).values({
        id: "user_alex",
        name: "Alex",
        email: "alex@ga.com",
        friendCode: "GA-ALEX01",
        locale: "en",
      });

      await testDb.insert(decks).values({
        id: "deck_test_1",
        userId: "user_alex",
        name: "Test Fire Deck",
        champion: "Merlin",
        format: "standard",
      });

      await testDb.insert(cards).values({
        slug: "fire-slash",
        name: "Fire Slash",
        element: "FIRE",
        class: "MAGE",
        type: "ATTACK",
      });
    });

    it("calls Gemini 3.8 Flash successfully when API key is provided", async () => {
      process.env.ADVISOR_ALLOWED_EMAILS = "alex@ga.com";

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: "Add 2x Palvor Sword for graveyard hate." } }],
        }),
      });

      const res = await runDeckAdvisorChat(
        "user_alex",
        "alex@ga.com",
        "deck_test_1",
        [{ role: "user", content: "Suggest changes" }],
        testDb,
        {
          geminiApiKey: "fake-gemini-key",
          customFetch: mockFetch as any,
        }
      );

      expect(res.fallbackActivated).toBe(false);
      expect(res.providerUsed).toBe("gemini");
      expect(res.message.content).toContain("Palvor Sword");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("automatically falls back to OmniRoute when Gemini returns HTTP 429", async () => {
      process.env.ADVISOR_ALLOWED_EMAILS = "alex@ga.com";

      const mockFetch = vi
        .fn()
        // First call: Gemini returns 429
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () => "Rate limit exceeded",
        })
        // Second call: OmniRoute succeeds
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: "OmniRoute fallback response: Cut 1x Fire Slash." } }],
          }),
        });

      const res = await runDeckAdvisorChat(
        "user_alex",
        "alex@ga.com",
        "deck_test_1",
        [{ role: "user", content: "Help" }],
        testDb,
        {
          geminiApiKey: "fake-key",
          omnirouteUrl: "http://localhost:20128/v1",
          customFetch: mockFetch as any,
        }
      );

      expect(res.fallbackActivated).toBe(true);
      expect(res.providerUsed).toBe("omniroute");
      expect(res.message.content).toContain("OmniRoute fallback");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
