import {
  getDeckAdvisorDeckData,
  getDeckAdvisorUserData,
  getDeckAdvisorMetaBenchmarks,
} from "../db/repositories/deck-advisor-repository";
import {
  assembleDeckAdvisorContext,
  isUserAdvisorAllowlisted,
} from "./deck-advisor-context";
import {
  DECK_ADVISOR_TOOLS_DECLARATIONS,
  dispatchDeckAdvisorTool,
} from "./deck-advisor-tools";
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
}

/**
 * Builds the system prompt grounding the model in the selected Deck & Candidate Pool.
 */
export function buildDeckAdvisorSystemPrompt(context: DeckAdvisorContextSnapshot): string {
  const cardsJson = JSON.stringify(
    context.deckCards.map((c) => ({
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
    })),
    null,
    2
  );

  const candidateJson = JSON.stringify(
    context.candidatePool.map((c) => ({
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
    })),
    null,
    2
  );

  return [
    "You are the expert Grand Archive TCG Deck Advisor and referee.",
    "Rules and card effects are absolute. Never hallucinate card text, costs, or inventory quantities.",
    `Selected Deck: "${context.deckName}" (Champion: ${context.champion || "Unknown"}, Format: ${context.format}).`,
    `Unlocked Elements: ${context.unlockedElements.join(", ")}.`,
    context.bypassedSubtypes.length > 0
      ? `Effect-Driven Legality Bypasses: ${context.bypassedSubtypes.map((b) => `${b.subtype} (via ${b.unlockedByCard})`).join(", ")}.`
      : "No subtype legality bypasses present.",
    `Active Champion Classes: ${context.activeChampionClasses.join(", ") || "None"}. Note: Off-class cards are legal for base effects if elemental requirements are met, but do not activate [Class Bonus].`,
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
  ].join("\n");
}

/**
 * Runs conversation with multi-step tool call loop.
 */
async function executeLlmWithToolLoop(
  endpoint: string,
  headers: Record<string, string>,
  bodyParams: { model: string; temperature: number },
  initialMessages: any[],
  toolContext: {
    userData: any;
    rulesMcpUrl?: string;
    customFetch: typeof fetch;
    database?: any;
    maxToolSteps: number;
  }
): Promise<{ reply: string; toolsConsulted: string[] }> {
  const messages = [...initialMessages];
  const toolsConsulted: string[] = [];
  const maxSteps = toolContext.maxToolSteps;

  for (let step = 0; step < maxSteps; step++) {
    const res = await toolContext.customFetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...bodyParams,
        messages,
        tools: DECK_ADVISOR_TOOLS_DECLARATIONS,
        tool_choice: "auto",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      const err = new Error(`LLM call failed with status ${res.status}: ${errText}`);
      (err as any).status = res.status;
      throw err;
    }

    const json = await res.json();
    const choice = json.choices?.[0];
    const message = choice?.message;

    if (!message) {
      throw new Error("No message choice returned from LLM");
    }

    // Check if model called tools
    const toolCalls = message.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      return {
        reply: message.content || "",
        toolsConsulted: Array.from(new Set(toolsConsulted)),
      };
    }

    // Append assistant's tool-call request to messages
    messages.push(message);

    // Execute tool calls
    for (const toolCall of toolCalls) {
      const name = toolCall.function?.name;
      let args = {};
      try {
        args = JSON.parse(toolCall.function?.arguments || "{}");
      } catch {
        args = {};
      }

      toolsConsulted.push(name);
      const execution = await dispatchDeckAdvisorTool(name, args, {
        userData: toolContext.userData,
        rulesMcpUrl: toolContext.rulesMcpUrl,
        customFetch: toolContext.customFetch,
        database: toolContext.database,
      });

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content:
          typeof execution.result === "string"
            ? execution.result
            : JSON.stringify(execution.result),
      });
    }
  }

  // Final fallback call without tools if max steps reached
  const finalRes = await toolContext.customFetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...bodyParams,
      messages,
    }),
  });

  if (!finalRes.ok) {
    throw new Error(`Final LLM call failed with status ${finalRes.status}`);
  }

  const finalJson = await finalRes.json();
  const reply = finalJson.choices?.[0]?.message?.content || "";
  return {
    reply,
    toolsConsulted: Array.from(new Set(toolsConsulted)),
  };
}

