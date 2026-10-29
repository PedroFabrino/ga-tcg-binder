import { describe, it, expect } from "vitest";
import {
  applySwapToOmnidex,
  computeNetShortageImpact,
  parseSwapProposalsFromLlm,
} from "../deck-advisor-swaps";
import type {
  DeckAdvisorDeckCardSnapshot,
  DeckAdvisorCandidateCard,
} from "@ga/contracts";

describe("Deck Advisor Swaps Engine (Ticket 3 - #188)", () => {
  const mockDeckCards: DeckAdvisorDeckCardSnapshot[] = [
    {
      id: "dc_1",
      cardSlug: "merlin-kingsmaker",
      cardName: "Merlin, Kingsmaker",
      zone: "material",
      quantity: 1,
      element: "FIRE",
      class: "MAGE",
      type: "CHAMPION",
      subtypes: ["MAGE"],
      effect: "",
      costReserve: null,
      costMemory: 0,
      speed: false,
      hardShortage: 0,
      sharedShortage: 0,
    },
    {
      id: "dc_2",
      cardSlug: "the-looking-glass",
      cardName: "The Looking Glass",
      zone: "material",
      quantity: 1,
      element: "NORM",
      class: "ALL",
      type: "ITEM",
      subtypes: ["RELIC"],
      effect: "Ignore the elemental requirements of Distortion cards you play.",
      costReserve: null,
      costMemory: 0,
      speed: false,
      hardShortage: 0,
      sharedShortage: 0,
    },
    {
      id: "dc_3",
      cardSlug: "fire-slash",
      cardName: "Fire Slash",
      zone: "main",
      quantity: 4,
      element: "FIRE",
      class: "WARRIOR",
      type: "ACTION",
      subtypes: [],
      effect: "Deal 3 damage.",
      costReserve: 2,
      costMemory: null,
      speed: true,
      hardShortage: 0,
      sharedShortage: 0,
    },
    {
      id: "dc_4",
      cardSlug: "flame-burst",
      cardName: "Flame Burst",
      zone: "main",
      quantity: 2,
      element: "FIRE",
      class: "MAGE",
      type: "SPELL",
      subtypes: [],
      effect: "Deal 4 damage.",
      costReserve: 3,
      costMemory: null,
      speed: false,
      hardShortage: 0,
      sharedShortage: 0,
    },
    {
      id: "dc_5",
      cardSlug: "dispel",
      cardName: "Dispel",
      zone: "side",
      quantity: 2,
      element: "NORM",
      class: "ALL",
      type: "ACTION",
      subtypes: [],
      effect: "Negate target spell.",
      costReserve: 2,
      costMemory: null,
      speed: true,
      hardShortage: 0,
      sharedShortage: 0,
    },
  ];

  describe("Omnidex Transformation Math (applySwapToOmnidex)", () => {
    it("handles partial cut and addition in Main Deck while preserving untouched zones", () => {
      const swap = {
        cuts: [{ cardName: "Fire Slash", zone: "main" as const, quantity: 2 }],
        adds: [
          {
            cardName: "Palvor Sword",
            zone: "main" as const,
            quantity: 2,
            tier: "binder_available" as const,
          },
        ],
      };

      const result = applySwapToOmnidex(mockDeckCards, swap);

      expect(result).toContain("# Material Deck\n1 Merlin, Kingsmaker\n1 The Looking Glass");
      expect(result).toContain("2 Fire Slash"); // Cut from 4 to 2
      expect(result).toContain("2 Flame Burst"); // Untouched
      expect(result).toContain("2 Palvor Sword"); // Added
      expect(result).toContain("# Sideboard\n2 Dispel"); // Untouched
    });

    it("completely removes card when cut quantity equals or exceeds existing quantity", () => {
      const swap = {
        cuts: [{ cardName: "Flame Burst", zone: "main" as const, quantity: 2 }],
        adds: [
          {
            cardName: "Ignite",
            zone: "main" as const,
            quantity: 2,
            tier: "binder_available" as const,
          },
        ],
      };

      const result = applySwapToOmnidex(mockDeckCards, swap);

      expect(result).not.toContain("Flame Burst");
      expect(result).toContain("2 Ignite");
    });

    it("increments quantity when adding copies of an already existing card", () => {
      const swap = {
        cuts: [{ cardName: "Flame Burst", zone: "main" as const, quantity: 2 }],
        adds: [
          {
            cardName: "Fire Slash",
            zone: "main" as const,
            quantity: 2,
            tier: "binder_available" as const,
          },
        ],
      };

      const result = applySwapToOmnidex(mockDeckCards, swap);

      expect(result).toContain("6 Fire Slash"); // 4 + 2
      expect(result).not.toContain("Flame Burst");
    });

    it("modifies Sideboard and Material Deck correctly", () => {
      const swap = {
        cuts: [{ cardName: "Dispel", zone: "side" as const, quantity: 1 }],
        adds: [
          {
            cardName: "Grand Crusader Shield",
            zone: "material" as const,
            quantity: 1,
            tier: "store_pullback" as const,
          },
          {
            cardName: "Defensive Stance",
            zone: "side" as const,
            quantity: 1,
            tier: "binder_available" as const,
          },
        ],
      };

      const result = applySwapToOmnidex(mockDeckCards, swap);

      expect(result).toContain("1 Grand Crusader Shield");
      expect(result).toContain("1 Dispel"); // 2 - 1
      expect(result).toContain("1 Defensive Stance");
    });
  });

  describe("Shortage Impact Calculation (computeNetShortageImpact)", () => {
    it("reports immediate when all adds are binder_available", () => {
      const impact = computeNetShortageImpact([
        { cardName: "A", zone: "main", quantity: 2, tier: "binder_available" },
        { cardName: "B", zone: "side", quantity: 1, tier: "binder_available" },
      ]);
      expect(impact).toBe("immediate");
    });

    it("reports store_pullback when any add is store_pullback and none unowned", () => {
      const impact = computeNetShortageImpact([
        { cardName: "A", zone: "main", quantity: 2, tier: "binder_available" },
        { cardName: "B", zone: "side", quantity: 1, tier: "store_pullback" },
      ]);
      expect(impact).toBe("store_pullback");
    });

    it("reports hard_shortage when any add is an unowned upgrade", () => {
      const impact = computeNetShortageImpact([
        { cardName: "A", zone: "main", quantity: 2, tier: "binder_available" },
        { cardName: "B", zone: "side", quantity: 1, tier: "store_pullback" },
        { cardName: "C", zone: "main", quantity: 1, tier: "unowned_upgrade" },
      ]);
      expect(impact).toBe("hard_shortage");
    });
  });

  describe("LLM Swap Proposals Extraction (parseSwapProposalsFromLlm)", () => {
    const candidatePool: DeckAdvisorCandidateCard[] = [
      {
        cardSlug: "palvor-sword",
        cardName: "Palvor Sword",
        element: "ASTRA",
        class: "WARRIOR",
        type: "WEAPON",
        subtypes: ["DISTORTION", "SWORD"],
        costMemory: null,
        costReserve: 2,
        speed: false,
        effect: "Ignored element via Distortion.",
        tier: "binder_available",
        ownedQuantity: 2,
        idleQuantity: 2,
        sharedQuantity: 0,
        storeQuantity: 0,
        unlockedViaReason: "The Looking Glass",
        classBonusActive: false,
      },
      {
        cardSlug: "spirit-blade",
        cardName: "Spirit Blade",
        element: "NORM",
        class: "MAGE",
        type: "WEAPON",
        subtypes: [],
        costMemory: null,
        costReserve: 1,
        speed: false,
        effect: "",
        tier: "store_pullback",
        ownedQuantity: 1,
        idleQuantity: 0,
        sharedQuantity: 0,
        storeQuantity: 1,
        unlockedViaReason: "Element Match",
        classBonusActive: true,
      },
    ];

    it("parses structured json:swap block and strips it from cleanReply", () => {
      const llmOutput = [
        "Based on your setup, The Looking Glass allows you to use Palvor Sword.",
        "",
        "```json:swap",
        JSON.stringify({
          swaps: [
            {
              id: "swap_distortion_1",
              title: "Tech in Palvor Sword for high burst",
              rationale: "Cut 2 Fire Slash to run 2 Palvor Sword for burst potential.",
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
        "This adjustment gives you significant reach without violating deck legality.",
      ].join("\n");

      const { cleanReply, proposals } = parseSwapProposalsFromLlm(
        llmOutput,
        mockDeckCards,
        candidatePool
      );

      expect(cleanReply).toContain("Based on your setup");
      expect(cleanReply).toContain("This adjustment gives you significant reach");
      expect(cleanReply).not.toContain("```json:swap");

      expect(proposals).toHaveLength(1);
      const proposal = proposals[0];
      expect(proposal.id).toBe("swap_distortion_1");
      expect(proposal.title).toBe("Tech in Palvor Sword for high burst");
      expect(proposal.cuts).toEqual([
        { cardName: "Fire Slash", zone: "main", quantity: 2 },
      ]);
      expect(proposal.adds).toEqual([
        {
          cardName: "Palvor Sword",
          zone: "main",
          quantity: 2,
          tier: "binder_available",
        },
      ]);
      expect(proposal.netImpact).toBe("immediate");
      expect(proposal.updatedOmnidexText).toContain("2 Palvor Sword");
      expect(proposal.updatedOmnidexText).toContain("2 Fire Slash");
    });

    it("infers tier from candidate pool if tier is omitted by LLM", () => {
      const llmOutput = [
        "Here is a recommended upgrade:",
        "```json",
        JSON.stringify({
          title: "Add Spirit Blade",
          rationale: "Pull 1 Spirit Blade from your MyP store listing.",
          cuts: [{ cardName: "Flame Burst", zone: "main", quantity: 1 }],
          adds: [{ cardName: "Spirit Blade", zone: "main", quantity: 1 }],
        }),
        "```",
      ].join("\n");

      const { proposals } = parseSwapProposalsFromLlm(
        llmOutput,
        mockDeckCards,
        candidatePool
      );

      expect(proposals).toHaveLength(1);
      expect(proposals[0].adds[0].tier).toBe("store_pullback");
      expect(proposals[0].netImpact).toBe("store_pullback");
    });

    it("marks unknown cards as unowned_upgrade and hard_shortage", () => {
      const llmOutput = [
        "```json:swap",
        JSON.stringify({
          title: "Add Grand Crusader Shield",
          cuts: [{ cardName: "Flame Burst", zone: "main", quantity: 1 }],
          adds: [{ cardName: "Grand Crusader Shield", zone: "material", quantity: 1 }],
        }),
        "```",
      ].join("\n");

      const { proposals } = parseSwapProposalsFromLlm(
        llmOutput,
        mockDeckCards,
        candidatePool
      );

      expect(proposals).toHaveLength(1);
      expect(proposals[0].adds[0].tier).toBe("unowned_upgrade");
      expect(proposals[0].netImpact).toBe("hard_shortage");
    });

    it("gracefully handles invalid JSON inside code blocks", () => {
      const llmOutput = "```json\n{ not valid json\n```\nHere is your advice.";
      const { cleanReply, proposals } = parseSwapProposalsFromLlm(
        llmOutput,
        mockDeckCards,
        candidatePool
      );

      expect(proposals).toHaveLength(0);
      expect(cleanReply).toBe(llmOutput);
    });
  });
});
