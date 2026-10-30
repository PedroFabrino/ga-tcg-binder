import {
  getDeckAdvisorDeckData,
  getDeckAdvisorUserData,
  getDeckAdvisorMetaBenchmarks,
  type DeckAdvisorDatabase,
} from "../db/repositories/deck-advisor-repository";
import {
  assembleDeckAdvisorContext,
  isUserAdvisorAllowlisted,
} from "./deck-advisor-context";
import {
  executeLlmWithToolLoop,
  LlmHttpError,
  type LlmChatMessage,
} from "./deck-advisor-llm";
import { parseSwapProposalsFromLlm } from "./deck-advisor-swaps";
import type {
  DeckAdvisorContextSnapshot,
  DeckAdvisorMessage,
  DeckAdvisorChatResponse,
} from "@ga/contracts";

export interface DeckAdvisorLlmOptions {
  geminiApiKey?: string;
  geminiModel?: string;
  geminiBaseUrl?: string;
  omnirouteUrl?: string;
  omnirouteModel?: string;
  rulesMcpUrl?: string;
  customFetch?: typeof fetch;
  maxToolSteps?: number;
  requireToolOnFirstStep?: boolean;
}

/**
 * Builds the system prompt grounding the model in the selected Deck & Candidate Pool.
 */
export function buildDeckAdvisorSystemPrompt(
  context: DeckAdvisorContextSnapshot,
  locale: "en" | "pt-BR" = "en"
): string {
  const cardsJson = context.deckCards
    .map((c) =>
      JSON.stringify({
        name: c.cardName,
        zone: c.zone,
        qty: c.quantity,
        costMemory: c.costMemory,
        costReserve: c.costReserve,
        speed: c.speed ? "Fast" : "Slow",
        element: c.element,
        class: c.class,
        subtypes: c.subtypes,
        effect: c.effect,
        hardShortage: c.hardShortage,
        sharedShortage: c.sharedShortage,
      })
    )
    .join("\n");

  const candidateJson = context.candidatePool
    .map((c) =>
      JSON.stringify({
        name: c.cardName,
        element: c.element,
        class: c.class,
        type: c.type,
        subtypes: c.subtypes,
        costMemory: c.costMemory,
        costReserve: c.costReserve,
        speed: c.speed ? "Fast" : "Slow",
        tier: c.tier,
        idleQty: c.idleQuantity,
        sharedQty: c.sharedQuantity,
        storeQty: c.storeQuantity,
        unlockedVia: c.unlockedViaReason,
        classBonusActive: c.classBonusActive,
        effect: c.effect,
      })
    )
    .join("\n");

  const localeInstruction =
    locale === "pt-BR"
      ? "Respond in Portuguese (pt-BR), while keeping official Grand Archive Game Nomenclature (Card names, Elements, Rarities, Deck zones Main Deck / Material Deck / Sideboard, and Finishes Foil / Normal) in canonical English."
      : "Respond in English.";

  return [
    "You are the expert Grand Archive TCG Deck Advisor and referee.",
    "Rules and card effects are absolute. Never hallucinate card text, costs, or inventory quantities.",
    localeInstruction,
    `Selected Deck: "${context.deckName}" (Champion: ${context.champion || "Unknown"}, Format: ${context.format}).`,
    `Unlocked Elements: ${context.unlockedElements.join(", ")}.`,
    context.bypassedSubtypes.length > 0
      ? `Effect-Driven Legality Bypasses: ${context.bypassedSubtypes.map((b) => `${b.subtype} (via ${b.unlockedByCard})`).join(", ")}.`
      : "No subtype legality bypasses present.",
    `Active Champion Classes: ${context.activeChampionClasses.join(", ") || "None"}. Note: Off-class cards are legal for base effects if elemental requirements are met, but do not activate [Class Bonus].`,
    "",
    "--- GRAND ARCHIVE CORE RULES: ELEMENTS TAXONOMY ---",
    "- Non-Elemental / Special: NORM",
    "- Basic Elements: FIRE, WATER, WIND",
    "- Advanced Elements: ARCANE, ASTRA, CRUX, EXALTED, EXIA, LUXEM, NEOS, TERA, UMBRA",
    "- MANDATORY: Effects or cards checking for 'Advanced cards' or 'Advanced elements' strictly check for the 9 Advanced Elements above. FIRE, WATER, WIND, and NORM are Basic/Non-Elemental and are NEVER Advanced Elements.",
    "",
    "--- GRAND ARCHIVE CORE RULES: SPEED & TIMING ---",
    "- Slow: Can only be played/activated during your Main Phase when the Effects Stack is empty and you have turn priority.",
    "- Fast: Can be played/activated during Opportunity windows (in response to actions, spells, attacks, or during turn phase steps).",
    "",
    "--- GRAND ARCHIVE CORE RULES: FLOATING MEMORY & COSTS ---",
    "- Floating Memory: A static keyword ability on cards meaning: 'While paying for a memory cost, you may banish this card from your graveyard to pay for 1 of that cost.'",
    "- Floating Memory ONLY pays for memory costs (such as materialization costs from the Material Deck).",
    "- Floating Memory does NOT pay for reserve costs, cannot be banished at will outside of paying a memory cost, and does NOT generate level counters or other benefits on its own.",
    "",
    "--- MANDATORY RULES & SYNERGY VERIFICATION PROTOCOL ---",
    "1. Before providing gameplay analysis, card legality, or swap recommendations, you MUST verify rules and synergy definitions via tools (`query_official_rules` or `search_candidate_pool`).",
    "2. NEVER guess, assume, or hallucinate rules definitions or keywords from other TCGs.",
    "",
    "--- CURRENT DECKLIST ---",
    cardsJson,
    "",
    "--- CANDIDATE POOL (OWNED CARDS AVAILABLE TO SWAP) ---",
    candidateJson,
    "",
    context.metaComparison
      ? `--- META BENCHMARK (${context.metaComparison.archetypeName} - ${context.metaComparison.tier}) ---\nWin Rate: ${context.metaComparison.winRate}, Share Rate: ${context.metaComparison.shareRate}.\nMissing Staples: ${JSON.stringify(context.metaComparison.missingStaples)}`
      : "",
    "",
    "Instructions:",
    "1. When recommending swaps, clearly cite the card acquisition tier: Tier 1 (Binder Available: Idle or Shared), Tier 2 (Store Listing Pull-Back), or Tier 3 (Unowned upgrade creating a Hard Shortage).",
    "2. Be concise, strategic, and accurate regarding Memory vs. Reserve costs, Lineage, and Timing (Slow vs. Fast).",
    "3. You have tools:",
    "   - query_official_rules: Check timing windows, phase structures, or keyword rulings in the official rules.",
    "   - search_candidate_pool: Search the Collector's full 1,000+ card collection or global catalog for off-element splashes, specific subtypes, or unowned upgrades.",
    "4. When recommending card swaps (cuts and additions), always output a structured JSON block formatted as:",
    "```json:swap",
    JSON.stringify(
      {
        swaps: [
          {
            title: "Swap Title",
            rationale: "Strategic explanation",
            cuts: [{ cardName: "Card A", zone: "main", quantity: 1 }],
            adds: [
              {
                cardName: "Card B",
                zone: "main",
                quantity: 1,
                tier: "binder_available",
              },
            ],
          },
        ],
      },
      null,
      2
    ),
    "```",
  ].join("\n");
}

