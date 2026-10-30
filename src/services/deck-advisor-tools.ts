import {
  searchCatalogCards,
  type DeckAdvisorRawUserData,
  type DeckAdvisorDatabase,
} from "../db/repositories/deck-advisor-repository";
import { queryOfficialRulesMcp } from "./deck-advisor-mcp";
import {
  aggregateUserHoldingsBySlug,
  parseCardSubtypes,
} from "./deck-advisor-inventory";
import type { DeckAdvisorAcquisitionTier } from "@ga/contracts";

export interface SearchCandidatePoolArgs {
  element?: string;
  subtype?: string;
  cardClass?: string;
  cardType?: string;
  keyword?: string;
  includeUnownedCatalog?: boolean;
  limit?: number;
}

export interface SearchCandidatePoolResultItem {
  cardSlug: string;
  cardName: string;
  element: string;
  class: string;
  type: string;
  subtypes: string[];
  effect: string;
  costReserve: number | null;
  costMemory: number | null;
  speed: string;
  tier: DeckAdvisorAcquisitionTier;
  ownedQuantity: number;
  idleQuantity: number;
  sharedQuantity: number;
  storeQuantity: number;
}

export const DECK_ADVISOR_TOOLS_DECLARATIONS = [
  {
    type: "function",
    function: {
      name: "query_official_rules",
      description:
        "Queries the official Grand Archive Comprehensive Rules (via official GitBook MCP). Call this whenever checking timing windows (Slow vs Fast speed), phase structures (Materialize Phase, Recollection Step, Draw Step, Main Phase, End Phase), priority, Opportunity, keyword abilities (Omnishroud, Floating Memory, Class Bonus), or rule interactions.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The rules concept, timing window, keyword, or phase to query in the rulebook.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_candidate_pool",
      description:
        "Queries the Collector's full 1,000+ card physical collection, personal store listings, and the global Card Catalog. Use this when the Collector asks about splashing a new Element, changing their Champion lineage, searching by specific subtype (e.g. DISTORTION, SWORD), or exploring unowned tech options.",
      parameters: {
        type: "object",
        properties: {
          element: {
            type: "string",
            description: "Filter by Element (e.g. FIRE, WATER, WIND, ASTRA, UMBRA, CRUX, NORM).",
          },
          subtype: {
            type: "string",
            description: "Filter by subtype (e.g. DISTORTION, SWORD, ACCESSORY, SKILL, SPELL).",
          },
          cardClass: {
            type: "string",
            description: "Filter by class (e.g. WARRIOR, MAGE, RANGER, GUARDIAN, CLERIC, ASSASSIN).",
          },
          cardType: {
            type: "string",
            description: "Filter by card type (e.g. CHAMPION, ATTACK, ACTION, ITEM, ALLY).",
          },
          keyword: {
            type: "string",
            description: "Search keyword matching card name or effect text.",
          },
          includeUnownedCatalog: {
            type: "boolean",
            description: "If true, also searches unowned cards from the global Card Catalog to suggest upgrades.",
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return (default 10).",
          },
        },
      },
    },
  },
];

/**
 * Executes search_candidate_pool tool across both Binder copies and Store Listings.
 */
