import { searchCatalogCards, type DeckAdvisorRawUserData } from "../db/repositories/deck-advisor-repository";
import { queryOfficialRulesMcp } from "./deck-advisor-mcp";

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
  tier: "binder_available" | "store_pullback" | "unowned_upgrade";
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
 * Executes search_candidate_pool tool.
 */
export async function executeSearchCandidatePoolTool(
  args: SearchCandidatePoolArgs,
  userData: DeckAdvisorRawUserData,
  database?: any
): Promise<SearchCandidatePoolResultItem[]> {
  const limit = Math.min(args.limit || 10, 25);
  const results: SearchCandidatePoolResultItem[] = [];

  // 1. Group owned cards by slug
  const inventoryBySlug = new Map<string, typeof userData.inventory[0] & { totalQty: number }>();
  for (const inv of userData.inventory) {
    const existing = inventoryBySlug.get(inv.cardSlug);
    if (existing) {
      existing.totalQty += inv.quantity;
    } else {
      inventoryBySlug.set(inv.cardSlug, { ...inv, totalQty: inv.quantity });
    }
  }

  // 2. Store listings by slug
  const storeBySlug = new Map<string, number>();
  for (const s of userData.storeListings) {
    if (s.cardSlug) {
      storeBySlug.set(s.cardSlug, (storeBySlug.get(s.cardSlug) || 0) + s.quantity);
    }
  }

  // 3. Search owned items
  for (const inv of Array.from(inventoryBySlug.values())) {
    if (args.element && inv.element.toUpperCase() !== args.element.toUpperCase()) {
      continue;
    }
    if (args.cardClass && inv.class.toUpperCase() !== args.cardClass.toUpperCase()) {
      continue;
    }
    if (args.cardType && inv.type.toUpperCase() !== args.cardType.toUpperCase()) {
      continue;
    }

    let parsedSubtypes: string[] = [];
    try {
      parsedSubtypes = JSON.parse(inv.subtypes || "[]");
    } catch {
      parsedSubtypes = [];
    }

    if (args.subtype) {
      const matchSubtype = parsedSubtypes.some(
        (st) => st.toUpperCase() === args.subtype?.toUpperCase()
      );
      if (!matchSubtype) continue;
    }

    if (args.keyword) {
      const q = args.keyword.toLowerCase();
      const matchName = inv.name.toLowerCase().includes(q);
      const matchEffect = (inv.effect || "").toLowerCase().includes(q);
      if (!matchName && !matchEffect) continue;
    }

    const storeQty = storeBySlug.get(inv.cardSlug) || 0;
    const tier = inv.totalQty > 0 ? "binder_available" : "store_pullback";

    results.push({
      cardSlug: inv.cardSlug,
      cardName: inv.name,
      element: inv.element,
      class: inv.class,
      type: inv.type,
      subtypes: parsedSubtypes,
      effect: inv.effect || "",
      costReserve: inv.costReserve,
      costMemory: inv.costMemory,
      speed: inv.speed ? "Fast" : "Slow",
      tier,
      ownedQuantity: inv.totalQty,
      idleQuantity: inv.totalQty,
      sharedQuantity: inv.totalQty,
      storeQuantity: storeQty,
    });

    if (results.length >= limit) return results;
  }

  // 4. If includeUnownedCatalog is true and under limit, query global catalog
  if (args.includeUnownedCatalog && results.length < limit) {
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

      let parsedSubtypes: string[] = [];
      try {
        parsedSubtypes = JSON.parse(cat.subtypes || "[]");
      } catch {
        parsedSubtypes = [];
      }

      if (args.subtype) {
        const matchSubtype = parsedSubtypes.some(
          (st) => st.toUpperCase() === args.subtype?.toUpperCase()
        );
        if (!matchSubtype) continue;
      }

      const storeQty = storeBySlug.get(cat.slug) || 0;
      const tier = storeQty > 0 ? "store_pullback" : "unowned_upgrade";

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
        tier,
        ownedQuantity: 0,
        idleQuantity: 0,
        sharedQuantity: 0,
        storeQuantity: storeQty,
      });

      if (results.length >= limit) break;
    }
  }

  return results;
}

/**
 * Dispatches a tool call by name.
 */
export async function dispatchDeckAdvisorTool(
  name: string,
  args: any,
  context: {
    userData: DeckAdvisorRawUserData;
    rulesMcpUrl?: string;
    customFetch?: typeof fetch;
    database?: any;
  }
): Promise<{ toolName: string; result: any }> {
  if (name === "query_official_rules") {
    const rulesRes = await queryOfficialRulesMcp(
      args.query || "",
      context.rulesMcpUrl,
      context.customFetch
    );
    return { toolName: name, result: rulesRes.text };
  }

  if (name === "search_candidate_pool") {
    const poolRes = await executeSearchCandidatePoolTool(
      args,
      context.userData,
      context.database
    );
    return { toolName: name, result: poolRes };
  }

  return { toolName: name, result: `Unknown tool: ${name}` };
}