/**
 * Formats LLM outcome into a unified DeckAdvisorChatResponse.
 */
function formatAdvisorResponse(
  outcome: { reply: string; toolsConsulted: string[] },
  context: DeckAdvisorContextSnapshot,
  fallbackActivated: boolean,
  providerUsed: "gemini" | "omniroute",
  modelUsed: string
): DeckAdvisorChatResponse {
  const { cleanReply, proposals } = parseSwapProposalsFromLlm(
    outcome.reply,
    context.deckCards,
    context.candidatePool
  );

  return {
    message: {
      role: "assistant",
      content: cleanReply || outcome.reply,
      toolsUsed: outcome.toolsConsulted,
      swapProposals: proposals.length > 0 ? proposals : undefined,
    },
    fallbackActivated,
    providerUsed,
    modelUsed,
    toolsConsulted: outcome.toolsConsulted,
  };
}

/**
 * Main chat turn orchestrator for the Deck Advisor.
 */
export async function runDeckAdvisorChat(
  userId: string,
  userEmail: string | undefined | null,
  deckId: string,
  userMessages: DeckAdvisorMessage[],
  database?: DeckAdvisorDatabase,
  options?: DeckAdvisorLlmOptions,
  locale: "en" | "pt-BR" = "en"
): Promise<DeckAdvisorChatResponse> {
  // 1. Check Allowlist Gate
  if (!isUserAdvisorAllowlisted({ id: userId, email: userEmail })) {
    throw new Error("UNAUTHORIZED_ADVISOR_ACCESS: User is not allowlisted for the Deck Advisor.");
  }

  // 2. Load Deck, Inventory, Store Listings, & Meta Benchmarks in parallel
  const [deckData, userData, metaBenchmarks] = await Promise.all([
    getDeckAdvisorDeckData(deckId, database),
    getDeckAdvisorUserData(userId, database),
    getDeckAdvisorMetaBenchmarks(database),
  ]);

  if (!deckData) {
    throw new Error(`DECK_NOT_FOUND: Deck with id "${deckId}" was not found.`);
  }

  // 3. Assemble Context
  const context = assembleDeckAdvisorContext({
    deckData,
    userData,
    metaBenchmarks,
  });

  // 4. Build Conversation History
  const systemPrompt = buildDeckAdvisorSystemPrompt(context, locale);
  const conversation: LlmChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...userMessages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  // 5. Execute LLM with Fallback
  const geminiApiKey = options?.geminiApiKey ?? process.env.GEMINI_API_KEY;
  const configuredModel = options?.geminiModel ?? process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";
  const geminiBaseUrl =
    options?.geminiBaseUrl ??
    process.env.GEMINI_BASE_URL ??
    "https://generativelanguage.googleapis.com/v1beta/openai";

  const omnirouteUrl =
    options?.omnirouteUrl ?? process.env.OMNIROUTE_URL ?? "http://localhost:20128/v1";
  const omnirouteModel =
    options?.omnirouteModel ?? process.env.OMNIROUTE_MODEL ?? "combo/auto-fallback";

  const toolContext = {
    userData,
    rulesMcpUrl: options?.rulesMcpUrl ?? process.env.GA_RULES_MCP_URL,
    customFetch: options?.customFetch ?? fetch,
    database,
    maxToolSteps: options?.maxToolSteps ?? 3,
    requireToolOnFirstStep: options?.requireToolOnFirstStep ?? true,
  };

  if (geminiApiKey) {
    const candidateModels = [
      configuredModel,
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
    ].filter((m, i, arr) => arr.indexOf(m) === i);

    for (const modelToTry of candidateModels) {
      try {
        const outcome = await executeLlmWithToolLoop(
          `${geminiBaseUrl}/chat/completions`,
          {
            "Content-Type": "application/json",
            Authorization: `Bearer ${geminiApiKey}`,
          },
          { model: modelToTry, temperature: 0.2, reasoning_effort: "low" },
          conversation,
          toolContext
        );

        return formatAdvisorResponse(outcome, context, false, "gemini", modelToTry);
      } catch (e: unknown) {
        const isRateLimit = e instanceof LlmHttpError && e.status === 429;
        const message = e instanceof Error ? e.message : String(e);
        if (isRateLimit) {
          console.warn("[DeckAdvisor] Gemini API HTTP 429 encountered. Activating OmniRoute fallback.");
          break;
        }
        console.warn(`[DeckAdvisor] Gemini model ${modelToTry} failed: ${message}. Trying next fallback.`);
      }
    }
  }

  // Fallback to OmniRoute
  const outcome = await executeLlmWithToolLoop(
    `${omnirouteUrl}/chat/completions`,
    { "Content-Type": "application/json" },
    { model: omnirouteModel, temperature: 0.2 },
    conversation,
    toolContext
  );

  return formatAdvisorResponse(outcome, context, true, "omniroute", omnirouteModel);
}