/**
 * Executes a turn of Deck Advisor chat with tool-calling loop and OmniRoute fallback.
 */
export async function runDeckAdvisorChat(
  userId: string,
  userEmail: string | null | undefined,
  deckId: string,
  messages: DeckAdvisorMessage[],
  database?: any,
  options: DeckAdvisorLlmOptions = {}
): Promise<DeckAdvisorChatResponse> {
  const customFetch = options.customFetch || fetch;
  const maxToolSteps = options.maxToolSteps || 4;

  // 1. Gating
  if (!isUserAdvisorAllowlisted({ id: userId, email: userEmail })) {
    throw new Error("UNAUTHORIZED_ADVISOR_ACCESS");
  }

  // 2. Fetch data
  const [deckData, userData, metaBenchmarks] = await Promise.all([
    getDeckAdvisorDeckData(deckId, database),
    getDeckAdvisorUserData(userId, database),
    getDeckAdvisorMetaBenchmarks(database),
  ]);

  if (!deckData) {
    throw new Error(`DECK_NOT_FOUND: ${deckId}`);
  }

  const context = assembleDeckAdvisorContext({
    deckData,
    userData,
    metaBenchmarks,
  });

  const systemPrompt = buildDeckAdvisorSystemPrompt(context);
  const conversation = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const geminiApiKey = options.geminiApiKey || process.env.GEMINI_API_KEY || "";
  const geminiModel = options.geminiModel || process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const geminiBaseUrl =
    options.geminiBaseUrl ||
    process.env.GEMINI_BASE_URL ||
    "https://generativelanguage.googleapis.com/v1beta/openai";

  const omnirouteUrl = options.omnirouteUrl || process.env.OMNIROUTE_URL || "http://localhost:20128/v1";
  const omnirouteModel = options.omnirouteModel || "combo/auto-fallback";
  const rulesMcpUrl = options.rulesMcpUrl || process.env.GA_RULES_MCP_URL;

  const toolContext = {
    userData,
    rulesMcpUrl,
    customFetch,
    database,
    maxToolSteps,
  };

  // Try Primary (Gemini)
  let fallbackActivated = false;
  let providerUsed: "gemini" | "omniroute" = "gemini";
  let modelUsed = geminiModel;

  if (geminiApiKey) {
    try {
      const outcome = await executeLlmWithToolLoop(
        `${geminiBaseUrl}/chat/completions`,
        {
          "Content-Type": "application/json",
          Authorization: `Bearer ${geminiApiKey}`,
        },
        { model: geminiModel, temperature: 0.2 },
        conversation,
        toolContext
      );

      return {
        message: {
          role: "assistant",
          content: outcome.reply,
          toolsUsed: outcome.toolsConsulted,
        },
        fallbackActivated: false,
        providerUsed: "gemini",
        modelUsed: geminiModel,
        toolsConsulted: outcome.toolsConsulted,
      };
    } catch (e: any) {
      if (e.status === 429) {
        console.warn("[DeckAdvisor] Gemini API HTTP 429 encountered. Activating OmniRoute fallback.");
      } else {
        console.warn(`[DeckAdvisor] Gemini API failed: ${e.message}. Falling back.`);
      }
      fallbackActivated = true;
    }
  } else {
    fallbackActivated = true;
  }

  // Fallback to OmniRoute
  providerUsed = "omniroute";
  modelUsed = omnirouteModel;

  const outcome = await executeLlmWithToolLoop(
    `${omnirouteUrl}/chat/completions`,
    { "Content-Type": "application/json" },
    { model: omnirouteModel, temperature: 0.2 },
    conversation,
    toolContext
  );

  return {
    message: {
      role: "assistant",
      content: outcome.reply,
      toolsUsed: outcome.toolsConsulted,
    },
    fallbackActivated: true,
    providerUsed: "omniroute",
    modelUsed: omnirouteModel,
    toolsConsulted: outcome.toolsConsulted,
  };
}