export async function executeSearchCandidatePoolTool(
  args: SearchCandidatePoolArgs,
  userData: DeckAdvisorRawUserData,
  database?: DeckAdvisorDatabase
): Promise<SearchCandidatePoolResultItem[]> {
  const limit = Math.min(args.limit || 10, 25);
  const results: SearchCandidatePoolResultItem[] = [];

  // Group user holdings across collection items and personal store listings
  const holdings = aggregateUserHoldingsBySlug(userData);

  for (const item of Array.from(holdings.values())) {
    if (args.element && item.element.toUpperCase() !== args.element.toUpperCase()) {
      continue;
    }
    if (args.cardClass && item.class.toUpperCase() !== args.cardClass.toUpperCase()) {
      continue;
    }
    if (args.cardType && item.type.toUpperCase() !== args.cardType.toUpperCase()) {
      continue;
    }

    if (args.subtype) {
      const matchSubtype = item.subtypes.some(
        (st) => st.toUpperCase() === args.subtype?.toUpperCase()
      );
      if (!matchSubtype) continue;
    }

    if (args.keyword) {
      const q = args.keyword.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchEffect = (item.effect || "").toLowerCase().includes(q);
      if (!matchName && !matchEffect) continue;
    }

    const tier: DeckAdvisorAcquisitionTier =
      item.ownedQuantity > 0 ? "binder_available" : "store_pullback";

    results.push({
      cardSlug: item.cardSlug,
      cardName: item.name,
      element: item.element,
      class: item.class,
      type: item.type,
      subtypes: item.subtypes,
      effect: item.effect || "",
      costReserve: item.costReserve,
      costMemory: item.costMemory,
      speed: item.speed ? "Fast" : "Slow",
      tier,
      ownedQuantity: item.ownedQuantity,
      idleQuantity: item.idleQuantity,
      sharedQuantity: item.sharedQuantity,
      storeQuantity: item.storeQuantity,
    });

    if (results.length >= limit) return results;
  }

  // If includeUnownedCatalog is not explicitly false and under limit, query global catalog
  const shouldIncludeCatalog = args.includeUnownedCatalog !== false;
  if (shouldIncludeCatalog && results.length < limit) {
    const catalogCards = await searchCatalogCards(
      {
        element: args.element,
        cardClass: args.cardClass,
        cardType: args.cardType,
        keyword: args.keyword,
        limit: limit - results.length,
      },
      database
    );

    for (const cat of catalogCards) {
      if (results.some((r) => r.cardSlug === cat.slug)) continue;

      const parsedSubtypes = parseCardSubtypes(cat.subtypes, cat.name);
      if (args.subtype) {
        const matchSubtype = parsedSubtypes.some(
          (st) => st.toUpperCase() === args.subtype?.toUpperCase()
        );
        if (!matchSubtype) continue;
      }

      results.push({
        cardSlug: cat.slug,
        cardName: cat.name,
        element: cat.element,
        class: cat.class,
        type: cat.type,
        subtypes: parsedSubtypes,
        effect: cat.effect || "",
        costReserve: cat.costReserve,
        costMemory: cat.costMemory,
        speed: cat.speed ? "Fast" : "Slow",
        tier: "unowned_upgrade",
        ownedQuantity: 0,
        idleQuantity: 0,
        sharedQuantity: 0,
        storeQuantity: 0,
      });

      if (results.length >= limit) break;
    }
  }

  return results;
}

export type DeckAdvisorToolResult =
  | { toolName: "query_official_rules"; result: string }
  | { toolName: "search_candidate_pool"; result: SearchCandidatePoolResultItem[] }
  | { toolName: string; result: string };

/**
 * Dispatches a tool call by name.
 */
export async function dispatchDeckAdvisorTool(
  name: string,
  args: Record<string, unknown>,
  context: {
    userData: DeckAdvisorRawUserData;
    rulesMcpUrl?: string;
    customFetch?: typeof fetch;
    database?: DeckAdvisorDatabase;
  }
): Promise<DeckAdvisorToolResult> {
  if (name === "query_official_rules") {
    const query = typeof args.query === "string" ? args.query : "";
    const rulesRes = await queryOfficialRulesMcp(
      query,
      context.rulesMcpUrl,
      context.customFetch
    );
    return { toolName: "query_official_rules", result: rulesRes.text };
  }

  if (name === "search_candidate_pool") {
    const poolRes = await executeSearchCandidatePoolTool(
      args as SearchCandidatePoolArgs,
      context.userData,
      context.database
    );
    return { toolName: "search_candidate_pool", result: poolRes };
  }

  return { toolName: name, result: `Unknown tool: ${name}` };
}
