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

    it("does not unlock elements from cards in the Sideboard", () => {
      const deckData = {
        deck: {
          id: "deck_side",
          name: "Fire Deck",
          champion: "Merlin",
          format: "standard",
          userId: "user_alex",
          isPublic: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        deckCards: [
          {
            id: "dc_1",
            deckId: "deck_side",
            cardSlug: "merlin",
            zone: "material",
            quantity: 1,
            assignedEditionId: null,
            name: "Merlin",
            element: "FIRE",
            class: "MAGE",
            type: "CHAMPION",
            subtypes: '["MAGE"]',
            effect: "",
            costReserve: null,
            costMemory: 0,
            speed: false,
          },
          {
            id: "dc_2",
            deckId: "deck_side",
            cardSlug: "water-barrier",
            zone: "side",
            quantity: 2,
            assignedEditionId: null,
            name: "Water Barrier",
            element: "WATER",
            class: "MAGE",
            type: "SPELL",
            subtypes: "[]",
            effect: "",
            costReserve: 2,
            costMemory: null,
            speed: true,
          },
        ],
      };

      const ctx = assembleDeckAdvisorContext({
        deckData,
        userData: { inventory: [], storeListings: [], otherDeckCardUsages: [] },
        metaBenchmarks: { archetypes: [], staples: [] },
      });

      expect(ctx.unlockedElements).toContain("FIRE");
      expect(ctx.unlockedElements).toContain("NORM");
      expect(ctx.unlockedElements).not.toContain("WATER");
    });

    it("does not unlock elements from non-champion cards in Material or cards in Main deck", () => {
      const deckData = {
        deck: {
          id: "deck_fire_crux",
          name: "Fire Crux Merlin",
          champion: "Merlin, Kingslayer",
          format: "standard",
          userId: "user_alex",
          isPublic: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        deckCards: [
          // Champion in Material unlocks FIRE and CRUX
          {
            id: "dc_1",
            deckId: "deck_fire_crux",
            cardSlug: "spirit-of-fire",
            zone: "material",
            quantity: 1,
            assignedEditionId: null,
            name: "Spirit of Fire",
            element: "FIRE",
            class: "MAGE",
            type: "CHAMPION",
            subtypes: '["SPIRIT"]',
            effect: "",
            costReserve: null,
            costMemory: 0,
            speed: false,
          },
          {
            id: "dc_2",
            deckId: "deck_fire_crux",
            cardSlug: "merlin-kingslayer",
            zone: "material",
            quantity: 1,
            assignedEditionId: null,
            name: "Merlin, Kingslayer",
            element: "CRUX",
            class: "MAGE",
            type: "CHAMPION",
            subtypes: '["MAGE"]',
            effect: "",
            costReserve: null,
            costMemory: 2,
            speed: false,
          },
          // Non-champion Item in Material with element WATER (MUST NOT unlock WATER)
          {
            id: "dc_3",
            deckId: "deck_fire_crux",
            cardSlug: "crystalline-mirror",
            zone: "material",
            quantity: 1,
            assignedEditionId: null,
            name: "Crystalline Mirror",
            element: "WATER",
            class: "CLERIC",
            type: "ITEM",
            subtypes: '["CLERIC", "ITEM"]',
            effect: "",
            costReserve: null,
            costMemory: 0,
            speed: false,
          },
          // Card in Main Deck with element ASTRA (MUST NOT unlock ASTRA)
          {
            id: "dc_4",
            deckId: "deck_fire_crux",
            cardSlug: "astra-strike",
            zone: "main",
            quantity: 1,
            assignedEditionId: null,
            name: "Astra Strike",
            element: "ASTRA",
            class: "MAGE",
            type: "SPELL",
            subtypes: '["MAGE"]',
            effect: "",
            costReserve: 2,
            costMemory: null,
            speed: false,
          },
        ],
      };

      const userData = {
        inventory: [
          {
            id: "ci_shattered_hope",
            cardSlug: "shattered-hope",
            editionId: "ed_sh",
            foil: false,
            quantity: 2,
            isDedicated: false,
            name: "Shattered Hope",
            element: "WATER",
            class: "MAGE",
            type: "SPELL",
            subtypes: JSON.stringify(["MAGE"]),
            effect: "Merlin Bonus: Put Sheen counter.",
            costReserve: 2,
            costMemory: null,
            speed: false,
          },
        ],
        storeListings: [],
        otherDeckCardUsages: [],
      };

      const ctx = assembleDeckAdvisorContext({
        deckData,
        userData,
        metaBenchmarks: { archetypes: [], staples: [] },
      });

      expect(ctx.unlockedElements).toEqual(["NORM", "FIRE", "CRUX"]);
      expect(ctx.unlockedElements).not.toContain("WATER");
      expect(ctx.unlockedElements).not.toContain("ASTRA");

      // Shattered Hope is Water without bypass, so it MUST NOT be in candidatePool
      const candidate = ctx.candidatePool.find((c) => c.cardSlug === "shattered-hope");
      expect(candidate).toBeUndefined();
    });

    it("excludes cards dedicated to other decks and computes hard and shared shortages", () => {
      const deckData = {
        deck: {
          id: "deck_current",
          name: "Current Deck",
          champion: "Merlin",
          format: "standard",
          userId: "user_alex",
          isPublic: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        deckCards: [
          {
            id: "dc_fire_slash",
            deckId: "deck_current",
            cardSlug: "fire-slash",
            zone: "main",
            quantity: 4,
            assignedEditionId: null,
            name: "Fire Slash",
            element: "FIRE",
            class: "MAGE",
            type: "ACTION",
            subtypes: "[]",
            effect: "",
            costReserve: 2,
            costMemory: null,
            speed: true,
          },
        ],
      };

      const userData = {
        inventory: [
          {
            id: "ci_1",
            cardSlug: "fire-slash",
            editionId: "ed_1",
            foil: false,
            quantity: 2,
            isDedicated: true,
            name: "Fire Slash",
            element: "FIRE",
            class: "MAGE",
            type: "ACTION",
            subtypes: "[]",
            effect: "",
            costReserve: 2,
            costMemory: null,
            speed: true,
          },
          {
            id: "ci_2",
            cardSlug: "fire-slash",
            editionId: "ed_2",
            foil: false,
            quantity: 2,
            isDedicated: false,
            name: "Fire Slash",
            element: "FIRE",
            class: "MAGE",
            type: "ACTION",
            subtypes: "[]",
            effect: "",
            costReserve: 2,
            costMemory: null,
            speed: true,
          },
        ],
        storeListings: [],
        otherDeckCardUsages: [
          { deckId: "deck_other", cardSlug: "fire-slash", quantity: 3 },
        ],
      };

      const ctx = assembleDeckAdvisorContext({
        deckData,
        userData,
        metaBenchmarks: { archetypes: [], staples: [] },
      });

      const snapshot = ctx.deckCards[0];
      expect(snapshot.hardShortage).toBe(2);
      expect(snapshot.sharedShortage).toBe(2);
    });

    it("partitions Candidate Pool into Tier 2 (store_pullback) and Tier 3 (unowned_upgrade)", () => {
      const deckData = {
        deck: {
          id: "deck_fire",
          name: "Fire Deck",
          champion: "Merlin",
          format: "standard",
          userId: "user_alex",
          isPublic: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        deckCards: [
          {
            id: "dc_merlin",
            deckId: "deck_fire",
            cardSlug: "merlin",
            zone: "material",
            quantity: 1,
            assignedEditionId: null,
            name: "Merlin",
            element: "FIRE",
            class: "MAGE",
            type: "CHAMPION",
            subtypes: '["MAGE"]',
            effect: "",
            costReserve: null,
            costMemory: 0,
            speed: false,
          },
        ],
      };

      const userData = {
        inventory: [],
        storeListings: [
          {
            id: "myp_1",
            cardSlug: "ignite",
            cardName: "Ignite",
            quantity: 2,
            name: "Ignite",
            element: "FIRE",
            class: "MAGE",
            type: "SPELL",
            subtypes: "[]",
            effect: "Deal 2 damage.",
            costReserve: 1,
            costMemory: null,
            speed: true,
          },
        ],
        otherDeckCardUsages: [],
      };

      const metaBenchmarks = {
        archetypes: [
          {
            id: "meta_1",
            name: "Merlin Burn",
            tier: "Tier 1",
            champion: "Merlin",
            element: "FIRE",
            shareRate: "15%",
            winRate: "55%",
            decklist: "# Main Deck\n4 Fireball",
          },
        ],
        staples: [
          {
            cardSlug: "dispel",
            cardName: "Dispel",
            recommendedCopies: 2,
          },
        ],
        catalogCards: [
          {
            slug: "fireball",
            name: "Fireball",
            element: "FIRE",
            class: "MAGE",
            type: "SPELL",
            subtypes: "[]",
            effect: "Deal 5 damage.",
            costReserve: 3,
            costMemory: null,
            speed: false,
          },
          {
            slug: "dispel",
            name: "Dispel",
            element: "NORM",
            class: "ALL",
            type: "ACTION",
            subtypes: "[]",
            effect: "Negate target spell.",
            costReserve: 2,
            costMemory: null,
            speed: true,
          },
        ],
      };

      const ctx = assembleDeckAdvisorContext({
        deckData,
        userData,
        metaBenchmarks,
      });

      const ignite = ctx.candidatePool.find((c) => c.cardSlug === "ignite");
      expect(ignite).toBeDefined();
      expect(ignite?.tier).toBe("store_pullback");
      expect(ignite?.storeQuantity).toBe(2);

      const fireball = ctx.candidatePool.find((c) => c.cardSlug === "fireball");
      expect(fireball).toBeDefined();
      expect(fireball?.tier).toBe("unowned_upgrade");

      const dispel = ctx.candidatePool.find((c) => c.cardSlug === "dispel");
      expect(dispel).toBeDefined();
      expect(dispel?.tier).toBe("unowned_upgrade");
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

    it("falls back to secondary Gemini Flash model when primary returns HTTP 503 high demand spike", async () => {
      process.env.ADVISOR_ALLOWED_EMAILS = "alex@ga.com";

      const mockFetch = vi
        .fn()
        // First call: primary model returns 503 high demand spike
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: async () => "This model is currently experiencing high demand. Spikes in demand are usually temporary.",
        })
        // Second call: backup Gemini Flash model succeeds
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: "Backup Gemini Flash response: Swap approved." } }],
          }),
        });

      const res = await runDeckAdvisorChat(
        "user_alex",
        "alex@ga.com",
        "deck_test_1",
        [{ role: "user", content: "Check deck" }],
        testDb,
        {
          geminiApiKey: "fake-key",
          geminiModel: "gemini-3.8-flash",
          omnirouteUrl: "http://localhost:20128/v1",
          customFetch: mockFetch as any,
        }
      );

      expect(res.fallbackActivated).toBe(false);
      expect(res.providerUsed).toBe("gemini");
      expect(res.modelUsed).toBe("gemini-3.5-flash");
      expect(res.message.content).toContain("Backup Gemini Flash response");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});


  describe("Function-Calling Tools & Live MCP Rules (Ticket 2)", () => {
    let testDb: any;

    beforeEach(async () => {
      const res = await createTestDb();
      testDb = res.db;

      await testDb.insert(users).values({
        id: "user_alex_tools",
        name: "Alex",
        email: "alex_tools@ga.com",
        friendCode: "GA-TOOLS1",
        locale: "en",
      });

      await testDb.insert(decks).values({
        id: "deck_tools_1",
        userId: "user_alex_tools",
        name: "Water Diana",
        champion: "Diana",
        format: "standard",
      });

      await testDb.insert(cards).values({
        slug: "tidal-surge",
        name: "Tidal Surge",
        element: "WATER",
        class: "MAGE",
        type: "ATTACK",
        subtypes: JSON.stringify(["MAGE"]),
        effect: "Deal 4 damage and freeze target.",
      });
    });

    it("executes query_official_rules tool and returns rule excerpt to model", async () => {
      process.env.ADVISOR_ALLOWED_EMAILS = "alex_tools@ga.com";

      const mockFetch = vi
        .fn()
        // 1. First model call -> decides to call query_official_rules
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: null,
                  tool_calls: [
                    {
                      id: "call_mcp_1",
                      type: "function",
                      function: {
                        name: "query_official_rules",
                        arguments: JSON.stringify({ query: "Fast timing" }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
        })
        // 2. MCP request -> returns GitBook rulebook search
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () =>
            `event: message\ndata: ${JSON.stringify({
              result: {
                content: [
                  {
                    type: "text",
                    text: "Fast Activation: You may activate this card at fast speed during Opportunity windows.",
                  },
                ],
              },
            })}`,
        })
        // 3. Second model call with tool output -> returns final answer
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: "According to the official rules, Fast cards can be activated during Opportunity.",
                },
              },
            ],
          }),
        });

      const res = await runDeckAdvisorChat(
        "user_alex_tools",
        "alex_tools@ga.com",
        "deck_tools_1",
        [{ role: "user", content: "Can I play Fast cards on opponent turn?" }],
        testDb,
        {
          geminiApiKey: "fake-key",
          customFetch: mockFetch as any,
        }
      );

      expect(res.toolsConsulted).toContain("query_official_rules");
      expect(res.message.toolsUsed).toContain("query_official_rules");
      expect(res.message.content).toContain("Fast cards can be activated");
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("executes search_candidate_pool tool to find unowned catalog cards when splashing an element", async () => {
      process.env.ADVISOR_ALLOWED_EMAILS = "alex_tools@ga.com";

      const mockFetch = vi
        .fn()
        // 1. Model decides to call search_candidate_pool
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: null,
                  tool_calls: [
                    {
                      id: "call_pool_1",
                      type: "function",
                      function: {
                        name: "search_candidate_pool",
                        arguments: JSON.stringify({
                          element: "WATER",
                          includeUnownedCatalog: true,
                        }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
        })
        // 2. Second model call after receiving candidate search results
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: "You could splash Tidal Surge (Water Attack).",
                },
              },
            ],
          }),
        });

      const res = await runDeckAdvisorChat(
        "user_alex_tools",
        "alex_tools@ga.com",
        "deck_tools_1",
        [{ role: "user", content: "What Water cards exist for my deck?" }],
        testDb,
        {
          geminiApiKey: "fake-key",
          customFetch: mockFetch as any,
        }
      );

      expect(res.toolsConsulted).toContain("search_candidate_pool");
      expect(res.message.toolsUsed).toContain("search_candidate_pool");
      expect(res.message.content).toContain("Tidal Surge");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("handles MCP endpoint failure gracefully without crashing conversation", async () => {
      process.env.ADVISOR_ALLOWED_EMAILS = "alex_tools@ga.com";

      const mockFetch = vi
        .fn()
        // 1. Model calls query_official_rules
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: null,
                  tool_calls: [
                    {
                      id: "call_mcp_fail",
                      type: "function",
                      function: {
                        name: "query_official_rules",
                        arguments: JSON.stringify({ query: "Priority" }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
        })
        // 2. MCP network failure (500)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        })
        // 3. Model continues with fallback message
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: "Official rules server is currently unreachable, but generally Priority resolves in turn order.",
                },
              },
            ],
          }),
        });

      const res = await runDeckAdvisorChat(
        "user_alex_tools",
        "alex_tools@ga.com",
        "deck_tools_1",
        [{ role: "user", content: "How does priority work?" }],
        testDb,
        {
          geminiApiKey: "fake-key",
          customFetch: mockFetch as any,
        }
      );

      expect(res.toolsConsulted).toContain("query_official_rules");
      expect(res.message.content).toContain("Priority resolves in turn order");
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("parses and attaches structured swapProposals when LLM recommends swaps", async () => {
      process.env.ADVISOR_ALLOWED_EMAILS = "alex_tools@ga.com";

      const swapBlock = [
        "I suggest replacing Fire Slash with Palvor Sword.",
        "",
        "```json:swap",
        JSON.stringify({
          swaps: [
            {
              id: "swap_1",
              title: "Swap Fire Slash for Palvor Sword",
              rationale: "Synergy with The Looking Glass",
              cuts: [{ cardName: "Fire Slash", zone: "main", quantity: 2 }],
              adds: [
                {
                  cardName: "Palvor Sword",
                  zone: "main",
                  quantity: 2,
                  tier: "binder_available",
                },
              ],
            },
          ],
        }),
        "```",
        "",
        "Let me know if you need any other swaps!",
      ].join("\n");

      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                role: "assistant",
                content: swapBlock,
              },
            },
          ],
        }),
      });

      const res = await runDeckAdvisorChat(
        "user_alex_tools",
        "alex_tools@ga.com",
        "deck_tools_1",
        [{ role: "user", content: "Suggest swaps" }],
        testDb,
        {
          geminiApiKey: "fake-key",
          customFetch: mockFetch as any,
        }
      );

      expect(res.message.swapProposals).toBeDefined();
      expect(res.message.swapProposals).toHaveLength(1);
      const swap = res.message.swapProposals![0];
      expect(swap.title).toBe("Swap Fire Slash for Palvor Sword");
      expect(swap.netImpact).toBe("immediate");
      expect(swap.updatedOmnidexText).toContain("2 Palvor Sword");
      expect(res.message.content).toContain("I suggest replacing Fire Slash with Palvor Sword.");
      expect(res.message.content).not.toContain("```json:swap");
    });

    it("instructs model to respond in pt-BR while keeping Game Nomenclature in English", async () => {
      process.env.ADVISOR_ALLOWED_EMAILS = "alex_tools@ga.com";

      let capturedSystemPrompt = "";
      const mockFetch = vi.fn().mockImplementation(async (_url, init) => {
        const body = JSON.parse(init.body);
        capturedSystemPrompt = body.messages[0].content;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: "Olá! Posso ajudar a tunar o seu deck." } }],
          }),
        };
      });

      await runDeckAdvisorChat(
        "user_alex_tools",
        "alex_tools@ga.com",
        "deck_tools_1",
        [{ role: "user", content: "Como melhorar o deck?" }],
        testDb,
        { geminiApiKey: "fake-key", customFetch: mockFetch as any },
        "pt-BR"
      );

      expect(capturedSystemPrompt).toContain("Respond in Portuguese (pt-BR)");
      expect(capturedSystemPrompt).toContain("Game Nomenclature");
    });

    it("enforces tool_choice: required on the initial turn and grounds core rules taxonomy", async () => {
      process.env.ADVISOR_ALLOWED_EMAILS = "alex_tools@ga.com";

      let capturedToolChoice = "";
      let capturedSystemPrompt = "";

      const mockFetch = vi.fn().mockImplementation(async (_url, init) => {
        const body = JSON.parse(init.body);
        capturedToolChoice = body.tool_choice;
        capturedSystemPrompt = body.messages[0].content;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: "Analysis complete." } }],
          }),
        };
      });

      await runDeckAdvisorChat(
        "user_alex_tools",
        "alex_tools@ga.com",
        "deck_tools_1",
        [{ role: "user", content: "Is Angelic Channeling good?" }],
        testDb,
        { geminiApiKey: "fake-key", customFetch: mockFetch as any }
      );

      expect(capturedToolChoice).toBe("required");
      expect(capturedSystemPrompt).toContain("GRAND ARCHIVE CORE RULES: ELEMENTS TAXONOMY");
      expect(capturedSystemPrompt).toContain("Basic Elements: FIRE, WATER, WIND");
      expect(capturedSystemPrompt).toContain("Advanced Elements: ARCANE, ASTRA, CRUX");
      expect(capturedSystemPrompt).toContain("GRAND ARCHIVE CORE RULES: SPEED & TIMING");
      expect(capturedSystemPrompt).toContain("GRAND ARCHIVE CORE RULES: FLOATING MEMORY & COSTS");
      expect(capturedSystemPrompt).toContain("MANDATORY RULES & SYNERGY VERIFICATION PROTOCOL");
    });
  });
